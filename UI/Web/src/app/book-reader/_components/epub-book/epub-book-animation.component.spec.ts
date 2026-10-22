import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BOOK_FACTORY} from '../../../manga-reader/_components/book-renderer/book-renderer.component';
import {FlipSetting} from '../../../_vendor/page-flip/Settings';
import {EpubBookAnimationComponent, EpubBookCorner, EpubBookTurn} from './epub-book-animation.component';

let liftsCorner = true;

class FakeBook {
  handlers = new Map<string, (e: {data: unknown}) => void>();
  pages: HTMLElement[] = [];
  flip = vi.fn();
  turnToPage = vi.fn();
  setForcePortrait = vi.fn();
  destroy = vi.fn();
  state = 'read';
  // The engine lifts the corner when the pointer is in its corner box, as PageFlip.userMove does
  userMove = vi.fn(() => { if (this.lifts) this.emit('changeState', this.state = 'fold_corner'); });
  getState = vi.fn(() => this.state);
  lifts = liftsCorner;
  constructor(readonly root: HTMLElement, readonly settings: Partial<FlipSetting>) {}
  on(event: string, callback: (e: {data: unknown}) => void) { this.handlers.set(event, callback); return this; }
  loadFromHTML(pages: HTMLElement[]) { this.pages = pages; this.emit('flip', 0); this.emit('changeState', 'read'); }
  emit(event: string, data: unknown) { if (event === 'changeState') this.state = data as string; this.handlers.get(event)?.({data}); }
}

