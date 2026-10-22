/** Fork (L6): text options of the reading profile; spacing and indent in tenths of an em, null keeps the book's own */
export interface EpubTextOptions {
  justify: boolean;
  hyphenate: boolean;
  paragraphSpacing: number | null;
  textIndent: number | null;
  ignorePublisherStyles: boolean;
}

export const EPUB_TEXT_OPTIONS_ID = 'epub-text-options';
/** Original media of a publisher stylesheet switched off; an attribute, so the page clones of a turn keep it too */
const ORIGINAL_MEDIA = 'data-epub-media';
const TEXT_BLOCKS = ['p', 'li', 'blockquote', 'dd'].map(tag => `.book-content ${tag}`).join(', ');

/** Rules over the publisher's own, scoped to the reader's text box (and so to the clones of a turn) */
export function epubTextOptionsCss(options: EpubTextOptions): string {
  const rules: string[] = [];
  if (options.justify) rules.push(`${TEXT_BLOCKS} { text-align: justify !important; }`);
  if (options.hyphenate) rules.push(`${TEXT_BLOCKS} { hyphens: auto !important; -webkit-hyphens: auto !important; }`);
  if (options.paragraphSpacing !== null) {
    rules.push(`.book-content p { margin-top: 0 !important; margin-bottom: ${options.paragraphSpacing / 10}em !important; }`);
  }
  if (options.textIndent !== null) rules.push(`.book-content p { text-indent: ${options.textIndent / 10}em !important; }`);
  return rules.join('\n');
}

export function applyEpubTextOptions(document: Document, content: HTMLElement, options: EpubTextOptions) {
  let style = document.getElementById(EPUB_TEXT_OPTIONS_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = EPUB_TEXT_OPTIONS_ID;
    document.head.append(style);
  }
  style.textContent = epubTextOptionsCss(options);

  for (const sheet of Array.from(content.querySelectorAll<HTMLElement>('style, link[rel~="stylesheet"]'))) {
    if (options.ignorePublisherStyles) {
      if (!sheet.hasAttribute(ORIGINAL_MEDIA)) sheet.setAttribute(ORIGINAL_MEDIA, sheet.getAttribute('media') ?? '');
      sheet.setAttribute('media', 'not all');
    } else if (sheet.hasAttribute(ORIGINAL_MEDIA)) {
      const media = sheet.getAttribute(ORIGINAL_MEDIA);
      if (media) sheet.setAttribute('media', media);
      else sheet.removeAttribute('media');
      sheet.removeAttribute(ORIGINAL_MEDIA);
    }
  }
}
