import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { captureLibrary, compareSnapshots, saveSnapshot } from './library-manifest.mjs';

async function fixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'kavita-manifest-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
        await rm(directory, { recursive: true, force: true });
    });
    const library = path.join(directory, 'library');
    await mkdir(path.join(library, 'Serie'), { recursive: true });
    await writeFile(path.join(library, 'Serie', '1.cbz'), 'original');
    return { directory, library, book: path.join(library, 'Serie', '1.cbz') };
}

test('captura arquivos aninhados sem modificar o acervo e aceita uma segunda leitura idêntica', async t => {
    const { library, book } = await fixture(t);
    const before = await captureLibrary(library);
    assert.equal(before.files[0].path, 'Serie/1.cbz');
    assert.equal(before.files[0].sha256.length, 64);
    assert.deepEqual(compareSnapshots(before, await captureLibrary(library)), []);
    assert.equal(await readFile(book, 'utf8'), 'original');
});

test('detecta alteração de conteúdo mesmo quando o tamanho do arquivo não muda', async t => {
    const { library, book } = await fixture(t);
    const before = await captureLibrary(library);
    await writeFile(book, 'alterado');
    assert.deepEqual(compareSnapshots(before, await captureLibrary(library)), [{ path: 'Serie/1.cbz', type: 'changed' }]);
});

test('detecta exclusão, renomeação e adição', async t => {
    const { library, book } = await fixture(t);
    const before = await captureLibrary(library);
    await rename(book, path.join(library, 'Serie', 'outro.cbz'));
    assert.deepEqual(compareSnapshots(before, await captureLibrary(library)), [
        { path: 'Serie/1.cbz', type: 'removed' }, { path: 'Serie/outro.cbz', type: 'added' },
    ]);
});

test('não grava manifesto no acervo nem sobrescreve um manifesto existente', async t => {
    const { library, directory } = await fixture(t);
    await assert.rejects(saveSnapshot(library, path.join(library, 'manifest.json')), /fora da biblioteca/);
    const output = path.join(directory, 'manifest.json');
    await saveSnapshot(library, output);
    await assert.rejects(saveSnapshot(library, output), { code: 'EEXIST' });
    assert.equal((await captureLibrary(library)).files.length, 1);
});

test('recusa links para não percorrer arquivos fora da amostra', async t => {
    const { library, directory } = await fixture(t);
    const outside = path.join(directory, 'outside');
    await mkdir(outside);
    await symlink(outside, path.join(library, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(captureLibrary(library), /Links não são permitidos/);
});

test('recusa manifesto inválido em vez de relatar preservação', () => {
    assert.throws(() => compareSnapshots({ version: 1, files: [{ path: 'a' }] }, { version: 1, files: [] }), /inválido/);
});
