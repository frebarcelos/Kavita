import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareFixture } from './prepare.mjs';
import { captureLibrary, compareSnapshots } from './library-manifest.mjs';

async function directory(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'kavita-fixture-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
        await rm(root, { recursive: true, force: true });
    });
    return root;
}

test('gera EPUB sintético válido, configuração local e manifesto fora da biblioteca', async t => {
    const parent = await directory(t);
    const output = path.join(parent, 'amostra com espaco');
    const result = await prepareFixture(output);
    const python = process.platform === 'win32' ? 'python' : 'python3';
    execFileSync(python, ['-c', [
        'import sys, zipfile, xml.etree.ElementTree as ET',
        'with zipfile.ZipFile(sys.argv[1]) as z:',
        ' assert z.testzip() is None',
        ' assert z.infolist()[0].filename == "mimetype"',
        ' assert z.infolist()[0].compress_type == zipfile.ZIP_STORED',
        ' assert z.read("mimetype") == b"application/epub+zip"',
        ' container = ET.fromstring(z.read("META-INF/container.xml"))',
        ' package = ET.fromstring(z.read("OEBPS/content.opf"))',
        ' ns = {"opf": "http://www.idpf.org/2007/opf"}',
        ' assert len(package.findall("opf:spine/opf:itemref", ns)) == 3',
        ' for item in package.findall("opf:manifest/opf:item", ns):',
        '  ET.fromstring(z.read("OEBPS/" + item.attrib["href"]))',
    ].join('\n'), result.book]);
    const before = JSON.parse(await readFile(result.manifest, 'utf8'));
    assert.deepEqual(compareSnapshots(before, await captureLibrary(result.library)), []);
    assert.match(await readFile(result.envFile, 'utf8'), /KAVITA_BIND_ADDRESS=127.0.0.1/);
    assert.equal(path.dirname(result.manifest), output);
});

test('recusa pasta existente sem sobrescrever dados, inclusive .env', async t => {
    const parent = await directory(t);
    const output = path.join(parent, 'existing');
    await mkdir(output);
    await writeFile(path.join(output, '.env'), 'dados existentes');
    await assert.rejects(prepareFixture(output), { code: 'EEXIST' });
    assert.equal(await readFile(path.join(output, '.env'), 'utf8'), 'dados existentes');
});
