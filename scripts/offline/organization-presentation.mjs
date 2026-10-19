import path from 'node:path';
import { excludedAuxiliaryPath } from './organization.mjs';
const normalize = value => value.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const unique = items => [...new Set(items)];

function variant(parts) {
    const folders = parts.slice(1, -1).filter(part => !/^(volumes?|cap[ií]tulos? avulsos?|s[eé]rie principal)$/i.test(part));
    const hints = folders.map(part => part.replace(/\s*-\s*Volumes?$/i, '').replace(/^Volumes?\s*-\s*/i, ''));
    const language = parts.at(-1).match(/\[(PT-BR|EN|ES|FR|JA)\]/i)?.[1].toUpperCase();
    if (language && !hints.some(hint => hint.toUpperCase().includes(language))) hints.push(language);
    return unique(hints).join(' - ');
}

function unit(filename, manga) {
    const volume = filename.match(/\bv(?:ol(?:ume)?\.?\s*)?\s*(\d+(?:\.\d+)?)/i);
    const chapter = filename.match(/\bc(?:h(?:apter)?\.?\s*)?\s*(\d+(?:\.\d+)?)/i);
    const pad = number => number.split('.').map((part, index) => index === 0 ? part.padStart(3, '0') : part).join('.');
    if (volume) return 'Volume ' + pad(volume[1]) + (chapter ? ' - Capítulo ' + pad(chapter[1]) : '');
    if (chapter) return 'Capítulo ' + pad(chapter[1]);
    const number = filename.match(/\s-\s(\d+(?:\.\d+)?)(?:\s|\.|$)/);
    return number && !manga ? 'Nº ' + pad(number[1]) : null;
}

