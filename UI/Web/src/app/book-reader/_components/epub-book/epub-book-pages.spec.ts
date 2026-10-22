import {describe, expect, it} from 'vitest';
import {createEpubBookPage, EpubPageGeometry} from './epub-book-pages';

describe('EPUB column clipping', () => {
  const geometry: EpubPageGeometry = {width: 800, height: 900, columns: 2, stride: 768,
    contentLeft: 64, contentTop: 20, contentWidth: 1472, contentHeight: 860, totalColumns: 7};
  function content() {
    const source = document.createElement('div');
    source.className = 'book-content column-layout-2';
    source.style.cssText = 'font-size: 24px; column-count: 2; column-gap: 64px; overflow: hidden';
    source.innerHTML = '<p id="paragraph">Texto nítido <a href="#paragraph">link</a></p>';
    return source;
  }
  // Horizontal position of the clone inside the page, whatever the nesting of positioned wrappers
  function leftInPage(clone: HTMLElement, page: HTMLElement) {
    let left = 0;
    for (let element: HTMLElement | null = clone; element && element !== page; element = element.parentElement) {
      left += parseFloat(element.style.left || '0');
    }
    return left;
  }

  it('clips the requested column using measured geometry, preserving the text and typography', () => {
    const page = createEpubBookPage(content(), 3, geometry);
    const clone = page.querySelector<HTMLElement>('.book-content')!;
    expect(page.style.width).toBe('800px');
    expect(page.style.height).toBe('900px');
    expect(page.style.overflow).toBe('hidden');
    expect(clone.textContent).toContain('Texto nítido');
    expect(clone.style.fontSize).toBe('24px');
    expect(clone.style.columnCount).toBe('2');
    expect(clone.style.width).toBe('1472px');
    // Spread two, right half: 64 - 2*768 - 800.
    expect(leftInPage(clone, page)).toBe(-2272);
    expect(clone.style.overflow).toBe('visible');
  });

  it('clips a single-page layout without changing the column stride', () => {
    const page = createEpubBookPage(content(), 2, {...geometry, columns: 1, width: 1600, stride: 1536});
    const clone = page.querySelector<HTMLElement>('.book-content')!;
    expect(leftInPage(clone, page)).toBe(-3008);
  });

  it('hides neighbouring columns outside the text box, as the scroll container of the reader does', () => {
    // A book page is half the reader area, margins included; the text box is narrower
    const page = createEpubBookPage(content(), 3, {...geometry, viewportLeft: 10, viewportTop: 38});
    const clone = page.querySelector<HTMLElement>('.book-content')!;
    const box = clone.parentElement!;
    expect(box.style.overflow).toBe('hidden');
    expect(box.style.width).toBe('1472px');
    expect(box.style.height).toBe('860px');
    expect(leftInPage(box, page)).toBe(64 - 800); // the text box starts at contentLeft, right half of the spread
    expect(parseFloat(box.style.top) + parseFloat(box.parentElement!.style.top)).toBe(20);
    expect(leftInPage(clone, page)).toBe(-2272);
  });

  it('creates an empty final page without copying chapter content', () => {
    const page = createEpubBookPage(content(), 7, geometry);
    expect(page.querySelector('.book-content')).toBeNull();
    expect(page.classList.contains('epub-book-blank')).toBe(true);
  });

  it('keeps clones inert and hidden from accessibility, leaving the source and its position untouched', () => {
    const source = content();
    source.scrollLeft = 1536;
    const html = source.outerHTML;
    const page = createEpubBookPage(source, 2, geometry);
    expect(page.hasAttribute('inert')).toBe(true);
    expect(page.getAttribute('aria-hidden')).toBe('true');
    expect(source.outerHTML).toBe(html);
    expect(source.scrollLeft).toBe(1536);
  });

  it('preserves inherited relative line heights instead of freezing them at the root font size', () => {
    const parent = document.createElement('div');
    parent.style.lineHeight = '1.5';
    const source = content();
    parent.append(source);
    document.body.append(parent);
    try {
      const clone = createEpubBookPage(source, 0, geometry).querySelector<HTMLElement>('.book-content')!;
      expect(clone.style.lineHeight).toBe('');
    } finally { parent.remove(); }
  });

  it('clips inside the engine page, whose inline styles PageFlip replaces on every frame', () => {
    const page = createEpubBookPage(content(), 0, geometry);
    page.style.cssText = 'position:absolute'; // The vendored HTMLPage.simpleDraw/drawSoft contract.
    expect(page.querySelector<HTMLElement>('.epub-book-clip')?.style.overflow).toBe('hidden');
  });

  it('keeps a viewport-sized containing block for publisher fixed positions inside each clipped page', () => {
    const page = createEpubBookPage(content(), 3, {...geometry, viewportLeft: 10, viewportTop: 38,
      viewportWidth: 1600, viewportHeight: 950});
    const viewport = page.querySelector<HTMLElement>('.epub-book-viewport')!;
    expect(viewport?.style.width).toBe('1600px');
    expect(viewport?.style.height).toBe('950px');
    expect(viewport?.style.left).toBe('-810px');
    expect(viewport?.style.top).toBe('-38px');
    expect(viewport?.style.transform).toBe('translateZ(0)');
  });

  it('paints opaque paper using the existing reader theme, including its texture', () => {
    const reader = document.createElement('div'), source = content();
    reader.className='reader-container'; reader.style.backgroundColor='rgb(241, 228, 213)';
    reader.style.backgroundImage='url("paper.png")'; reader.append(source); document.body.append(reader);
    try {
      const clip=createEpubBookPage(source,0,geometry).querySelector<HTMLElement>('.epub-book-clip')!;
      expect(clip.style.backgroundColor).toBe('rgb(241, 228, 213)');
      expect(clip.style.backgroundImage).toContain('paper.png');
    } finally { reader.remove(); }
  });
});
