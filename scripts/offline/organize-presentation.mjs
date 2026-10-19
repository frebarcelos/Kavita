import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KavitaApi, snapshotCatalog } from './organization-api.mjs';
import { assertStableCatalog, validateServerUrl, validateBackupRecord } from './organization.mjs';
import { planPresentation, applyPresentation } from './organization-presentation.mjs';

async function json(file) {
    return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
}

async function save(file, value) {
    await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

async function main() {
    const [mode, server, directory, backupFile] = process.argv.slice(2);
    if (!['plan', 'apply'].includes(mode) || !server || !directory || process.argv.length !== (mode === 'apply' ? 6 : 5)) {
        throw new Error('Uso: organize-presentation.mjs plan|apply URL DIRETORIO_RELATORIO [BACKUP_JSON]');
    }
    const base = validateServerUrl(server).origin;
    const apiKey = process.env.KAVITA_API_KEY?.trim();
    const token = process.env.KAVITA_API_TOKEN?.trim();
    if (!apiKey && !token) throw new Error('Defina KAVITA_API_KEY no ambiente local; não passe credenciais nos argumentos.');
    const api = new KavitaApi(base, { apiKey, token });
    if (!(await api.request('/api/account')).roles?.includes('Admin')) throw new Error('Conta administrativa necessária.');
    const output = path.resolve(directory);

    if (mode === 'plan') {
        const libraries = await api.request('/api/library/libraries');
        const catalog = await snapshotCatalog(api);
        const presentation = planPresentation(libraries, catalog);
        await mkdir(output);
        await save(path.join(output, 'proposal.json'), { version: 1, server: base, libraries, catalog, presentation });
        console.log('Proposta: ' + presentation.seriesUpdates.length + ' nomes, ' + presentation.collections.length + ' coleções, ' + presentation.exceptions.length + ' exceções para revisão.');
        return;
    }

    const plan = await json(path.join(output, 'proposal.json'));
    if (plan.version !== 1 || plan.server !== base || !isDeepStrictEqual(plan.presentation, planPresentation(plan.libraries, plan.catalog))) {
        throw new Error('Proposta inválida ou de outro servidor.');
    }
    const backup = await json(backupFile);
    validateBackupRecord(backup, base);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(path.dirname(backupFile), backup.file))) hash.update(chunk);
    if (hash.digest('hex') !== backup.sha256.toLowerCase()) throw new Error('Checksum do backup divergente.');

    const before = await snapshotCatalog(api);
    assertStableCatalog(plan.catalog.files, before.files);
    await save(path.join(output, 'apply-started.json'), { startedAt: new Date().toISOString() });
    const result = await applyPresentation(api, plan.presentation, async step => {
        await writeFile(path.join(output, 'ledger.json'), JSON.stringify(step, null, 2), { mode: 0o600 });
    });
    const after = await snapshotCatalog(api);
    await save(path.join(output, 'catalog-after.json'), after);
    assertStableCatalog(before.files, after.files);
    await save(path.join(output, 'result.json'), { ...result, existingContentIdsPreserved: true, exceptions: plan.presentation.exceptions, finishedAt: new Date().toISOString() });
    console.log('Aplicados ' + result.seriesIds.length + ' nomes e ' + result.collectionIds.length + ' coleções; IDs preservados.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}