// L2.2: measure the real column-clipping generator and PageFlip in a disposable Chrome reader.
// Reports geometry/counts/timings only, never chapter text or book metadata.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export async function runEpubClippingTests({api, libraryId, route, check, until, evaluate, open, send, sleep, bookModeKey}) {
  const measurements = [];
  await send('Emulation.setDeviceMetricsOverride', {width: 1600, height: 950, deviceScaleFactor: 1, mobile: false});
  for (const folder of ['Livro EPUB', 'Livro EPUB CSS']) {
    const folders = await api(`/api/Library/folder-series?libraryId=${libraryId}`);
    const seriesId = folders.find(row => row.path === folder)?.seriesId;
    if (!seriesId) throw new Error('The clipping probe needs fixtures generated with --publisher-css.');
    const volumes = await api(`/api/Series/volumes?seriesId=${seriesId}`);
    const chapter = {seriesId, chapterId: volumes[0].chapters[0].id};
    const profile = await api(`/api/reading-profile/${libraryId}/${seriesId}`);
    await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${seriesId}`, {method: 'POST', body: {
      ...profile, bookReaderLayoutMode: 2, bookReaderWritingStyle: 0, bookReaderReadingDirection: 0,
      bookReaderFontSize: 100, bookReaderMargin: 4, bookReaderImmersiveMode: false, bookReaderThemeName: 'White'}});
    await evaluate(`localStorage.setItem('${bookModeKey}', 'true'); true`);
    await open(route('book', chapter));
    if (!await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`), 20000, 100)) {
      throw new Error('The clipping probe reader did not load.');
    }
    await evaluate('document.fonts.ready.then(() => true)');
    await sleep(700);
    const result = await measureEpubClipping(evaluate);
    if (!result?.samples) throw new Error('No clipping measurement returned.');
    measurements.push({fixture: folder === 'Livro EPUB' ? 'synthetic' : 'publisher-css', ...result});
    check(result.maxMs <= 100, `EPUB clipping ${folder}: mounted within 100 ms (${result.maxMs} ms)`);
    check(result.geometryMismatches === 0, `EPUB clipping ${folder}: same element geometry (${result.geometryMismatches} differences)`);
    check(result.sourceOffsetPreserved, `EPUB clipping ${folder}: original text position preserved`);
  }
  const artifacts = new URL('../../_temp/epub-l2/', import.meta.url);
  await mkdir(artifacts, {recursive: true});
  await writeFile(new URL('synthetic-measurements.json', artifacts), JSON.stringify(measurements, null, 2) + '\n');
}

export async function measureEpubClipping(evaluate) {
  const require = createRequire(new URL('../../UI/Web/package.json', import.meta.url));
  const {build} = require('esbuild');
  const directory = fileURLToPath(new URL('../../UI/Web/src/app/', import.meta.url));
  const bundled = await build({stdin: {contents: `
    export {createEpubBookPage} from './book-reader/_components/epub-book/epub-book-pages';
    export {PageFlip} from './_vendor/page-flip/PageFlip';`, resolveDir: directory},
    bundle: true, format: 'iife', globalName: 'epubProbe', write: false});
  const css = await readFile(new URL('../../UI/Web/src/app/_vendor/page-flip/Style/stPageFlip.css', import.meta.url), 'utf8');
  return evaluate(`(async () => {
    ${bundled.outputFiles[0].text}
    const source = document.querySelector('.book-content');
    const area = source.closest('.book-container'), rect = area.getBoundingClientRect();
    const contentRect = source.getBoundingClientRect(), style = getComputedStyle(source);
    const columns = Number(style.columnCount), gap = parseFloat(style.columnGap);
    const geometry = {width: rect.width / columns, height: contentRect.height, columns,
      stride: (source.clientWidth + gap) / columns,
      contentLeft: contentRect.left - rect.left, contentTop: 0,
      contentWidth: contentRect.width, contentHeight: contentRect.height,
      totalColumns: Math.ceil(source.scrollWidth / ((source.clientWidth + gap) / columns)),
      viewportLeft: rect.left, viewportTop: contentRect.top,
      viewportWidth: innerWidth, viewportHeight: innerHeight};
    const rules = document.createElement('style'); rules.textContent = ${JSON.stringify(css)};
    document.head.append(rules);
    const originalOffset = source.scrollLeft;
    source.scrollLeft = 0;
    const samples = [], discrepancies = [];
    const wanted = [...source.querySelectorAll('p, img, h1, h2, [data-probe]')];
    for (let attempt = 0; attempt < 5; attempt++) {
      const host = document.createElement('div');
      Object.assign(host.style, {position:'absolute', left: '0px', top: (contentRect.top - rect.top) + 'px',
        width: rect.width + 'px', height: geometry.height + 'px', zIndex:'10000', pointerEvents:'none'});
      area.append(host);
      let book;
      try {
        const start = performance.now();
        const pages = Array.from({length: columns * 2}, (_, column) => epubProbe.createEpubBookPage(source, column, geometry));
        book = new epubProbe.PageFlip(host, {size:'fixed', width:geometry.width, height:geometry.height,
          usePortrait:false, forcePortrait:columns === 1, useMouseEvents:false, showCover:false,
          autoSize:false, drawShadow:true, maxShadowOpacity:0.5});
        book.loadFromHTML(pages);
        for (const page of pages) page.querySelector('.book-content')?.getBoundingClientRect();
        samples.push(Math.round((performance.now() - start) * 10) / 10);
        await new Promise(requestAnimationFrame);
        if (attempt === 0) {
          for (let half = 0; half < columns; half++) {
            const cloned = [...pages[half].querySelectorAll('p, img, h1, h2, [data-probe]')];
            const left = rect.left + half * geometry.width, right = left + geometry.width;
            for (let i = 0; i < wanted.length; i++) {
              const expected = [...wanted[i].getClientRects()];
              if (!expected.some(r => r.right > left && r.left < right && r.bottom > contentRect.top && r.top < contentRect.bottom)) continue;
              const actual = [...cloned[i].getClientRects()];
              if (actual.length !== expected.length || actual.some((r, j) =>
                Math.abs(r.left - expected[j].left) > 1 || Math.abs(r.top - expected[j].top) > 1 ||
                Math.abs(r.width - expected[j].width) > 1 || Math.abs(r.height - expected[j].height) > 1)) {
                discrepancies.push({half, element: i, tag: wanted[i].tagName,
                  expected: expected.slice(0, 1).map(r => [r.left, r.top, r.width, r.height]),
                  actual: actual.slice(0, 1).map(r => [r.left, r.top, r.width, r.height])});
              }
            }
          }
        }
      } finally {
        book?.destroy(); host.remove();
      }
      // PageFlip has a deferred initialization callback; let it finish before the next sample.
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    source.scrollLeft = originalOffset; rules.remove();
    return {elements: source.querySelectorAll('*').length, columns, samples,
      maxMs: Math.max(...samples), geometryMismatches: discrepancies.length, differences: discrepancies.slice(0, 5),
      sourceOffsetPreserved: source.scrollLeft === originalOffset};
  })()`);
}
