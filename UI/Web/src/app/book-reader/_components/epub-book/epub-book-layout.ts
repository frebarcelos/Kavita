/** Room for the spine shadow between the two pages of a spread, split half on each page. */
export const EPUB_BOOK_SPINE_GAP = 64;

/**
 * Column gap of a two-page spread. The reader margin only pads the outer edges of the text box; a printed book has
 * it on both sides of each page, so the spine side gets it too, on top of the room for the spine shadow.
 */
export function epubBookColumnGap(marginPx: number): number {
  return EPUB_BOOK_SPINE_GAP + 2 * (Number.isFinite(marginPx) && marginPx > 0 ? marginPx : 0);
}
