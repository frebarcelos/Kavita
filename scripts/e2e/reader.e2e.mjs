// Fork (item 7.1): reader scenarios in a real Chrome, over the DevTools protocol. Run by run.ps1 against a disposable
// server; never point it at the main server. Uses only Node 24 (fetch, WebSocket).
//   node reader.e2e.mjs <server URL> <Chrome debugging port>
const [server, debugPort] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(server ?? '')) throw new Error('The end-to-end test runs only against 127.0.0.1.');

const BOOK_MODE_KEY = 'kavita--reader-book-mode';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const failures = [];
let checks = 0;
function check(condition, label) {
  checks++;
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) failures.push(label);
}
async function until(probe, timeoutMs, stepMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await sleep(stepMs);
  }
  return null;
}

// --- Server: account, library and the chapters under test ---
let token = '';
let browserHeaders = {};
async function api(route, {method = 'GET', body} = {}, attempt = 0) {
  const response = await fetch(server + route, {
    method,
    headers: {...browserHeaders, ...(token ? {Authorization: 'Bearer ' + token} : {}), ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // The fork limits progress saves of one chapter to one per 300 ms; a test save right after the browser's waits it out
  if (response.status === 429 && attempt < 5) {
    await sleep(350);
    return api(route, {method, body}, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${method} ${route.split('?')[0]}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const credentials = {username: 'e2e-admin', password: 'E2e-Test-Pass-2026', email: 'e2e-admin@example.invalid'};
await api('/api/Account/register', {method: 'POST', body: credentials});
const user = await api('/api/Account/login', {method: 'POST', body: {username: credentials.username, password: credentials.password}});
token = user.token;
const library = await api('/api/Library/create', {method: 'POST', body: {
  id: 0, name: 'E2E', type: 1, folders: ['/media'], folderWatching: false, includeInDashboard: true, includeInSearch: true,
  manageCollections: false, manageReadingLists: false, allowScrobbling: false, allowMetadataMatching: false,
  enableMetadata: false, folderBasedOrganization: true, removePrefixForSortName: false, inheritWebLinksFromFirstChapter: false,
  defaultLanguage: '', metadataProvider: 4, fileGroupTypes: [1, 2, 3, 4], excludePatterns: [],
}});
const libraryId = library?.id ?? (await api('/api/Library/libraries')).find(l => l.name === 'E2E').id;
await api(`/api/Library/scan?libraryId=${libraryId}&force=true`, {method: 'POST'});
const folders = await until(async () => {
  const rows = await api(`/api/Library/folder-series?libraryId=${libraryId}`);
  // Wait for every fixture folder, not for a count: the publisher CSS fixture adds one, and the PDF pages are only
  // ready once the scan has finished
  const expected = ['Livro PDF', 'Revista', 'Livro EPUB', ...(process.argv.includes('--epub-clipping') ? ['Livro EPUB CSS'] : [])];
  return expected.every(folder => rows.some(row => row.path === folder)) ? rows : null;
}, 120000, 2000);
if (!folders) throw new Error('The scan did not index the fixtures.');
async function chapterOf(folder) {
  const seriesId = folders.find(f => f.path === folder).seriesId;
  const volumes = await api(`/api/Series/volumes?seriesId=${seriesId}`);
  return {seriesId, chapterId: volumes[0].chapters[0].id, pages: volumes[0].chapters[0].pages};
}
const pdf = await chapterOf('Livro PDF');
const progress = async chapterId => (await api(`/api/Reader/get-progress?chapterId=${chapterId}`)).pageNum;
const setProgress = (chapter, pageNum) => api('/api/Reader/progress', {method: 'POST', body: {
  libraryId, seriesId: chapter.seriesId, volumeId: 0, chapterId: chapter.chapterId, pageNum}});
const route = (kind, chapter) => `/library/${libraryId}/series/${chapter.seriesId}/${kind}/${chapter.chapterId}`;
check(pdf.pages === 8, `the PDF fixture has 8 pages (${pdf.pages})`);

// --- Browser ---
const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {method: 'PUT'})).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
const requests = [];
socket.onmessage = ({data}) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method === 'Network.requestWillBeSent') {
    // Reading profiles are per device. Configure the same device the UI identifies,
    // retaining only these public headers, never Authorization or auth keys.
    const headers = message.params.request.headers;
    if (Object.keys(headers).some(key => key.toLowerCase() === 'x-device-id')) {
      browserHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) =>
        ['x-device-id', 'x-kavita-client', 'user-agent'].includes(key.toLowerCase())));
    }
    requests.push({url: message.params.request.url, method: message.params.request.method, id: message.params.requestId});
  } else if (message.method === 'Network.responseReceived') {
    const request = requests.find(r => r.id === message.params.requestId);
    if (request) request.status = message.params.response.status;
  }
};
function send(method, params = {}, timeoutMs = 15000) {
  const id = ++nextId;
  socket.send(JSON.stringify({id, method, params}));
  return Promise.race([
    new Promise(resolve => pending.set(id, resolve)),
    sleep(timeoutMs).then(() => ({timeout: true})),
  ]);
}
async function evaluate(expression, timeoutMs = 15000) {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, timeoutMs);
  return result.timeout ? {timeout: true} : result.result?.result?.value;
}
const path = () => evaluate('location.pathname');
async function open(url) {
  await send('Page.navigate', {url: server + url});
  await sleep(1500);
}
async function key(name, code) {
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key: name, code, windowsVirtualKeyCode: code === 'ArrowRight' ? 39 : 37});
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key: name, code, windowsVirtualKeyCode: code === 'ArrowRight' ? 39 : 37});
}
// The PDF viewer shows page 1 while it loads, then the saved page
async function pdfPageShown(expected) {
  const page = () => evaluate(`document.querySelector('#pageNumber')?.value ?? ''`);
  return (await until(async () => (await page()) === expected, 20000)) ? expected : await page();
}
const progressPosts = () => requests.filter(r => r.method === 'POST' && r.url.includes('/api/reader/progress')).length;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
// A fixed viewport also keeps screenshot compositing active with the test window hidden.
await send('Emulation.setDeviceMetricsOverride', {width: 1600, height: 950, deviceScaleFactor: 1, mobile: false});
await send('Emulation.setFocusEmulationEnabled', {enabled: true});
await open('/login');
const {authKeys, ...persisted} = user;
await evaluate(`localStorage.setItem('kavita-user', ${JSON.stringify(JSON.stringify(persisted))}); true`);

