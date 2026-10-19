import {MangaFormat} from '../_models/manga-format';

export type ReaderKind = 'manga' | 'book' | 'pdf';

/**
 * The reader that opens a chapter of this format
 */
export function readerFor(format: MangaFormat | undefined): ReaderKind {
  if (format === MangaFormat.EPUB) return 'book';
  if (format === MangaFormat.PDF) return 'pdf';
  return 'manga';
}

/**
 * A folder-organized series may mix formats, so a reader moving to another chapter hands it over when the chapter's
 * format belongs to another reader
 */
export function opensInOtherReader(current: ReaderKind, format: MangaFormat | undefined): boolean {
  return readerFor(format) !== current;
}
