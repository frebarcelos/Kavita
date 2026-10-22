/** Geometry already measured by the reader; the book never paginates the text. */
export interface EpubPageGeometry {
  width: number;
  height: number;
  columns: number;
  stride: number;
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  contentHeight: number;
  totalColumns: number;
  viewportLeft?: number;
  viewportTop?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export function createEpubBookPage(source: HTMLElement, column: number, geometry: EpubPageGeometry): HTMLElement {
  const page = source.ownerDocument.createElement('div');
  page.className = 'epub-book-page';
  page.setAttribute('inert', '');
  page.setAttribute('aria-hidden', 'true');
  Object.assign(page.style, {position: 'relative', width: `${geometry.width}px`, height: `${geometry.height}px`,
    overflow: 'hidden', background: 'var(--brtheme-bg-color)'});
  // PageFlip owns the outer inline styles. Clip in a child so drawSoft/simpleDraw cannot erase it.
  const clip = source.ownerDocument.createElement('div');
  clip.className = 'epub-book-clip';
  const theme = getComputedStyle(source.closest('.reader-container') ?? source);
  const paper = {backgroundColor: theme.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fff' : theme.backgroundColor,
    backgroundImage: theme.backgroundImage, backgroundSize: theme.backgroundSize,
    backgroundPosition: theme.backgroundPosition, backgroundRepeat: theme.backgroundRepeat};
  Object.assign(clip.style, {position: 'absolute', inset: '0', overflow: 'hidden', ...paper});
  page.appendChild(clip);
  if (column < 0 || column >= geometry.totalColumns) {
    page.classList.add('epub-book-blank');
    return page;
  }
  const viewport = source.ownerDocument.createElement('div');
  viewport.className = 'epub-book-viewport';
  const window = source.ownerDocument.defaultView!;
  const half = column % geometry.columns;
  const spread = column - half;
  const viewportLeft = geometry.viewportLeft ?? 0, viewportTop = geometry.viewportTop ?? 0;
  // Recreate the original viewport inside the page. Otherwise the engine's transforms make fixed
  // publisher notes relative to a single half-page instead of the browser viewport.
  Object.assign(viewport.style, {position: 'absolute',
    left: `${-viewportLeft - half * geometry.width}px`, top: `${-viewportTop}px`,
    width: `${geometry.viewportWidth ?? window.innerWidth}px`,
    height: `${geometry.viewportHeight ?? window.innerHeight}px`, transform: 'translateZ(0)', ...paper});
  // The reader's text box is a scroll container that hides the other columns; a book page also covers the margins.
  // Fixed publisher notes keep the viewport as containing block, so this box does not clip them, as in the reader.
  const box = source.ownerDocument.createElement('div');
  box.className = 'epub-book-text-box';
  Object.assign(box.style, {position: 'absolute', left: `${viewportLeft + geometry.contentLeft}px`,
    top: `${viewportTop + geometry.contentTop}px`, width: `${geometry.contentWidth}px`,
    height: `${geometry.contentHeight}px`, overflow: 'hidden'});
  const clone = source.cloneNode(true) as HTMLElement;
  // Keep the original cascade in the reader's ancestry. Copying computed line-height freezes
  // a relative inherited value in pixels and changes the height of smaller text and superscripts.
  Object.assign(clone.style, {
    position: 'absolute', left: `${-spread * geometry.stride}px`, top: '0', margin: '0',
    width: `${geometry.contentWidth}px`, minWidth: '0', maxWidth: 'none',
    height: `${geometry.contentHeight}px`, minHeight: '0', maxHeight: 'none',
    overflow: 'visible', pointerEvents: 'none', transform: 'none',
  });
  box.appendChild(clone);
  viewport.appendChild(box);
  clip.appendChild(viewport);
  return page;
}
