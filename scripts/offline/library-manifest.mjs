import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function captureLibrary(library) {
    const root = await realpath(library);
    if (!(await lstat(root)).isDirectory()) throw new Error('A biblioteca precisa ser uma pasta.');
    const files = [];
    async function walk(directory) {
        for (const name of (await readdir(directory)).sort()) {
            const file = path.join(directory, name);
            const stat = await lstat(file);
            if (stat.isSymbolicLink()) throw new Error('Links não são permitidos na biblioteca de validação.');
            if (stat.isDirectory()) await walk(file);
            else if (stat.isFile()) {
                const hash = createHash('sha256');
                for await (const chunk of createReadStream(file)) hash.update(chunk);
                files.push({ path: path.relative(root, file).split(path.sep).join('/'), size: stat.size, sha256: hash.digest('hex') });
            } else throw new Error('Tipo de arquivo não suportado.');
        }
    }
    await walk(root);
    return { version: 1, files };
}

function validateSnapshot(snapshot) {
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.files)) throw new Error('Manifesto inválido.');
    const names = new Set();
    for (const file of snapshot.files) {
        if (typeof file.path !== 'string' || names.has(file.path) || !Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
            throw new Error('Manifesto inválido.');
        }
        names.add(file.path);
    }
}

export function compareSnapshots(before, after) {
    validateSnapshot(before);
    validateSnapshot(after);
    const previous = new Map(before.files.map(file => [file.path, file]));
    const current = new Map(after.files.map(file => [file.path, file]));
    const changes = [];
    for (const [name, file] of previous) {
        if (!current.has(name)) changes.push({ path: name, type: 'removed' });
        else if (current.get(name).size !== file.size || current.get(name).sha256 !== file.sha256) changes.push({ path: name, type: 'changed' });
    }
    for (const name of current.keys()) if (!previous.has(name)) changes.push({ path: name, type: 'added' });
    return changes.sort((a, b) => a.path.localeCompare(b.path));
}

export async function saveSnapshot(library, output) {
    const root = await realpath(library);
    const destination = path.join(await realpath(path.dirname(path.resolve(output))), path.basename(output));
    const relative = path.relative(root, destination);
    if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('O manifesto deve ficar fora da biblioteca.');
    }
    const snapshot = await captureLibrary(root);
    await writeFile(destination, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    return snapshot;
}

async function main() {
    const [command, library, manifest] = process.argv.slice(2);
    if (!['capture', 'verify'].includes(command) || !library || !manifest || process.argv.length !== 5) {
        throw new Error('Uso: node scripts/offline/library-manifest.mjs capture|verify BIBLIOTECA MANIFESTO');
    }
    if (command === 'capture') {
        const snapshot = await saveSnapshot(library, manifest);
        console.log('Manifesto criado: ' + snapshot.files.length + ' arquivos.');
    } else {
        const before = JSON.parse(await readFile(manifest, 'utf8'));
        const changes = compareSnapshots(before, await captureLibrary(library));
        if (changes.length) throw new Error('Acervo alterado: ' + JSON.stringify(changes));
        console.log('Acervo preservado: ' + before.files.length + ' arquivos e hashes idênticos.');
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
