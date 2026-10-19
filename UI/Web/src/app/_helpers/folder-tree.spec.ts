import {describe, expect, it} from 'vitest';
import {folderView} from './folder-tree';

const library = [
  {seriesId: 1, path: ''},
  {seriesId: 2, path: 'Elric/EN'},
  {seriesId: 3, path: 'Elric/PT-BR'},
  {seriesId: 4, path: 'Elric/PT-BR/elric glenat'},
  {seriesId: 5, path: 'Volume 10'},
  {seriesId: 6, path: 'Volume 2'},
  {seriesId: 7, path: 'Blueberry/Mister Blueberry'},
  {seriesId: 8, path: 'blueberry/Outra'},
];

describe('Folder view of a library', () => {
  it('lists the root subfolders in natural order and the root series', () => {
    const view = folderView(library, '');

    expect(view.exists).toBe(true);
    expect(view.seriesId).toBe(1);
    expect(view.crumbs).toEqual([]);
    expect(view.folders.map(f => f.name)).toEqual(['Blueberry', 'blueberry', 'Elric', 'Volume 2', 'Volume 10']);
  });

  it('counts the series below each folder and covers it with the first one in natural order', () => {
    const elric = folderView(library, '').folders.find(f => f.name === 'Elric')!;

    expect(elric).toEqual({name: 'Elric', path: 'Elric', seriesCount: 3, coverSeriesId: 2, seriesId: null});
  });

  it('shows a folder holding both a series and subfolders', () => {
    const view = folderView(library, 'Elric/PT-BR');

    expect(view.seriesId).toBe(3);
    expect(view.folders).toEqual([{name: 'elric glenat', path: 'Elric/PT-BR/elric glenat', seriesCount: 1, coverSeriesId: 4, seriesId: 4}]);
    expect(view.crumbs).toEqual([{name: 'Elric', path: 'Elric'}, {name: 'PT-BR', path: 'Elric/PT-BR'}]);
  });

  it('treats a folder with only subfolders as navigation, not a series', () => {
    const view = folderView(library, 'Elric');

    expect(view.exists).toBe(true);
    expect(view.seriesId).toBeNull();
    expect(view.folders.map(f => f.path)).toEqual(['Elric/EN', 'Elric/PT-BR']);
  });

  it('points a folder holding only files straight at its series', () => {
    const folders = folderView(library, 'Elric').folders;

    expect(folders.map(f => [f.name, f.seriesId])).toEqual([['EN', 2], ['PT-BR', null]]);
  });

  it('does not match a folder by a prefix of its name', () => {
    expect(folderView(library, 'Elr').exists).toBe(false);
    expect(folderView(library, 'Elric/PT').folders).toEqual([]);
  });

  it('ignores slashes around the requested path', () => {
    expect(folderView(library, '/Elric/').folders.map(f => f.name)).toEqual(['EN', 'PT-BR']);
  });
});
