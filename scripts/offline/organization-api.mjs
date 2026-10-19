import { isDeepStrictEqual } from 'node:util';
import { validateServerUrl } from './organization.mjs';

export class KavitaApi {
    #base; #headers;
    constructor(server, { apiKey, token } = {}) {
        this.#base = validateServerUrl(server);
        this.#headers = apiKey ? { 'x-api-key': apiKey } : token ? { Authorization: 'Bearer ' + token } : {};
    }
    async request(route, { method = 'GET', body } = {}) {
        if (!route.startsWith('/api/') || route.includes('://') || route.includes('..') || !['GET', 'POST'].includes(method)) throw new Error('Rota local inválida.');
        const response = await fetch(new URL(route, this.#base), { method, headers: { ...this.#headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(120000) });
        if (!response.ok) { await response.body?.cancel(); throw new Error('Kavita HTTP ' + response.status + ' em ' + route.split('?')[0]); }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
}
function comparable(library) {
    const result = structuredClone(library);
    delete result.lastScanned;
    delete result.coverImage;
    return result;
}

export async function applyLibraryPlan(api, entries) {
    for (const entry of entries) {
        const current = await api.request('/api/library?libraryId=' + entry.before.id);
        if (!isDeepStrictEqual(comparable(current), comparable(entry.before))) throw new Error('Edição concorrente da biblioteca; gere uma nova proposta.');
    }
    const applied = [];
    for (const entry of entries) {
        await api.request('/api/library/update', { method: 'POST', body: entry.after });
        applied.push(entry.before.id);
    }
    return applied;
}

export async function snapshotCatalog(api) {
    const series = [];
    const seen = new Set();
    for (let page = 1; page <= 10000; page++) {
        const rows = await api.request('/api/series/all-v2?pageNumber=' + page + '&pageSize=100', { method: 'POST', body: { statements: [], combination: 1 } });
        if (!Array.isArray(rows)) throw new Error('Catálogo inválido.');
        for (const row of rows) { if (seen.has(row.id)) throw new Error('Paginação repetiu uma série.'); seen.add(row.id); series.push(row); }
        if (rows.length < 100) break;
        if (page === 10000) throw new Error('Catálogo excedeu o limite de páginas.');
    }
    const files = [];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, series.length) }, async () => {
        while (cursor < series.length) {
            const row = series[cursor++];
            for (const volume of await api.request('/api/series/volumes?seriesId=' + row.id)) {
                for (const chapter of volume.chapters) {
                    for (const file of chapter.files) files.push({ path: file.filePath, fileId: file.id, libraryId: row.libraryId, seriesId: row.id, volumeId: volume.id, chapterId: chapter.id });
                }
            }
        }
    }));
    return { series, files };
}
