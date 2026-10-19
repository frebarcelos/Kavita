import {NO_ERRORS_SCHEMA, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {TranslocoTestingModule} from '@jsverse/transloco';
import {BehaviorSubject, of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AccountService} from '../_services/account.service';
import {ImageService} from '../_services/image.service';
import {LibraryService} from '../_services/library.service';
import {UploadService} from '../_services/upload.service';
import {LoadingComponent} from '../shared/loading/loading.component';
import {SideNavCompanionBarComponent} from '../sidenav/_components/side-nav-companion-bar/side-nav-companion-bar.component';
import {LibraryFoldersComponent} from './library-folders.component';

const folders: Record<number, {seriesId: number, path: string}[]> = {
  1: [{seriesId: 1, path: 'Berserk/EN'}, {seriesId: 2, path: 'Berserk/PT-BR'}],
  3: [{seriesId: 7, path: 'Tecnologia/Clean Code'}, {seriesId: 8, path: 'Tecnologia/Outro'}],
};

describe('Library folders page', () => {
  const params = new BehaviorSubject(convertToParamMap({libraryId: '1'}));
  const data = new BehaviorSubject<Record<string, unknown>>({library: {name: 'Mangas'}});
  const getFolderSeries = vi.fn((id: number) => of(folders[id]));
  const getFolderCovers = vi.fn((id: number) => of([]));

  beforeEach(() => {
    params.next(convertToParamMap({libraryId: '1'}));
    data.next({library: {name: 'Mangas'}});
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({langs: {en: {}}, translocoConfig: {availableLangs: ['en'], defaultLang: 'en'}})],
      providers: [
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {
          paramMap: params, queryParamMap: of(convertToParamMap({})), data,
          snapshot: {paramMap: convertToParamMap({libraryId: '1'})},
        }},
        {provide: LibraryService, useValue: {getFolderSeries, getFolderCovers}},
        {provide: ImageService, useValue: {getSeriesCoverImage: (id: number) => `cover-${id}`, getFolderCoverImage: () => 'folder'}},
        {provide: UploadService, useValue: {updateFolderCoverImage: vi.fn()}},
        {provide: AccountService, useValue: {hasAdminRole: signal(false)}},
      ],
    });
    TestBed.overrideComponent(LibraryFoldersComponent, {
      remove: {imports: [SideNavCompanionBarComponent, LoadingComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]},
    });
  });

  async function names(fixture: {detectChanges(): void, whenStable(): Promise<unknown>, nativeElement: HTMLElement}) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return [...fixture.nativeElement.querySelectorAll('.folders .name')].map(n => n.textContent?.trim());
  }

  it('shows the folders of the library it opens', async () => {
    const fixture = TestBed.createComponent(LibraryFoldersComponent);

    expect(await names(fixture)).toEqual(['Berserk']);
  });

  it('switches to the other library folders when moving between libraries', async () => {
    const fixture = TestBed.createComponent(LibraryFoldersComponent);
    await names(fixture);

    params.next(convertToParamMap({libraryId: '3'}));
    data.next({library: {name: 'Livros'}});

    expect(await names(fixture)).toEqual(['Tecnologia']);
    expect(getFolderSeries).toHaveBeenLastCalledWith(3);
    expect(getFolderCovers).toHaveBeenLastCalledWith(3);
  });
});
