// L1: real Chromium layout, live text and the unchanged pageNum + bookScrollId contract.
import {mkdir, writeFile} from 'node:fs/promises';

export async function runEpubTests({api, chapter, libraryId, route, check, until, evaluate,
  open, key, send, sleep, progressPosts, bookModeKey}) {
  const artifacts = new URL('../../_temp/epub-livro/', import.meta.url);
  await mkdir(artifacts, {recursive: true});
  const profileRoute = `/api/reading-profile/${libraryId}/${chapter.seriesId}`;
  const saved = () => api(`/api/Reader/get-progress?chapterId=${chapter.chapterId}`);
  const originalProfile = await api(profileRoute);
  const configure = overrides => api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`,
    {method: 'POST', body: {...originalProfile, bookReaderLayoutMode: 2, bookReaderWritingStyle: 0,
      bookReaderReadingDirection: 0, bookReaderFontSize: 100, bookReaderMargin: 4,
      bookReaderImmersiveMode: false, bookReaderTapToPaginate: false, ...overrides}});
  const state = () => evaluate(`(() => {
    const c = document.querySelector('.book-content'); if (!c) return null;
    const style = getComputedStyle(c), gap = parseFloat(style.columnGap);
    const text = getComputedStyle(c.querySelector('p'));
    const stride = c.clientWidth + gap;
    return {columns: Number(style.columnCount), gap, offset: c.scrollLeft,
      page: Math.round(c.scrollLeft / stride) + 1, pages: Math.ceil(c.scrollWidth / stride),
      font: style.fontSize, family: text.fontFamily, lineHeight: text.lineHeight, margin: style.marginLeft,
      width: c.clientWidth, leftEdge: document.querySelector('.epub-book-edge-left')?.style.width,
      decoration: !!document.querySelector('app-epub-book-decoration'), spine: !!document.querySelector('.epub-book-spine'),
      dark: !!document.querySelector('.epub-book-dark'), button: !!document.querySelector('.epub-book-toggle')};
  })()`);
  async function load(book) {
    await evaluate(`localStorage.setItem('${bookModeKey}', '${book}'); true`);
    await open(route('book', chapter));
    if (!await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`), 20000, 100)) {
      throw new Error('EPUB did not load.');
    }
    await sleep(700); // Existing layout and saved-position timers finish before assertions.
    return state();
  }
  async function screenshot(name) {
    const response = await send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: false});
    if (!response.result?.data) throw new Error('No EPUB screenshot returned: ' + JSON.stringify(response));
    await writeFile(new URL(name + '.png', artifacts), Buffer.from(response.result.data, 'base64'));
  }
  async function drawer() {
    await evaluate(`document.querySelector('.top-action-bar .fa-bars')?.closest('button').click(); true`);
    return until(() => evaluate(`!!document.querySelector('#fontsize')`), 5000, 100);
  }
  const measurements = [];

  // Characterization in the browser includes actual CSS columns and keyboard bindings.
  for (const layout of [1, 2]) {
    for (const direction of [0, 1]) {
      await configure({bookReaderLayoutMode: layout, bookReaderReadingDirection: direction});
      await api('/api/Reader/progress', {method: 'POST', body: {libraryId, seriesId: chapter.seriesId,
        volumeId: 0, chapterId: chapter.chapterId, pageNum: 0, bookScrollId: ''}});
      const before = await load(false);
      check(before.columns === layout && before.pages > 2 && !before.decoration,
        `EPUB off: CSS layout ${layout}, direction ${direction}, ${before.pages} virtual spreads`);
      const start = performance.now(), posts = progressPosts();
      const forward = direction === 0 ? 'ArrowRight' : 'ArrowLeft';
      const backward = direction === 0 ? 'ArrowLeft' : 'ArrowRight';
      await key(forward, forward);
      const moved = await until(async () => (await state())?.page === before.page + 1, 1000, 30);
      measurements.push({layout, direction, book: false, responseMs: Math.round(performance.now() - start)});
      check(!!moved, `EPUB off: next spread responds within 1 s (${layout}/${direction})`);
      await sleep(500);
      await key(backward, backward);
      check(!!await until(async () => (await state())?.page === before.page, 1000, 30),
        `EPUB off: previous spread returns (${layout}/${direction})`);
      await sleep(500);
      measurements.at(-1).saves = progressPosts() - posts;
      check((await saved()).pageNum === 0, `EPUB virtual paging keeps the HTML index (${layout}/${direction})`);
    }
  }

  await configure({bookReaderLayoutMode: 1, bookReaderThemeName: 'Paper'});
  const plain = await load(false);
  await evaluate(`document.querySelector('.epub-book-toggle')?.click(); true`);
  check(!!await until(async () => (await state())?.spine, 3000, 50), 'EPUB Livro: button opens a two-page book');
  const book = await state();
  check(book.columns === 2 && book.gap >= 64 && book.width > 1000, 'EPUB Livro: full-width spread and extra inner margin');
  check((await api(profileRoute)).bookReaderLayoutMode === 1, 'EPUB Livro: enabling does not update the server layout');
  check(await evaluate(`localStorage.getItem('${bookModeKey}')`) === 'true', 'EPUB Livro: preference is remembered');
  check(await evaluate(`getComputedStyle(document.querySelector('app-epub-book-decoration')).pointerEvents`) === 'none',
    'EPUB Livro: decoration does not intercept text selection or links');
  await screenshot('papel-duas-paginas');
  // Many EPUBs draw drop caps and ornaments as JPEGs with a white background; on paper they blend like print
  const imageBlend = () => evaluate(`(() => { const c = document.querySelector('.book-content'), i = document.createElement('img');
    c.prepend(i); const value = getComputedStyle(i).mixBlendMode; i.remove(); return value; })()`);
  check(await imageBlend() === 'multiply', 'EPUB Livro: images blend with the paper theme');

  const initial = await state(), posts = progressPosts(), start = performance.now();
  await key('ArrowRight', 'ArrowRight');
  check(!!await until(async () => (await state())?.page === initial.page + 1, 1000, 30),
    'EPUB Livro: next spread responds within 1 s');
  measurements.push({book: true, responseMs: Math.round(performance.now() - start)});
  await sleep(700);
  check((await state()).leftEdge !== initial.leftEdge, 'EPUB Livro: paper edges follow virtual paging');
  const bookmark = await saved();
  check(bookmark.pageNum === 0 && !!bookmark.bookScrollId, 'EPUB Livro: saves HTML index and text position');
  const reloaded = await load(true);
  check(reloaded.offset > 0 && reloaded.spine, 'EPUB Livro: reopens at saved progress with the remembered preference');
  await key('ArrowLeft', 'ArrowLeft');
  await sleep(700);
  check((await state()).page < reloaded.page && (await saved()).pageNum === 0, 'EPUB Livro: previous spread keeps the progress contract');
  measurements.at(-1).savesIncludingReopen = progressPosts() - posts;
  const offSaves = Math.max(...measurements.filter(m => m.book === false).map(m => m.saves));
  // Reloads have their own initial progress reporting; compare the per-turn stops below without a reload.
  const steadyPosts = progressPosts();
  await key('ArrowRight', 'ArrowRight'); await sleep(600);
  await key('ArrowLeft', 'ArrowLeft'); await sleep(600);
  measurements.at(-1).saves = progressPosts() - steadyPosts;
  check(measurements.at(-1).saves <= offSaves, 'EPUB Livro: no extra progress writes compared with ordinary paging');

  check(!!await drawer(), 'EPUB Livro: existing appearance menu remains available');
  await evaluate(`(() => { const input = document.querySelector('#fontsize'); input.value = '150';
    input.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
  check(!!await until(async () => (await state())?.font !== book.font, 3000, 50), 'EPUB Livro: changing font size repaginates live text');
  const typography = await state();
  for (const [id, value, property] of [['linespacing', '200', 'lineHeight'], ['margin', '10', 'margin']]) {
    await evaluate(`(() => { const input = document.querySelector('#${id}'); input.value = '${value}';
      input.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
    check(!!await until(async () => (await state())?.[property] !== typography[property], 3000, 50),
      `EPUB Livro: changing ${id} repaginates live text`);
  }
  const margined = await state();
  check(Math.abs(margined.gap - (64 + 2 * parseFloat(margined.margin))) < 1.5,
    `EPUB Livro: the spine side keeps the reader margin plus the spine room (${margined.gap}px, margin ${margined.margin})`);
  const changedFont = await evaluate(`(() => { const input = document.querySelector('select#library-type');
    const next = [...input.options].find(o => o.value && o.value !== input.value);
    if (!next) return false; input.value = next.value;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
  check(changedFont && !!await until(async () => (await state())?.family !== typography.family, 3000, 50),
    'EPUB Livro: changing font family preserves live text');
  await evaluate(`document.querySelector('#layout-mode-col1')?.click(); true`);
  check(!!await until(async () => (await state())?.columns === 1 && !(await state())?.spine, 3000, 50),
    'EPUB Livro: one-page layout hides the spine');
  await evaluate(`document.querySelector('.top-action-bar .fa-bars')?.closest('button').click(); true`);
  await screenshot('uma-pagina');
  await sleep(700);
  check((await api(profileRoute)).bookReaderLayoutMode === 1, 'EPUB Livro: typography updates preserve the stored layout');

  for (const theme of ['Dark', 'Black', 'White']) {
    await configure({bookReaderThemeName: theme});
    const themed = await load(true);
    check(themed.dark === (theme !== 'White') && themed.spine, `EPUB Livro: ${theme} palette`);
    // Multiply would turn images almost black on a dark page; on white it changes nothing
    if (theme !== 'White') check(await imageBlend() === 'normal', `EPUB Livro: ${theme} keeps images unblended`);
    await screenshot(theme.toLowerCase());
  }
  await configure({bookReaderReadingDirection: 1});
  const rtl = await load(true);
  await key('ArrowLeft', 'ArrowLeft');
  check(!!await until(async () => (await state())?.page > rtl.page, 1000, 30), 'EPUB Livro: RTL keyboard advances');
  await send('Emulation.setDeviceMetricsOverride', {width: 650, height: 950, deviceScaleFactor: 1, mobile: false});
  check(!!await until(async () => (await state())?.columns === 1 && !(await state())?.spine, 3000, 100),
    'EPUB Livro: narrow viewport has one page');
  await screenshot('janela-estreita');
  await send('Emulation.clearDeviceMetricsOverride');
  await configure({bookReaderWritingStyle: 1, bookReaderLayoutMode: 1});
  const vertical = await load(true);
  check(!vertical.button && !vertical.decoration, 'EPUB Livro: vertical writing hides the button and decoration');
  await configure({bookReaderLayoutMode: 0});
  const scrolling = await load(true);
  check(!scrolling.button && !scrolling.decoration, 'EPUB Livro: scrolling keeps its original reader');
  await configure({bookReaderLayoutMode: 2});
  const off = await load(false);
  check(!off.decoration && off.gap === plain.gap, 'EPUB Livro off: original CSS gap restored');
  await writeFile(new URL('medidas.json', artifacts), JSON.stringify(measurements, null, 2) + '\n');
}
