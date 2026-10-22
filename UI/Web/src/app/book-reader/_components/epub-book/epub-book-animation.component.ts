import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, ViewEncapsulation} from '@angular/core';
import {Book, BOOK_FACTORY} from '../../../manga-reader/_components/book-renderer/book-renderer.component';
import {SizeType} from '../../../_vendor/page-flip/Settings';
import {PageFlip} from '../../../_vendor/page-flip/PageFlip';
import {createEpubBookPage, EpubPageGeometry} from './epub-book-pages';

export interface EpubBookTurn {
  source: HTMLElement;
  area: HTMLElement;
  current: number;
  target: number;
  stride: number;
  columns: number;
  rightToLeft: boolean;
}

/** L5: the mouse is near an outer corner of the spread, at viewport point (x, y) */
export interface EpubBookCorner {
  source: HTMLElement;
  area: HTMLElement;
  /** Spread on screen and number of spreads of the HTML, from zero */
  current: number;
  spreads: number;
  stride: number;
  columns: number;
  rightToLeft: boolean;
  x: number;
  y: number;
}

interface TurnSession {
  book: Book;
  root: HTMLElement;
  frame: number | null;
  timeout: number | null;
  started: boolean;
  done: boolean;
  commit: () => void;
  source: HTMLElement;
  visibility: string;
  visibilityPriority: string;
  /** L5: a book mounted under the mouse; busy once the page is dragged or turning */
  corner?: {busy: boolean, folded: boolean, flipped: number | null};
}

/** The engine methods a corner needs; the factory type is shared with the image reader */
type InteractiveBook = Book & Partial<Pick<PageFlip, 'userMove' | 'getState'>>;

@Component({selector: 'app-epub-book-animation', template: '',
  styleUrls: ['../../../_vendor/page-flip/Style/stPageFlip.css', './epub-book-animation.component.scss'],
  encapsulation: ViewEncapsulation.None, changeDetection: ChangeDetectionStrategy.OnPush})
