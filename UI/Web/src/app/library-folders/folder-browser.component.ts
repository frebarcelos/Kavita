import {ChangeDetectionStrategy, Component, input, output, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {FolderView} from '../_helpers/folder-tree';

@Component({
  selector: 'app-folder-browser',
  imports: [RouterLink],
  template: `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-3">
        <li class="breadcrumb-item" [class.active]="view().crumbs.length === 0">
          @if (view().crumbs.length === 0) {
            <span aria-current="page">{{ rootLabel() }}</span>
          } @else {
            <a [routerLink]="folderLink()" [queryParams]="{path: ''}">{{ rootLabel() }}</a>
          }
        </li>
        @for (crumb of view().crumbs; track crumb.path; let last = $last) {
          <li class="breadcrumb-item" [class.active]="last">
            @if (last) {
              <span aria-current="page">{{ crumb.name }}</span>
            } @else {
              <a [routerLink]="folderLink()" [queryParams]="{path: crumb.path}">{{ crumb.name }}</a>
            }
          </li>
        }
      </ol>
    </nav>

    @if (!view().exists) {
      <p class="text-muted">{{ emptyLabel() }}</p>
    }

    <div class="folders">
      @if (view().seriesId; as seriesId) {
        <a class="folder card" [routerLink]="['/library', libraryId(), 'series', seriesId]">
          <img class="card-img-top" [src]="coverUrl()(seriesId)" alt="" loading="lazy">
          <span class="card-body">
            <span class="name"><i class="fa-solid fa-book-open me-1" aria-hidden="true"></i>{{ folderItemsLabel() }}</span>
          </span>
        </a>
      }
      @for (folder of view().folders; track folder.path) {
        <div class="folder-cell">
          @if (folder.seriesId; as seriesId) {
            <!-- A folder of files is a series: open it directly -->
            <a class="folder card" [routerLink]="['/library', libraryId(), 'series', seriesId]">
              <img class="card-img-top" [src]="folderCover(folder.path, folder.coverSeriesId)" alt="" loading="lazy">
              <span class="card-body">
                <span class="name"><i class="fa-solid fa-folder me-1" aria-hidden="true"></i>{{ folder.name }}</span>
              </span>
            </a>
          } @else {
            <a class="folder card" [routerLink]="folderLink()" [queryParams]="{path: folder.path}">
              <img class="card-img-top" [src]="folderCover(folder.path, folder.coverSeriesId)" alt="" loading="lazy">
              <span class="card-body">
                <span class="name"><i class="fa-solid fa-folder me-1" aria-hidden="true"></i>{{ folder.name }}</span>
                <small class="d-block text-muted">{{ folder.seriesCount }} {{ seriesLabel() }}</small>
              </span>
            </a>
          }
          @if (canEdit()) {
            <button type="button" class="cover-menu btn btn-sm btn-secondary" [attr.aria-label]="editCoverLabel() + ': ' + folder.name"
                    [attr.aria-expanded]="openMenu() === folder.path" (click)="toggleMenu(folder.path)">
              <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
            </button>
            @if (openMenu() === folder.path) {
              <div class="cover-menu-list dropdown-menu show">
                <button type="button" class="cover-menu-item dropdown-item" (click)="choose(folder.path, 'edit')">{{ editCoverLabel() }}</button>
                @if (customCovers().has(folder.path)) {
                  <button type="button" class="cover-menu-item dropdown-item" (click)="choose(folder.path, 'remove')">{{ removeCoverLabel() }}</button>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    .folders { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 1rem; }
    .folder { text-decoration: none; color: inherit; overflow: hidden; }
    .folder img { aspect-ratio: 2 / 3; object-fit: cover; }
    .folder .card-body { display: block; padding: .5rem; }
    .folder .name { display: block; overflow-wrap: anywhere; }
    .folder-cell { position: relative; }
    .folder-cell .folder { height: 100%; }
    .cover-menu { position: absolute; top: .25rem; right: .25rem; padding: .1rem .5rem; opacity: .85; }
    .cover-menu-list { position: absolute; top: 2rem; right: .25rem; left: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderBrowserComponent {
  libraryId = input.required<number>();
  view = input.required<FolderView>();
  coverUrl = input.required<(seriesId: number) => string>();
  rootLabel = input.required<string>();
  folderItemsLabel = input.required<string>();
  seriesLabel = input.required<string>();
  emptyLabel = input.required<string>();
  /** Covers chosen for folders, by folder path; other folders show their first series' cover */
  customCovers = input<Map<string, string>>(new Map());
  /** Whether the user may change folder covers (admins) */
  canEdit = input(false);
  editCoverLabel = input('');
  removeCoverLabel = input('');
  editCover = output<string>();
  removeCover = output<string>();

  protected readonly openMenu = signal<string | null>(null);

  protected folderCover(path: string, seriesId: number) {
    return this.customCovers().get(path) ?? this.coverUrl()(seriesId);
  }

  protected toggleMenu(path: string) {
    this.openMenu.update(open => open === path ? null : path);
  }

  protected choose(path: string, action: 'edit' | 'remove') {
    this.openMenu.set(null);
    if (action === 'edit') this.editCover.emit(path);
    else this.removeCover.emit(path);
  }

  protected folderLink() {
    return ['/library', this.libraryId(), 'folders'];
  }
}
