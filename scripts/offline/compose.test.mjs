import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { prepareFixture } from './prepare.mjs';

const composeFile = fileURLToPath(new URL('../../deployment/offline/compose.yaml', import.meta.url));
const bundledCompose = 'C:/Program Files/Docker/Docker/resources/bin/docker-compose.exe';
const executable = process.env.KAVITA_COMPOSE || (existsSync(bundledCompose) ? bundledCompose : 'docker');
const prefix = executable === 'docker' ? ['compose'] : [];

async function render(t, extra = '', library = true) {
    const directory = await mkdtemp(path.join(tmpdir(), 'kavita-compose-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
        await rm(directory, { recursive: true, force: true });
    });
    const envFile = path.join(directory, '.env');
    const source = directory.split(path.sep).join('/');
    await writeFile(envFile, (library ? "KAVITA_LIBRARY_PATH='" + source + "'\n" : '') + extra);
    const env = { ...process.env };
    for (const key of ['KAVITA_LIBRARY_PATH', 'KAVITA_IMAGE', 'KAVITA_BIND_ADDRESS', 'KAVITA_PORT']) delete env[key];
    return () => JSON.parse(execFileSync(executable, [...prefix, '--env-file', envFile, '-f', composeFile, 'config', '--format', 'json'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env,
    }));
}

test('o acervo é um único bind mount somente de leitura, sem criação implícita de pastas', async t => {
    const config = (await render(t))();
    const binds = config.services.kavita.volumes.filter(v => v.type === 'bind');
    assert.equal(binds.length, 1);
    assert.equal(binds[0].target, '/media');
    assert.equal(binds[0].read_only, true, 'o servidor nunca pode escrever nos originais');
    assert.equal(binds[0].bind.create_host_path, false);
});

test('banco/configuração ficam em volume Docker independente do acervo e do OneDrive', async t => {
    const config = (await render(t))();
    const storage = config.services.kavita.volumes.filter(v => v.type === 'volume');
    assert.equal(storage.length, 1);
    assert.equal(storage[0].target, '/kavita/config');
    assert.notEqual(storage[0].read_only, true);
    assert.ok(config.volumes[storage[0].source]);
});

test('o servidor inicia limitado ao próprio PC e permite IP LAN explícito', async t => {
    const config = (await render(t))();
    assert.equal(config.services.kavita.ports[0].host_ip, '127.0.0.1');
    const lan = (await render(t, 'KAVITA_BIND_ADDRESS=192.168.1.20\nKAVITA_PORT=5050\n'))();
    assert.equal(lan.services.kavita.ports[0].host_ip, '192.168.1.20');
    assert.equal(lan.services.kavita.ports[0].published, '5050');
});

test('exige pasta explícita e fixa a imagem por digest', async t => {
    const config = (await render(t))();
    assert.match(config.services.kavita.image, /@sha256:[a-f0-9]{64}$/);
    assert.ok(config.services.kavita.healthcheck.test.includes('http://localhost:5000/api/health'));
    const missing = await render(t, '', false);
    assert.throws(missing, /Defina KAVITA_LIBRARY_PATH/);
});

test('configuração gerada preserva caminhos com espaços, dólar e apóstrofo', async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kavita-compose-path-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
        await rm(directory, { recursive: true, force: true });
    });
    const sample = await prepareFixture(path.join(directory, "amostra $& d'leitura"));
    const env = { ...process.env };
    for (const key of ['KAVITA_LIBRARY_PATH', 'KAVITA_IMAGE', 'KAVITA_BIND_ADDRESS', 'KAVITA_PORT']) delete env[key];
    const config = JSON.parse(execFileSync(executable, [...prefix, '--env-file', sample.envFile, '-f', composeFile, 'config', '--format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env }));
    const media = config.services.kavita.volumes.find(v => v.target === '/media');
    // Compose serializa dólares literais como $$ para que o modelo possa ser relido.
    assert.equal(path.normalize(media.source.replaceAll('$$', '$')), path.normalize(sample.library));
});