describe('EPUB transient page turn', () => {
  let books: FakeBook[], frame: FrameRequestCallback, reduced: boolean;
  beforeEach(() => {
    books = []; reduced = false; liftsCorner = true;
    vi.stubGlobal('matchMedia', () => ({get matches() { return reduced; }, addEventListener: vi.fn(), removeEventListener: vi.fn()}));
    TestBed.configureTestingModule({providers: [{provide: BOOK_FACTORY, useValue: (root: HTMLElement, settings: Partial<FlipSetting>) => {
      const book = new FakeBook(root, settings); books.push(book); return book;
    }}]});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function create() {
    const fixture = TestBed.createComponent(EpubBookAnimationComponent);
    fixture.detectChanges();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 12; });
    vi.spyOn(window, 'cancelAnimationFrame');
    const area = document.createElement('div'), source = document.createElement('div');
    area.append(source); fixture.nativeElement.append(area);
    source.className = 'book-content'; source.style.cssText = 'column-count:2; column-gap:64px';
    source.innerHTML = '<p>Texto vivo do capítulo</p>';
    Object.defineProperties(source, {scrollWidth: {value: 6080}, clientWidth: {value: 1472}});
    source.getBoundingClientRect = () => ({left:64, top:38, width:1472, height:874}) as DOMRect;
    area.getBoundingClientRect = () => ({left:0, top:38, width:1600, height:874}) as DOMRect;
    const request: EpubBookTurn = {source, area, current:0, target:1, stride:1536, columns:2, rightToLeft:false};
    return {fixture, component: fixture.componentInstance, request, commit:vi.fn()};
  }

  it('builds no book at rest; a turn clones just the current and destination spreads', () => {
    const {component, request, commit} = create();
    expect(books).toHaveLength(0);
    expect(component.turn(request, commit)).toBe(true);
    expect(books).toHaveLength(1);
    expect(books[0].pages).toHaveLength(4);
    expect(commit).not.toHaveBeenCalled();
    frame(0);
    expect(books[0].flip).toHaveBeenCalledWith(2);
  });

  it('turns straight to a distant spread of the same HTML, as when following a link', () => {
    const {component, request, commit} = create();
    expect(component.turn({...request, current:0, target:3}, commit)).toBe(true);
    const lefts = books[0].pages.map(page => page.querySelector<HTMLElement>('.book-content')?.style.left);
    // Spreads 0 and 3 only, each as its two half pages
    expect(lefts).toEqual(['0px', '0px', '-4608px', '-4608px']);
    frame(0);
    expect(books[0].flip).toHaveBeenCalledWith(2);
  });

  it('refuses a turn to the spread already on screen', () => {
    const {component, request, commit} = create();
    expect(component.turn({...request, target:0}, commit)).toBe(false);
    expect(books).toHaveLength(0);
  });

  it('ignores initial/flip events and commits once only when the animation settles', async () => {
    const {component, request, commit} = create();
    component.turn(request, commit);
    expect(commit).not.toHaveBeenCalled();
    frame(0);
    books[0].emit('flip', 2);
    expect(commit).not.toHaveBeenCalled();
    books[0].emit('changeState', 'read'); books[0].emit('changeState', 'read');
    await Promise.resolve();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(books[0].destroy).toHaveBeenCalledTimes(1);
    expect(books[0].root.isConnected).toBe(false);
  });

  it('absorbs rapid commands while turning instead of creating a progress or animation loop', async () => {
    const {component, request, commit} = create();
    for (let i = 0; i < 20; i++) expect(component.turn(request, commit)).toBe(true);
    expect(books).toHaveLength(1);
    frame(0); books[0].emit('changeState', 'read'); await Promise.resolve();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('reverses the visual turn in RTL without swapping the live spread halves', () => {
    const {component, request, commit} = create();
    component.turn({...request, rightToLeft:true}, commit); frame(0);
    expect(books[0].settings.startPage).toBe(2);
    expect(books[0].flip).toHaveBeenCalledWith(0);
  });

  it('uses one page with soft interior slots and a stronger flip shadow', () => {
    const {component, request, commit} = create();
    component.turn({...request, columns:1}, commit); frame(0);
    expect(books[0].settings.forcePortrait).toBe(true);
    expect(books[0].settings.startPage).toBe(1);
    expect(books[0].flip).toHaveBeenCalledWith(2);
    expect(books[0].settings.maxShadowOpacity).toBe(0.5);
    expect(books[0].settings.useMouseEvents).toBe(false);
  });

  it('leaves reduced motion and invalid geometry to the original instant reader', () => {
    const {component, request, commit} = create(); reduced = true;
    expect(component.turn(request, commit)).toBe(false);
    reduced = false;
    expect(component.turn({...request, stride:0}, commit)).toBe(false);
    expect(books).toHaveLength(0);
    expect(commit).not.toHaveBeenCalled();
  });

  it('cancels without committing a stale turn on appearance change or destruction', async () => {
    const {component, fixture, request, commit} = create();
    component.turn(request, commit); frame(0);
    component.cancel(); fixture.destroy();
    books[0].emit('changeState', 'read'); await Promise.resolve();
    expect(commit).not.toHaveBeenCalled();
    expect(books[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('falls back to one committed turn if the engine never reports completion', async () => {
    const {component, request, commit} = create();
    vi.useFakeTimers();
    try {
      component.turn(request, commit); frame(0);
      vi.advanceTimersByTime(850); await Promise.resolve();
      books[0].emit('changeState','read'); await Promise.resolve();
      expect(commit).toHaveBeenCalledTimes(1);
      expect(books[0].destroy).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('removes a failed engine and falls back to one original reader jump', () => {
    const {component, request, commit} = create();
    vi.spyOn(FakeBook.prototype,'loadFromHTML').mockImplementation(() => { throw new Error('Render failed'); });
    expect(component.turn(request,commit)).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(books[0].root.isConnected).toBe(false);
  });

  it('hides only the original text during the turn and restores its exact visibility on cancellation', () => {
    const {component,request,commit}=create();
    request.source.style.setProperty('visibility','visible','important');
    // jsdom's CSSStyleDeclaration drops !important for visibility; Chromium checks it in the e2e.
    const priority=request.source.style.getPropertyPriority('visibility');
    component.turn(request,commit);
    expect(request.source.style.visibility).toBe('hidden');
    expect(books[0].pages[0].querySelector<HTMLElement>('.book-content')!.style.visibility).toBe('visible');
    component.cancel();
    expect(request.source.style.visibility).toBe('visible');
    expect(request.source.style.getPropertyPriority('visibility')).toBe(priority);
    expect(commit).not.toHaveBeenCalled();
  });

  describe('corner under the mouse (L5)', () => {
    function corner(overrides: Partial<EpubBookCorner> = {}) {
      const {fixture, component, request} = create();
      const cornerRequest: EpubBookCorner = {source: request.source, area: request.area, current: 1, spreads: 4,
        stride: 1536, columns: 2, rightToLeft: false, x: 1590, y: 905, ...overrides};
      return {fixture, component, request, cornerRequest, onTurn: vi.fn()};
    }
    const lefts = (book: FakeBook) => book.pages.map(page => page.querySelector<HTMLElement>('.book-content')?.style.left ?? 'blank');

    it('lifts the corner with an interactive book of the neighbouring spreads over the hidden live text', () => {
      const {component, cornerRequest, onTurn} = corner();
      expect(component.openCorner(cornerRequest, onTurn)).toBe(true);
      const book = books[0];
      expect(book.settings.useMouseEvents).toBe(true);
      expect(book.settings.showPageCorners).toBe(true);
      expect(book.settings.startPage).toBe(2);
      expect(lefts(book)).toEqual(['0px', '0px', '-1536px', '-1536px', '-3072px', '-3072px']);
      expect(book.userMove).toHaveBeenCalledWith(expect.objectContaining({x: expect.any(Number), y: expect.any(Number)}), false);
      expect(cornerRequest.source.style.visibility).toBe('hidden');
      expect(book.root.hasAttribute('inert')).toBe(false);
      expect(book.root.style.pointerEvents).toBe('auto');
      expect(component.cornerOpen()).toBe(true);
      expect(onTurn).not.toHaveBeenCalled();
    });

    it('commits one turn in the reading direction when a drag crosses the spine', async () => {
      const {component, cornerRequest, onTurn} = corner();
      component.openCorner(cornerRequest, onTurn);
      books[0].emit('changeState', 'user_fold'); books[0].emit('flip', 4); books[0].emit('changeState', 'read');
      await Promise.resolve();
      expect(onTurn).toHaveBeenCalledExactlyOnceWith(true);
      expect(books[0].destroy).toHaveBeenCalledTimes(1);
      expect(component.cornerOpen()).toBe(false);
    });

    it('lays the page down without a turn when the drag is given up or the mouse leaves the corner', async () => {
      const {component, cornerRequest, onTurn} = corner();
      component.openCorner(cornerRequest, onTurn);
      books[0].emit('changeState', 'user_fold'); books[0].emit('changeState', 'read');
      await Promise.resolve();
      expect(onTurn).not.toHaveBeenCalled();
      expect(books[0].destroy).toHaveBeenCalledTimes(1);
      expect(cornerRequest.source.style.visibility).toBe('');
      expect(component.cornerOpen()).toBe(false);
    });

    it('offers blank sheets past the last spread, so the drag can open the next file', () => {
      const {component, cornerRequest, onTurn} = corner({current: 3});
      component.openCorner(cornerRequest, onTurn);
      expect(books[0].pages.slice(4).every(page => page.classList.contains('epub-book-blank'))).toBe(true);
      expect(lefts(books[0]).slice(0, 4)).toEqual(['-3072px', '-3072px', '-4608px', '-4608px']);
    });

    it('puts the next spread on the left in RTL and maps a left turn to forward', async () => {
      const {component, cornerRequest, onTurn} = corner({rightToLeft: true, x: 10});
      component.openCorner(cornerRequest, onTurn);
      expect(lefts(books[0])).toEqual(['-3072px', '-3072px', '-1536px', '-1536px', '0px', '0px']);
      books[0].emit('changeState', 'user_fold'); books[0].emit('flip', 0); books[0].emit('changeState', 'read');
      await Promise.resolve();
      expect(onTurn).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('gives way to the keyboard while only lifted, and absorbs it while dragging', () => {
      const {component, request, cornerRequest, onTurn} = corner();
      component.openCorner(cornerRequest, onTurn);
      expect(component.isTurning).toBe(false);
      expect(component.turn(request, vi.fn())).toBe(true);
      expect(books[0].destroy).toHaveBeenCalledTimes(1);
      expect(books).toHaveLength(2);
      component.cancel();
      component.openCorner(cornerRequest, onTurn);
      books[2].emit('changeState', 'user_fold');
      expect(component.isTurning).toBe(true);
    });

    it('does not mount when the engine leaves the point outside its corner, with reduced motion or during a turn', () => {
      const {component, request, cornerRequest, onTurn} = corner();
      liftsCorner = false;
      expect(component.openCorner(cornerRequest, onTurn)).toBe(false);
      expect(books[0].destroy).toHaveBeenCalledTimes(1);
      expect(cornerRequest.source.style.visibility).toBe('');
      liftsCorner = true;
      reduced = true;
      expect(component.openCorner(cornerRequest, onTurn)).toBe(false);
      reduced = false;
      component.turn(request, vi.fn());
      expect(component.openCorner(cornerRequest, onTurn)).toBe(false);
      expect(books).toHaveLength(2);
    });
  });
});
