import {ReaderMode} from '../../../_models/preferences/reader-mode';
import {ReadingDirection} from '../../../_models/preferences/reading-direction';
import {LayoutMode} from '../../_models/layout-mode';

/** The book mode is a choice of this browser (made for reading on the PC), kept across chapters */
export const BOOK_MODE_KEY = 'kavita--reader-book-mode';

export function readBookMode(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(BOOK_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveBookMode(enabled: boolean, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(BOOK_MODE_KEY, String(enabled));
  } catch {
    // Without storage the choice lasts only while the reader is open
  }
}

/** Pages turn as a book only in the left/right reader; webtoon and up/down keep scrolling */
export function isBookModeActive(enabled: boolean, readerMode: ReaderMode): boolean {
  return enabled && readerMode === ReaderMode.LeftRight;
}

export interface BookShape {
  twoPages: boolean;
  rightToLeft: boolean;
  /** The first page alone, as a cover */
  cover: boolean;
}

/** The book follows the reader layout: one page or two, and which way the pairs read */
export function bookShape(layoutMode: LayoutMode, readingDirection: ReadingDirection): BookShape {
  return {
    twoPages: layoutMode !== LayoutMode.Single,
    // The reversed double layout is the reader's manga layout: pairs read from the right
    rightToLeft: readingDirection === ReadingDirection.RightToLeft || layoutMode === LayoutMode.DoubleReversed,
    cover: layoutMode !== LayoutMode.DoubleNoCover,
  };
}

function safeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
