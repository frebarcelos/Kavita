// L4: selection, highlights and navigation inside the HTML with the book on.
export async function runEpubL4Tests({api, chapter, libraryId, route, check, until, evaluate,
  open, key, send, sleep, progressPosts, bookModeKey}) {
  const profile = await api(`/api/reading-profile/${libraryId}/${chapter.seriesId}`);
  const stage = () => evaluate(`!!document.querySelector('.epub-book-animation-stage')`);
  const state = () => evaluate(`(() => { const c=document.querySelector('.book-content'), step=c.clientWidth+parseFloat(getComputedStyle(c).columnGap);
    return {offset:c.scrollLeft, step, aligned:Math.abs(c.scrollLeft/step-Math.round(c.scrollLeft/step))<0.01}; })()`);
  // An element is on the current spread when one of its boxes is inside the reader's text box
  const onSpread = selector => evaluate(`(() => { const c=document.querySelector('.book-content'), r=c.getBoundingClientRect();
    const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return false;
    return [...e.getClientRects()].some(x=>x.width>0&&x.right>r.left+1&&x.left<r.right-1); })()`);
  async function load() {
    await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`, {method:'POST', body:{...profile,
      bookReaderLayoutMode:2, bookReaderWritingStyle:0, bookReaderReadingDirection:0, bookReaderFontSize:100,
      bookReaderMargin:4, bookReaderThemeName:'Paper', bookReaderTapToPaginate:true, bookReaderImmersiveMode:false}});
    await api('/api/Reader/progress', {method:'POST', body:{libraryId, seriesId:chapter.seriesId, volumeId:0,
      chapterId:chapter.chapterId, pageNum:0, bookScrollId:''}});
    await send('Emulation.setDeviceMetricsOverride', {width:1600, height:950, deviceScaleFactor:1, mobile:false});
    await evaluate(`localStorage.setItem('${bookModeKey}', 'true'); true`);
    await open(route('book', chapter));
    if (!await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`), 20000, 100)) {
      throw new Error('L4 EPUB reader did not load.');
    }
    await sleep(800);
  }
  async function turn() {
    await evaluate(`document.querySelector('.reader-container').focus(); true`);
    await key('ArrowRight', 'ArrowRight');
    await until(async () => !(await stage()) && (await state()).aligned, 1500, 30);
    await sleep(500);
  }
  // Selects the start of the first paragraph that begins on the spread and releases the pointer there, as a reader does
  const select = () => evaluate(`(() => { const c=document.querySelector('.book-content'), r=c.getBoundingClientRect();
    const p=[...c.querySelectorAll('p[id^="p"]')].find(p=>{ const x=p.getClientRects()[0]; return x&&x.left>=r.left&&x.right<=r.right; });
    const text=[...p.childNodes].find(n=>n.nodeType===3&&n.data.trim()); const range=document.createRange();
    range.setStart(text, 0); range.setEnd(text, 30); const s=getSelection(); s.removeAllRanges(); s.addRange(range);
    const box=range.getBoundingClientRect();
    p.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerType:'mouse', button:0, clientX:box.left+4, clientY:box.top+4}));
    return p.id; })()`);
  const overlayOpen = () => evaluate(`!!document.querySelector('app-book-line-overlay .overlay')`);

  // L4.1: a turn closes the selection and its menu, so neither points at text that is no longer on screen
  await load();
  await turn();
  await select();
  check(!!await until(overlayOpen, 3000, 50), 'EPUB L4: selecting text opens the selection menu');
  await evaluate(`document.querySelector('.reader-container').focus(); true`);
  await key('ArrowRight', 'ArrowRight');
  check(!!await until(stage, 400, 15), 'EPUB L4: a turn starts with a selection open');
  check(await evaluate(`getSelection().toString()`) === '' && !await overlayOpen(),
    'EPUB L4: the turn clears the selection and closes its menu');
  await until(async () => !(await stage()), 1500, 30); await sleep(500);

  // L4.1: a highlight made with the book on is part of the HTML, so it is on the turning sheet too
  const paragraph = await select(), beforeCreate = (await state()).offset;
  await until(overlayOpen, 3000, 50);
  await evaluate(`document.querySelector('app-book-line-overlay .fa-highlighter').closest('button').click(); true`);
  const created = await until(() => evaluate(`(() => { const b=[...document.querySelectorAll('app-view-edit-annotation-drawer button.btn-primary')]
    .find(b=>b.offsetParent!==null); b?.click(); return !!b; })()`), 5000, 100);
  check(!!created, 'EPUB L4: the highlight can be created with the book on');
  const highlight = `#${paragraph} app-epub-highlight`;
  const shown = await until(() => onSpread(highlight), 8000, 100);
  const stored = (await api(`/api/annotation/all?chapterId=${chapter.chapterId}`)).map(a => a.xPath).join(' ');
  const where = await evaluate(`(() => { const c=document.querySelector('.book-content'), r=c.getBoundingClientRect();
    return [...document.querySelectorAll('.book-content app-epub-highlight')].map(h=>h.closest('p')?.id+'@'+Math.round(h.getBoundingClientRect().left-r.left)).join(' ')
      + ' offset ' + c.scrollLeft; })()`);
  check(!!shown, `EPUB L4: the new highlight is on the current spread (selected ${paragraph}, stored ${stored}, shown ${where})`);
  await sleep(500);
  const afterCreate = (await state()).offset;
  check(afterCreate === beforeCreate, `EPUB L4: creating a highlight keeps the spread (${beforeCreate} -> ${afterCreate})`);
  // The colour is an inline style on the innermost highlight span
  const markOf = `(h => [...h.querySelectorAll('.epub-highlight')].pop() ?? h)`;
  const liveColor = () => evaluate(`getComputedStyle(${markOf}(document.querySelector(${JSON.stringify(highlight)}))).backgroundColor`);
  await evaluate(`document.querySelector('.reader-container').focus(); true`);
  await key('ArrowRight', 'ArrowRight');
  await until(stage, 400, 15);
  const onSheet = await evaluate(`(() => { const out=[];
    for (const box of document.querySelectorAll('.epub-book-animation-stage .epub-book-text-box')) {
      const r=box.getBoundingClientRect(), h=box.querySelector(${JSON.stringify(highlight)}); if(!h) continue;
      if ([...h.getClientRects()].some(x=>x.width>0&&x.right>r.left+1&&x.left<r.right-1)) out.push(getComputedStyle(${markOf}(h)).backgroundColor); }
    return out; })()`);
  await until(async () => !(await stage()), 1500, 30); await sleep(500);
  await evaluate(`document.querySelector('.reader-container').focus(); true`);
  await key('ArrowLeft', 'ArrowLeft');
  await until(async () => !(await stage()), 1500, 30); await sleep(500);
  check(await onSpread(highlight), 'EPUB L4: turning back shows the highlight again');
  // Compared with the reader once the highlight's fade-in after creation is over
  const settled = await liveColor();
  check(onSheet.length > 0 && onSheet.every(color => color === settled) && settled !== 'rgba(0, 0, 0, 0)',
    `EPUB L4: the highlight shows on the turning sheet with its colour (${settled} / ${onSheet.join(', ')})`);

  // L4.2: links and contents inside the same HTML turn to the target instead of jumping
  async function follow(label, action, target) {
    await load();
    const posts = progressPosts(), before = await state();
    await evaluate(action);
    const turned = await until(stage, 600, 15);
    await until(async () => !(await stage()) && (await onSpread(target)), 2500, 30);
    await sleep(600);
    const after = await state();
    check(!!turned, `EPUB L4: ${label} turns the page`);
    check(await onSpread(target) && after.aligned && after.offset > before.offset,
      `EPUB L4: ${label} ends on the spread of its target`);
    check(progressPosts() - posts <= 1, `EPUB L4: ${label} saves progress at most once (${progressPosts() - posts})`);
  }
  await follow('an internal link', `[...document.querySelectorAll('.book-content a')].find(a=>a.textContent.includes('trecho 70')).click(); true`, '#p70');
  await follow('a link to the same file', `[...document.querySelectorAll('.book-content a')].find(a=>a.textContent.includes('trecho 80')).click(); true`, '#p80');
  await follow('a contents entry in the same file', `(async () => {
    document.querySelector('.top-action-bar .fa-rectangle-list').closest('button').click();
    for (let i = 0; i < 50; i++) { const a=[...document.querySelectorAll('app-view-toc-drawer a')].find(a=>a.textContent.trim()==='Trecho 50');
      if (a) { a.click(); return true; } await new Promise(r=>setTimeout(r,100)); }
    return false; })()`, '#p50');
}
