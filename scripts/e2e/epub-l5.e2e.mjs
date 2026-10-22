// L5: the page corner lifts under the mouse and dragging it turns the sheet, or gives up halfway.
export async function runEpubL5Tests({api, chapter, libraryId, route, check, until, evaluate,
  open, send, sleep, progressPosts, bookModeKey}) {
  const profile = await api(`/api/reading-profile/${libraryId}/${chapter.seriesId}`);
  const saved = () => api(`/api/Reader/get-progress?chapterId=${chapter.chapterId}`);
  const stage = () => evaluate(`!!document.querySelector('.epub-book-animation-stage')`);
  const state = () => evaluate(`(() => { const c=document.querySelector('.book-content'), step=c.clientWidth+parseFloat(getComputedStyle(c).columnGap);
    return {offset:c.scrollLeft, step, spread:Math.round(c.scrollLeft/step), spreads:Math.round(c.scrollWidth/step),
      hidden:getComputedStyle(c).visibility==='hidden'}; })()`);
  // The book area and the reader's text box, in viewport coordinates
  const area = () => evaluate(`(() => { const a=document.querySelector('.book-container').getBoundingClientRect(),
    c=document.querySelector('.book-content').getBoundingClientRect();
    return {left:a.left, right:a.right, top:c.top, bottom:c.bottom, width:a.width}; })()`);
  const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', {type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left',
    buttons, clickCount: type === 'mouseMoved' ? 0 : 1});
  async function glide(from, to, buttons = 0, steps = 12) {
    for (let i = 1; i <= steps; i++) {
      await mouse('mouseMoved', from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps, buttons);
      await sleep(16);
    }
  }
  async function load() {
    await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`, {method:'POST', body:{...profile,
      bookReaderLayoutMode:2, bookReaderWritingStyle:0, bookReaderReadingDirection:0, bookReaderFontSize:100,
      bookReaderLineSpacing:100, bookReaderMargin:4, bookReaderThemeName:'Paper', bookReaderTapToPaginate:true,
      bookReaderImmersiveMode:false}});
    await api('/api/Reader/progress', {method:'POST', body:{libraryId, seriesId:chapter.seriesId, volumeId:0,
      chapterId:chapter.chapterId, pageNum:0, bookScrollId:''}});
    await send('Emulation.setDeviceMetricsOverride', {width:1600, height:950, deviceScaleFactor:1, mobile:false});
    await evaluate(`localStorage.setItem('${bookModeKey}', 'true'); true`);
    await open(route('book', chapter));
    if (!await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`), 20000, 100)) {
      throw new Error('L5 EPUB reader did not load.');
    }
    await sleep(800);
    // Away from both corners: the middle of the spread
    const a = await area();
    await mouse('mouseMoved', (a.left + a.right) / 2, (a.top + a.bottom) / 2);
    await sleep(300);
  }
  const settle = async () => { await until(async () => !(await stage()), 2500, 30); await sleep(600); };

  // Hover: the corner lifts; leaving it puts the live reader back, with nothing saved
  await load();
  let a = await area(), before = await state(), posts = progressPosts();
  const middle = {x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2};
  const nextCorner = {x: a.right - 12, y: a.bottom - 12};
  await glide(middle, nextCorner);
  check(!!await until(stage, 800, 20), 'EPUB L5: the mouse near the page corner lifts it');
  await glide(nextCorner, middle);
  check(!!await until(async () => !(await stage()), 1500, 30), 'EPUB L5: leaving the corner lays the page down');
  await sleep(400);
  const rest = await state();
  check(rest.offset === before.offset && !rest.hidden && progressPosts() === posts,
    'EPUB L5: hovering keeps the spread, the live text and the saved progress');

  // Dragging past half the spread turns one sheet and saves once
  posts = progressPosts();
  await glide(middle, nextCorner);
  await until(stage, 800, 20);
  await mouse('mousePressed', nextCorner.x, nextCorner.y, 1);
  await glide(nextCorner, {x: a.left + a.width * 0.15, y: a.bottom - 40}, 1, 20);
  await mouse('mouseReleased', a.left + a.width * 0.15, a.bottom - 40);
  await settle();
  const turned = await state();
  check(turned.spread === before.spread + 1 && !turned.hidden, `EPUB L5: a full drag turns one sheet (${before.spread} -> ${turned.spread})`);
  check(progressPosts() - posts === 1, `EPUB L5: a full drag saves progress once (${progressPosts() - posts})`);

  // Releasing before half the spread gives up: same spread, nothing saved
  await mouse('mouseMoved', middle.x, middle.y); await sleep(300);
  posts = progressPosts();
  await glide(middle, nextCorner);
  await until(stage, 800, 20);
  await mouse('mousePressed', nextCorner.x, nextCorner.y, 1);
  await glide(nextCorner, {x: a.right - a.width * 0.3, y: a.bottom - 30}, 1, 10);
  await mouse('mouseReleased', a.right - a.width * 0.3, a.bottom - 30);
  await glide({x: a.right - a.width * 0.3, y: a.bottom - 30}, middle);
  await settle();
  const kept = await state();
  check(kept.spread === turned.spread && !kept.hidden, `EPUB L5: a drag given up halfway stays on the spread (${turned.spread} -> ${kept.spread})`);
  check(progressPosts() === posts, `EPUB L5: a drag given up saves nothing (${progressPosts() - posts})`);

  // The left corner turns back
  const previousCorner = {x: a.left + 12, y: a.bottom - 12};
  await glide(middle, previousCorner);
  await until(stage, 800, 20);
  await mouse('mousePressed', previousCorner.x, previousCorner.y, 1);
  await glide(previousCorner, {x: a.right - a.width * 0.15, y: a.bottom - 40}, 1, 20);
  await mouse('mouseReleased', a.right - a.width * 0.15, a.bottom - 40);
  await mouse('mouseMoved', middle.x, middle.y);
  await settle();
  check((await state()).spread === turned.spread - 1, 'EPUB L5: dragging the left corner turns back');

  // Text away from the corners is still selected with the mouse. The reader's tap areas cover a fifth of the screen on
  // each side, where a mouse selection never started, so the drag runs along a line of paragraph text outside them.
  const word = await evaluate(`(() => { const c=document.querySelector('.book-content'), r=c.getBoundingClientRect(), from=innerWidth*0.22;
    for (const p of c.querySelectorAll('p[id^="p"]')) { const range=document.createRange(); range.selectNodeContents(p);
      const line=[...range.getClientRects()].find(x=>x.top>r.top+40&&x.bottom<r.bottom-40&&x.left<from&&x.right>from+200);
      if (line) return {x:from+10, y:(line.top+line.bottom)/2}; }
    return null; })()`);
  await mouse('mouseMoved', word.x, word.y);
  await mouse('mousePressed', word.x, word.y, 1);
  await glide(word, {x: word.x + 160, y: word.y}, 1, 8);
  await mouse('mouseReleased', word.x + 160, word.y);
  await sleep(300);
  const selection = await evaluate(`({text:getSelection().toString().trim().slice(0, 30),
    under:document.elementFromPoint(${word?.x ?? 0}, ${word?.y ?? 0})?.className, hidden:getComputedStyle(document.querySelector('.book-content')).visibility})`);
  check(selection.text.length > 5 && !await stage(),
    `EPUB L5: selecting text away from the corners still works (${JSON.stringify({word, ...selection})})`);
  await evaluate(`getSelection().removeAllRanges(); document.querySelector('app-book-line-overlay .fa-times-circle')?.closest('button')?.click(); true`);

  // On the last spread of the HTML, dragging the corner opens the next file, as the arrow does
  a = await area();
  await evaluate(`(() => { const c=document.querySelector('.book-content'), step=c.clientWidth+parseFloat(getComputedStyle(c).columnGap);
    c.scrollLeft=Math.round(c.scrollWidth/step-1)*step; return true; })()`);
  await sleep(800);
  const heading = () => evaluate(`document.querySelector('.book-content h1')?.textContent`);
  const first = await heading();
  await glide(middle, nextCorner);
  await until(stage, 800, 20);
  await mouse('mousePressed', nextCorner.x, nextCorner.y, 1);
  await glide(nextCorner, {x: a.left + a.width * 0.15, y: a.bottom - 40}, 1, 20);
  await mouse('mouseReleased', a.left + a.width * 0.15, a.bottom - 40);
  await mouse('mouseMoved', middle.x, middle.y);
  // The last HTML is saved as the chapter total, the completed mark, so the file is read from the page itself
  check(!!await until(async () => (await heading()) === 'Parte 2', 5000, 100),
    `EPUB L5: dragging the last sheet opens the next HTML file (${first} -> ${await heading()})`);
}
