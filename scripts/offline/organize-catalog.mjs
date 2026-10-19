import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KavitaApi, applyLibraryPlan, snapshotCatalog } from './organization-api.mjs';
import { proposeLibrarySettings, assertStableCatalog, validateServerUrl, validateBackupRecord, auxiliarySeriesIds } from './organization.mjs';

async function json(file) { return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
async function save(file, data) { await writeFile(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }

async function main() {
    const [mode, server, directory, backupFile] = process.argv.slice(2);
    if (!['plan', 'apply'].includes(mode) || !server || !directory || process.argv.length !== (mode === 'apply' ? 6 : 5)) throw new Error('Uso: organize-catalog.mjs plan|apply URL DIRETORIO_RELATORIO [BACKUP_JSON]');
    const base = validateServerUrl(server).origin;
    const apiKey = process.env.KAVITA_API_KEY?.trim();
    const token = process.env.KAVITA_API_TOKEN?.trim();
    if (!apiKey && !token) throw new Error('Defina KAVITA_API_KEY no ambiente local; não passe credenciais na URL ou argumentos.');
    const api = new KavitaApi(base, { apiKey, token });
    const account = await api.request('/api/account');
    if (!account.roles?.includes('Admin')) throw new Error('A organização exige a conta administrativa.');
    const output = path.resolve(directory);
    if (mode === 'plan') {
        const libraries = await api.request('/api/library/libraries');
        const catalog = await snapshotCatalog(api);
        const entries = libraries.map(before => ({ before, after: proposeLibrarySettings(before, { indexedFiles: catalog.files.filter(file => file.libraryId === before.id) }) }));
        await mkdir(output);
        await save(path.join(output, 'proposal.json'), { version: 1, server: base, entries, catalog });
        console.log('Proposta criada: ' + entries.length + ' bibliotecas, ' + catalog.series.length + ' séries. Nenhuma alteração aplicada.');
        return;
    }
    const plan = await json(path.join(output, 'proposal.json'));
    if (plan.version !== 1 || plan.server !== base || !Array.isArray(plan.entries)) throw new Error('Proposta inválida ou de outro servidor.');
    for (const entry of plan.entries) if (!isDeepStrictEqual(entry.after, proposeLibrarySettings(entry.before, { indexedFiles: plan.catalog.files.filter(file => file.libraryId === entry.before.id) }))) throw new Error('A proposta contém mudanças além das exclusões verificadas.');
    const backup = await json(backupFile);
    validateBackupRecord(backup, base);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(path.dirname(backupFile), backup.file))) hash.update(chunk);
    if (hash.digest('hex') !== backup.sha256.toLowerCase()) throw new Error('Checksum do backup divergente.');
    const beforeApply = await snapshotCatalog(api);
    assertStableCatalog(plan.catalog.files, beforeApply.files);
    await save(path.join(output, 'apply-started.json'), { startedAt: new Date().toISOString(), backup: path.basename(backupFile) });
    const applied = await applyLibraryPlan(api, plan.entries);
    for (const entry of plan.entries) {
        const current = await api.request('/api/library?libraryId=' + entry.before.id);
        await api.request('/api/library/scan?libraryId=' + current.id + '&force=false', { method: 'POST' });
        let done = false;
        for (let n = 0; n < 180; n++) {
            const scanned = await api.request('/api/library?libraryId=' + current.id);
            if (scanned.lastScanned !== current.lastScanned) { done = true; break; }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!done) throw new Error('Scan não concluído; veja o relatório antes de repetir a aplicação.');
    }
    const after = await snapshotCatalog(api);
    await save(path.join(output, 'catalog-after.json'), after);
    assertStableCatalog(beforeApply.files, after.files);
    const libraries = await api.request('/api/library/libraries');
    for (const entry of plan.entries) {
        const current = libraries.find(library => library.id === entry.before.id);
        if (!current || !isDeepStrictEqual(current.excludePatterns, entry.after.excludePatterns)) throw new Error('Exclusões não persistiram.');
    }
    await save(path.join(output, 'auxiliary-review.json'), { seriesIds: auxiliarySeriesIds(after), action: 'review-only' });
    await save(path.join(output, 'result.json'), { applied, existingContentIdsPreserved: true, auxiliarySeriesPendingReview: auxiliarySeriesIds(after).length, seriesBefore: beforeApply.series.length, seriesAfter: after.series.length, finishedAt: new Date().toISOString() });
    console.log('Exclusões aplicadas e reindexadas: IDs do conteúdo existente preservados. Séries: ' + beforeApply.series.length + ' → ' + after.series.length + '.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });