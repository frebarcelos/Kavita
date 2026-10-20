import {describe, expect, it} from 'vitest';
import {bookLayout, BookSlot, pagesToLoad, typicalPageRatio} from './book-pages';

const wide = (...pages: number[]) => (page: number) => pages.includes(page);
const describeSlots = (slots: BookSlot[]) => slots.map(s => s.blank ? `_${s.page}` : `${s.page}${s.half ?? ''}`);

describe('Book pages', () => {
  it('keeps the reading order for left-to-right books', () => {
    const layout = bookLayout(4, {rightToLeft: false, twoPages: false, isWide: wide()});

    expect(describeSlots(layout.slots)).toEqual(['0', '1', '2', '3']);
    expect(layout.slotOf(2)).toBe(2);
  });

  it('reverses the pages for right-to-left reading, and maps back', () => {
    const layout = bookLayout(4, {rightToLeft: true, twoPages: false, isWide: wide()});

    expect(describeSlots(layout.slots)).toEqual(['3', '2', '1', '0']);
    expect(layout.slotOf(0)).toBe(3);
    for (let page = 0; page < 4; page++) {
      expect(layout.slots[layout.slotOf(page)].page).toBe(page);
    }
  });

  it('opens a wide page across both sides of a two-page book, after a lone cover', () => {
    // Cover alone, then pairs: a wide page needs its left half on a left side (odd slot)
    expect(describeSlots(bookLayout(6, {rightToLeft: false, twoPages: true, isWide: wide(3)}).slots))
      .toEqual(['0', '1', '2', '3left', '3right', '4', '5']);
    // Here it would start on a right side, so a blank page faces the page before it
    const layout = bookLayout(5, {rightToLeft: false, twoPages: true, isWide: wide(2)});
    expect(describeSlots(layout.slots)).toEqual(['0', '1', '_2', '2left', '2right', '3', '4']);
    expect(layout.slotOf(2)).toBe(3);
  });

  it('keeps the halves of a wide page in image order for right-to-left reading', () => {
    const layout = bookLayout(4, {rightToLeft: true, twoPages: true, isWide: wide(1)});

    // The book is reversed, but the image halves stay left and right; a blank closes the book so that, counted
    // from its far end, the pairs are the reader's: 0 alone, the spread 1, then 2 with 3
    expect(describeSlots(layout.slots)).toEqual(['_3', '3', '2', '1left', '1right', '0']);
    expect(layout.slots[layout.slotOf(1)].page).toBe(1);
    expect(layout.slotOf(0)).toBe(5);
    expect(layout.viewAt(layout.slotOf(2), true).map(s => layout.slots[s].page)).toEqual([3, 2]);
  });

  it('pairs a right-to-left book like the reader when it has an odd number of pages', () => {
    const layout = bookLayout(5, {rightToLeft: true, twoPages: true, isWide: wide()});

    expect(describeSlots(layout.slots)).toEqual(['_4', '4', '3', '2', '1', '0']);
    expect(layout.viewAt(layout.slotOf(1), true).map(s => layout.slots[s].page)).toEqual([2, 1]);
    expect(layout.viewAt(layout.slotOf(0), true).map(s => layout.slots[s].page)).toEqual([0]);
  });

  it('pairs from the first page when the layout has no lone cover', () => {
    const plain = bookLayout(4, {rightToLeft: false, twoPages: true, cover: false, isWide: wide()});
    expect(plain.viewAt(0, true)).toEqual([0, 1]);
    expect(plain.viewAt(3, true)).toEqual([2, 3]);

    // A wide page starts on an even slot
    expect(describeSlots(bookLayout(4, {rightToLeft: false, twoPages: true, cover: false, isWide: wide(1)}).slots))
      .toEqual(['0', '_1', '1left', '1right', '2', '3']);
  });

  it('pairs the halves of a wide page in a one-page book, for when the book opens on it', () => {
    // A one-page book opens as two pages from even slots: the left half goes on an even slot
    const layout = bookLayout(4, {rightToLeft: false, twoPages: false, isWide: wide(1)});

    expect(describeSlots(layout.slots)).toEqual(['0', '_1', '1left', '1right', '2', '3']);
    expect(layout.slotOf(1)).toBe(2);
    expect(layout.isWide(1)).toBe(true);
    expect(layout.isWide(2)).toBe(false);
  });

  it('knows which slots are in view, as PageFlip pairs them', () => {
    const two = bookLayout(6, {rightToLeft: false, twoPages: true, isWide: wide()});
    // Lone cover, pairs, lone last page
    expect(two.viewAt(0, true)).toEqual([0]);
    expect(two.viewAt(2, true)).toEqual([1, 2]);
    expect(two.viewAt(5, true)).toEqual([5]);

    const one = bookLayout(5, {rightToLeft: false, twoPages: false, isWide: wide()});
    expect(one.viewAt(3, false)).toEqual([3]);
    // Opened, a one-page book pairs from the start
    expect(one.viewAt(3, true)).toEqual([2, 3]);
    expect(one.viewAt(4, true)).toEqual([4]);
  });

  it('takes the page shape from the chapter, so pages fill the screen', () => {
    const page = (width: number, height: number, isWide = false) => ({width, height, isWide});

    // The median of the single pages; a spread or an odd page does not change it
    expect(typicalPageRatio([page(740, 1000), page(745, 1000), page(735, 1000), page(1480, 1000, true), page(500, 1000)]))
      .toBe(0.735);
    // Nothing known: the usual comic page
    expect(typicalPageRatio([])).toBe(2 / 3);
    expect(typicalPageRatio([page(0, 0), page(1480, 1000, true)])).toBe(2 / 3);
  });

  it('loads only the pages around the current one', () => {
    expect([...pagesToLoad(0, 10)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect([...pagesToLoad(5, 10)].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect([...pagesToLoad(9, 10, 1)].sort((a, b) => a - b)).toEqual([8, 9]);
  });
});
