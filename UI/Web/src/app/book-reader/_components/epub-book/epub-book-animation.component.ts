import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, ViewEncapsulation} from '@angular/core';
import {Book, BOOK_FACTORY} from '../../../manga-reader/_components/book-renderer/book-renderer.component';
import {SizeType} from '../../../_vendor/page-flip/Settings';
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
}

@Component({selector: 'app-epub-book-animation', template: '',
  styleUrls: ['../../../_vendor/page-flip/Style/stPageFlip.css', './epub-book-animation.component.scss'],
  encapsulation: ViewEncapsulation.None, changeDetection: ChangeDetectionStrategy.OnPush})
export class EpubBookAnimationComponent {
  private readonly factory = inject(BOOK_FACTORY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private session: TurnSession | null = null;
  get isTurning(): boolean { return this.session !== null; }

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
    if (this.session) return true;
    // The destination may be any other spread of the HTML: a link or the contents turn straight to it
    if (this.motion?.matches || request.stride <= 0 || request.current === request.target) return false;
    const rect = request.area.getBoundingClientRect(), content = request.source.getBoundingClientRect();
    if (rect.width <= 0 || content.height <= 0) return false;
    const geometry: EpubPageGeometry = {width: rect.width / request.columns, height: content.height,
      columns: request.columns, stride: request.stride / request.columns,
      contentLeft: content.left - rect.left, contentTop: 0, contentWidth: content.width, contentHeight: content.height,
      totalColumns: Math.ceil(request.source.scrollWidth / (request.stride / request.columns)),
      viewportLeft: rect.left, viewportTop: content.top, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight};
    const reverse = (request.target < request.current) !== request.rightToLeft;
    const order = reverse ? [request.target, request.current] : [request.current, request.target];
    const pages = order.flatMap(spread => Array.from({length: request.columns}, (_, half) =>
      createEpubBookPage(request.source, spread * request.columns + half, geometry)));
    // Interior portrait slots stay soft; PageFlip treats its final unpaired slot as a hard cover.
    const padding = request.columns === 1 ? 1 : 0;
    if (padding) {
      pages.unshift(createEpubBookPage(request.source, -1, geometry));
      pages.push(createEpubBookPage(request.source, -1, geometry));
    }
    const root = document.createElement('div');
    root.className = 'epub-book-animation-stage';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
    Object.assign(root.style, {position: 'absolute', left: '0', top: `${content.top - rect.top}px`,
      width: `${rect.width}px`, height: `${content.height}px`});
    this.host.append(root);
    try {
      const book = this.factory(root, {size: SizeType.FIXED, width: geometry.width, height: geometry.height,
        startPage: padding + (reverse ? request.columns : 0), autoSize: false, usePortrait: false,
        forcePortrait: request.columns === 1, showCover: false, useMouseEvents: false,
        showPageCorners: false, clickEventForward: false, mobileScrollSupport: false,
        drawShadow: true, maxShadowOpacity: 0.5, flippingTime: 600});
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
    if (!session) return;
    if (session.frame !== null) cancelAnimationFrame(session.frame);
    if (session.timeout !== null) clearTimeout(session.timeout);
    if (session.visibility) session.source.style.setProperty('visibility', session.visibility, session.visibilityPriority);
    else session.source.style.removeProperty('visibility');
    try { session.book.destroy(); } finally { session.root.remove(); }
  }
}
