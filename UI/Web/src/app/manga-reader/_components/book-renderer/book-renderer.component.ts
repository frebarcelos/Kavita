import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  output,
  untracked,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import {PageFlip} from '../../../_vendor/page-flip/PageFlip';
import {FlipSetting, SizeType} from '../../../_vendor/page-flip/Settings';
import {BookLayout, bookLayout, pagesToLoad} from './book-pages';

/** The parts of PageFlip the renderer uses, so tests can provide a fake book */
export type Book = Pick<PageFlip, 'on' | 'loadFromHTML' | 'flip' | 'turnToPage' | 'destroy' | 'setForcePortrait'>;
export type BookFactory = (root: HTMLElement, settings: Partial<FlipSetting>) => Book;
export const BOOK_FACTORY = new InjectionToken<BookFactory>('BOOK_FACTORY', {
  providedIn: 'root',
  factory: () => (root, settings) => new PageFlip(root, settings),
});

/** Proportions of one page when the chapter does not tell its own; the image is fitted inside it */
const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 600;

/**
 * Shows the chapter as a book whose pages turn like paper. Paging stays with the reader: it sets pageNum and the book
 * turns to it; a page turned by hand in the book is reported through pageChange.
 *
 * A wide page (a two-page spread) lies across both sides of the open book. A one-page book opens as two pages while it
 * is on a wide page, and closes back to one page after it.
 */
