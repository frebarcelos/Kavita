/**
 * One page of the page-flip book. A wide reader page (a two-page spread) takes two slots, one per half of the image; a
 * blank slot keeps a spread from starting on the right side. A blank belongs to the page that follows it in the book.
 */
export interface BookSlot {
  page: number;
  half?: 'left' | 'right';
  blank?: boolean;
}

export interface BookLayout {
  /** In book order: the book always turns left to right, so right-to-left reading puts the pages in reversed */
  slots: BookSlot[];
  /** The slot the reader page opens on */
  slotOf(page: number): number;
  isWide(page: number): boolean;
  /** The slots on screen with the slot shown, as PageFlip pairs them when the book is open (two pages) or not */
  viewAt(slot: number, open: boolean): number[];
}

export interface BookLayoutOptions {
  rightToLeft: boolean;
  /** Two pages side by side with a lone cover. Otherwise one page, that opens as two only on a wide page */
  twoPages: boolean;
  /** With two pages, the first one alone as a cover (the default); otherwise pairs from the first page */
  cover?: boolean;
  isWide: (page: number) => boolean;
}

export function bookLayout(totalPages: number, options: BookLayoutOptions): BookLayout {
  const lonePage = options.twoPages && (options.cover ?? true);
  // In reading order, where a pair begins when the book is open: after a lone cover, or from the first page
  const beginsPair = (slot: number) => slot % 2 === (lonePage ? 1 : 0);
  const reading: BookSlot[] = [];
  for (let page = 0; page < totalPages; page++) {
    if (!options.isWide(page)) {
      reading.push({page});
      continue;
    }
    if (!beginsPair(reading.length)) reading.push({page, blank: true});
    // The halves in reading order; the book turns them into image order when it reverses
    if (options.rightToLeft) {
      reading.push({page, half: 'right'}, {page, half: 'left'});
    } else {
      reading.push({page, half: 'left'}, {page, half: 'right'});
    }
  }
  // PageFlip pairs from the start of the book, which for right-to-left reading is its last page: an even count makes
  // those pairs the reader's
  if (options.rightToLeft && reading.length % 2 === 1) reading.push({page: totalPages - 1, blank: true});
  const slots = options.rightToLeft ? reading.reverse() : reading;

  const firstSlot = new Map<number, number>();
  slots.forEach((slot, index) => {
    if (!slot.blank && !firstSlot.has(slot.page)) firstSlot.set(slot.page, index);
  });

  return {
    slots,
    slotOf: page => firstSlot.get(page) ?? 0,
    isWide: page => options.isWide(page),
    viewAt: (slot, open) => {
      if (!open) return [slot];
      // As PageFlip pairs pages when open: after a lone cover in a two-page book, from the start otherwise; a page
      // left over at the end stays alone
      const first = lonePage ? 1 : 0;
      if (slot < first) return [slot];
      const left = slot - ((slot - first) % 2);
      return left + 1 < slots.length ? [left, left + 1] : [left];
    },
  };
}

/** Width over height of the chapter's single pages, for the book's page size */
export function typicalPageRatio(dimensions: ReadonlyArray<{width: number, height: number, isWide: boolean}>): number {
  // The middle one, so a spread, a cover or an insert of another size does not reshape every page
  const ratios = dimensions
    .filter(d => !d.isWide && d.width > 0 && d.height > 0)
    .map(d => d.width / d.height)
    .sort((a, b) => a - b);
  return ratios.length > 0 ? ratios[Math.floor((ratios.length - 1) / 2)] : 2 / 3;
}

/**
 * Reader pages that get their image loaded: the current one and its neighbours, so a long chapter does not load at once
 */
export function pagesToLoad(readerPage: number, totalPages: number, radius = 3): Set<number> {
  const pages = new Set<number>();
  for (let page = Math.max(0, readerPage - radius); page <= Math.min(totalPages - 1, readerPage + radius); page++) {
    pages.add(page);
  }
  return pages;
}
