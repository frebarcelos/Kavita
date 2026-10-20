import {describe, expect, it} from 'vitest';
import {pdfPageFromProgress, progressFromPdfPage} from './pdf-progress';

describe('PDF progress', () => {
  it('opens the page the image reader and the tablet saved', () => {
    expect(pdfPageFromProgress(0, 10)).toBe(1);
    expect(pdfPageFromProgress(4, 10)).toBe(5);
  });

  it('a finished chapter opens on its last page', () => {
    expect(pdfPageFromProgress(10, 10)).toBe(10);
    expect(pdfPageFromProgress(12, 10)).toBe(10);
  });

  it('opens before the page count is known', () => {
    expect(pdfPageFromProgress(4)).toBe(5);
  });

  it('saves the page index, as the image reader and the tablet do', () => {
    expect(progressFromPdfPage(1, 10)).toBe(0);
    expect(progressFromPdfPage(5, 10)).toBe(4);
  });

  it('the last page finishes the chapter', () => {
    expect(progressFromPdfPage(10, 10)).toBe(10);
  });

  it('a page read in one reader opens on the same page in the other', () => {
    for (const page of [1, 2, 7, 10]) {
      expect(pdfPageFromProgress(progressFromPdfPage(page, 10), 10)).toBe(page);
    }
  });
});
