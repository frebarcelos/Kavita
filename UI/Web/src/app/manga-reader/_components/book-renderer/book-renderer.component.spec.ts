import {TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FlipSetting} from '../../../_vendor/page-flip/Settings';
import {Book, BOOK_FACTORY, BookRendererComponent} from './book-renderer.component';

class FakeBook {
  handlers = new Map<string, (e: {data: unknown}) => void>();
  pages: HTMLElement[] = [];
  flip = vi.fn();
  turnToPage = vi.fn();
  destroy = vi.fn();
  setForcePortrait = vi.fn();

  constructor(readonly root: HTMLElement, readonly settings: Partial<FlipSetting>) {}

  on(event: string, callback: (e: {data: unknown}) => void) {
    this.handlers.set(event, callback);
    return this;
  }

  loadFromHTML(items: HTMLElement[]) {
    this.pages = [...items];
  }

  turnByHand(bookIndex: number) {
    this.handlers.get('flip')!({data: bookIndex});
  }
}

describe('Book renderer', () => {
  let books: FakeBook[];

  beforeEach(() => {
    books = [];
    TestBed.configureTestingModule({
      providers: [{provide: BOOK_FACTORY, useValue: (root: HTMLElement, settings: Partial<FlipSetting>) => {
        const book = new FakeBook(root, settings);
        books.push(book);
        return book as unknown as Book;
      }}],
    });
  });

  function create(options: {pageNum?: number, rightToLeft?: boolean, twoPages?: boolean, drawShadow?: boolean,
                            wide?: number[]} = {}) {
    const fixture = TestBed.createComponent(BookRendererComponent);
    fixture.componentRef.setInput('chapter', {id: 1});
    fixture.componentRef.setInput('isWide', (page: number) => (options.wide ?? []).includes(page));
    fixture.componentRef.setInput('totalPages', 10);
    fixture.componentRef.setInput('pageNum', options.pageNum ?? 0);
    fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
    fixture.componentRef.setInput('rightToLeft', options.rightToLeft ?? false);
    fixture.componentRef.setInput('twoPages', options.twoPages ?? false);
    fixture.componentRef.setInput('drawShadow', options.drawShadow ?? true);
    fixture.detectChanges();
    TestBed.tick();
    return fixture;
  }

  it('opens a single-page book on the current page, without the spine shadow mode', () => {
    create({pageNum: 4});
    const settings = books[0].settings;

    expect(settings.forcePortrait).toBe(true);
    expect(settings.showCover).toBe(false);
    expect(settings.startPage).toBe(4);
    expect(books[0].pages.length).toBe(10);
    expect(books[0].root.querySelector('canvas')).toBeNull();
  });

  it('leaves a click in the middle of the page to the reader menu; corners and dragging still turn', () => {
    create();

    expect(books[0].settings.disableFlipByClick).toBe(true);
    expect(books[0].settings.useMouseEvents).not.toBe(false);
  });

  it('opens a two-page book with a lone cover and configurable flip shadow', () => {
    create({twoPages: true, drawShadow: false});
    const settings = books[0].settings;

    expect(settings.forcePortrait).toBe(false);
    expect(settings.usePortrait).toBe(false);
    expect(settings.showCover).toBe(true);
    expect(settings.drawShadow).toBe(false);
  });

  it('fits the book to the screen height, as the book takes its height from its width', () => {
    create();
    expect(books[0].root.style.getPropertyValue('--book-ratio')).toBe(String(400 / 600));

    create({twoPages: true});
    expect(books[1].root.style.getPropertyValue('--book-ratio')).toBe(String(800 / 600));
  });

  it('shapes the pages like the chapter pages, so the images fill the screen height', () => {
    const fixture = TestBed.createComponent(BookRendererComponent);
    fixture.componentRef.setInput('chapter', {id: 1});
    fixture.componentRef.setInput('totalPages', 10);
    fixture.componentRef.setInput('pageNum', 0);
    fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
    fixture.componentRef.setInput('twoPages', true);
    fixture.componentRef.setInput('pageRatio', 0.74);
    fixture.detectChanges();
    TestBed.tick();
    const settings = books[0].settings;

    expect(settings.width! / settings.height!).toBeCloseTo(0.74, 2);
    expect(Number(books[0].root.style.getPropertyValue('--book-ratio'))).toBeCloseTo(1.48, 2);
  });

  it('leaves the first page paired when the layout has no lone cover', () => {
    const fixture = TestBed.createComponent(BookRendererComponent);
    fixture.componentRef.setInput('chapter', {id: 1});
    fixture.componentRef.setInput('totalPages', 10);
    fixture.componentRef.setInput('pageNum', 0);
    fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
    fixture.componentRef.setInput('twoPages', true);
    fixture.componentRef.setInput('cover', false);
    fixture.detectChanges();
    TestBed.tick();

    expect(books[0].settings.showCover).toBe(false);
  });

  it('loads only the images around the current page', () => {
    create({pageNum: 5});
    const sources = books[0].pages.map(p => p.querySelector('img')!.getAttribute('src'));

    expect(sources.filter(s => s !== null)).toEqual(['page-2', 'page-3', 'page-4', 'page-5', 'page-6', 'page-7', 'page-8']);
  });

  it('puts right-to-left pages in reverse and reports pages turned by hand in reading order', () => {
    const fixture = create({rightToLeft: true});
    const turned: number[] = [];
    fixture.componentInstance.pageChange.subscribe(page => turned.push(page));

    expect(books[0].settings.startPage).toBe(9);
    expect(books[0].pages[9].querySelector('img')!.getAttribute('src')).toBe('page-0');
    books[0].turnByHand(8);

    expect(turned).toEqual([1]);
  });

  it('turns with animation to a nearby page and jumps to a far one', () => {
    const fixture = create();

    fixture.componentRef.setInput('pageNum', 1);
    fixture.detectChanges();
    TestBed.tick();
    fixture.componentRef.setInput('pageNum', 8);
    fixture.detectChanges();
    TestBed.tick();

    expect(books[0].flip).toHaveBeenCalledWith(1);
    expect(books[0].turnToPage).toHaveBeenCalledWith(8);
  });

  it('does not turn again for the page it just reported', () => {
    const fixture = create();
    fixture.componentInstance.pageChange.subscribe(page => {
      fixture.componentRef.setInput('pageNum', page);
    });

    books[0].turnByHand(1);
    fixture.detectChanges();
    TestBed.tick();

    expect(books[0].flip).not.toHaveBeenCalled();
    expect(books[0].turnToPage).not.toHaveBeenCalled();
  });

  function goTo(fixture: ReturnType<typeof create>, page: number) {
    fixture.componentRef.setInput('pageNum', page);
    fixture.detectChanges();
    TestBed.tick();
  }

  const image = (page: HTMLElement) => page.querySelector('img')?.getAttribute('src');

  it('spreads a wide page over both sides of a two-page book', () => {
    create({twoPages: true, wide: [3]});
    const pages = books[0].pages;

    expect(pages.length).toBe(11);
    expect(pages[3].classList).toContain('book-half-left');
    expect(pages[4].classList).toContain('book-half-right');
    expect(image(pages[3])).toBe('page-3');
    expect(image(pages[4])).toBe('page-3');
  });

  it('puts a blank page before a wide page that would start on the right side', () => {
    const fixture = create({twoPages: true, wide: [2]});
    const pages = books[0].pages;

    expect(pages[2].classList).toContain('book-blank');
    expect(pages[2].querySelector('img')).toBeNull();
    goTo(fixture, 2);
    expect(books[0].flip).toHaveBeenCalledWith(3);
  });

  it('opens a one-page book on a wide page, and closes it after', async () => {
    const fixture = create({pageNum: 4, wide: [5]});
    const book = books[0];
    expect(book.settings.forcePortrait).toBe(true);

    goTo(fixture, 5);
    expect(book.setForcePortrait).toHaveBeenLastCalledWith(false);
    expect(book.root.style.getPropertyValue('--book-ratio')).toBe(String(800 / 600));
    // Slots: 0-4, a blank at 5 so the spread opens from an even slot, its halves at 6 and 7, page 6 at 8
    expect(book.flip).toHaveBeenCalledWith(6);
    // Opening happens before the turn, so the spread turns in as a whole
    expect(book.setForcePortrait.mock.invocationCallOrder[0]).toBeLessThan(book.flip.mock.invocationCallOrder[0]);

    book.turnByHand(8);
    await Promise.resolve();
    expect(book.setForcePortrait).toHaveBeenLastCalledWith(true);
    expect(book.root.style.getPropertyValue('--book-ratio')).toBe(String(400 / 600));
    expect(book.turnToPage).toHaveBeenLastCalledWith(8);
  });

  it('starts open when the reader is on a wide page', () => {
    create({pageNum: 5, wide: [5]});

    expect(books[0].settings.forcePortrait).toBe(false);
    expect(books[0].settings.startPage).toBe(6);
  });

  it('opens the spread when a one-page book is turned by hand onto its blank page', async () => {
    const fixture = create({wide: [1]});
    const turned: number[] = [];
    fixture.componentInstance.pageChange.subscribe(page => turned.push(page));

    books[0].turnByHand(1);
    await Promise.resolve();

    expect(turned).toEqual([1]);
    expect(books[0].setForcePortrait).toHaveBeenLastCalledWith(false);
    expect(books[0].turnToPage).toHaveBeenLastCalledWith(2);
  });

  it('reports the first page in reading order of a pair turned by hand, also right to left', () => {
    const fixture = create({twoPages: true, rightToLeft: true});
    const turned: number[] = [];
    fixture.componentInstance.pageChange.subscribe(page => turned.push(page));

    // Book order is 9..0: a lone 9, then pairs; pages 2 and 1 sit at slots 7 and 8, reported by the left one (7)
    books[0].turnByHand(7);

    expect(turned).toEqual([1]);
  });

  it('does not turn for a reader page already in view, so differing page rules cannot loop', () => {
    const fixture = create({twoPages: true});
    fixture.componentInstance.pageChange.subscribe(() => {});
    books[0].turnByHand(1);

    // The reader settles the pair [1, 2] on its own rule, as page 2
    goTo(fixture, 2);

    expect(books[0].flip).not.toHaveBeenCalled();
    expect(books[0].turnToPage).not.toHaveBeenCalled();
  });

  it('does not report a turn that lands on a view showing the reader page', () => {
    const fixture = create({twoPages: true, pageNum: 2});
    const turned: number[] = [];
    fixture.componentInstance.pageChange.subscribe(page => turned.push(page));

    // The book settles on the pair [1, 2] and tells its left slot
    books[0].turnByHand(1);

    expect(turned).toEqual([]);
  });

  it('builds a new book for a new chapter, even with the same page count', () => {
    const fixture = create();

    fixture.componentRef.setInput('chapter', {id: 2});
    fixture.detectChanges();
    TestBed.tick();

    expect(books.length).toBe(2);
    expect(books[0].destroy).toHaveBeenCalled();
  });

  it('destroys the book with the reader', () => {
    const fixture = create();

    fixture.destroy();

    expect(books[0].destroy).toHaveBeenCalled();
  });
});
