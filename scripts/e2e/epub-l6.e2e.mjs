// L6: text options of the reading profile (justify, hyphenation, paragraph spacing, first line indent, publisher styles).
export async function runEpubL6Tests({api, chapter, libraryId, route, check, until, evaluate,
  open, key, send, sleep, bookModeKey}) {
  const profile = await api(`/api/reading-profile/${libraryId}/${chapter.seriesId}`);
  const stage = () => evaluate(`!!document.querySelector('.epub-book-animation-stage')`);
  const saved = () => api(`/api/reading-profile/${libraryId}/${chapter.seriesId}`);
  // A paragraph of the chapter text, never the publisher's own blocks
  const paragraph = prop => evaluate(`(() => { const p=document.querySelector('.book-content p[id^="p"]'); const s=getComputedStyle(p);
    return {value:s[${JSON.stringify(prop)}], font:parseFloat(s.fontSize)}; })()`);
  async function load() {
    await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`, {method:'POST', body:{...profile,
      bookReaderLayoutMode:2, bookReaderWritingStyle:0, bookReaderReadingDirection:0, bookReaderFontSize:100,
      bookReaderLineSpacing:100, bookReaderMargin:4, bookReaderThemeName:'Paper', bookReaderTapToPaginate:true,
      bookReaderImmersiveMode:false, bookReaderJustify:false, bookReaderHyphenate:false, bookReaderParagraphSpacing:null,
      bookReaderTextIndent:null, bookReaderIgnorePublisherStyles:false}});
    await api('/api/Reader/progress', {method:'POST', body:{libraryId, seriesId:chapter.seriesId, volumeId:0,
      chapterId:chapter.chapterId, pageNum:0, bookScrollId:''}});
    await send('Emulation.setDeviceMetricsOverride', {width:1600, height:950, deviceScaleFactor:1, mobile:false});
    await evaluate(`localStorage.setItem('${bookModeKey}', 'true'); true`);
    await open(route('book', chapter));
    if (!await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`), 20000, 100)) {
      throw new Error('L6 EPUB reader did not load.');
    }
    await sleep(800);
  }
  async function menu() {
    if (await evaluate(`!!document.querySelector('#justify-text')`)) return true;
    await evaluate(`document.querySelector('.top-action-bar .fa-bars').closest('button').click(); true`);
    return until(() => evaluate(`!!document.querySelector('#justify-text')`), 5000, 100);
  }
  const toggle = id => evaluate(`(() => { const i=document.querySelector('#${id}'); i.click(); return i.checked; })()`);
  const choose = (id, value) => evaluate(`(() => { const s=document.querySelector('#${id}'); s.value=${JSON.stringify(value)};
    s.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
  // Saved through the implicit profile after the form debounce
  const persisted = (field, value) => until(async () => (await saved())[field] === value, 4000, 200);

  await load();
  check(!!await menu(), 'EPUB L6: the text options are in the reader menu');

  // Justify
  check((await paragraph('textAlign')).value !== 'justify', 'EPUB L6: paragraphs start with the book alignment');
  await toggle('justify-text');
  check(!!await until(async () => (await paragraph('textAlign')).value === 'justify', 2000, 50), 'EPUB L6: justify aligns paragraphs to both margins');
  check(!!await persisted('bookReaderJustify', true), 'EPUB L6: justify is saved in the reading profile');

  // Hyphenation
  await toggle('hyphenate-text');
  check(!!await until(async () => (await paragraph('hyphens')).value === 'auto', 2000, 50), 'EPUB L6: hyphenation turns on for paragraphs');
  check(await evaluate(`!!document.querySelector('.book-content p[id^="p"]').closest('[lang]')`),
    'EPUB L6: the text has a language, which hyphenation needs');
  check(!!await persisted('bookReaderHyphenate', true), 'EPUB L6: hyphenation is saved in the reading profile');

  // Paragraph spacing, in tenths of an em; a paragraph already has 1 em below by default, so 2 em tells them apart
  await choose('paragraph-spacing', '20');
  check(!!await until(async () => { const p = await paragraph('marginBottom'); return Math.abs(parseFloat(p.value) - 2 * p.font) < 0.5; }, 2000, 50),
    'EPUB L6: paragraph spacing of 2 em is applied');
  check((await paragraph('marginTop')).value === '0px', 'EPUB L6: paragraph spacing replaces the top margin');
  check(!!await persisted('bookReaderParagraphSpacing', 20), 'EPUB L6: paragraph spacing is saved in the reading profile');

  // First line indent: the publisher's 2em, removed, then back to the book's own
  const bookIndent = await paragraph('textIndent');
  check(Math.abs(parseFloat(bookIndent.value) - 2 * bookIndent.font) < 0.5, `EPUB L6: the publisher indent is in place (${bookIndent.value})`);
  await choose('text-indent', '0');
  check(!!await until(async () => (await paragraph('textIndent')).value === '0px', 2000, 50), 'EPUB L6: indent 0 removes the publisher indent');
  check(!!await persisted('bookReaderTextIndent', 0), 'EPUB L6: indent is saved in the reading profile');
  await choose('text-indent', '');
  check(!!await until(async () => (await paragraph('textIndent')).value === bookIndent.value, 2000, 50), 'EPUB L6: "from the book" gives the publisher indent back');
  check(!!await persisted('bookReaderTextIndent', null), 'EPUB L6: "from the book" is saved as no override');

  // Ignore publisher styles: the publisher columns and fixed note go back to plain text
  const publisher = () => evaluate(`(() => { const c=document.querySelector('.book-content .publisher-columns'), f=document.querySelector('.book-content .publisher-fixed');
    return {columns:getComputedStyle(c).columnCount, position:getComputedStyle(f).position}; })()`);
  check((await publisher()).columns === '2', 'EPUB L6: the publisher stylesheet is in effect');
  await toggle('ignore-publisher-styles');
  check(!!await until(async () => { const p = await publisher(); return p.columns === 'auto' && p.position === 'static'; }, 2000, 50),
    'EPUB L6: ignoring the publisher styles leaves plain text');
  check(!!await persisted('bookReaderIgnorePublisherStyles', true), 'EPUB L6: ignoring publisher styles is saved in the reading profile');

  // Reopening keeps every option; a turn shows the same text on the turning sheet
  await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`, {method:'POST', body:{...(await saved()),
    bookReaderJustify:true, bookReaderHyphenate:true, bookReaderParagraphSpacing:10, bookReaderTextIndent:0, bookReaderIgnorePublisherStyles:true}});
  await open(route('book', chapter));
  await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`), 20000, 100);
  await sleep(800);
  const reopened = await evaluate(`(() => { const s=getComputedStyle(document.querySelector('.book-content p[id^="p"]'));
    return [s.textAlign, s.hyphens, s.textIndent, getComputedStyle(document.querySelector('.book-content .publisher-columns')).columnCount].join(' '); })()`);
  check(reopened === 'justify auto 0px auto', `EPUB L6: reopening the book keeps the options (${reopened})`);
  await evaluate(`document.querySelector('.reader-container').focus(); true`);
  await key('ArrowRight', 'ArrowRight');
  await until(stage, 400, 15);
  const sheet = await evaluate(`(() => { const p=document.querySelector('.epub-book-animation-stage .book-content p[id^="p"]');
    return p ? [getComputedStyle(p).textAlign, getComputedStyle(p).textIndent].join(' ') : 'none'; })()`);
  check(sheet === 'justify 0px', `EPUB L6: the turning sheet shows the same options (${sheet})`);
  await until(async () => !(await stage()), 1500, 30);

  // Leave the shared profile as the other scenarios expect it
  await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`, {method:'POST', body:{...(await saved()),
    bookReaderJustify:false, bookReaderHyphenate:false, bookReaderParagraphSpacing:null, bookReaderTextIndent:null,
    bookReaderIgnorePublisherStyles:false}});
}
