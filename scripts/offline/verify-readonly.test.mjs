import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareFixture } from './prepare.mjs';
import { assertProtectedMounts, probeReadonly } from './verify-readonly.mjs';

function mounts() {
    return [{ Type: 'bind', Destination: '/media', Source: '/fixture', RW: false },
        { Type: 'volume', Destination: '/kavita/config', Source: '/docker-volume', RW: true }];
}

test('aceita somente acervo read-only e configuração separada gravável', () => {
    assert.doesNotThrow(() => assertProtectedMounts(mounts()));
});

test('recusa biblioteca gravável, volume de configuração incorreto e montagens extras', () => {
    const writable = mounts(); writable[0].RW = true;
    assert.throws(() => assertProtectedMounts(writable), /somente leitura/);
    const config = mounts(); config[1].Type = 'bind';
    assert.throws(() => assertProtectedMounts(config), /configuração/);
    assert.throws(() => assertProtectedMounts([...mounts(), { Type: 'bind', Destination: '/media/nested', RW: true }]), /extras/);
});

async function fixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'kavita-probe-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
        await rm(directory, { recursive: true, force: true });
    });
    return prepareFixture(path.join(directory, 'sample'));
}

test('verificação ativa é recusada fora da biblioteca sintética, antes de executar comandos', async t => {
    const sample = await fixture(t);
    await writeFile(path.join(sample.library, '.kavita-offline-fixture.json'), '{}');
    let executed = false;
    await assert.rejects(probeReadonly(sample.library, mounts(), async () => { executed = true; }), /sintética/);
    assert.equal(executed, false);
});

test('montagem insegura impede a tentativa de escrita até na amostra sintética', async t => {
    const sample = await fixture(t);
    const unsafe = mounts(); unsafe[0].RW = true;
    let executed = false;
    await assert.rejects(probeReadonly(sample.library, unsafe, async () => { executed = true; }), /somente leitura/);
    assert.equal(executed, false);
});

test('confere hashes depois da execução e detecta escrita mesmo com comando retornando sucesso', async t => {
    const sample = await fixture(t);
    await assert.rejects(probeReadonly(sample.library, mounts(), async () => {
        await writeFile(sample.book, 'alteracao indevida');
    }), /alterada/);
});

test('sem alteração, registra sucesso do executor e preservação da amostra', async t => {
    const sample = await fixture(t);
    let executed = false;
    await probeReadonly(sample.library, mounts(), async command => {
        executed = true;
        assert.ok(command.includes('/media/.offline-probe/'));
    });
    assert.equal(executed, true);
});
