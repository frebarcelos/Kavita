import {describe, expect, it} from 'vitest';
import {ReaderMode} from '../../../_models/preferences/reader-mode';
import {LayoutMode} from '../../_models/layout-mode';
import {ReadingDirection} from '../../../_models/preferences/reading-direction';
import {BOOK_MODE_KEY, bookShape, isBookModeActive, readBookMode, saveBookMode} from './book-mode';

function memoryStorage() {
  const values = new Map<string, string>();
  return {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }};
}

describe('Book mode preference', () => {
  it('is off until the user turns it on in this browser, and is remembered', () => {
    const storage = memoryStorage();
    expect(readBookMode(storage)).toBe(false);

    saveBookMode(true, storage);
    expect(storage.getItem(BOOK_MODE_KEY)).toBe('true');
    expect(readBookMode(storage)).toBe(true);

    saveBookMode(false, storage);
    expect(readBookMode(storage)).toBe(false);
  });

  it('still works when the browser blocks storage', () => {
    const broken = {getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }};
    expect(readBookMode(broken)).toBe(false);
    expect(() => saveBookMode(true, broken)).not.toThrow();
    expect(readBookMode(null)).toBe(false);
  });

  it('lays the book out as the reader layout says', () => {
    expect(bookShape(LayoutMode.Single, ReadingDirection.LeftToRight))
      .toEqual({twoPages: false, rightToLeft: false, cover: true});
    expect(bookShape(LayoutMode.Single, ReadingDirection.RightToLeft))
      .toEqual({twoPages: false, rightToLeft: true, cover: true});
    expect(bookShape(LayoutMode.Double, ReadingDirection.LeftToRight))
      .toEqual({twoPages: true, rightToLeft: false, cover: true});
    // The manga layout: the lower page of a pair on the right
    expect(bookShape(LayoutMode.DoubleReversed, ReadingDirection.LeftToRight))
      .toEqual({twoPages: true, rightToLeft: true, cover: true});
    expect(bookShape(LayoutMode.DoubleNoCover, ReadingDirection.LeftToRight))
      .toEqual({twoPages: true, rightToLeft: false, cover: false});
  });

  it('applies only to the left/right reader', () => {
    expect(isBookModeActive(true, ReaderMode.LeftRight)).toBe(true);
    expect(isBookModeActive(true, ReaderMode.UpDown)).toBe(false);
    expect(isBookModeActive(true, ReaderMode.Webtoon)).toBe(false);
    expect(isBookModeActive(false, ReaderMode.LeftRight)).toBe(false);
  });
});
