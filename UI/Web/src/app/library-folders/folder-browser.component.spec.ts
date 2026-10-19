import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {beforeEach, describe, expect, it} from 'vitest';
import {folderView} from '../_helpers/folder-tree';
import {FolderBrowserComponent} from './folder-browser.component';

const library = [
  {seriesId: 3, path: 'Elric/PT-BR'},
  {seriesId: 4, path: 'Elric/PT-BR/elric glenat'},
  {seriesId: 2, path: 'Elric/EN'},
];

describe('Folder browser', () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [provideRouter([])]}));

  function create(path: string, options: {canEdit?: boolean, customCovers?: Map<string, string>} = {}) {
    const fixture = TestBed.createComponent(FolderBrowserComponent);
    fixture.componentRef.setInput('canEdit', options.canEdit ?? false);
    fixture.componentRef.setInput('customCovers', options.customCovers ?? new Map());
    fixture.componentRef.setInput('editCoverLabel', 'Editar capa');
    fixture.componentRef.setInput('removeCoverLabel', 'Remover capa');
    fixture.componentRef.setInput('libraryId', 7);
    fixture.componentRef.setInput('view', folderView(library, path));
    fixture.componentRef.setInput('coverUrl', (id: number) => `cover-${id}`);
    fixture.componentRef.setInput('rootLabel', 'Quadrinhos');
    fixture.componentRef.setInput('folderItemsLabel', 'Itens desta pasta');
    fixture.componentRef.setInput('seriesLabel', 'séries');
    fixture.componentRef.setInput('emptyLabel', 'Pasta não encontrada');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function createFixture(path: string, options: {canEdit?: boolean, customCovers?: Map<string, string>}) {
    const fixture = TestBed.createComponent(FolderBrowserComponent);
    fixture.componentRef.setInput('canEdit', options.canEdit ?? false);
    fixture.componentRef.setInput('customCovers', options.customCovers ?? new Map());
    fixture.componentRef.setInput('editCoverLabel', 'Editar capa');
    fixture.componentRef.setInput('removeCoverLabel', 'Remover capa');
    fixture.componentRef.setInput('libraryId', 7);
    fixture.componentRef.setInput('view', folderView(library, path));
    fixture.componentRef.setInput('coverUrl', (id: number) => `cover-${id}`);
    fixture.componentRef.setInput('rootLabel', 'Quadrinhos');
    fixture.componentRef.setInput('folderItemsLabel', 'Itens desta pasta');
    fixture.componentRef.setInput('seriesLabel', 'séries');
    fixture.componentRef.setInput('emptyLabel', 'Pasta não encontrada');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the cover chosen for a folder instead of its first series cover', () => {
    const page = create('Elric', {customCovers: new Map([['Elric/PT-BR', 'custom-ptbr']])});
    const covers = [...page.querySelectorAll('.folders img')].map(i => i.getAttribute('src'));

    expect(covers).toEqual(['cover-2', 'custom-ptbr']);
  });

  it('offers no cover menu to users who cannot edit', () => {
    expect(create('Elric').querySelector('.cover-menu')).toBeNull();
  });

  it('lets an admin edit each folder cover and remove a chosen one from the ⋮ menu', () => {
    const fixture = createFixture('Elric', {canEdit: true, customCovers: new Map([['Elric/PT-BR', 'custom-ptbr']])});
    const edited: string[] = [];
    const removed: string[] = [];
    fixture.componentInstance.editCover.subscribe(p => edited.push(p));
    fixture.componentInstance.removeCover.subscribe(p => removed.push(p));
    const page = fixture.nativeElement as HTMLElement;
    const menus = [...page.querySelectorAll<HTMLButtonElement>('.cover-menu')];
    expect(menus.length).toBe(2);

    menus[0].click();
    fixture.detectChanges();
    expect(page.textContent).not.toContain('Remover capa');
    [...page.querySelectorAll<HTMLButtonElement>('.cover-menu-item')].find(b => b.textContent?.includes('Editar capa'))!.click();

    menus[1].click();
    fixture.detectChanges();
    [...page.querySelectorAll<HTMLButtonElement>('.cover-menu-item')].find(b => b.textContent?.includes('Remover capa'))!.click();

    expect(edited).toEqual(['Elric/EN']);
    expect(removed).toEqual(['Elric/PT-BR']);
  });

  it('opens a folder of files straight at its series, and a folder of folders as a folder', () => {
    const page = create('Elric');
    const cards = [...page.querySelectorAll<HTMLAnchorElement>('.folders a')];

    expect(cards.map(a => a.querySelector('.name')!.textContent?.trim())).toEqual(['EN', 'PT-BR']);
    expect(cards[0].getAttribute('href')).toBe('/library/7/series/2');
    expect(decodeURIComponent(cards[1].getAttribute('href')!)).toBe('/library/7/folders?path=Elric/PT-BR');
    expect(cards[1].textContent).toContain('2 séries');
    expect(cards[1].querySelector('img')!.getAttribute('src')).toBe('cover-3');
  });

  it('shows the files of a folder that also has subfolders as one more card, without a button', () => {
    const page = create('Elric/PT-BR');
    const cards = [...page.querySelectorAll<HTMLAnchorElement>('.folders a')];

    expect(page.querySelector('.btn')).toBeNull();
    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute('href')).toBe('/library/7/series/3');
    expect(cards[0].textContent).toContain('Itens desta pasta');
    expect(cards[0].querySelector('img')!.getAttribute('src')).toBe('cover-3');
    expect(cards[1].getAttribute('href')).toBe('/library/7/series/4');
  });

  it('shows the way back to the library root', () => {
    const page = create('Elric/PT-BR');
    const crumbs = [...page.querySelectorAll<HTMLAnchorElement>('nav a')];

    expect(crumbs.map(a => a.textContent?.trim())).toEqual(['Quadrinhos', 'Elric']);
    expect(decodeURIComponent(crumbs[0].getAttribute('href')!)).toBe('/library/7/folders?path=');
    expect(page.querySelector('nav [aria-current=page]')!.textContent?.trim()).toBe('PT-BR');
  });

  it('says when a folder does not exist', () => {
    expect(create('Nada').textContent).toContain('Pasta não encontrada');
  });
});
