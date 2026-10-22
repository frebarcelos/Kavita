import {afterEach, describe, expect, it} from 'vitest';
import {applyEpubTextOptions, EPUB_TEXT_OPTIONS_ID, EpubTextOptions, epubTextOptionsCss} from './epub-text-options';

const none: EpubTextOptions = {justify: false, hyphenate: false, paragraphSpacing: null, textIndent: null,
  ignorePublisherStyles: false};

describe('EPUB text options (L6)', () => {
  afterEach(() => document.getElementById(EPUB_TEXT_OPTIONS_ID)?.remove());

  it('leaves the book as it is when no option is chosen', () => {
    expect(epubTextOptionsCss(none)).toBe('');
  });

  it('justifies text blocks to both margins', () => {
    const css = epubTextOptionsCss({...none, justify: true});
    expect(css).toContain('.book-content p');
    expect(css).toContain('text-align: justify !important');
  });

  it('turns on hyphenation, also for WebKit', () => {
    const css = epubTextOptionsCss({...none, hyphenate: true});
    expect(css).toContain('hyphens: auto !important');
    expect(css).toContain('-webkit-hyphens: auto !important');
  });

  it('sets the space between paragraphs in em', () => {
    const css = epubTextOptionsCss({...none, paragraphSpacing: 5});
    expect(css).toContain('margin-top: 0 !important');
    expect(css).toContain('margin-bottom: 0.5em !important');
  });

  it('sets the first line indent, where zero removes the book indent and null keeps it', () => {
    expect(epubTextOptionsCss({...none, textIndent: 0})).toContain('text-indent: 0em !important');
    expect(epubTextOptionsCss({...none, textIndent: 15})).toContain('text-indent: 1.5em !important');
    expect(epubTextOptionsCss({...none, textIndent: null})).not.toContain('text-indent');
  });

  it('keeps one stylesheet in the page head for the options, outside the book HTML', () => {
    const content = document.createElement('div');
    applyEpubTextOptions(document, content, {...none, justify: true});
    applyEpubTextOptions(document, content, {...none, textIndent: 10});
    const styles = document.querySelectorAll(`#${EPUB_TEXT_OPTIONS_ID}`);
    expect(styles).toHaveLength(1);
    expect(styles[0].parentElement).toBe(document.head);
    expect(styles[0].textContent).toContain('text-indent: 1em');
    expect(styles[0].textContent).not.toContain('justify');
  });

  it('switches the publisher stylesheets off and back on, by an attribute that page clones keep', () => {
    const content = document.createElement('div');
    content.innerHTML = '<style>p { text-indent: 2em }</style><style media="print">p {}</style>' +
      '<link rel="stylesheet" href="book.css"><p>Texto</p>';
    const [own, print] = [...content.querySelectorAll('style')];
    const link = content.querySelector('link')!;
    applyEpubTextOptions(document, content, {...none, ignorePublisherStyles: true});
    expect([own, print, link].map(sheet => sheet.getAttribute('media'))).toEqual(['not all', 'not all', 'not all']);
    expect((content.cloneNode(true) as HTMLElement).querySelector('style')!.getAttribute('media')).toBe('not all');
    applyEpubTextOptions(document, content, {...none, ignorePublisherStyles: true});
    applyEpubTextOptions(document, content, none);
    expect(own.hasAttribute('media')).toBe(false);
    expect(print.getAttribute('media')).toBe('print');
    expect(link.hasAttribute('media')).toBe(false);
  });
});
