import { crc32 } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { saveSnapshot } from './library-manifest.mjs';

// ZIP sem compressão: mimetype precisa ser a primeira entrada EPUB, armazenada sem compressão.
function zip(entries) {
    const chunks = [], central = [];
    let offset = 0;
    for (const [name, text] of entries) {
        const filename = Buffer.from(name), data = Buffer.from(text);
        const checksum = crc32(data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(33, 12);
        header.writeUInt32LE(checksum, 14);
        header.writeUInt32LE(data.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(filename.length, 26);
        chunks.push(header, filename, data);
        const record = Buffer.alloc(46);
        record.writeUInt32LE(0x02014b50, 0);
        record.writeUInt16LE(20, 4);
        record.writeUInt16LE(20, 6);
        record.writeUInt16LE(33, 14);
        record.writeUInt32LE(checksum, 16);
        record.writeUInt32LE(data.length, 20);
        record.writeUInt32LE(data.length, 24);
        record.writeUInt16LE(filename.length, 28);
        record.writeUInt32LE(offset, 42);
        central.push(record, filename);
        offset += header.length + filename.length + data.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...chunks, directory, end]);
}

function book() {
    const entries = [
        ['mimetype', 'application/epub+zip'],
        ['META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
        ['OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:389d065a-d1bf-4ed1-b254-b7de844f0801</dc:identifier><dc:title>Teste Offline F1</dc:title><dc:creator>Fixture sintetica do fork</dc:creator><dc:language>pt-BR</dc:language><meta property="dcterms:modified">2026-10-17T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' + [1, 2, 3].map(n => '<item id="c' + n + '" href="chapter' + n + '.xhtml" media-type="application/xhtml+xml"/>').join('') + '</manifest><spine>' + [1, 2, 3].map(n => '<itemref idref="c' + n + '"/>').join('') + '</spine></package>'],
        ['OEBPS/nav.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Indice</title></head><body><nav epub:type="toc"><h1>Teste Offline F1</h1><ol>' + [1, 2, 3].map(n => '<li><a href="chapter' + n + '.xhtml">Capitulo ' + n + '</a></li>').join('') + '</ol></nav></body></html>'],
    ];
    for (const n of [1, 2, 3]) entries.push(['OEBPS/chapter' + n + '.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR"><head><title>Capitulo ' + n + '</title></head><body><h1>Capitulo ' + n + '</h1>' + Array.from({ length: 30 }, (_, i) => '<p id="p' + i + '">Amostra sintetica. Capitulo ' + n + ', paragrafo ' + (i + 1) + '. Este texto serve para validar leitura offline, progresso e remocao somente da copia local. O original permanece no PC.</p>').join('') + '</body></html>']);
    return zip(entries);
}

export async function prepareFixture(destination) {
    const output = path.resolve(destination);
    await mkdir(path.dirname(output), { recursive: true });
    await mkdir(output);
    const library = path.join(output, 'library');
    const series = path.join(library, 'Teste Offline F1');
    const probe = path.join(library, '.offline-probe');
    await mkdir(series, { recursive: true });
    await mkdir(probe);
    const bookPath = path.join(series, 'Teste Offline F1.epub');
    await writeFile(bookPath, book());
    await writeFile(path.join(library, '.kavita-offline-fixture.json'), JSON.stringify({ kind: 'kavita-offline-synthetic', version: 1 }));
    for (const name of ['modify.txt', 'delete.txt', 'rename.txt']) await writeFile(path.join(probe, name), 'synthetic sentinel\n');
    const example = await readFile(new URL('../../deployment/offline/.env.example', import.meta.url), 'utf8');
    const libraryValue = library.split(path.sep).join('/').replaceAll("'", String.fromCharCode(92) + "'");
    const envFile = path.join(output, '.env');
    await writeFile(envFile, example.replace(/^KAVITA_LIBRARY_PATH=.*$/m, () => "KAVITA_LIBRARY_PATH='" + libraryValue + "'"));
    const manifest = path.join(output, 'before.json');
    await saveSnapshot(library, manifest);
    return { library, book: bookPath, envFile, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const destination = process.argv[2] || fileURLToPath(new URL('../../_temp/offline-f1', import.meta.url));
    prepareFixture(destination).then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}
