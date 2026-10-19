import {inject} from '@angular/core';
import {CanActivateFn, Router, Routes} from '@angular/router';
import {LibraryDetailComponent} from '../library-detail/library-detail.component';
import {UrlFilterResolver} from "../_resolvers/url-filter.resolver";
import {libraryResolver} from "../_resolvers/library.resolver";
import {AccountService} from "../_services/account.service";
import {opensLibraryByFolder, SERIES_VIEW_PARAM} from "../_helpers/library-landing";

/** Libraries open on their folder tree unless the user prefers the series grid */
const libraryLandingGuard: CanActivateFn = route => {
  const preferences = inject(AccountService).userPreferences();
  if (!opensLibraryByFolder(preferences?.browseLibrariesByFolder, route.queryParamMap.get(SERIES_VIEW_PARAM))) return true;
  return inject(Router).createUrlTree(['/library', route.paramMap.get('libraryId'), 'folders']);
};

export const routes: Routes = [
  {
    path: '',
    component: LibraryDetailComponent,
    canActivate: [libraryLandingGuard],
    data: {titleField: 'library', titleProp: 'name'},
    resolve: {
      library: libraryResolver,
      filter: UrlFilterResolver
    }
  }
];
