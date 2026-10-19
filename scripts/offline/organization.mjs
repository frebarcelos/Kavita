import { isIP } from 'node:net';

export const auxiliaryExclusions = Object.freeze(['**/.yacreaderlibrary/**', '**/capas/**']);

export function excludedAuxiliaryPath(relative) {
    const segments = relative.replaceAll('\\', '/').split('/').slice(0, -1);
    return segments.some(segment => ['.yacreaderlibrary', 'capas'].includes(segment.toLowerCase()));
}

export function proposeLibrarySettings(library, { indexedFiles = [] } = {}) {
    if (!Number.isSafeInteger(library?.id) || library.id < 1) throw new Error('Biblioteca inválida.');
    if (!Array.isArray(library.folders) || !library.folders.length || library.folders.some(p => typeof p !== 'string' || !p)) throw new Error('As pastas atuais precisam estar presentes.');
    if (!Array.isArray(library.libraryFileTypes) || !library.libraryFileTypes.length || library.libraryFileTypes.some(n => ![1, 2, 3, 4].includes(n))) throw new Error('Os formatos atuais precisam estar presentes.');
    if (!Array.isArray(library.excludePatterns) || library.excludePatterns.some(p => typeof p !== 'string')) throw new Error('Exclusões atuais inválidas.');
    const groups = new Set(library.libraryFileTypes);
    for (const file of indexedFiles) {
        if (excludedAuxiliaryPath(file.path)) continue;
        const extension = file.path.split('.').at(-1).toLowerCase();
        const group = ['cbz', 'cbr', 'zip', 'rar', '7z', 'cb7'].includes(extension) ? 1 : extension === 'epub' ? 2 : extension === 'pdf' ? 3 : ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'].includes(extension) ? 4 : null;
        if (group) groups.add(group);
    }
    // O DTO de leitura chama o campo libraryFileTypes; o de atualização exige fileGroupTypes.
    // Preservar os demais campos também evita zerar preferências novas da versão instalada.
    return { ...structuredClone(library), fileGroupTypes: [...groups],
        excludePatterns: [...new Set([...library.excludePatterns, ...auxiliaryExclusions])] };
}

export function validateServerUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('URL local inválida ou com credenciais.');
    const host = url.hostname;
    const parts = host.split('.').map(Number);
    const privateIpv4 = isIP(host) === 4 && (parts[0] === 127 || parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
    if (host !== 'localhost' && !privateIpv4) throw new Error('O servidor precisa ser local ou ter IP privado.');
    return url;
}
export function assertStableCatalog(before, after) {
    const key = file => JSON.stringify([file.libraryId, file.path]);
    const current = new Map(after.map(file => [key(file), file]));
    for (const file of before) {
        if (excludedAuxiliaryPath(file.path)) continue;
        const next = current.get(key(file));
        if (!next) throw new Error('Conteúdo existente ausente após reindexação.');
        if (['seriesId', 'volumeId', 'chapterId'].some(key => next[key] !== file[key])) throw new Error('Mudança de identidade de conteúdo existente; migração necessária.');
    }
}

export function validateBackupRecord(backup, server) {
    if (!backup?.stopped || backup.server !== validateServerUrl(server).origin || typeof backup.file !== 'string' || !backup.file || /[\\/]/.test(backup.file) || ['.', '..'].includes(backup.file) || !/^[a-f0-9]{64}$/i.test(backup.sha256)) throw new Error('Registro de backup consistente inválido ou de outro servidor.');
}

// Somente identifica candidatos; nenhuma exclusão é executada por esta função.
export function auxiliarySeriesIds(catalog) {
    const bySeries = new Map();
    for (const file of catalog.files) {
        if (!bySeries.has(file.seriesId)) bySeries.set(file.seriesId, []);
        bySeries.get(file.seriesId).push(file);
    }
    return catalog.series.filter(series => {
        const files = bySeries.get(series.id) || [];
        return files.length > 0 && files.every(file => excludedAuxiliaryPath(file.path) && /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(file.path));
    }).map(series => series.id);
}
