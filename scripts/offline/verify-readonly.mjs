import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { captureLibrary, compareSnapshots } from './library-manifest.mjs';

const execute = promisify(execFile);

export function assertProtectedMounts(mounts) {
    if (!Array.isArray(mounts) || mounts.length !== 2) throw new Error('Montagens extras não são permitidas na verificação.');
    const media = mounts.find(m => m.Destination === '/media');
    if (media?.Type !== 'bind' || media.RW !== false) throw new Error('O acervo precisa estar somente leitura.');
    const config = mounts.find(m => m.Destination === '/kavita/config');
    if (config?.Type !== 'volume' || config.RW !== true) throw new Error('A configuração precisa de volume Docker gravável separado.');
}

const writeProbe = [
    'set -eu',
    'command -v rm >/dev/null',
    'command -v mv >/dev/null',
    'for name in modify delete rename; do test "$(cat /media/.offline-probe/$name.txt)" = "synthetic sentinel"; done',
    'failed=0',
    'if (printf test > /media/.offline-probe/create.txt) 2>/dev/null; then failed=1; fi',
    'if (printf test > /media/.offline-probe/modify.txt) 2>/dev/null; then failed=1; fi',
    'if rm /media/.offline-probe/delete.txt 2>/dev/null; then failed=1; fi',
    'if mv /media/.offline-probe/rename.txt /media/.offline-probe/renamed.txt 2>/dev/null; then failed=1; fi',
    'test "$failed" = 0',
].join('\n');

export async function probeReadonly(library, mounts, runProbe) {
    assertProtectedMounts(mounts);
    const marker = JSON.parse(await readFile(path.join(library, '.kavita-offline-fixture.json'), 'utf8'));
    if (marker.kind !== 'kavita-offline-synthetic' || marker.version !== 1) throw new Error('Verificação ativa exige biblioteca sintética.');
    const before = await captureLibrary(library);
    let commandError;
    try { await runProbe(writeProbe); } catch (error) { commandError = error; }
    const changes = compareSnapshots(before, await captureLibrary(library));
    if (changes.length) throw new Error('A amostra foi alterada durante a verificação: ' + JSON.stringify(changes));
    if (commandError) throw commandError;
}

async function main() {
    const envFile = process.argv[2];
    if (!envFile || process.argv.length !== 3) throw new Error('Uso: node scripts/offline/verify-readonly.mjs ARQUIVO_ENV');
    const bundled = 'C:/Program Files/Docker/Docker/resources/bin/docker-compose.exe';
    const composeExecutable = process.env.KAVITA_COMPOSE || (existsSync(bundled) ? bundled : 'docker');
    const prefix = composeExecutable === 'docker' ? ['compose'] : [];
    const composeFile = fileURLToPath(new URL('../../deployment/offline/compose.yaml', import.meta.url));
    const base = [...prefix, '--env-file', path.resolve(envFile), '-f', composeFile];
    const options = { encoding: 'utf8', windowsHide: true, timeout: 30000 };
    const config = JSON.parse((await execute(composeExecutable, [...base, 'config', '--format', 'json'], options)).stdout);
    const library = config.services.kavita.volumes.find(v => v.target === '/media')?.source?.replaceAll('$$', '$');
    const id = (await execute(composeExecutable, [...base, 'ps', '-q', 'kavita'], options)).stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('Container Kavita não encontrado ou resultado ambíguo.');
    const [inspection] = JSON.parse((await execute('docker', ['inspect', id], options)).stdout);
    if (inspection.HostConfig?.Privileged) throw new Error('Não executar o teste em container privilegiado.');
    await probeReadonly(library, inspection.Mounts, command => execute('docker', ['exec', id, 'sh', '-c', command], options));
    console.log('Montagem somente leitura confirmada: criação, alteração, exclusão e renomeação negadas; hashes preservados.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
