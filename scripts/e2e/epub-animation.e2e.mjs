// L2: the live reader commits only after the transient PageFlip layer has settled.
import {mkdir, writeFile} from 'node:fs/promises';

export async function runEpubAnimationTests({api, chapter, libraryId, route, check, until, evaluate,
  open, key, send, sleep, progressPosts, bookModeKey}) {
  const artifacts = new URL('../../_temp/epub-l2/', import.meta.url);
  await mkdir(artifacts, {recursive: true});
  const profile = await api(`/api/reading-profile/${libraryId}/${chapter.seriesId}`);
  const saved = () => api(`/api/Reader/get-progress?chapterId=${chapter.chapterId}`);
  const stage = () => evaluate(`!!document.querySelector('.epub-book-animation-stage')`);
  const state = () => evaluate(`(() => { const c=document.querySelector('.book-content'); if(!c)return null;
    const stride=c.clientWidth+parseFloat(getComputedStyle(c).columnGap);
    return {page:Math.round(c.scrollLeft/stride)+1, offset:c.scrollLeft,
      columns:Number(getComputedStyle(c).columnCount), pages:Math.ceil(c.scrollWidth/stride)}; })()`);
  async function load(direction, columns = 2) {
    await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`, {method:'POST',body:{...profile,
      bookReaderLayoutMode:2, bookReaderWritingStyle:0, bookReaderReadingDirection:direction, bookReaderFontSize:100,
      bookReaderMargin:4, bookReaderThemeName:'Paper', bookReaderTapToPaginate:true, bookReaderImmersiveMode:false}});
    await api('/api/Reader/progress',{method:'POST',body:{libraryId, seriesId:chapter.seriesId, volumeId:0,
      chapterId:chapter.chapterId, pageNum:0, bookScrollId:''}});
    await evaluate(`localStorage.setItem('${bookModeKey}', 'true'); true`);
    await send('Emulation.setDeviceMetricsOverride',{width:1600,height:950,deviceScaleFactor:1,mobile:false});
    await open(route('book',chapter));
    if (!await until(() => evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`),20000,100)) {
      throw new Error('Animated EPUB reader did not load.');
    }
    await sleep(700);
    if (columns === 1) {
      await evaluate(`document.querySelector('.top-action-bar .fa-bars').closest('button').click(); true`);
      if (!await until(() => evaluate(`!!document.querySelector('#layout-mode-col1')`),5000,100)) throw new Error('No layout menu');
      await evaluate(`document.querySelector('#layout-mode-col1').click(); true`);
      await evaluate(`document.querySelector('.top-action-bar .fa-bars').closest('button').click(); true`);
      await sleep(700);
    }
  }

  const measurements = [];
  for (const columns of [1,2]) for (const direction of [0,1]) {
    await load(direction, columns);
    await evaluate(`document.querySelector('.book-content').style.setProperty('visibility','visible','important'); true`);
    const before=await state(), posts=progressPosts(), start=performance.now();
    const forward=direction===0?'ArrowRight':'ArrowLeft';
    await key(forward, forward);
    check(!!await until(stage,400,15),`EPUB animation ${columns}/${direction}: transient book starts`);
    check((await state()).offset===before.offset,`EPUB animation ${columns}/${direction}: live text waits for the turn`);
    check(await evaluate(`getComputedStyle(document.querySelector('.book-content')).visibility==='hidden' &&
      [...document.querySelectorAll('.epub-book-clip')].every(p=>getComputedStyle(p).backgroundColor!=='rgba(0, 0, 0, 0)')`),
      `EPUB animation ${columns}/${direction}: opaque sheets replace the hidden live text`);
    await sleep(160);
    check(await evaluate(`[...document.querySelectorAll('.epub-book-animation-stage .stf__item')].some(p=>p.style.transform.includes('rotate'))`),
      `EPUB animation ${columns}/${direction}: engine rotates an HTML page`);
    if (columns===2 && direction===0) {
      const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
      await writeFile(new URL('virada-sintetica.png',artifacts),Buffer.from(shot.result.data,'base64'));
    }
    const finished=await until(async()=>!(await stage()) && (await state()).page===before.page+1,1000,20);
    const responseMs=Math.round(performance.now()-start);
    check(!!finished && responseMs<1000,`EPUB animation ${columns}/${direction}: one spread within 1 s (${responseMs} ms)`);
    check(await evaluate(`document.querySelector('.book-content').style.visibility==='visible' &&
      document.querySelector('.book-content').style.getPropertyPriority('visibility')==='important'`),
      `EPUB animation ${columns}/${direction}: exact live visibility restored`);
    await sleep(500);
    const saves=progressPosts()-posts;
    check(saves===1 && (await saved()).pageNum===0,`EPUB animation ${columns}/${direction}: one save, unchanged HTML index (${saves})`);
    measurements.push({columns,direction,responseMs,saves});
    const backward=direction===0?'ArrowLeft':'ArrowRight';
    await key(backward,backward);
    check(!!await until(async()=>!(await stage()) && (await state()).page===before.page,1100,20),
      `EPUB animation ${columns}/${direction}: previous spread returns`);
    await sleep(500);
  }

  await load(0);
  const burstBefore=await state(), burstPosts=progressPosts();
  for(let i=0;i<20;i++) await key('ArrowRight','ArrowRight');
  await until(async()=>!(await stage()),1100,20); await sleep(500);
  check((await state()).page===burstBefore.page+1 && progressPosts()-burstPosts===1,
    'EPUB animation: 20 rapid commands form one turn and one progress save');

  for (const [label,command] of [
    ['wheel',`document.querySelector('.book-content').dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}))`],
    ['next button',`document.querySelector('.bottom-bar .fa-angle-right').closest('button').click()`],
    ['side tap',`document.querySelector('.tap-to-paginate .right').click()`]]) {
    const before=await state();
    await evaluate(command+'; true');
    check(!!await until(stage,400,15),`EPUB animation: ${label} starts a turn`);
    check(!!await until(async()=>!(await stage()) && (await state()).page===before.page+1,1100,20),
      `EPUB animation: ${label} advances once`);
    await sleep(500);
  }

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const still=await state(); await key('ArrowRight','ArrowRight');
  check(!!await until(async()=>(await state()).page===still.page+1 && !(await stage()),300,15),
    'EPUB animation: reduced motion uses the instant L1 reader');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await sleep(500);

  // Cross HTML boundaries through the original reader, never through a synthetic column index.
  await evaluate(`(() => {const c=document.querySelector('.book-content'), step=c.clientWidth+parseFloat(getComputedStyle(c).columnGap);
    c.scrollLeft=(Math.ceil(c.scrollWidth/step)-1)*step; return true;})()`);
  await key('ArrowRight','ArrowRight');
  check(!!await until(()=>evaluate(`document.querySelector('.book-content h1')?.textContent==='Parte 2'`),5000,50),
    'EPUB animation: after the final column opens the next HTML file');
  await sleep(700); await key('ArrowLeft','ArrowLeft');
  check(!!await until(()=>evaluate(`document.querySelector('.book-content h1')?.textContent==='Parte 1'`),5000,50),
    'EPUB animation: before the first column returns to the previous HTML file');
  await sleep(700);
  check(!(await stage()) && await evaluate('1+1')===2,'EPUB animation: no overlay remains and reader still responds');
  await writeFile(new URL('animation-measurements.json',artifacts),JSON.stringify(measurements,null,2)+'\n');
}