@Component({
  selector: 'app-book-renderer',
  template: `<div class="book-area" #area></div>`,
  host: {'class': 'book-renderer'},
  styleUrls: ['../../../_vendor/page-flip/Style/stPageFlip.css', './book-renderer.component.scss'],
  // The book builds its own DOM, which component-scoped styles would not reach
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookRendererComponent {
  totalPages = input.required<number>();
  pageNum = input.required<number>();
  pageUrl = input.required<(page: number) => string>();
  rightToLeft = input(false);
  twoPages = input(false);
  /** With two pages, the first one alone */
  cover = input(true);
  drawShadow = input(true);
  /**
   * The loaded chapter. A new one builds a new book, even with as many pages as the last; pass it once its page
   * sizes are known, so wide pages are found
   */
  chapter = input<unknown>(null);
  isWide = input<(page: number) => boolean>(() => false);
  /** Width over height of one page */
  pageRatio = input(PAGE_WIDTH / PAGE_HEIGHT);
  pageChange = output<number>();

  private readonly factory = inject(BOOK_FACTORY);
  private readonly area = viewChild.required<ElementRef<HTMLElement>>('area');
  private book: Book | null = null;
  private root: HTMLElement | null = null;
  private layout: BookLayout | null = null;
  /** Images by reader page; a wide page has one per half */
  private images = new Map<number, HTMLImageElement[]>();
  private currentPage = -1;
  private portrait = false;
  private ratio = PAGE_WIDTH / PAGE_HEIGHT;
  /** Set while the renderer itself opens or closes the book */
  private adjusting = false;

  constructor() {
    // A new chapter or layout builds a new book
    effect(() => {
      const area = this.area().nativeElement;
      this.chapter();
      const total = this.totalPages();
      const rightToLeft = this.rightToLeft();
      const twoPages = this.twoPages();
      const cover = this.cover();
      const drawShadow = this.drawShadow();
      const pageUrl = this.pageUrl();
      const isWide = this.isWide();
      const pageRatio = this.pageRatio();
      untracked(() => this.build(area, total, rightToLeft, twoPages, drawShadow, pageUrl, isWide, pageRatio, cover));
    });
    // The reader decides the page; the book follows it
    effect(() => {
      const page = this.pageNum();
      untracked(() => this.goTo(page));
    });
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  private build(area: HTMLElement, total: number, rightToLeft: boolean, twoPages: boolean, drawShadow: boolean,
                pageUrl: (page: number) => string, isWide: (page: number) => boolean, pageRatio: number,
                cover: boolean) {
    this.teardown();
    if (total <= 0) return;

    const layout = bookLayout(total, {rightToLeft, twoPages, cover, isWide});
    // PageFlip removes its root element when destroyed, so each book gets a fresh one
    const root = document.createElement('div');
    area.appendChild(root);
    this.images = new Map();
    const pages = layout.slots.map(slot => {
      const element = document.createElement('div');
      element.className = 'book-page';
      if (slot.blank) {
        element.classList.add('book-blank');
        return element;
      }
      if (slot.half) element.classList.add(`book-half-${slot.half}`);
      const image = document.createElement('img');
      image.alt = '';
      image.dataset['src'] = pageUrl(slot.page);
      element.appendChild(image);
      this.images.set(slot.page, [...(this.images.get(slot.page) ?? []), image]);
      return element;
    });

    this.layout = layout;
    this.root = root;
    this.ratio = pageRatio;
    this.currentPage = this.pageNum();
    this.loadAround(this.currentPage);
    this.setPortrait(this.wantsPortrait(this.currentPage));

    const book = this.factory(root, {
      size: SizeType.STRETCH,
      // Shaped like the chapter pages: the images then fill the page instead of leaving bands
      width: Math.round(PAGE_HEIGHT * pageRatio), height: PAGE_HEIGHT,
      minWidth: 100, maxWidth: 2000, minHeight: 150, maxHeight: 3000,
      startPage: layout.slotOf(this.currentPage),
      // One page or two, as the reader layout and the current page say; never decided by the window width
      usePortrait: false,
      forcePortrait: this.portrait,
      showCover: twoPages && cover,
      // Only the shadow of a page while it turns: the HTML mode has no fixed shadow between two open pages
      drawShadow,
      maxShadowOpacity: 0.3,
      flippingTime: 600,
      mobileScrollSupport: false,
      // A click in the middle opens the reader menu, as in the other renderers; corners and dragging still turn
      disableFlipByClick: true,
    });
    // While loading, PageFlip shows its first page and then the start page, each with a flip event; reporting those as
    // turns would send the reader back to page 0 and into a loop with its saved page
    let loading = true;
    book.on('flip', e => {
      if (loading || this.adjusting) return;
      // The reader and the book name a pair of pages by different rules: only a view without the reader's page is a
      // turn, reported by its first page in reading order. Otherwise the two could keep correcting each other
      const inView = this.pagesInView(e.data as number);
      if (!inView.includes(this.currentPage)) {
        this.currentPage = Math.min(...inView);
        this.loadAround(this.currentPage);
        this.pageChange.emit(this.currentPage);
      }
      const page = this.currentPage;
      // After the book has settled: opening or closing it inside its own flip event would redraw mid-turn
      queueMicrotask(() => {
        if (this.book === book) this.fitTo(page);
      });
    });
    book.loadFromHTML(pages);
    loading = false;
    this.book = book;
  }

  private goTo(page: number) {
    if (this.book === null || this.layout === null || page === this.currentPage) return;
    // Already on screen, as the other page of the pair shown: nothing to turn
    if (this.pagesInView(this.layout.slotOf(this.currentPage)).includes(page)) {
      this.currentPage = page;
      return;
    }
    const previous = this.currentPage;
    this.currentPage = page;
    this.loadAround(page);
    // Open before turning onto a wide page, so it turns in as a whole; closing waits for the turn to end
    if (!this.wantsPortrait(page)) this.fitTo(page);

    const target = this.layout.slotOf(page);
    if (Math.abs(page - previous) <= (this.twoPages() ? 2 : 1)) {
      this.book.flip(target);
    } else {
      this.book.turnToPage(target);
    }
  }

  /** Opens or closes a one-page book for the page, and shows it */
  private fitTo(page: number) {
    const portrait = this.wantsPortrait(page);
    if (this.book === null || this.layout === null || portrait === this.portrait) return;
    this.setPortrait(portrait);
    // Switching re-shows the page the engine was on, with flip events for places the reader never asked for; those
    // are not turns, and reporting them made the opening and closing chase each other without end
    this.adjusting = true;
    try {
      this.book.setForcePortrait(portrait);
      this.book.turnToPage(this.layout.slotOf(page));
    } finally {
      this.adjusting = false;
    }
  }

  /** Reader pages on screen with the slot; a blank only counts when it is all there is */
  private pagesInView(slot: number) {
    const layout = this.layout!;
    const shown = layout.viewAt(slot, !this.portrait).filter(s => !layout.slots[s].blank);
    return (shown.length > 0 ? shown : [slot]).map(s => layout.slots[s].page);
  }

  private wantsPortrait(page: number) {
    return !this.twoPages() && !this.layout!.isWide(page);
  }

  private setPortrait(portrait: boolean) {
    this.portrait = portrait;
    // The book takes its height from its width; the stylesheet caps the width so the height fits the screen
    this.root?.style.setProperty('--book-ratio', String(this.ratio * (portrait ? 1 : 2)));
  }

  private loadAround(page: number) {
    for (const nearby of pagesToLoad(page, this.totalPages())) {
      for (const image of this.images.get(nearby) ?? []) {
        if (!image.getAttribute('src')) image.setAttribute('src', image.dataset['src']!);
      }
    }
  }

  private teardown() {
    this.book?.destroy();
    this.book = null;
    this.root = null;
    this.layout = null;
  }
}
