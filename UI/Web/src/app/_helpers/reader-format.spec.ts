import {describe, expect, it} from 'vitest';
import {MangaFormat} from '../_models/manga-format';
import {opensInOtherReader, readerFor, readerRoute} from './reader-format';

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

  // Fork (V1): the book mode turns PDF pages like a book, in the image reader
  it('opens a PDF in the image reader when the book mode is on', () => {
    expect(readerFor(MangaFormat.PDF, true)).toBe('manga');
    expect(readerFor(MangaFormat.PDF, false)).toBe('pdf');
  });

  it('the book mode changes only PDF', () => {
    expect(readerFor(MangaFormat.EPUB, true)).toBe('book');
    expect(readerFor(MangaFormat.ARCHIVE, true)).toBe('manga');
  });

  it('with the book mode on, the PDF reader hands its chapter to the image reader, and back when it is off', () => {
    expect(opensInOtherReader('pdf', MangaFormat.PDF, true)).toBe(true);
    expect(opensInOtherReader('manga', MangaFormat.PDF, true)).toBe(false);
    expect(opensInOtherReader('manga', MangaFormat.PDF, false)).toBe(true);
  });

  it('routes a chapter to its reader, the book mode sending PDF to the image reader', () => {
    expect(readerRoute(1, 2, 3, MangaFormat.EPUB)).toEqual(['library', 1, 'series', 2, 'book', 3]);
    expect(readerRoute(1, 2, 3, MangaFormat.PDF)).toEqual(['library', 1, 'series', 2, 'pdf', 3]);
    expect(readerRoute(1, 2, 3, MangaFormat.PDF, true)).toEqual(['library', 1, 'series', 2, 'manga', 3]);
    expect(readerRoute(1, 2, 3, MangaFormat.ARCHIVE)).toEqual(['library', 1, 'series', 2, 'manga', 3]);
    expect(readerRoute(1, 2, 3, undefined)).toEqual(['library', 1, 'series', 2, 'manga', 3]);
  });
});
