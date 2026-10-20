export interface ProgressDebouncer {
  /** Saves after the reader stays on the page for a moment; a newer page replaces what is pending */
  schedule(save: () => void): void;
  /** Saves what is pending now, as when leaving the reader or the chapter */
  flush(): void;
  /** Drops what is pending, when a newer save is sent straight away */
  cancel(): void;
}

/**
 * Progress is saved once the reader stops on a page, not on every page turned: turning quickly through a chapter, or a
 * renderer that keeps changing pages by mistake, does not send a save per page to the server.
 */
export function createProgressDebouncer(delayMs: number): ProgressDebouncer {
  let pending: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const flush = () => {
    clear();
    const save = pending;
    pending = null;
    save?.();
  };

  return {
    schedule: save => {
      clear();
      pending = save;
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel: () => {
      clear();
      pending = null;
    },
  };
}
