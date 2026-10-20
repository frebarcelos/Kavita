import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PageFlip} from './PageFlip';
import {Orientation} from './Render/Render';
import {SizeType} from './Settings';

describe('PageFlip (incorporated for Kavita)', () => {
  let frames: FrameRequestCallback[];
  let cancelled: number[];

  beforeEach(() => {
    frames = [];
    cancelled = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => frames.push(cb));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { cancelled.push(id); });
    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, get: () => 1600});
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {configurable: true, get: () => 900});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as {offsetWidth?: number}).offsetWidth;
    delete (HTMLElement.prototype as {offsetHeight?: number}).offsetHeight;
    document.body.innerHTML = '';
  });

  function book(settings: Record<string, unknown> = {}) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const pages = [0, 1, 2, 3].map(() => {
      const page = document.createElement('div');
      root.appendChild(page);
      return page;
    });
    const flip = new PageFlip(root, {
      size: SizeType.STRETCH, width: 400, height: 600, minWidth: 100, maxWidth: 2000, minHeight: 100, maxHeight: 2000,
      ...settings,
    });
    flip.loadFromHTML(pages);
    return flip;
  }

  it('stops its animation loop when destroyed', () => {
    const flip = book();
    expect(frames.length).toBeGreaterThan(0);

    flip.destroy();
    const pending = frames.splice(0);
    pending.forEach(cb => cb(0));

    expect(frames).toEqual([]);
  });

  it('stops listening to window resizes when destroyed', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const flip = book();

    flip.destroy();

    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function), false);
  });

  it('shows two pages when they fit, unless one page is forced', () => {
    expect(book({usePortrait: false}).getOrientation()).toBe(Orientation.LANDSCAPE);
    expect(book({usePortrait: false, forcePortrait: true}).getOrientation()).toBe(Orientation.PORTRAIT);
  });

  it('opens a one-page book into two pages and back, staying on the same page', () => {
    const flip = book({usePortrait: false, forcePortrait: true});
    flip.turnToPage(2);

    flip.setForcePortrait(false);
    expect(flip.getOrientation()).toBe(Orientation.LANDSCAPE);
    expect(flip.getCurrentPageIndex()).toBe(2);

    flip.setForcePortrait(true);
    expect(flip.getOrientation()).toBe(Orientation.PORTRAIT);
    expect(flip.getCurrentPageIndex()).toBe(2);
  });
});
