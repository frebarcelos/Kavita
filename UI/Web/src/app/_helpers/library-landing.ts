/** Query param that keeps the series grid open when folders are the default */
export const SERIES_VIEW_PARAM = 'view';
export const SERIES_VIEW = 'series';

/**
 * Whether opening a library should land on its folder tree: the user's preference (on by default), unless the
 * series grid was asked for explicitly
 */
export function opensLibraryByFolder(browseByFolder: boolean | undefined, view: string | null): boolean {
  return browseByFolder !== false && view !== SERIES_VIEW;
}
