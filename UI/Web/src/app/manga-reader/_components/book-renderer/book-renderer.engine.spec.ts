import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PageFlip} from '../../../_vendor/page-flip/PageFlip';
import {BookRendererComponent} from './book-renderer.component';

// The renderer with the real PageFlip engine, for what the fake book cannot show
describe('Book renderer with the real engine', () => {
  let frames: FrameRequestCallback[];
  // One clock for the whole test: PageFlip animations count frames from when they started
  let clock: number;

  beforeEach(() => {
    frames = [];
    clock = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => frames.push(cb));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, get: () => 1600});
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {configurable: true, get: () => 900});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as {offsetWidth?: number}).offsetWidth;
    delete (HTMLElement.prototype as {offsetHeight?: number}).offsetHeight;
  });

  async function run(ms: number) {
    const end = clock + ms;
    while (clock < end) {
      clock += 16;
      const pending = frames.splice(0);
      pending.forEach(cb => cb(clock));
      await Promise.resolve();
    }
  }

  for (const scenario of [
    {name: 'single, no wide', twoPages: false, wide: [] as number[]},
    {name: 'double, no wide', twoPages: true, wide: [] as number[]},
    {name: 'single, wide 6', twoPages: false, wide: [6]},
    {name: 'double, wide 6', twoPages: true, wide: [6]},
  ]) {
    it(`does not report pages of its own while opening on the saved page (${scenario.name})`, async () => {
      const fixture = TestBed.createComponent(BookRendererComponent);
      const emitted: number[] = [];
      fixture.componentInstance.pageChange.subscribe(page => {
        emitted.push(page);
        fixture.componentRef.setInput('pageNum', page);
      });
      fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
      fixture.componentRef.setInput('totalPages', 1);
      fixture.componentRef.setInput('pageNum', 0);
      fixture.componentRef.setInput('twoPages', scenario.twoPages);
      fixture.detectChanges();
      TestBed.tick();

      // The chapter arrives together with the saved progress, as the reader sets both in one callback
      fixture.componentRef.setInput('chapter', {id: 1});
      fixture.componentRef.setInput('isWide', (page: number) => scenario.wide.includes(page));
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('pageNum', 5);
      fixture.detectChanges();
      TestBed.tick();
      await run(2000);
      // PageFlip finishes loading in a timeout
      await new Promise(resolve => setTimeout(resolve, 20));
      await run(2000);
      fixture.detectChanges();
      TestBed.tick();
      await run(2000);

      // Nothing was turned by hand: the book must not report pages of its own
      expect(emitted).toEqual([]);
    });
  }

  it('turns back a page in a one-page book', async () => {
    const fixture = TestBed.createComponent(BookRendererComponent);
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe(page => {
      emitted.push(page);
      fixture.componentRef.setInput('pageNum', page);
    });
    fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
    fixture.componentRef.setInput('chapter', {id: 1});
    fixture.componentRef.setInput('totalPages', 10);
    fixture.componentRef.setInput('pageNum', 3);
    fixture.detectChanges();
    TestBed.tick();
    await new Promise(resolve => setTimeout(resolve, 20));
    await run(500);

    fixture.componentRef.setInput('pageNum', 2);
    fixture.detectChanges();
    TestBed.tick();
    for (let i = 0; i < 5; i++) {
      await run(1000);
      fixture.detectChanges();
      TestBed.tick();
    }

    const book = (fixture.componentInstance as unknown as {book: PageFlip}).book;
    expect(book.getCurrentPageIndex()).toBe(2);
    expect(emitted).toEqual([]);
  });

  // A one-page book opens as two on the wide page 2 and closes again around it (seen in Chrome with a real chapter)
  for (const move of [{from: 2, to: 1}, {from: 3, to: 2}, {from: 1, to: 2}, {from: 2, to: 3}]) {
    it(`reports nothing of its own while opening or closing around a wide page (${move.from} to ${move.to})`, async () => {
      const fixture = TestBed.createComponent(BookRendererComponent);
      const emitted: number[] = [];
      fixture.componentInstance.pageChange.subscribe(page => {
        emitted.push(page);
        // A loop would never give control back; stop it so the test can fail instead of hanging
        if (emitted.length > 20) throw new Error('loop');
        fixture.componentRef.setInput('pageNum', page);
      });
      fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
      fixture.componentRef.setInput('chapter', {id: 1});
      fixture.componentRef.setInput('isWide', (page: number) => page === 2);
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('pageNum', move.from);
      fixture.detectChanges();
      TestBed.tick();
      await new Promise(resolve => setTimeout(resolve, 20));
      await run(500);

      fixture.componentRef.setInput('pageNum', move.to);
      fixture.detectChanges();
      TestBed.tick();
      for (let i = 0; i < 5; i++) {
        await run(1000);
        fixture.detectChanges();
        TestBed.tick();
      }

      expect(emitted).toEqual([]);
    });
  }

  for (const rightToLeft of [false, true]) {
    it(`settles after a turn even when the reader numbers pairs by its own rule (${rightToLeft ? 'rtl' : 'ltr'})`, async () => {
      const fixture = TestBed.createComponent(BookRendererComponent);
      const emitted: number[] = [];
      // Like the reader's double layout: a pair is known by a page of its own choosing
      const readerRule = (page: number) => page % 2 === 1 ? page + 1 : page;
      fixture.componentInstance.pageChange.subscribe(page => {
        emitted.push(page);
        fixture.componentRef.setInput('pageNum', readerRule(page));
      });
      fixture.componentRef.setInput('pageUrl', (page: number) => `page-${page}`);
      fixture.componentRef.setInput('chapter', {id: 1});
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('pageNum', 0);
      fixture.componentRef.setInput('twoPages', true);
      fixture.componentRef.setInput('rightToLeft', rightToLeft);
      fixture.detectChanges();
      TestBed.tick();
      await new Promise(resolve => setTimeout(resolve, 20));
      await run(500);

      const book = (fixture.componentInstance as unknown as {book: PageFlip}).book;
      if (rightToLeft) book.flipPrev(); else book.flipNext();
      for (let i = 0; i < 20; i++) {
        await run(1000);
        fixture.detectChanges();
        TestBed.tick();
      }

      // The turn happened, and was reported once
      expect(emitted).toEqual([1]);
    });
  }
});
