import {FolderSeries} from '../_models/library/folder-series';

export interface FolderCrumb {
  name: string;
  path: string;
}

export interface FolderNode {
  name: string;
  path: string;
  /** Series in this folder and below it */
  seriesCount: number;
  /** The first series in natural order in or below this folder, for the cover */
  coverSeriesId: number;
  /** The folder's own series when it holds only files (no subfolders): opening the folder opens it */
  seriesId: number | null;
}

export interface FolderView {
  path: string;
  exists: boolean;
  crumbs: FolderCrumb[];
  /** The series made of the files in this folder, if any */
  seriesId: number | null;
  folders: FolderNode[];
}

/**
 * The content of one folder of a library, as a file explorer shows it: its subfolders and its own series
 */
export function folderView(entries: FolderSeries[], path: string): FolderView {
  const parts = splitPath(path);
  const current = parts.join('/');
  const below = entries
    .map(e => ({seriesId: e.seriesId, parts: splitPath(e.path)}))
    .filter(e => startsWith(e.parts, parts))
    .sort((a, b) => compareNames(a.parts.join('/'), b.parts.join('/')));

  const children = new Map<string, FolderNode>();
  const withSubfolders = new Set<string>();
  const ownSeries = new Map<string, number>();
  for (const entry of below) {
    if (entry.parts.length === parts.length) continue;
    const name = entry.parts[parts.length];
    if (entry.parts.length === parts.length + 1) ownSeries.set(name, entry.seriesId);
    else withSubfolders.add(name);
    const node = children.get(name);
    if (node) {
      node.seriesCount++;
    } else {
      children.set(name, {name, path: [...parts, name].join('/'), seriesCount: 1, coverSeriesId: entry.seriesId, seriesId: null});
    }
  }
  for (const [name, node] of children) {
    if (!withSubfolders.has(name)) node.seriesId = ownSeries.get(name) ?? null;
  }

  return {
    path: current,
    exists: below.length > 0,
    crumbs: parts.map((name, i) => ({name, path: parts.slice(0, i + 1).join('/')})),
    seriesId: below.find(e => e.parts.length === parts.length)?.seriesId ?? null,
    folders: [...children.values()].sort((a, b) => compareNames(a.name, b.name)),
  };
}

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

/** Natural order ("Volume 2" before "Volume 10"), then exact order so the result never depends on the input */
function compareNames(a: string, b: string) {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

function splitPath(path: string) {
  return path.split('/').filter(p => p.length > 0);
}

function startsWith(parts: string[], prefix: string[]) {
  return prefix.length <= parts.length && prefix.every((p, i) => parts[i] === p);
}
