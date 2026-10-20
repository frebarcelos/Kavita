import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createProgressDebouncer} from './progress-debouncer';

describe('Progress debouncer', () => {
  let saved: number[];

  beforeEach(() => {
    vi.useFakeTimers();
    saved = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves only the last page of quick turns, once they stop', () => {
    const debouncer = createProgressDebouncer(500);
    for (let page = 1; page <= 20; page++) {
      debouncer.schedule(() => saved.push(page));
      vi.advanceTimersByTime(100);
    }
    expect(saved).toEqual([]);

    vi.advanceTimersByTime(500);
    expect(saved).toEqual([20]);
  });

  it('saves each page of slow reading', () => {
    const debouncer = createProgressDebouncer(500);
    debouncer.schedule(() => saved.push(1));
    vi.advanceTimersByTime(600);
    debouncer.schedule(() => saved.push(2));
    vi.advanceTimersByTime(600);

    expect(saved).toEqual([1, 2]);
  });

  it('saves what is pending right away when leaving', () => {
    const debouncer = createProgressDebouncer(500);
    debouncer.schedule(() => saved.push(7));
    debouncer.flush();
    expect(saved).toEqual([7]);

    vi.advanceTimersByTime(1000);
    debouncer.flush();
    expect(saved).toEqual([7]);
  });

  it('drops what is pending when a newer save goes straight away', () => {
    const debouncer = createProgressDebouncer(500);
    debouncer.schedule(() => saved.push(9));
    debouncer.cancel();
    vi.advanceTimersByTime(1000);

    expect(saved).toEqual([]);
  });
});
