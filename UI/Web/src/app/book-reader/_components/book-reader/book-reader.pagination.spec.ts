import {ElementRef, signal} from '@angular/core';
import {describe, expect, it, vi} from 'vitest';
import {BookReaderComponent} from './book-reader.component';
import {BookPageLayoutMode} from '../../../_models/readers/book-page-layout-mode';
import {ReadingDirection} from '../../../_models/preferences/reading-direction';
import {WritingStyle} from '../../../_models/preferences/writing-style';
import {PAGING_DIRECTION} from '../../../manga-reader/_models/reader-enums';

// The selection menu's third-party color picker cannot JIT compile in jsdom.
// Its UI is outside this characterization of the existing paging methods.
vi.mock('@iplab/ngx-color-picker', () => ({
  ChromePickerComponent: class {}, Color: class {}, ColorPickerControl: class {},
}));

// Restoration after a layout change runs on the next frame; the tests run it immediately.
vi.mock('afterframe', () => ({default: (callback: () => void) => callback()}));

// Characterizes the existing paging methods without starting the reader's HTTP lifecycle.
describe('EPUB pagination before book presentation', () => {
  it('restores a text anchor on the right-hand page to the start of its two-page spread', () => {
    const content = document.createElement('div');
    content.innerHTML = '<p id="first">Trecho lido</p>';
    const anchor = content.querySelector('p')!;
    // A spread of two columns is 1000 wide; the anchor starts in the right column of the third spread
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({left: 0} as DOMRect);
    vi.spyOn(anchor, 'getClientRects').mockImplementation(() => [{left: 2500 - content.scrollLeft}] as unknown as DOMRectList);
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {
      bookContentElemRef: () => new ElementRef(content), getElementFromXPath: () => anchor,
      layoutMode: () => BookPageLayoutMode.Column2, writingStyle: () => WritingStyle.Horizontal,
      getVirtualPage: () => [1, 4, 1000], scrollService: {scrollIntoView: vi.fn()},
    });
    reader.scrollTo("id('first')");
    expect(content.scrollLeft).toBe(2000);
  });

  it('refreshes the book edges after a virtual page turn even when the HTML has no TOC anchors', () => {
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {hasDelayedScroll: false, pageAnchors: {},
      getFirstVisibleElementXPath: () => null, lastSeenScrollPartPath: '',
      bookModeActive: () => true, cdRef: {markForCheck: vi.fn()},
    });
    reader.handleScrollEvent(true);
    expect(reader.cdRef.markForCheck).toHaveBeenCalled();
  });

  it('restores the visible text, not the start of a paragraph that began on an earlier spread', () => {
    const content = document.createElement('div');
    content.innerHTML = '<p id="first">Trecho longo que começou antes</p>';
    document.body.appendChild(content);
    const anchor = content.querySelector('p')!;
    // Spreads of 1000. Each character is 100 wide; the paragraph begins half a spread before the one being read.
    // The larger font then moves the paragraph start to 2500 and each character to 120 wide.
    let start = 1500, width = 100;
    content.scrollLeft = 2000;
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, bottom: 900} as DOMRect);
    vi.spyOn(anchor, 'getClientRects').mockImplementation(() => [{left: start - content.scrollLeft}] as unknown as DOMRectList);
    const char = (i: number) => ({left: start + width * i - content.scrollLeft, right: start + width * (i + 1) - content.scrollLeft});
    // jsdom has no layout for ranges
    Object.defineProperty(Range.prototype, 'getClientRects', {configurable: true, value: function (this: Range) {
      return (this.endOffset - this.startOffset > 1 ? [char(this.startOffset), char(this.endOffset - 1)] : [char(this.startOffset)]) as unknown as DOMRectList;
    }});
    let afterLayout!: FrameRequestCallback;
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      afterLayout = callback;
      return 1;
    });
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {
      document, bookContentElemRef: () => new ElementRef(content),
      renderer: {setStyle: vi.fn(), removeStyle: vi.fn()},
      getFirstVisibleElementXPath: () => "id('first')", getElementFromXPath: () => anchor,
      convertVwToPx: () => 0, updateImageSizes: vi.fn(), updateWidthAndHeightCalcs: vi.fn(),
      layoutMode: () => BookPageLayoutMode.Column2, writingStyle: () => WritingStyle.Horizontal,
      addEmptyPageIfRequired: vi.fn(), getVirtualPage: () => [1, 4, 1000],
      hasDelayedScroll: false, pagingRevision: 0, scrollService: {scrollIntoView: vi.fn()},
    });
    try {
      reader.applyPageStyles({'font-family': 'inherit', 'font-size': '150%',
        'line-height': '100%', 'margin-left': '0vw', 'margin-right': '0vw'});
      start = 2500; width = 120; // the first visible character (index 5) is now at 3100
      afterLayout(0);
      expect(content.scrollLeft).toBe(3000);
    } finally {
      frame.mockRestore();
      delete (Range.prototype as unknown as {getClientRects?: unknown}).getClientRects;
      content.remove();
    }
  });

  it('restores the text even when no element is entirely on screen, as during an interrupted turn', () => {
    const text = document.createRange();
    let afterLayout!: FrameRequestCallback;
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      afterLayout = callback;
      return 1;
    });
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {
      bookContentElemRef: () => new ElementRef(document.createElement('div')),
      renderer: {setStyle: vi.fn(), removeStyle: vi.fn()},
      getFirstVisibleElementXPath: () => null, getFirstVisibleTextRange: () => text,
      convertVwToPx: () => 0, updateImageSizes: vi.fn(), updateWidthAndHeightCalcs: vi.fn(),
      layoutMode: () => BookPageLayoutMode.Column2, addEmptyPageIfRequired: vi.fn(),
      hasDelayedScroll: false, pagingRevision: 0, alignToSpread: vi.fn(() => true), scrollTo: vi.fn(),
    });
    try {
      reader.applyPageStyles({'font-family': 'inherit', 'font-size': '170%',
        'line-height': '100%', 'margin-left': '0vw', 'margin-right': '0vw'});
      afterLayout?.(0);
      expect(reader.alignToSpread).toHaveBeenCalledWith(text);
      expect(reader.scrollTo).not.toHaveBeenCalled();
    } finally {
      frame.mockRestore();
    }
  });

  it('keeps the text at the top of the old layout when switching between one and two pages', () => {
    vi.useFakeTimers();
    const text = document.createRange();
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {
      pagingRevision: 0, lastSeenScrollPartPath: "id('saved')", pendingAnchorRestore: null,
      clearTimeout: vi.fn(), updateImageSizes: vi.fn(), injectImageBookmarkIndicators: vi.fn(),
      addEmptyPageIfRequired: vi.fn(), updateSingleImagePageStyles: vi.fn(), cdRef: {markForCheck: vi.fn()},
      scrollbarNeeded: {set: vi.fn()},
      bookContentElemRef: () => undefined, reader: () => undefined,
      getFirstVisibleTextRange: () => text, alignToSpread: vi.fn(() => true), scrollTo: vi.fn(),
    });
    try {
      reader.applyLayoutMode(BookPageLayoutMode.Column1, true);
      vi.runAllTimers();
      expect(reader.alignToSpread).toHaveBeenCalledWith(text);
      expect(reader.scrollTo).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores the deferred typography anchor before a new page turn, without rewinding afterwards', () => {
    const content = document.createElement('div');
    content.innerHTML = '<p id="first">Trecho lido</p>';
    const anchor = content.querySelector('p')!;
    // After the larger font, the anchor moved to the third column (offset 2500 with columns of 1000)
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({left: 0} as DOMRect);
    vi.spyOn(anchor, 'getClientRects').mockReturnValue([{left: 2500 - content.scrollLeft}] as unknown as DOMRectList);
    const reader = Object.create(BookReaderComponent.prototype);
    let afterLayout!: FrameRequestCallback;
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      afterLayout = callback;
      return 1;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    let offsetAtCommand = -1;
    Object.assign(reader, {
      bookContentElemRef: () => new ElementRef(content),
      renderer: {setStyle: vi.fn(), removeStyle: vi.fn()},
      getFirstVisibleElementXPath: () => "id('first')", getElementFromXPath: () => anchor,
      convertVwToPx: () => 0, updateImageSizes: vi.fn(), updateWidthAndHeightCalcs: vi.fn(),
      layoutMode: () => BookPageLayoutMode.Column2, writingStyle: () => WritingStyle.Horizontal,
      addEmptyPageIfRequired: vi.fn(), getVirtualPage: () => [1, 4, 1000],
      hasDelayedScroll: false, scrollTo: vi.fn(), pagingRevision: 0,
      nextPage: vi.fn(() => offsetAtCommand = content.scrollLeft),
      getFirstVisibleTextRange: () => null, // covers the element fallback; the text anchor has its own test
      bookModeActive: () => false,
    });
    try {
      reader.applyPageStyles({'font-family': 'inherit', 'font-size': '150%',
        'line-height': '100%', 'margin-left': '0vw', 'margin-right': '0vw'});
      reader.movePage(PAGING_DIRECTION.FORWARD);
      expect(offsetAtCommand).toBe(2000);
      expect(cancel).toHaveBeenCalledWith(1);
      afterLayout(0);
      expect(reader.scrollTo).not.toHaveBeenCalled();
    } finally {
      frame.mockRestore();
      cancel.mockRestore();
    }
  });

  it('defers the reader jump until the book completes, then commits directly without another animation', () => {
    const reader = Object.create(BookReaderComponent.prototype);
    let complete!: () => void;
    const turn = vi.fn((_: unknown, commit: () => void) => { complete = commit; return true; });
    Object.assign(reader, {pagingRevision:0, bookModeActive:() => true, bookTwoPages:() => true,
      bookAnimation:() => ({turn}), getVirtualPage:() => [2, 4, 1000],
      bookContentElemRef:() => new ElementRef(document.createElement('div')),
      bookContainerElemRef:() => new ElementRef(document.createElement('div')),
      readingDirection:() => ReadingDirection.LeftToRight, nextPage:vi.fn(), prevPage:vi.fn()});
    reader.movePage(PAGING_DIRECTION.FORWARD);
    expect(turn).toHaveBeenCalledTimes(1);
    expect(reader.nextPage).not.toHaveBeenCalled();
    complete();
    expect(reader.nextPage).toHaveBeenCalledTimes(1);
    expect(turn).toHaveBeenCalledTimes(1);
  });

  it('leaves the HTML boundary to the original next/previous file navigation', () => {
    const reader = Object.create(BookReaderComponent.prototype), turn = vi.fn();
    Object.assign(reader, {pagingRevision:0, bookModeActive:() => true,
      bookAnimation:() => ({turn}), getVirtualPage:() => [4, 4, 1000], nextPage:vi.fn(), prevPage:vi.fn()});
    reader.movePage(PAGING_DIRECTION.FORWARD);
    reader.getVirtualPage = () => [1, 4, 1000];
    reader.movePage(PAGING_DIRECTION.BACKWARDS);
    expect(turn).not.toHaveBeenCalled();
    expect(reader.nextPage).toHaveBeenCalledTimes(1);
    expect(reader.prevPage).toHaveBeenCalledTimes(1);
  });

  it('routes wheel gestures to book turns and absorbs the remainder of the same gesture', () => {
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {bookModeActive:() => true, lastBookWheel:-Infinity, movePage:vi.fn(),
      layoutMode:() => BookPageLayoutMode.Column2});
    const event = new WheelEvent('wheel', {deltaY:120, cancelable:true});
    reader.onWheel(event); reader.onWheel(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reader.movePage).toHaveBeenCalledExactlyOnceWith(PAGING_DIRECTION.FORWARD);
  });

  it('absorbs an opposite command at an HTML boundary while another page is still turning', () => {
    const reader = Object.create(BookReaderComponent.prototype);
    Object.assign(reader, {pagingRevision:0, bookModeActive:() => true,
      bookAnimation:() => ({isTurning:true}), getVirtualPage:() => [1,4,1000], prevPage:vi.fn(), nextPage:vi.fn()});
    reader.movePage(PAGING_DIRECTION.BACKWARDS);
    expect(reader.prevPage).not.toHaveBeenCalled();
  });

  for (const layout of [BookPageLayoutMode.Column1, BookPageLayoutMode.Column2]) {
    for (const direction of [ReadingDirection.LeftToRight, ReadingDirection.RightToLeft]) {
      it(`counts, advances and returns within HTML in layout ${layout}, direction ${direction}`, () => {
        const content = document.createElement('div');
        content.innerHTML = '<p id="first">Primeiro trecho</p><p id="last">Último trecho</p>';
        Object.defineProperty(content, 'scrollWidth', {value: 4000});
        const reader = Object.create(BookReaderComponent.prototype);
        Object.assign(reader, {
          bookContentElemRef: () => new ElementRef(content),
          readingSectionElemRef: () => new ElementRef(content),
          layoutMode: signal(layout), readingDirection: signal(direction),
          writingStyle: signal(WritingStyle.Horizontal), pageNum: signal(0),
          pageSize: () => 1000, handleScrollEvent: vi.fn(),
          scrollService: {scrollToX: (offset: number, element: HTMLElement, _: string, done: () => void) => {
            element.scrollLeft = offset;
            done();
          }},
        });

        expect(reader.getVirtualPage()).toEqual([1, 4, 1000]);
        reader.nextPage();
        expect(reader.getVirtualPage()).toEqual([2, 4, 1000]);
        content.scrollLeft = 2000; // Existing scroll-to-column-N contract, independent of direction.
        expect(reader.getVirtualPage()).toEqual([3, 4, 1000]);
        reader.prevPage();
        expect(reader.getVirtualPage()).toEqual([2, 4, 1000]);
        expect(reader.pageNum()).toBe(0); // A virtual page never becomes the persisted HTML index.
        expect(reader.handleScrollEvent).toHaveBeenCalledTimes(2);
      });
    }
  }
});
