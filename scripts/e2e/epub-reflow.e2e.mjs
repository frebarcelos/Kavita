// L3: preserve the actual bookScrollId anchor, including appearance changes during a turn.
import {mkdir, writeFile} from 'node:fs/promises';

export async function runEpubReflowTests({api, chapter, libraryId, route, check, until, evaluate,
  open, key, send, sleep, progressPosts, bookModeKey}) {
  const profile=await api(`/api/reading-profile/${libraryId}/${chapter.seriesId}`);
  await api(`/api/reading-profile/series?libraryId=${libraryId}&seriesId=${chapter.seriesId}`,{method:'POST',body:{...profile,
    bookReaderLayoutMode:2,bookReaderWritingStyle:0,bookReaderReadingDirection:0,bookReaderFontSize:100,
    bookReaderFontFamily:'default',bookReaderLineSpacing:100,bookReaderMargin:4,
    bookReaderThemeName:'Paper',bookReaderTapToPaginate:true,bookReaderImmersiveMode:false}});
  await api('/api/Reader/progress',{method:'POST',body:{libraryId,seriesId:chapter.seriesId,volumeId:0,
    chapterId:chapter.chapterId,pageNum:0,bookScrollId:''}});
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:950,deviceScaleFactor:1,mobile:false});
  await evaluate(`localStorage.setItem('${bookModeKey}','true'); true`);
  await open(route('book',chapter));
  if(!await until(()=>evaluate(`!!document.querySelector('.reading-section:not(.is-loading) .book-content p')`),20000,100)) {
    throw new Error('Reflow EPUB reader did not load.');
  }
  await sleep(700);
  const state=()=>evaluate(`(() => {const c=document.querySelector('.book-content'),s=getComputedStyle(c),step=c.clientWidth+parseFloat(s.columnGap);
    return {offset:c.scrollLeft,step,columns:Number(s.columnCount),font:s.fontSize,
      family:getComputedStyle(c.querySelector('p')).fontFamily,lineHeight:getComputedStyle(c.querySelector('p')).lineHeight,
      margin:s.marginLeft,theme:document.body.className,
      stage:!!document.querySelector('.epub-book-animation-stage'),
      aligned:Math.abs(c.scrollLeft/step-Math.round(c.scrollLeft/step))<0.01};})()`);
  const saved=()=>api(`/api/Reader/get-progress?chapterId=${chapter.chapterId}`);
  const visible=path=>evaluate(`(() => {
    const c=document.querySelector('.book-content'),r=c.getBoundingClientRect();
    const p=document.evaluate(${JSON.stringify(path)},document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
    return !!p && c.contains(p) && [...p.getClientRects()].some(x=>x.right>Math.max(0,r.left)&&x.left<Math.min(innerWidth,r.right)&&x.bottom>Math.max(38,r.top)&&x.top<Math.min(innerHeight-38,r.bottom));})()`);
  async function turn() {
    const before=await state();
    await evaluate(`document.querySelector('.reader-container').focus(); true`);
    await key('ArrowRight','ArrowRight');
    if(!await until(async()=>{const next=await state();return !next.stage&&next.offset>before.offset;},1200,20)) throw new Error('Reflow turn failed');
    await sleep(500);
  }
  for(let i=0;i<4;i++) await turn();
  const anchor=(await saved()).bookScrollId;
  check(!!anchor&&await visible(anchor),'EPUB reflow: saved middle-of-chapter text anchor is visible');
  await evaluate(`document.querySelector('.top-action-bar .fa-bars').closest('button').click(); true`);
  if(!await until(()=>evaluate(`!!document.querySelector('#fontsize')`),5000,100)) throw new Error('No reflow settings menu');
  const records=[];
  // The first character inside the visible spread, found from text geometry before each change (the settings drawer
  // covers the reader, so a hit test would land on it). Narrower columns hold less text, so a paragraph that started
  // mid-spread may move on; the text read at the top of the spread may not.
  const markTopText=()=>evaluate(`(() => {const c=document.querySelector('.book-content'),b=c.getBoundingClientRect();
    const walker=document.createTreeWalker(c,NodeFilter.SHOW_TEXT),r=document.createRange();
    for(let n=walker.nextNode();n;n=walker.nextNode()) for(let i=0;i<n.length;i++){
      if(!n.data[i].trim())continue;r.setStart(n,i);r.setEnd(n,i+1);const x=r.getClientRects()[0];
      if(x&&x.left>=b.left-1&&x.left<b.right){window.__l3TopText=r;return true;}
      if(x&&x.right<=b.left&&i===0){const all=document.createRange();all.selectNodeContents(n);const rs=all.getClientRects();
        if(rs.length&&rs[rs.length-1].right<=b.left)break;}}
    return false;})()`);
  const topTextVisible=()=>evaluate(`(() => {const c=document.querySelector('.book-content'),r=c.getBoundingClientRect();
    return [...window.__l3TopText.getClientRects()].some(x=>x.right>Math.max(0,r.left)&&x.left<Math.min(innerWidth,r.right)
      &&x.bottom>Math.max(38,r.top)&&x.top<Math.min(innerHeight-38,r.bottom));})()`);
  async function change(label,command) {
    const previous=await state();
    check(await markTopText(),`EPUB reflow: ${label} has text at the top of the spread before the change`);
    await evaluate(command+'; true');
    await evaluate('document.fonts.ready.then(()=>true)');
    await sleep(850);
    const current=await state(), kept=await topTextVisible();
    check(['font','family','lineHeight','margin','columns','theme'].some(key=>current[key]!==previous[key]),
      `EPUB reflow: ${label} actually changes the reader appearance`);
    // Decision of 2026-10-21: the text at the top wins over the saved bookScrollId element when both do not fit
    records.push({label,topTextVisible:kept,savedElementVisible:await visible(anchor),aligned:current.aligned,
      offset:current.offset,step:current.step});
    check(kept,`EPUB reflow: ${label} keeps the text read at the top of the spread visible`);
    check(current.aligned&&!current.stage,`EPUB reflow: ${label} settles on a complete reader spread`);
  }
  await change('larger font',`(() => {const i=document.querySelector('#fontsize');i.value='200';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await change('font family',`(() => {const i=document.querySelector('select#library-type'),next=[...i.options].find(o=>o.value&&o.value!==i.value);i.value=next.value;i.dispatchEvent(new Event('change',{bubbles:true}));i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  // 100% removes the override and the reader's default already renders as 150%, so 180% is a visible change
  await change('line spacing',`(() => {const i=document.querySelector('#linespacing');i.value='180';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await change('margin',`(() => {const i=document.querySelector('#margin');i.value='15';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await change('one-page layout',`document.querySelector('#layout-mode-col1').click()`);
  await change('dark theme',`[...document.querySelectorAll('button.color')].find(b=>b.textContent.trim()==='Dark').click()`);

  // Changes while turning cancel the old snapshots; the reading anchor stays at its pre-turn text.
  check(await markTopText(),'EPUB reflow: text at the top of the spread before the interrupted turn');
  const posts=progressPosts();
  await evaluate(`document.querySelector('.reader-container').focus(); true`);
  await key('ArrowRight','ArrowRight');
  check(!!await until(async()=>(await state()).stage,300,15),'EPUB reflow: turn starts before concurrent appearance change');
  await evaluate(`(() => {const i=document.querySelector('#fontsize');i.value='170';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(1000);
  const interrupted=await state(), interruptedVisible=await topTextVisible();
  records.push({label:'interrupted-turn',topTextVisible:interruptedVisible,offset:interrupted.offset,step:interrupted.step,
    topText:interruptedVisible?undefined:await evaluate(`(() => {const c=document.querySelector('.book-content'),r=c.getBoundingClientRect(),x=window.__l3TopText.getClientRects()[0];
      return {content:[r.left,r.right],text:x&&[Math.round(x.left),Math.round(x.top)],chars:window.__l3TopText.toString(),
        connected:window.__l3TopText.startContainer.isConnected};})()`)});
  check(interruptedVisible&&!interrupted.stage,'EPUB reflow: font change during a turn cancels it at the original text');
  check(progressPosts()-posts<=1,'EPUB reflow: cancelled turn does not create extra progress writes');
  const typography=await state();
  await evaluate(`document.querySelector('.reader-container').focus(); true`);
  await key('ArrowRight','ArrowRight');
  await until(async()=>(await state()).stage,300,15);
  check(await evaluate(`(() => {const c=document.querySelector('.epub-book-animation-stage .book-content');return !!c&&getComputedStyle(c).fontSize===${JSON.stringify(typography.font)};})()`),
    'EPUB reflow: next turn uses the updated text size');
  await until(async()=>!(await state()).stage,1200,20); await sleep(500);
  check((await saved()).pageNum===0&&!!(await saved()).bookScrollId,'EPUB reflow: new turn preserves the HTML and text progress contract');

  // Deterministic race: a new command can arrive before the deferred reflow frame has run.
  // Hold only frame scheduling, then release it after the real keyboard command.
  check(await markTopText(),'EPUB reflow: rapid-command case has text at the top of the spread before the change');
  await evaluate(`(() => {const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,queue=new Map();let id=-1;
    window.__epubReflowFrames={release(){window.requestAnimationFrame=request;window.cancelAnimationFrame=cancel;
      for(const callback of queue.values())request.call(window,callback);delete window.__epubReflowFrames;}};
    window.requestAnimationFrame=callback=>{queue.set(id,callback);return id--;};
    window.cancelAnimationFrame=handle=>handle<0?queue.delete(handle):cancel.call(window,handle);
    const input=document.querySelector('#fontsize');input.value='300';input.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('.reader-container').focus();return new Promise(resolve=>setTimeout(resolve,30));})()`);
  const expected=await evaluate(`(() => {const c=document.querySelector('.book-content'),step=c.clientWidth+parseFloat(getComputedStyle(c).columnGap);
    const position=window.__l3TopText.getClientRects()[0].left-c.getBoundingClientRect().left+c.scrollLeft;
    return {offset:(Math.floor(Math.max(0,position)/step)+1)*step,font:getComputedStyle(c).fontSize};})()`);
  check(expected.font!==typography.font,'EPUB reflow: rapid-command case applies the larger font before restoring its anchor');
  await key('ArrowRight','ArrowRight');
  await evaluate('window.__epubReflowFrames.release(); true');
  await sleep(1200);
  const rapid=await state();
  check(Math.abs(rapid.offset-expected.offset)<3,'EPUB reflow: an immediate next command advances from the restored text, without jumping backwards');
  records.push({label:'next-before-reflow-frame',expectedOffset:expected.offset,offset:rapid.offset});

  async function resizeListeners() {
    const target=await send('Runtime.evaluate',{expression:'window'});
    const id=target.result.result.objectId;
    const result=await send('DOMDebugger.getEventListeners',{objectId:id});
    await send('Runtime.releaseObject',{objectId:id});
    return result.result.listeners.filter(listener=>listener.type==='resize').length;
  }
  const baseline=await resizeListeners();
  for(let i=0;i<10;i++) {
    await evaluate(`[...document.querySelectorAll('button.color')].find(b=>b.textContent.trim()==='${i%2?'Dark':'White'}').click(); true`);
    await sleep(100);
    await turn();
  }
  check(await resizeListeners()===baseline,'EPUB reflow: ten appearance changes and rebuilt turns leave no extra resize listeners');
  check(!(await state()).stage,'EPUB reflow: no snapshot remains after ten remounts');
  const artifacts=new URL('../../_temp/epub-l3/',import.meta.url);
  await mkdir(artifacts,{recursive:true});
  await writeFile(new URL('reflow-measurements.json',artifacts),JSON.stringify(records,null,2)+'\n');
}
