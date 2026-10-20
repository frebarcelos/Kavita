import {MangaFormat} from '../_models/manga-format';

export type ReaderKind = 'manga' | 'book' | 'pdf';

/**
 * The reader that opens a chapter of this format. Fork (V1): with the book mode on, a PDF opens in the image reader,
 * which turns its pages (rendered by the server) like a book
 */
export function readerFor(format: MangaFormat | undefined, bookMode = false): ReaderKind {
  if (format === MangaFormat.EPUB) return 'book';
  if (format === MangaFormat.PDF) return bookMode ? 'manga' : 'pdf';
  return 'manga';
}

/**
 * A folder-organized series may mix formats, so a reader moving to another chapter hands it over when the chapter's
 * format belongs to another reader
 */
export function opensInOtherReader(current: ReaderKind, format: MangaFormat | undefined, bookMode = false): boolean {
  return readerFor(format, bookMode) !== current;
}

/** The route of the reader for a chapter */
export function readerRoute(libraryId: number, seriesId: number, chapterId: number, format: MangaFormat | undefined,
                            bookMode = false): (string | number)[] {
  return ['library', libraryId, 'series', seriesId, readerFor(format, bookMode), chapterId];
}
