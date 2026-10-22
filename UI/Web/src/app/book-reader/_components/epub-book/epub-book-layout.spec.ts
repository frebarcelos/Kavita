import {describe, expect, it} from 'vitest';
import {EPUB_BOOK_SPINE_GAP, epubBookColumnGap} from './epub-book-layout';

describe('EPUB book spread layout', () => {
  it('gives each page the reader margin on the spine side too, plus room for the spine shadow', () => {
    expect(epubBookColumnGap(0)).toBe(EPUB_BOOK_SPINE_GAP);
    expect(epubBookColumnGap(80)).toBe(EPUB_BOOK_SPINE_GAP + 160);
  });

  it('never returns less than the spine room', () => {
    expect(epubBookColumnGap(Number.NaN)).toBe(EPUB_BOOK_SPINE_GAP);
    expect(epubBookColumnGap(-10)).toBe(EPUB_BOOK_SPINE_GAP);
  });
});
