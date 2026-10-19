import path from 'node:path';
import { excludedAuxiliaryPath } from './organization.mjs';

const supported = new Set(['.pdf', '.epub', '.cbz', '.cbr', '.zip', '.rar', '.7z', '.7zip', '.cb7', '.cbt', '.tar.gz', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const unsupportedBooks = new Set(['.mobi', '.azw', '.azw3']);
const normalize = value => value.replaceAll('\\', '/').normalize('NFC');
const key = (libraryId, filePath) => JSON.stringify([libraryId, normalize(filePath)]);
const extensionOf = filePath => /\.tar\.gz$/i.test(filePath) ? '.tar.gz' : path.posix.extname(filePath).toLowerCase();

/** Read-only coverage audit. A file being indexed does not mean it has its own book/volume. */
export function auditCatalog(sources, catalog) {
    const indexedPaths = new Set(catalog.files.map(f => key(f.libraryId, f.path)));
    const result = { expected: 0, indexed: 0, missing: [], unsupported: [], multiFileChapters: [] };
    const inventoryPaths = new Set();
    for (const source of sources) {
        if (!Number.isSafeInteger(source.libraryId) || !source.mount.startsWith('/') || source.mount.includes('..')) throw new Error('Montagem inválida.');
        const mount = normalize(source.mount).replace(/\/+$/, '');
        for (const relative of source.files) {
            const name = normalize(relative);
            if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some(part => ['', '.', '..'].includes(part))) throw new Error('Caminho inválido no inventário.');
            const entry = { libraryId: source.libraryId, path: mount + '/' + name };
            const identity = key(entry.libraryId, entry.path);
            if (inventoryPaths.has(identity)) throw new Error('Caminho duplicado no inventário.');
            inventoryPaths.add(identity);
            if (excludedAuxiliaryPath(name)) continue;
            const extension = extensionOf(name);
            if (unsupportedBooks.has(extension)) { result.unsupported.push(entry); continue; }
            if (!supported.has(extension)) continue;
            result.expected++;
            if (indexedPaths.has(identity)) result.indexed++;
            else result.missing.push(entry);
        }
    }
    const chapters = new Map();
    for (const file of catalog.files) {
        // Image pages naturally share a chapter; only container documents need this review.
        if (excludedAuxiliaryPath(file.path) || !supported.has(extensionOf(file.path)) || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(file.path)) continue;
        const chapterKey = JSON.stringify([file.libraryId, file.chapterId]);
        if (!chapters.has(chapterKey)) chapters.set(chapterKey, { libraryId: file.libraryId, seriesId: file.seriesId, chapterId: file.chapterId, paths: new Set() });
        chapters.get(chapterKey).paths.add(normalize(file.path));
    }
    for (const chapter of chapters.values()) {
        if (chapter.paths.size > 1) result.multiFileChapters.push({ ...chapter, paths: [...chapter.paths].sort() });
    }
    return result;
}
