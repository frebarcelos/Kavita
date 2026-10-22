import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {of} from 'rxjs';
import {TranslocoTestingModule} from '@jsverse/transloco';
import {ToastrService} from '@openng/ngx-toastr';
import {EpubReaderSettingsService} from './epub-reader-settings.service';
import {FontService} from './font.service';
import {ThemeService} from './theme.service';
import {ReadingProfileService} from './reading-profile.service';
import {BreakpointService} from './breakpoint.service';
import {BookPageLayoutMode} from '../_models/readers/book-page-layout-mode';
import {BOOK_MODE_KEY} from '../manga-reader/_components/book-renderer/book-mode';
import {WritingStyle} from '../_models/preferences/writing-style';
import {ReadingProfile, ReadingProfileKind} from '../_models/preferences/reading-profiles';

describe('EPUB browser book preference', () => {
  beforeEach(() => {
    localStorage.removeItem(BOOK_MODE_KEY);
    TestBed.configureTestingModule({imports: [TranslocoTestingModule.forRoot({langs: {en: {}},
      translocoConfig: {availableLangs: ['en'], defaultLang: 'en'},
    })], providers: [EpubReaderSettingsService,
      {provide: FontService, useValue: {getFonts: () => of([])}},
      {provide: ThemeService, useValue: {defaultBookTheme: 'Dark'}},
      {provide: ReadingProfileService, useValue: {}}, {provide: ToastrService, useValue: {success: vi.fn()}},
      {provide: BreakpointService, useValue: {isMobile: signal(false)}},
    ]});
  });
  afterEach(() => localStorage.removeItem(BOOK_MODE_KEY));

  it('keeps the original single-column layout with book mode off', () => {
    const settings = TestBed.inject(EpubReaderSettingsService);
    settings.formModel.update(value => ({...value, bookReaderLayoutMode: BookPageLayoutMode.Column1}));
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column1);
  });

  it('opens the remembered book in two columns without changing the profile form', () => {
    localStorage.setItem(BOOK_MODE_KEY, 'true');
    const settings = TestBed.inject(EpubReaderSettingsService);
    settings.formModel.update(value => ({...value, bookReaderLayoutMode: BookPageLayoutMode.Column1}));
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column2);
    expect(settings.formGroup.bookReaderLayoutMode().value()).toBe(BookPageLayoutMode.Column1);
  });

  it('toggles and persists locally, restores the profile layout, and never replaces scroll or vertical writing', () => {
    const settings = TestBed.inject(EpubReaderSettingsService);
    expect(settings.bookModeAvailable()).toBe(false);
    settings.formModel.update(value => ({...value, bookReaderLayoutMode: BookPageLayoutMode.Column1}));
    settings.toggleBookMode();
    expect(localStorage.getItem(BOOK_MODE_KEY)).toBe('true');
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column2);
    settings.updateWritingStyle(WritingStyle.Vertical);
    expect(settings.bookModeAvailable()).toBe(false);
    expect(settings.bookModeActive()).toBe(false);
    settings.updateWritingStyle(WritingStyle.Horizontal);
    settings.toggleBookMode();
    expect(localStorage.getItem(BOOK_MODE_KEY)).toBe('false');
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column1);
    settings.updateLayoutMode(BookPageLayoutMode.Default);
    settings.toggleBookMode();
    expect(settings.bookModeActive()).toBe(false);
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Default);
  });

  it('allows one visible page locally and falls back to one page on small screens', () => {
    const settings = TestBed.inject(EpubReaderSettingsService);
    settings.updateLayoutMode(BookPageLayoutMode.Column2);
    settings.toggleBookMode();
    settings.updateLayoutMode(BookPageLayoutMode.Column1);
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column1);
    expect(settings.formGroup.bookReaderLayoutMode().value()).toBe(BookPageLayoutMode.Column2);
    settings.updateLayoutMode(BookPageLayoutMode.Column2);
    (TestBed.inject(BreakpointService).isMobile as ReturnType<typeof signal<boolean>>).set(true);
    // The existing reader informs about the mobile fallback through Transloco.
    TestBed.inject(ToastrService).info = vi.fn();
    expect(settings.bookModeActive()).toBe(true);
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column1);
  });

  it('keeps the existing single-column fallback when switching a two-column book to vertical writing', () => {
    const settings = TestBed.inject(EpubReaderSettingsService);
    settings.updateLayoutMode(BookPageLayoutMode.Column2);
    settings.toggleBookMode();
    settings.toggleWritingStyle();
    expect(settings.bookModeActive()).toBe(false);
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column1);
  });

  it('saves changed typography while keeping the server layout free of the browser override', async () => {
    const profile = {id: 1, kind: ReadingProfileKind.Implicit,
      bookReaderLayoutMode: BookPageLayoutMode.Column1, bookReaderFontFamily: 'default',
      bookReaderFontSize: 100, bookReaderLineSpacing: 100, bookReaderMargin: 4,
      bookReaderTapToPaginate: false, bookReaderImmersiveMode: false, bookReaderDisableBookmarkIcon: false,
      bookReaderReadingDirection: 0, bookReaderWritingStyle: WritingStyle.Horizontal, bookReaderThemeName: 'Dark',
    } as ReadingProfile;
    const profiles = TestBed.inject(ReadingProfileService);
    profiles.getForSeries = vi.fn(() => of(profile));
    profiles.updateParentProfile = vi.fn(() => of(profile));
    const settings = TestBed.inject(EpubReaderSettingsService);
    await settings.initialize(1, 2, profile);
    settings.toggleBookMode();
    settings.formGroup.bookReaderFontSize().value.set(150);
    settings.updateParentProfile();
    expect(profiles.updateParentProfile).toHaveBeenCalledWith(1, 2, expect.objectContaining({
      bookReaderLayoutMode: BookPageLayoutMode.Column1, bookReaderFontSize: 150, bookReaderMargin: 4,
    }));
    expect(settings.layoutMode()).toBe(BookPageLayoutMode.Column2);
  });
});
