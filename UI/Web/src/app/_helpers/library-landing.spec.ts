import {describe, expect, it} from 'vitest';
import {opensLibraryByFolder, SERIES_VIEW} from './library-landing';

describe('Library landing', () => {
  it('opens libraries by folder by default', () => {
    expect(opensLibraryByFolder(true, null)).toBe(true);
    expect(opensLibraryByFolder(undefined, null)).toBe(true);
  });

  it('keeps the series grid when the user turned folders off', () => {
    expect(opensLibraryByFolder(false, null)).toBe(false);
  });

  it('keeps the series grid when it was asked for explicitly', () => {
    expect(opensLibraryByFolder(true, SERIES_VIEW)).toBe(false);
  });
});
