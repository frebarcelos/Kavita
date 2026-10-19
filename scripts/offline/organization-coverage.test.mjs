import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditCatalog } from './organization-coverage.mjs';

const source = files => [{ libraryId: 2, mount: '/libraries/manga', files }];
const file = (path, ids = {}) => ({ libraryId: 2, path, seriesId: 10, volumeId: 20, chapterId: 30, ...ids });

test('detecta arquivos suportados ausentes sem confundir indexação com quantidade de séries', () => {
    const catalog = { files: [file('/libraries/manga/Série/a.pdf'), file('/libraries/manga/Série/b.pdf')] };
    const result = auditCatalog(source(['Série/a.pdf', 'Série/b.pdf', 'Série/c.cbz']), catalog);
    assert.equal(result.expected, 3);
    assert.equal(result.indexed, 2);
    assert.deepEqual(result.missing.map(f => f.path), ['/libraries/manga/Série/c.cbz']);
    assert.equal(result.multiFileChapters.length, 1);
});

test('mantém MOBI como formato não suportado e ignora auxiliares e capas', () => {
    const result = auditCatalog(source(['Obra/a.mobi', 'Obra/capas/1.jpg', '.yacreaderlibrary/cache.pdf', 'Obra/a.CBZ']), { files: [] });
    assert.equal(result.expected, 1);
    assert.deepEqual(result.unsupported.map(f => f.path), ['/libraries/manga/Obra/a.mobi']);
    assert.equal(result.missing.length, 1);
});

test('compara Unicode e separadores sem confundir maiúsculas em caminhos Linux', () => {
    const result = auditCatalog(source(['Série\\vol01.pdf', 'Série/Vol02.pdf']), { files: [file('/libraries/manga/Se\u0301rie/vol01.pdf'), file('/libraries/manga/Série/vol02.pdf')] });
    assert.equal(result.indexed, 1);
    assert.equal(result.missing[0].path, '/libraries/manga/Série/Vol02.pdf');
});

test('a mesma montagem em outra biblioteca não comprova cobertura da biblioteca esperada', () => {
    const result = auditCatalog(source(['a.pdf']), { files: [file('/libraries/manga/a.pdf', { libraryId: 9 })] });
    assert.equal(result.missing.length, 1);
});

test('não aceita caminhos que escapam da montagem ou inventário duplicado', () => {
    for (const files of [['../a.pdf'], ['/a.pdf'], ['a/../../b.pdf'], ['a.pdf', 'a.pdf']]) {
        assert.throws(() => auditCatalog(source(files), { files: [] }), /caminho|duplicado/i);
    }
});

test('múltiplos arquivos repetidos do mesmo capítulo não viram falsos livros adicionais', () => {
    const f = file('/libraries/manga/a.pdf');
    const result = auditCatalog(source(['a.pdf']), { files: [f, { ...f }] });
    assert.equal(result.indexed, 1);
    assert.deepEqual(result.multiFileChapters, []);
});

test('inclui imagens legítimas e os formatos de arquivo do parser Kavita', () => {
    const result = auditCatalog(source(['Capítulo/001.jpg', 'Capítulo/002.AVIF', 'a.7zip', 'b.cbt', 'c.tar.gz']), { files: [] });
    assert.equal(result.expected, 5);
    assert.equal(result.missing.length, 5);
});
