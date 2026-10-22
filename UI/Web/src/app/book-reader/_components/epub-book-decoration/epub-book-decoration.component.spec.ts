import {TestBed} from '@angular/core/testing';
import {describe, expect, it} from 'vitest';
import {EpubBookDecorationComponent} from './epub-book-decoration.component';

describe('EPUB open book decoration', () => {
  function create() {
    const fixture = TestBed.createComponent(EpubBookDecorationComponent);
    fixture.componentRef.setInput('pages', 9);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a spine only with two visible pages and stays outside the accessibility tree', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.epub-book-spine')).toBeNull();
    fixture.componentRef.setInput('twoPages', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.epub-book-spine')).not.toBeNull();
    expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
  });

  it('moves the paper stack from the unread edge to the read edge as the reader advances', () => {
    const fixture = create();
    const edge = (side: string) => fixture.nativeElement.querySelector(`.epub-book-edge-${side}`).style.width;
    expect(edge('left')).toBe('1px');
    expect(edge('right')).toBe('9px');
    fixture.componentRef.setInput('page', 5);
    fixture.detectChanges();
    expect(edge('left')).toBe('5px');
    expect(edge('right')).toBe('5px');
    fixture.componentRef.setInput('page', 9);
    fixture.detectChanges();
    expect(edge('left')).toBe('9px');
    expect(edge('right')).toBe('1px');
    fixture.componentRef.setInput('rightToLeft', true);
    fixture.detectChanges();
    expect(edge('left')).toBe('1px');
    expect(edge('right')).toBe('9px');
  });

  it('uses the dark palette for dark and black themes', () => {
    const fixture = create();
    expect(fixture.nativeElement.classList.contains('epub-book-dark')).toBe(false);
    fixture.componentRef.setInput('dark', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('epub-book-dark')).toBe(true);
  });

  it('keeps finite, bounded edges when the HTML has just one spread', () => {
    const fixture = create();
    fixture.componentRef.setInput('pages', 1);
    fixture.componentRef.setInput('page', 100);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.epub-book-edge-left').style.width).toBe('1px');
  });
});