export class EpubBookAnimationComponent {
  private readonly factory = inject(BOOK_FACTORY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private session: TurnSession | null = null;
  /** A corner only lifted under the mouse is not a turn: the keyboard and other commands replace it */
  get isTurning(): boolean { return this.session !== null && (!this.session.corner || this.session.corner.busy); }
  /** L5: true while a book lies under the mouse; the tap areas of the reader must let the mouse through to it */
  readonly cornerOpen = signal(false);

  /**
   * L5: mounts an interactive book of the previous, current and next spreads under the mouse, so the engine lifts the
   * corner and can be dragged. Crossing the spine turns one sheet; releasing before it, or leaving the corner, lays the
   * page down and puts the live reader back with nothing changed. Past the HTML the neighbour is a blank spread, and
   * the reader opens the neighbouring file, as its arrows do.
   * @returns false when nothing was mounted, for example the engine does not see the point as a corner
   */
  openCorner(request: EpubBookCorner, onTurn: (forward: boolean) => void): boolean {
    if (this.session || this.motion?.matches || request.stride <= 0) return false;
    const measured = this.measure(request.source, request.area, request.stride, request.columns);
    if (!measured) return false;
    const {rect, content, geometry} = measured;
    const reading = [request.current - 1, request.current, request.current + 1];
    const pages = (request.rightToLeft ? reading.reverse() : reading).flatMap(spread =>
      Array.from({length: request.columns}, (_, half) => spread < 0 || spread >= request.spreads
        ? createEpubBookPage(request.source, -1, geometry)
        : createEpubBookPage(request.source, spread * request.columns + half, geometry)));
    const padding = this.pad(pages, request.source, geometry, request.columns);
    const start = padding + request.columns;
    const root = this.stage(rect, content, true);
    let book: InteractiveBook;
    try {
      book = this.factory(root, this.settings(geometry, request.columns, start, true));
    } catch {
      root.remove();
      return false;
    }
    const corner = {busy: false, folded: false, flipped: null as number | null};
    const session: TurnSession = {book, root, frame: null, timeout: null, started: true, done: false, corner,
      source: request.source, visibility: request.source.style.getPropertyValue('visibility'),
      visibilityPriority: request.source.style.getPropertyPriority('visibility'),
      commit: () => onTurn(((corner.flipped ?? start) > start) !== request.rightToLeft)};
    this.session = session;
    book.on('flip', event => { if (corner.folded && event.data !== start) corner.flipped = event.data as number; });
    book.on('changeState', event => {
      if (event.data === 'fold_corner') { corner.folded = true; corner.busy = false; return; }
      if (event.data === 'user_fold' || event.data === 'flipping') { corner.folded = true; corner.busy = true; return; }
      if (event.data !== 'read' || !corner.folded) return;
      if (corner.flipped !== null) this.finish(session);
      else queueMicrotask(() => { if (this.session === session) this.cancel(); });
    });
    try {
      book.loadFromHTML(pages);
    } catch {
      this.cancel();
      return false;
    }
    request.source.style.setProperty('visibility', 'hidden', 'important');
    this.cornerOpen.set(true);
    // The engine listens on the window from now on; give it the point that brought the mouse here
    const block = (root.querySelector('.stf__block') ?? root).getBoundingClientRect();
    book.userMove?.({x: request.x - block.left, y: request.y - block.top}, false);
    if (book.getState && book.getState() !== 'fold_corner') {
      this.cancel();
      return false;
    }
    return true;
  }

  constructor() {
    const resize = () => this.cancel();
    const motion = () => { if (this.motion?.matches && this.session) this.finish(this.session); };
    window.addEventListener('resize', resize);
    this.motion?.addEventListener('change', motion);
    inject(DestroyRef).onDestroy(() => {
      this.cancel();
      window.removeEventListener('resize', resize);
      this.motion?.removeEventListener('change', motion);
    });
  }

  /** True means this command is handled. Repeated commands during a turn are absorbed. */
  turn(request: EpubBookTurn, commit: () => void): boolean {
    if (this.session?.corner && !this.session.corner.busy) this.cancel();
    if (this.session) return true;
    // The destination may be any other spread of the HTML: a link or the contents turn straight to it
    if (this.motion?.matches || request.stride <= 0 || request.current === request.target) return false;
    const measured = this.measure(request.source, request.area, request.stride, request.columns);
    if (!measured) return false;
    const {rect, content, geometry} = measured;
    const reverse = (request.target < request.current) !== request.rightToLeft;
    const order = reverse ? [request.target, request.current] : [request.current, request.target];
    const pages = order.flatMap(spread => Array.from({length: request.columns}, (_, half) =>
      createEpubBookPage(request.source, spread * request.columns + half, geometry)));
    const padding = this.pad(pages, request.source, geometry, request.columns);
    const root = this.stage(rect, content, false);
    try {
      const book = this.factory(root, this.settings(geometry, request.columns, padding + (reverse ? request.columns : 0), false));
      const session: TurnSession = {book, root, frame: null, timeout: null, started: false, done: false, commit,
        source: request.source, visibility: request.source.style.getPropertyValue('visibility'),
        visibilityPriority: request.source.style.getPropertyPriority('visibility')};
      this.session = session;
      book.on('changeState', event => { if (event.data === 'read' && session.started) this.finish(session); });
      book.loadFromHTML(pages);
      request.source.style.setProperty('visibility', 'hidden', 'important');
      session.frame = requestAnimationFrame(() => {
        session.frame = null;
        if (this.session !== session) return;
        session.started = true;
        book.flip(padding + (reverse ? 0 : request.columns));
      });
      // A failed or interrupted engine must never trap the reader under a stale overlay.
      session.timeout = window.setTimeout(() => this.finish(session), 850);
      return true;
    } catch {
      this.cancel(); root.remove(); commit();
      return true;
    }
  }

  private measure(source: HTMLElement, area: HTMLElement, stride: number, columns: number) {
    const rect = area.getBoundingClientRect(), content = source.getBoundingClientRect();
    if (rect.width <= 0 || content.height <= 0) return null;
    const geometry: EpubPageGeometry = {width: rect.width / columns, height: content.height,
      columns, stride: stride / columns,
      contentLeft: content.left - rect.left, contentTop: 0, contentWidth: content.width, contentHeight: content.height,
      totalColumns: Math.ceil(source.scrollWidth / (stride / columns)),
      viewportLeft: rect.left, viewportTop: content.top, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight};
    return {rect, content, geometry};
  }

  /** Interior portrait slots stay soft; PageFlip treats its final unpaired slot as a hard cover. */
  private pad(pages: HTMLElement[], source: HTMLElement, geometry: EpubPageGeometry, columns: number) {
    if (columns !== 1) return 0;
    pages.unshift(createEpubBookPage(source, -1, geometry));
    pages.push(createEpubBookPage(source, -1, geometry));
    return 1;
  }

  /** A turn is out of reach of the mouse; a corner receives it, while the pages inside stay inert */
  private stage(rect: DOMRect, content: DOMRect, interactive: boolean) {
    const root = document.createElement('div');
    root.className = 'epub-book-animation-stage';
    root.setAttribute('aria-hidden', 'true');
    if (!interactive) root.setAttribute('inert', '');
    Object.assign(root.style, {position: 'absolute', left: '0', top: `${content.top - rect.top}px`,
      width: `${rect.width}px`, height: `${content.height}px`, ...(interactive ? {pointerEvents: 'auto'} : {})});
    this.host.append(root);
    return root;
  }

  private settings(geometry: EpubPageGeometry, columns: number, startPage: number, mouse: boolean) {
    return {size: SizeType.FIXED, width: geometry.width, height: geometry.height,
      startPage, autoSize: false, usePortrait: false,
      forcePortrait: columns === 1, showCover: false, useMouseEvents: mouse,
      showPageCorners: mouse, clickEventForward: mouse, mobileScrollSupport: false,
      drawShadow: true, maxShadowOpacity: 0.5, flippingTime: 600};
  }

  private finish(session: TurnSession) {
    if (this.session !== session || session.done) return;
    session.done = true;
    // PageFlip still resets its internal flip after changeState; destroy it outside that callback.
    queueMicrotask(() => {
      if (this.session !== session) return;
      this.cancel();
      session.commit();
    });
  }

  cancel(): void {
    const session = this.session;
    this.session = null;
    this.cornerOpen.set(false);
    if (!session) return;
    if (session.frame !== null) cancelAnimationFrame(session.frame);
    if (session.timeout !== null) clearTimeout(session.timeout);
    if (session.visibility) session.source.style.setProperty('visibility', session.visibility, session.visibilityPriority);
    else session.source.style.removeProperty('visibility');
    try { session.book.destroy(); } finally { session.root.remove(); }
  }
}
