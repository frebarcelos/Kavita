/**
 * A folder with a cover chosen by the user
 */
export interface FolderCover {
  path: string;
  lastModifiedUtc: string;
}

/**
 * A series and its folder relative to the library root ('/' separated, empty at the root)
 */
export interface FolderSeries {
  seriesId: number;
  path: string;
}
