import {ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed, toObservable, toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TranslocoDirective} from '@jsverse/transloco';
import {map, switchMap} from 'rxjs';
import {folderView} from '../_helpers/folder-tree';
import {SERIES_VIEW, SERIES_VIEW_PARAM} from '../_helpers/library-landing';
import {FolderCover, FolderSeries} from '../_models/library/folder-series';
import {AccountService} from '../_services/account.service';
import {UploadService} from '../_services/upload.service';
import {Library} from '../_models/library/library';
import {ImageService} from '../_services/image.service';
import {LibraryService} from '../_services/library.service';
import {LoadingComponent} from '../shared/loading/loading.component';
import {SideNavCompanionBarComponent} from '../sidenav/_components/side-nav-companion-bar/side-nav-companion-bar.component';
import {FolderBrowserComponent} from './folder-browser.component';

/**
 * Browses a library by its folders, as a file explorer does
 */
@Component({
  selector: 'app-library-folders',
  imports: [FolderBrowserComponent, LoadingComponent, RouterLink, SideNavCompanionBarComponent, TranslocoDirective],
  template: `
    <div class="main-container container-fluid">
      <ng-container *transloco="let t; prefix: 'library-folders'">
        <app-side-nav-companion-bar>
          <h4 title>
            {{ t('title', {name: libraryName()}) }}
            <a class="btn btn-sm btn-outline-secondary ms-2" [routerLink]="['/library', libraryId()]" [queryParams]="seriesView">
              <i class="fa-solid fa-table-cells me-1" aria-hidden="true"></i>{{ t('all-series') }}
            </a>
          </h4>
        </app-side-nav-companion-bar>
        <app-loading [loading]="loading()" />
        @if (!loading()) {
          <app-folder-browser
            [libraryId]="libraryId()"
            [view]="view()"
            [coverUrl]="coverUrl"
            [rootLabel]="libraryName()"
            [folderItemsLabel]="t('folder-items')"
            [seriesLabel]="t('series')"
            [emptyLabel]="t('empty')"
            [customCovers]="customCovers()"
            [canEdit]="canEdit()"
            [editCoverLabel]="t('edit-cover')"
            [removeCoverLabel]="t('remove-cover')"
            (editCover)="chooseCover($event)"
            (removeCover)="saveCover($event, null)" />
        }
        <input #coverFile type="file" class="d-none" accept=".png,.jpg,.jpeg,.gif,.webp,.avif"
               (change)="coverChosen(coverFile)">
      </ng-container>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LibraryFoldersComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly libraryService = inject(LibraryService);
  private readonly imageService = inject(ImageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly uploadService = inject(UploadService);
  private readonly accountService = inject(AccountService);

  protected readonly libraryId = toSignal(
    this.route.paramMap.pipe(map(p => parseInt(p.get('libraryId') ?? '0', 10))),
    {initialValue: parseInt(this.route.snapshot.paramMap.get('libraryId') ?? '0', 10)});
  private readonly path = toSignal(this.route.queryParamMap.pipe(map(q => q.get('path') ?? '')), {initialValue: ''});
  private readonly library = toSignal(this.route.data.pipe(map(d => d['library'] as Library | undefined)));
  private readonly coversRefresh = signal(0);
  // The route reuses this page between libraries: everything follows the current library id, and answers carry
  // the library they belong to so a slow answer never shows another library's folders.
  private readonly loaded = toSignal(toObservable(this.libraryId).pipe(
    switchMap(libraryId => this.libraryService.getFolderSeries(libraryId).pipe(map(entries => ({libraryId, entries}))))));
  private readonly loadedCovers = toSignal(toObservable(computed(() => ({libraryId: this.libraryId(), refresh: this.coversRefresh()}))).pipe(
    switchMap(({libraryId}) => this.libraryService.getFolderCovers(libraryId).pipe(map(covers => ({libraryId, covers}))))));
  private readonly entries = computed<FolderSeries[]>(() => this.loading() ? [] : this.loaded()!.entries);
  private readonly covers = computed<FolderCover[]>(() =>
    this.loadedCovers()?.libraryId === this.libraryId() ? this.loadedCovers()!.covers : []);
  /** Folder waiting for the file picker */
  private coverPath: string | null = null;
  private readonly coverFile = viewChild<ElementRef<HTMLInputElement>>('coverFile');

  protected readonly loading = computed(() => this.loaded()?.libraryId !== this.libraryId());
  protected readonly libraryName = computed(() => this.library()?.name ?? '');
  protected readonly view = computed(() => folderView(this.entries(), this.path()));
  protected readonly coverUrl = (seriesId: number) => this.imageService.getSeriesCoverImage(seriesId);
  protected readonly seriesView = {[SERIES_VIEW_PARAM]: SERIES_VIEW};
  protected readonly canEdit = this.accountService.hasAdminRole;
  protected readonly customCovers = computed(() => new Map(this.covers().map(c =>
    [c.path, this.imageService.getFolderCoverImage(this.libraryId(), c.path, c.lastModifiedUtc)])));

  constructor() {
    // A folder holding only files is a series: a link straight to it opens the series
    effect(() => {
      const view = this.view();
      if (!this.loading() && view.seriesId != null && view.folders.length === 0) {
        this.router.navigate(['/library', this.libraryId(), 'series', view.seriesId], {replaceUrl: true});
      }
    });
  }

  protected chooseCover(path: string) {
    this.coverPath = path;
    this.coverFile()?.nativeElement.click();
  }

  protected coverChosen(input: HTMLInputElement) {
    const file = input.files?.[0];
    const path = this.coverPath;
    input.value = '';
    if (!file || path === null) return;
    const reader = new FileReader();
    reader.onload = () => this.saveCover(path, (reader.result as string).split(',')[1] ?? null);
    reader.readAsDataURL(file);
  }

  protected saveCover(path: string, base64: string | null) {
    this.uploadService.updateFolderCoverImage(this.libraryId(), path, base64)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.coversRefresh.update(n => n + 1));
  }
}
