import assert from 'node:assert/strict';
import { test } from 'node:test';
import { excludedAuxiliaryPath, proposeLibrarySettings, validateServerUrl } from './organization.mjs';

const original = () => ({ id: 7, name: 'Quadrinhos', type: 5, folders: ['/libraries/quadrinhos'], folderWatching: false,
    includeInDashboard: true, includeInSearch: false, manageCollections: false, manageReadingLists: true,
    allowScrobbling: false, allowMetadataMatching: false, enableMetadata: true, removePrefixForSortName: true,
    inheritWebLinksFromFirstChapter: false, defaultLanguage: 'pt-BR', metadataProvider: 0,
    libraryFileTypes: [1, 3, 4], excludePatterns: ['**/privado/**'], collapseSeriesRelationships: true });

test('exclui apenas pastas auxiliares completas em qualquer profundidade, preservando imagens de leitura', () => {
    for (const name of ['.yacreaderlibrary/covers/a.jpg', 'Serie/.yacreaderlibrary/library.ydb', 'Serie/capas/volume_1.jpg', 'Serie/CAPAS/a.png']) assert.equal(excludedAuxiliaryPath(name), true);
    for (const name of ['Serie/Capitulo 1/001.jpg', 'Serie/capas extras/a.jpg', 'Serie/capas.cbz', 'Serie/a.cbz']) assert.equal(excludedAuxiliaryPath(name), false);
});

test('proposta acrescenta exclusões preservando identidade, pastas, tipo, formatos e preferências', () => {
    const before = original(); const copy = structuredClone(before); const update = proposeLibrarySettings(before);
    assert.deepEqual(before, copy);
    for (const key of Object.keys(before).filter(k => !['libraryFileTypes', 'excludePatterns'].includes(k))) assert.deepEqual(update[key], before[key], key);
    assert.deepEqual(update.fileGroupTypes, [1, 3, 4]);
    assert.ok(update.excludePatterns.includes('**/privado/**'));
    for (const pattern of ['**/.yacreaderlibrary/**', '**/capas/**']) assert.ok(update.excludePatterns.includes(pattern));
    assert.deepEqual(proposeLibrarySettings({ ...before, ...update, libraryFileTypes: update.fileGroupTypes }), update);
});

test('não adivinha os formatos ao receber DTO incompleto', () => {
    assert.throws(() => proposeLibrarySettings({ ...original(), libraryFileTypes: undefined }), /formatos/i);
    assert.throws(() => proposeLibrarySettings({ ...original(), folders: [] }), /pastas/i);
});

test('a API administrativa fica limitada ao PC ou IP privado, sem credencial embutida na URL', () => {
    for (const url of ['http://127.0.0.1:5051', 'http://localhost:5000', 'http://192.168.1.113:5000', 'http://10.0.0.2:5000']) assert.ok(validateServerUrl(url));
    for (const url of ['http://example.com', 'http://8.8.8.8', 'http://172.32.0.1', 'http://user:pass@127.0.0.1', 'http://127.0.0.1/?key=secret']) assert.throws(() => validateServerUrl(url), /local|privad|credencia|URL/i);
});
test('rejeita reindexação que troque IDs de capítulos, volumes ou séries de conteúdo existente', async () => {
    const { assertStableCatalog } = await import('./organization.mjs');
    const before=[{path:'/library/Serie/v01.cbz',seriesId:2,volumeId:3,chapterId:4},{path:'/library/Serie/capas/a.jpg',seriesId:6,volumeId:7,chapterId:8}];
    assert.doesNotThrow(()=>assertStableCatalog(before,[before[0]]));
    for(const key of ['seriesId','volumeId','chapterId']) assert.throws(()=>assertStableCatalog(before,[{...before[0],[key]:99}]),/identidade/i);
    assert.throws(()=>assertStableCatalog(before,[]),/ausente/i);
});
test('backup deve pertencer ao mesmo servidor e não pode apontar fora da pasta de backups', async () => {
    const { validateBackupRecord }=await import('./organization.mjs');
    const backup={stopped:true,server:'http://127.0.0.1:5051',file:'before.tar.gz',sha256:'a'.repeat(64)};
    assert.doesNotThrow(()=>validateBackupRecord(backup,'http://127.0.0.1:5051'));
    assert.throws(()=>validateBackupRecord(backup,'http://192.168.1.113:5000'),/backup/i);
    assert.throws(()=>validateBackupRecord({...backup,file:'../before.tar.gz'},backup.server),/backup/i);
    assert.throws(()=>validateBackupRecord({...backup,stopped:false},backup.server),/backup/i);
});
test('mesmo arquivo em bibliotecas de piloto diferentes não causa falso conflito de identidade', async () => {
    const {assertStableCatalog}=await import('./organization.mjs');
    const files=[{libraryId:1,path:'/pilot/a.cbz',seriesId:2,volumeId:3,chapterId:4},{libraryId:9,path:'/pilot/a.cbz',seriesId:12,volumeId:13,chapterId:14}];
    assert.doesNotThrow(()=>assertStableCatalog(files,[...files].reverse()));
    assert.throws(()=>assertStableCatalog(files,[files[0],{...files[1],chapterId:99}]),/identidade/i);
});
test('preserva formatos já indexados mesmo quando a configuração antiga omitiu PDF',()=>{
    const library={...original(),libraryFileTypes:[1]};
    const update=proposeLibrarySettings(library,{indexedFiles:[{path:'/libraries/quadrinhos/Titulo/a.cbz'},{path:'/libraries/quadrinhos/Titulo/a.pdf'},{path:'/libraries/quadrinhos/Titulo/capas/volume_1.jpg'}]});
    assert.deepEqual(update.fileGroupTypes,[1,3]);
    assert.deepEqual(library.libraryFileTypes,[1]);
});
test('identifica para revisão apenas séries inteiras de imagens auxiliares, preservando livros e séries mistas',async()=>{
 const { auxiliarySeriesIds }=await import('./organization.mjs');
 const catalog={series:[{id:1},{id:2},{id:3},{id:4}],files:[{seriesId:1,path:'/media/Serie/capas/a.jpg'},{seriesId:2,path:'/media/Serie/capas/livro.cbz'},{seriesId:3,path:'/media/Outra/capas/a.png'},{seriesId:3,path:'/media/Outra/001.jpg'}]};
 assert.deepEqual(auxiliarySeriesIds(catalog),[1]);
});