/**
 * Fork: the progress of a chapter is the index of the page being read (0 = first page), and the page count once the
 * chapter is finished. The image reader and Kover keep it that way; the PDF viewer counts pages from 1. These convert
 * between the two, so a PDF opens on the same page in the PDF reader, the book mode and the tablet.
 */

/** The PDF viewer page (from 1) for a saved progress */
export function pdfPageFromProgress(pageNum: number, maxPages?: number): number {
  const page = Math.max(0, pageNum || 0) + 1;
  return maxPages ? Math.min(page, maxPages) : page;
}

/** The progress to save for a PDF viewer page (from 1) */
export function progressFromPdfPage(page: number, maxPages: number): number {
  if (maxPages && page >= maxPages) return maxPages;
  return Math.max(0, page - 1);
}