export function planPresentation(libraries, catalog) {
    const exceptions = [], candidates = [], groupedCollections = new Map();
    const byLibrary = new Map(libraries.map(library => [library.id, library]));
    const bySeries = new Map();
    for (const file of catalog.files) {
        if (excludedAuxiliaryPath(file.path)) continue;
        if (!bySeries.has(file.seriesId)) bySeries.set(file.seriesId, []);
        bySeries.get(file.seriesId).push(file);
    }
    for (const series of catalog.series) {
        const library = byLibrary.get(series.libraryId), files = bySeries.get(series.id) || [];
        if (!library || !files.length) continue;
        if (library.folderBasedOrganization) {
            exceptions.push({ seriesId: series.id, reason: 'folder_based_library' });
            continue;
        }
        const relatives = files.map(file => {
            const root = library.folders.find(folder => file.path.startsWith(folder.replace(/\/$/, '') + '/'));
            return root ? file.path.slice(root.replace(/\/$/, '').length + 1).split('/') : [];
        });
        const groups = unique(relatives.map(parts => parts.length >= 2 ? parts[0] : null));
        if (groups.length !== 1 || !groups[0]) { exceptions.push({ seriesId: series.id, reason: 'multiple_roots' }); continue; }
        const book = library.type === 2 || library.type === 4;
        const collectionTitle = (book ? 'Livros' : library.type === 0 ? 'Mangás' : 'Quadrinhos') + ' - ' + groups[0];
        if (!groupedCollections.has(collectionTitle)) groupedCollections.set(collectionTitle, { book, ids: [] });
        groupedCollections.get(collectionTitle).ids.push(series.id);
        if (series.nameLocked || series.sortNameLocked) continue;
        let name;
        if (book) {
            const titles = unique(relatives.map(parts => path.posix.parse(parts.at(-1)).name));
            if (titles.length !== 1) { exceptions.push({ seriesId: series.id, reason: 'multiple_books_in_series' }); continue; }
            name = titles[0];
        } else {
            const variants = unique(relatives.map(variant));
            if (variants.length > 1) { exceptions.push({ seriesId: series.id, reason: 'mixed_variants' }); continue; }
            name = groups[0] + (variants[0] ? ' - ' + variants[0] : '');
        }
        const formats = unique(files.map(file => path.posix.extname(file.path).slice(1).toUpperCase()));
        candidates.push({ id: series.id, name, sortName: name, libraryId: series.libraryId, format: series.format, files, book, formats, before: series });
    }
    const families = new Map();
    for (const entry of candidates) {
        const key = JSON.stringify([entry.libraryId, normalize(entry.name)]);
        if (!families.has(key)) families.set(key, []);
        families.get(key).push(entry);
    }
    for (const siblings of families.values()) {
        if (siblings.length < 2) continue;
        for (const entry of siblings) {
            const sameFormat = siblings.filter(other => other.format === entry.format);
            if (sameFormat.length > 1) {
                if (entry.files.length === 1) {
                    const suffix = unit(path.posix.basename(entry.files[0].path), byLibrary.get(entry.libraryId).type === 0);
                    entry.name = suffix ? entry.name + ' - ' + suffix : path.posix.parse(entry.files[0].path).name;
                } else entry.ambiguous = true;
            }
            if (unique(siblings.map(other => other.format)).length > 1) entry.name += ' [' + entry.formats.join('/') + ']';
            entry.sortName = entry.name;
        }
    }
    const proposedNames = new Map(catalog.series.map(series => [series.id, series.name]));
    for (const entry of candidates) if (!entry.ambiguous) proposedNames.set(entry.id, entry.name);
    const seriesUpdates = [];
    for (const entry of candidates) {
        const collision = catalog.series.some(other => other.id !== entry.id && other.libraryId === entry.libraryId && other.format === entry.format && normalize(proposedNames.get(other.id)) === normalize(entry.name));
        if (entry.ambiguous || collision) { exceptions.push({ seriesId: entry.id, reason: 'ambiguous_display_name' }); continue; }
        if (entry.name !== entry.before.name || entry.sortName !== entry.before.sortName) seriesUpdates.push({ id: entry.id, name: entry.name, sortName: entry.sortName, nameLocked: true, sortNameLocked: true, before: entry.before });
    }
    const collections = [...groupedCollections].filter(([, group]) => group.book || group.ids.length > 1).map(([title, group]) => ({ title, seriesIds: unique(group.ids).sort((a, b) => a - b) })).sort((a, b) => a.title.localeCompare(b.title));
    return { seriesUpdates, collections, exceptions };
}
export async function applyPresentation(api, plan, onStep = async () => {}) {
    const currentSeries = new Map();
    for (const entry of plan.seriesUpdates) {
        const current = await api.request('/api/series/' + entry.id);
        if (['name', 'sortName', 'nameLocked', 'sortNameLocked'].some(key => current[key] !== entry.before[key])) throw new Error('Edição concorrente da série; gere uma nova proposta.');
        currentSeries.set(entry.id, current);
    }
    const result = { seriesIds: [], collectionIds: [] };
    for (const entry of plan.seriesUpdates) {
        const current = currentSeries.get(entry.id);
        await api.request('/api/series/update', { method: 'POST', body: { ...current, name: entry.name, sortName: entry.sortName, nameLocked: true, sortNameLocked: true } });
        const saved = await api.request('/api/series/' + entry.id);
        if (saved.name !== entry.name || saved.id !== entry.id || !saved.nameLocked) throw new Error('Nome da série não persistiu.');
        result.seriesIds.push(entry.id);
        await onStep(structuredClone(result));
    }
    for (const collection of plan.collections) {
        let owned = await api.request('/api/collection?ownedOnly=true');
        let tag = owned.find(item => item.title === collection.title);
        await api.request('/api/collection/update-for-series', { method: 'POST', body: { collectionTagId: tag?.id || 0, collectionTagTitle: collection.title, seriesIds: collection.seriesIds } });
        owned = await api.request('/api/collection?ownedOnly=true');
        tag = owned.find(item => item.title === collection.title);
        if (!tag || tag.itemCount < collection.seriesIds.length) throw new Error('Coleção não foi criada com os itens esperados.');
        await api.request('/api/collection/update', { method: 'POST', body: { ...tag, promoted: true } });
        const saved = await api.request('/api/collection/single?collectionId=' + tag.id);
        if (!saved.promoted) throw new Error('Coleção não ficou disponível aos leitores.');
        result.collectionIds.push(tag.id);
        await onStep(structuredClone(result));
    }
    return result;
}