const only = process.argv.includes('--epub-reflow-only') || process.argv.includes('--epub-l4-only') || process.argv.includes('--epub-l5-only');
if (!only) {
// V1: book mode off, a PDF opens in the PDF reader, on the page the image reader and the tablet saved
await setProgress(pdf, 2);
await evaluate(`localStorage.setItem('${BOOK_MODE_KEY}', 'false'); true`);
await open(route('pdf', pdf));
check(await until(async () => (await path())?.includes('/pdf/'), 15000), 'book mode off: the PDF opens in the PDF reader');
const shownPage = await pdfPageShown('3');
check(shownPage === '3', `the PDF reader opens progress 2 (third page) on page 3 (${shownPage})`);

// V1: book mode on, the same PDF opens in the image reader, as page images
await evaluate(`localStorage.setItem('${BOOK_MODE_KEY}', 'true'); true`);
const postsBefore = progressPosts();
await open(route('pdf', pdf));
check(await until(async () => (await path())?.includes('/manga/'), 20000), 'book mode on: the PDF reader hands the chapter to the image reader');
const pageImage = await until(() => evaluate(`[...document.images].some(i => i.src.includes('reader/image') && i.src.includes('extractPdf=true') && i.complete && i.naturalWidth > 0)`), 30000);
check(!!pageImage, 'the PDF pages arrive as images');
const failedImages = requests.filter(r => r.url.includes('reader/image') && r.status && r.status !== 200);
check(failedImages.length === 0, `every page image answers 200 (${failedImages.length} failed)`);
const savedBefore = await progress(pdf.chapterId);
check(savedBefore === 2, `the image reader keeps the saved page (${savedBefore})`);

// Turning pages: one progress save per stop, the page shown
await key('ArrowRight', 'ArrowRight');
await sleep(1200);
await key('ArrowRight', 'ArrowRight');
await sleep(2500);
const afterTurn = await progress(pdf.chapterId);
check(afterTurn > 2 && afterTurn < pdf.pages, `turning pages saves a later page (${afterTurn})`);
const posts = progressPosts() - postsBefore;
check(posts <= 4, `no progress storm while turning (${posts} saves)`);
const alive = await evaluate('1 + 1', 5000);
check(alive === 2, 'the page still answers');

// V1: back in the PDF reader, the page read as a book
await evaluate(`localStorage.setItem('${BOOK_MODE_KEY}', 'false'); true`);
await open(route('manga', pdf));
check(await until(async () => (await path())?.includes('/pdf/'), 20000), 'book mode off: the image reader hands a PDF back to the PDF reader');
const backPage = await pdfPageShown(String(afterTurn + 1));
check(backPage === String(afterTurn + 1), `the PDF reader opens the page read as a book (${backPage}, progress ${afterTurn})`);

// V1: the book button of the PDF reader opens the image reader on the same page
const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.querySelector('.fa-book-open')); b?.click(); return !!b; })()`);
check(clicked, 'the PDF reader shows the book button');
check(await until(async () => (await path())?.includes('/manga/'), 20000), 'the book button opens the image reader');
await sleep(2000);
check(await progress(pdf.chapterId) === afterTurn, 'the book button keeps the page');
check(await evaluate(`localStorage.getItem('${BOOK_MODE_KEY}')`) === 'true', 'the book button turns the book mode on');

const {runEpubTests} = await import('./epub.e2e.mjs');
await runEpubTests({api, chapter: await chapterOf('Livro EPUB'), libraryId, route, check, until,
  evaluate, open, key, send, sleep, progressPosts, bookModeKey: BOOK_MODE_KEY});

const {runEpubAnimationTests} = await import('./epub-animation.e2e.mjs');
await runEpubAnimationTests({api, chapter: await chapterOf('Livro EPUB'), libraryId, route, check, until,
  evaluate, open, key, send, sleep, progressPosts, bookModeKey: BOOK_MODE_KEY});

if (process.argv.includes('--epub-clipping')) {
  const {runEpubClippingTests} = await import('./epub-clipping.e2e.mjs');
  await runEpubClippingTests({api, libraryId, route, check, until, evaluate, open, send, sleep,
    bookModeKey: BOOK_MODE_KEY});
}
}

if (!process.argv.includes('--epub-l4-only') && !process.argv.includes('--epub-l5-only')) {
const {runEpubReflowTests} = await import('./epub-reflow.e2e.mjs');
await runEpubReflowTests({api, chapter: await chapterOf('Livro EPUB'), libraryId, route, check, until,
  evaluate, open, key, send, sleep, progressPosts, bookModeKey: BOOK_MODE_KEY});
}

if (!process.argv.includes('--epub-reflow-only') && !process.argv.includes('--epub-l5-only')) {
const {runEpubL4Tests} = await import('./epub-l4.e2e.mjs');
await runEpubL4Tests({api, chapter: await chapterOf('Livro EPUB'), libraryId, route, check, until,
  evaluate, open, key, send, sleep, progressPosts, bookModeKey: BOOK_MODE_KEY});
}

if (!process.argv.includes('--epub-reflow-only') && !process.argv.includes('--epub-l4-only')) {
const {runEpubL5Tests} = await import('./epub-l5.e2e.mjs');
await runEpubL5Tests({api, chapter: await chapterOf('Livro EPUB'), libraryId, route, check, until,
  evaluate, open, send, sleep, progressPosts, bookModeKey: BOOK_MODE_KEY});
}

socket.close();
if (failures.length) {
  console.log(`${failures.length} failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`All reader end-to-end tests passed (${checks} checks).`);
