import {describe, expect, it} from 'vitest';
import {MangaFormat} from '../_models/manga-format';
import {opensInOtherReader, readerFor} from './reader-format';

describe('Reader for a chapter format', () => {
  it('opens each format in its own reader', () => {
    expect(readerFor(MangaFormat.EPUB)).toBe('book');
    expect(readerFor(MangaFormat.PDF)).toBe('pdf');
    expect(readerFor(MangaFormat.ARCHIVE)).toBe('manga');
    expect(readerFor(MangaFormat.IMAGE)).toBe('manga');
    expect(readerFor(undefined)).toBe('manga');
  });

  it('hands a chapter of a mixed-format series to the matching reader', () => {
    expect(opensInOtherReader('manga', MangaFormat.EPUB)).toBe(true);
    expect(opensInOtherReader('manga', MangaFormat.PDF)).toBe(true);
    expect(opensInOtherReader('book', MangaFormat.PDF)).toBe(true);
    expect(opensInOtherReader('pdf', MangaFormat.ARCHIVE)).toBe(true);
  });

  it('keeps chapters already in their reader', () => {
    expect(opensInOtherReader('manga', MangaFormat.ARCHIVE)).toBe(false);
    expect(opensInOtherReader('manga', MangaFormat.IMAGE)).toBe(false);
    expect(opensInOtherReader('book', MangaFormat.EPUB)).toBe(false);
    expect(opensInOtherReader('pdf', MangaFormat.PDF)).toBe(false);
  });
});
