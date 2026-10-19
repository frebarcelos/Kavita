import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { KavitaApi, snapshotCatalog } from './organization-api.mjs';
import { validateServerUrl } from './organization.mjs';
import { auditCatalog } from './organization-coverage.mjs';

async function main() {
    const [server, inventoryFile, outputFile] = process.argv.slice(2);
    if (process.argv.length !== 5) throw new Error('Uso: audit-catalog.mjs URL INVENTARIO_JSON RELATORIO_JSON');
    const base = validateServerUrl(server).origin;
    const inventory = JSON.parse((await readFile(inventoryFile, 'utf8')).replace(/^\uFEFF/, ''));
    if (inventory.version !== 1 || !Array.isArray(inventory.sources)) throw new Error('Inventário inválido.');
    const apiKey = process.env.KAVITA_API_KEY?.trim();
    if (!apiKey) throw new Error('Defina KAVITA_API_KEY no ambiente local.');
    const catalog = await snapshotCatalog(new KavitaApi(base, { apiKey }));
    const audit = auditCatalog(inventory.sources, catalog);
    await writeFile(outputFile, JSON.stringify({ version: 1, server: base, createdAt: new Date().toISOString(), audit, catalog }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ expected: audit.expected, indexed: audit.indexed, missing: audit.missing.length, unsupported: audit.unsupported.length, multiFileChaptersForReview: audit.multiFileChapters.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
