# Mapa do repositório Kavita

Snapshot estrutural em 2026-10-17, antes desta documentação: 3854 arquivos fora de .git e diretórios de dependências/build. Contagens incluem assets, fixtures e migrações; não representam quantidade de funcionalidades ou testes executados. Use este índice para escolher o código a ler, junto de [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Áreas de topo

| Área | Arquivos | Função |
| --- | ---: | --- |
| (raiz) | 21 | Solução, versões, instruções upstream, licença, Docker e release |
| .github | 13 | Workflows de build/test/release, templates e configuração de colaboração |
| .vscode | 2 | Configurações do editor |
| Kavita.API | 111 | Contratos de serviços, repositórios, banco e store |
| Kavita.Benchmark | 11 | Benchmarks e amostras |
| Kavita.Common | 41 | Configuração e utilitários compartilhados |
| Kavita.Common.Tests | 11 | Testes de Common |
| Kavita.Database | 509 | EF/SQLite, seed, repositórios e migrações |
| Kavita.Database.Tests | 10 | Testes de banco e infraestrutura de fixtures |
| Kavita.Email | 5 | DTOs de e-mail; projeto fora da solução |
| Kavita.Integration.Tests | 4 | Integrações Plus com serviço externo |
| Kavita.Models | 631 | Entidades, DTOs, enums, builders e parser |
| Kavita.Models.Tests | 5 | Testes dos modelos |
| Kavita.Server | 216 | Host, HTTP, auth, migrações manuais, assets e traduções |
| Kavita.Server.Tests | 6 | Testes de endpoints, middleware, helpers e migrações |
| Kavita.Services | 142 | Regras de negócio, leitura, scanner, integrações e jobs |
| Kavita.Services.Tests | 258 | Testes de serviços, parsers, leitura e filesystem, com fixtures |
| Logo | 7 | Identidade visual upstream |
| scripts | 17 | Ferramentas auxiliares Python/.NET |
| UI | 1834 | Frontend Angular, assets e localização |

## Projetos e dependências diretas

| Projeto | Target | Referências locais |
| --- | --- | --- |
| [Kavita.API/Kavita.API.csproj](../../Kavita.API/Kavita.API.csproj) | net10.0 | Kavita.Models |
| [Kavita.Benchmark/Kavita.Benchmark.csproj](../../Kavita.Benchmark/Kavita.Benchmark.csproj) | net10.0 | Kavita.Models, Kavita.Services |
| [Kavita.Common/Kavita.Common.csproj](../../Kavita.Common/Kavita.Common.csproj) | net10.0 | — |
| [Kavita.Common.Tests/Kavita.Common.Tests.csproj](../../Kavita.Common.Tests/Kavita.Common.Tests.csproj) | net10.0 | Kavita.Common |
| [Kavita.Database/Kavita.Database.csproj](../../Kavita.Database/Kavita.Database.csproj) | net10.0 | Kavita.API, Kavita.Models |
| [Kavita.Database.Tests/Kavita.Database.Tests.csproj](../../Kavita.Database.Tests/Kavita.Database.Tests.csproj) | net10.0 | Kavita.Common, Kavita.Database, Kavita.Services |
| [Kavita.Email/Kavita.Email.csproj](../../Kavita.Email/Kavita.Email.csproj) | net8.0 | — |
| [Kavita.Integration.Tests/Kavita.Integration.Tests.csproj](../../Kavita.Integration.Tests/Kavita.Integration.Tests.csproj) | net10.0 | Kavita.Common, Kavita.Models |
| [Kavita.Models/Kavita.Models.csproj](../../Kavita.Models/Kavita.Models.csproj) | net10.0 | Kavita.Common |
| [Kavita.Models.Tests/Kavita.Models.Tests.csproj](../../Kavita.Models.Tests/Kavita.Models.Tests.csproj) | net10.0 | Kavita.Models |
| [Kavita.Server/Kavita.Server.csproj](../../Kavita.Server/Kavita.Server.csproj) | net10.0 | Kavita.API, Kavita.Common, Kavita.Database, Kavita.Models, Kavita.Services |
| [Kavita.Server.Tests/Kavita.Server.Tests.csproj](../../Kavita.Server.Tests/Kavita.Server.Tests.csproj) | net10.0 | Kavita.API, Kavita.Database.Tests, Kavita.Server |
| [Kavita.Services/Kavita.Services.csproj](../../Kavita.Services/Kavita.Services.csproj) | net10.0 | Kavita.API, Kavita.Database, Kavita.Models |
| [Kavita.Services.Tests/Kavita.Services.Tests.csproj](../../Kavita.Services.Tests/Kavita.Services.Tests.csproj) | net10.0 | Kavita.Common.Tests, Kavita.Database.Tests |
| [scripts/FsProbe/FsProbe.csproj](../../scripts/FsProbe/FsProbe.csproj) | net10.0 | — |

## Onde começar por tarefa

| Tarefa | Código inicial |
| --- | --- |
| Inicialização e DI | Server/Program.cs, Startup.cs, Server/Extensions, Services/Extensions |
| Contratos públicos | Models/DTOs, API/Services e API/Repositories; openapi.json como snapshot |
| Catálogo e consultas | Models/Entities, Database/DataContext.cs, Repositories, Extensions e UnitOfWork.cs |
| Scan/indexação | Services/Scanner e TaskScheduler.cs; contratos API/Services/Scanner |
| Parser de nomes/formatos | Models/Parser, Services/Scanner e testes de parsing |
| Leitura e progresso | Server/Controllers/ReaderController.cs, Services/Reading, Models/DTOs/Progress |
| Download/payload | DownloadController.cs, Services/DownloadService.cs, ArchiveService.cs, BookService.cs |
| Filesystem/cache | DirectoryService.cs, FileService.cs, CacheService.cs, FileCacheService.cs, CleanupService.cs |
| Contas/permissões | Account/Plugin/Users controllers, Server/Middleware, AuthKeyService, Models/Constants |
| Listas e coleções | Services/ReadingLists, CollectionTagService e controllers correspondentes |
| Eventos e jobs | Services/SignalR, HostedServices, TaskScheduler.cs e Startup.cs |
| Integrações Plus | Services/Plus e Integration.Tests; serviço externo necessário |
| Leitores web | UI/Web/src/app/book-reader, manga-reader, pdf-reader, reader-shared |
| EPUB como livro (L1) | book-reader/_components/epub-book-decoration; _services/epub-reader-settings.service.ts; scripts/e2e/epub.e2e.mjs; docs/validation/EPUB_LIVRO.md |
| Virada de EPUB (L2, implementação local em aceite) | book-reader/_components/epub-book/epub-book-pages.ts e epub-book-animation.component.ts, com testes; ganchos em book-reader; scripts/e2e/epub-animation.e2e.mjs e epub-clipping.e2e.mjs; `scripts/e2e/run.ps1 -MeasureEpubClipping` |
| Aparência sem perder o lugar (L3, implementação local em aceite) | âncora de texto e alinhamento da dupla em book-reader.component.ts; book-reader.pagination.spec.ts; scripts/e2e/epub-reflow.e2e.mjs; `scripts/e2e/run.ps1 -EpubReflowOnly` |
| Cliente HTTP web | UI/Web/src/app/_services, _interceptors e _models |
| Kover Android | [Contexto próprio](KOVER_CONTEXT.md); código na pasta irmã ../kover |

Os caminhos abreviados na tabela têm prefixo Kavita. (por exemplo, Services = Kavita.Services).

## Controllers HTTP

Todos ficam em Kavita.Server/Controllers. As rotas/atributos nos arquivos são a fonte de verdade.

- [AccountController.cs](../../Kavita.Server/Controllers/AccountController.cs)
- [ActivityController.cs](../../Kavita.Server/Controllers/ActivityController.cs)
- [AdminController.cs](../../Kavita.Server/Controllers/AdminController.cs)
- [AnnotationController.cs](../../Kavita.Server/Controllers/AnnotationController.cs)
- [BaseApiController.cs](../../Kavita.Server/Controllers/BaseApiController.cs)
- [BookController.cs](../../Kavita.Server/Controllers/BookController.cs)
- [CBLController.cs](../../Kavita.Server/Controllers/CBLController.cs)
- [ChapterController.cs](../../Kavita.Server/Controllers/ChapterController.cs)
- [CollectionController.cs](../../Kavita.Server/Controllers/CollectionController.cs)
- [ColorScapeController.cs](../../Kavita.Server/Controllers/ColorScapeController.cs)
- [DeviceController.cs](../../Kavita.Server/Controllers/DeviceController.cs)
- [DownloadController.cs](../../Kavita.Server/Controllers/DownloadController.cs)
- [EmailController.cs](../../Kavita.Server/Controllers/EmailController.cs)
- [FallbackController.cs](../../Kavita.Server/Controllers/FallbackController.cs)
- [FilterController.cs](../../Kavita.Server/Controllers/FilterController.cs)
- [FontController.cs](../../Kavita.Server/Controllers/FontController.cs)
- [HealthController.cs](../../Kavita.Server/Controllers/HealthController.cs)
- [ImageController.cs](../../Kavita.Server/Controllers/ImageController.cs)
- [KavitaPlusAuditController.cs](../../Kavita.Server/Controllers/KavitaPlusAuditController.cs)
- [KoreaderController.cs](../../Kavita.Server/Controllers/KoreaderController.cs)
- [LibraryController.cs](../../Kavita.Server/Controllers/LibraryController.cs)
- [LicenseController.cs](../../Kavita.Server/Controllers/LicenseController.cs)
- [LocaleController.cs](../../Kavita.Server/Controllers/LocaleController.cs)
- [ManageController.cs](../../Kavita.Server/Controllers/ManageController.cs)
- [MetadataController.cs](../../Kavita.Server/Controllers/MetadataController.cs)
- [OAuthController.cs](../../Kavita.Server/Controllers/OAuthController.cs)
- [OidcController.cs](../../Kavita.Server/Controllers/OidcController.cs)
- [OPDSController.cs](../../Kavita.Server/Controllers/OPDSController.cs)
- [PanelsController.cs](../../Kavita.Server/Controllers/PanelsController.cs)
- [PersonController.cs](../../Kavita.Server/Controllers/PersonController.cs)
- [PluginController.cs](../../Kavita.Server/Controllers/PluginController.cs)
- [RatingController.cs](../../Kavita.Server/Controllers/RatingController.cs)
- [ReaderController.cs](../../Kavita.Server/Controllers/ReaderController.cs)
- [ReadingListController.cs](../../Kavita.Server/Controllers/ReadingListController.cs)
- [ReadingProfileController.cs](../../Kavita.Server/Controllers/ReadingProfileController.cs)
- [ReviewController.cs](../../Kavita.Server/Controllers/ReviewController.cs)
- [ScrobblingController.cs](../../Kavita.Server/Controllers/ScrobblingController.cs)
- [SearchController.cs](../../Kavita.Server/Controllers/SearchController.cs)
- [SeriesController.cs](../../Kavita.Server/Controllers/SeriesController.cs)
- [ServerController.cs](../../Kavita.Server/Controllers/ServerController.cs)
- [SettingsController.cs](../../Kavita.Server/Controllers/SettingsController.cs)
- [StatsController.cs](../../Kavita.Server/Controllers/StatsController.cs)
- [StreamController.cs](../../Kavita.Server/Controllers/StreamController.cs)
- [TachiyomiController.cs](../../Kavita.Server/Controllers/TachiyomiController.cs)
- [ThemeController.cs](../../Kavita.Server/Controllers/ThemeController.cs)
- [UploadController.cs](../../Kavita.Server/Controllers/UploadController.cs)
- [UsersController.cs](../../Kavita.Server/Controllers/UsersController.cs)
- [VolumeController.cs](../../Kavita.Server/Controllers/VolumeController.cs)
- [WantToReadController.cs](../../Kavita.Server/Controllers/WantToReadController.cs)

## Serviços por área

### Kavita.Services

[AccountService.cs](../../Kavita.Services/AccountService.cs), [ActiveUserTrackerService.cs](../../Kavita.Services/ActiveUserTrackerService.cs), [AnnotationService.cs](../../Kavita.Services/AnnotationService.cs), [ArchiveService.cs](../../Kavita.Services/ArchiveService.cs), [AuthKeyService.cs](../../Kavita.Services/AuthKeyService.cs), [BackupService.cs](../../Kavita.Services/BackupService.cs), [BookmarkService.cs](../../Kavita.Services/BookmarkService.cs), [BookService.cs](../../Kavita.Services/BookService.cs), [CacheService.cs](../../Kavita.Services/CacheService.cs), [CleanupService.cs](../../Kavita.Services/CleanupService.cs), [ClientDeviceService.cs](../../Kavita.Services/ClientDeviceService.cs), [CollectionTagService.cs](../../Kavita.Services/CollectionTagService.cs), [DeviceService.cs](../../Kavita.Services/DeviceService.cs), [DeviceTrackingService.cs](../../Kavita.Services/DeviceTrackingService.cs), [DirectoryService.cs](../../Kavita.Services/DirectoryService.cs), [DownloadService.cs](../../Kavita.Services/DownloadService.cs), [EmailService.cs](../../Kavita.Services/EmailService.cs), [EntityNamingService.cs](../../Kavita.Services/EntityNamingService.cs), [FileCacheService.cs](../../Kavita.Services/FileCacheService.cs), [FileService.cs](../../Kavita.Services/FileService.cs), [FontService.cs](../../Kavita.Services/FontService.cs), [ImageService.cs](../../Kavita.Services/ImageService.cs), [KoreaderService.cs](../../Kavita.Services/KoreaderService.cs), [LocalizationService.cs](../../Kavita.Services/LocalizationService.cs), [MediaConversionService.cs](../../Kavita.Services/MediaConversionService.cs), [MediaErrorService.cs](../../Kavita.Services/MediaErrorService.cs), [MetadataService.cs](../../Kavita.Services/MetadataService.cs), [OidcService.cs](../../Kavita.Services/OidcService.cs), [OpdsService.cs](../../Kavita.Services/OpdsService.cs), [PersonService.cs](../../Kavita.Services/PersonService.cs), [RatingService.cs](../../Kavita.Services/RatingService.cs), [RefreshTokenProvider.cs](../../Kavita.Services/RefreshTokenProvider.cs), [SeriesService.cs](../../Kavita.Services/SeriesService.cs), [SettingsService.cs](../../Kavita.Services/SettingsService.cs), [SiteThemeService.cs](../../Kavita.Services/SiteThemeService.cs), [StatisticService.cs](../../Kavita.Services/StatisticService.cs), [StatsService.cs](../../Kavita.Services/StatsService.cs), [StreamService.cs](../../Kavita.Services/StreamService.cs), [TachiyomiService.cs](../../Kavita.Services/TachiyomiService.cs), [TaskScheduler.cs](../../Kavita.Services/TaskScheduler.cs), [TokenService.cs](../../Kavita.Services/TokenService.cs), [UrlValidationService.cs](../../Kavita.Services/UrlValidationService.cs), [VersionUpdaterService.cs](../../Kavita.Services/VersionUpdaterService.cs).

### Kavita.Services/Builders

[ChapterBuilder.cs](../../Kavita.Services/Builders/ChapterBuilder.cs), [MangaFileBuilder.cs](../../Kavita.Services/Builders/MangaFileBuilder.cs), [VolumeBuilder.cs](../../Kavita.Services/Builders/VolumeBuilder.cs).

### Kavita.Services/Comparators

[ChapterSortComparer.cs](../../Kavita.Services/Comparators/ChapterSortComparer.cs).

### Kavita.Services/Extensions

[ApplicationServiceExtensions.cs](../../Kavita.Services/Extensions/ApplicationServiceExtensions.cs), [ChapterExtensions.cs](../../Kavita.Services/Extensions/ChapterExtensions.cs), [ChapterListExtensions.cs](../../Kavita.Services/Extensions/ChapterListExtensions.cs), [ComicInfoExtensions.cs](../../Kavita.Services/Extensions/ComicInfoExtensions.cs), [FileTypeGroupExtensions.cs](../../Kavita.Services/Extensions/FileTypeGroupExtensions.cs), [FlurlGithubExtensions.cs](../../Kavita.Services/Extensions/FlurlGithubExtensions.cs), [IHasKPlusMetadataExtensions.cs](../../Kavita.Services/Extensions/IHasKPlusMetadataExtensions.cs), [MarkdownExtensions.cs](../../Kavita.Services/Extensions/MarkdownExtensions.cs), [ParserExtensions.cs](../../Kavita.Services/Extensions/ParserExtensions.cs), [ParserInfoListExtensions.cs](../../Kavita.Services/Extensions/ParserInfoListExtensions.cs), [ReadingListRemapRuleExtensions.cs](../../Kavita.Services/Extensions/ReadingListRemapRuleExtensions.cs), [ScanJobExtensions.cs](../../Kavita.Services/Extensions/ScanJobExtensions.cs), [SeriesExtensions.cs](../../Kavita.Services/Extensions/SeriesExtensions.cs), [VolumeExtensions.cs](../../Kavita.Services/Extensions/VolumeExtensions.cs), [VolumeListExtensions.cs](../../Kavita.Services/Extensions/VolumeListExtensions.cs), [ZipArchiveExtensions.cs](../../Kavita.Services/Extensions/ZipArchiveExtensions.cs).

### Kavita.Services/Helpers

[AnnotationHelper.cs](../../Kavita.Services/Helpers/AnnotationHelper.cs), [BookChapterItemHelper.cs](../../Kavita.Services/Helpers/BookChapterItemHelper.cs), [BookSortTitlePrefixHelper.cs](../../Kavita.Services/Helpers/BookSortTitlePrefixHelper.cs), [CacheHelper.cs](../../Kavita.Services/Helpers/CacheHelper.cs), [CblParser.cs](../../Kavita.Services/Helpers/CblParser.cs), [KoreaderHelper.cs](../../Kavita.Services/Helpers/KoreaderHelper.cs), [ParsedCountHelper.cs](../../Kavita.Services/Helpers/ParsedCountHelper.cs), [PdfComicInfoExtractor.cs](../../Kavita.Services/Helpers/PdfComicInfoExtractor.cs), [PdfMetadataExtractor.cs](../../Kavita.Services/Helpers/PdfMetadataExtractor.cs), [PersonHelper.cs](../../Kavita.Services/Helpers/PersonHelper.cs), [RecommendationHelper.cs](../../Kavita.Services/Helpers/RecommendationHelper.cs), [ReviewHelper.cs](../../Kavita.Services/Helpers/ReviewHelper.cs), [SeriesHelper.cs](../../Kavita.Services/Helpers/SeriesHelper.cs), [TagHelper.cs](../../Kavita.Services/Helpers/TagHelper.cs).

### Kavita.Services/Helpers/SmartFilter

[SmartFilterHelper.cs](../../Kavita.Services/Helpers/SmartFilter/SmartFilterHelper.cs).

### Kavita.Services/HostedServices

[ReadingSessionInitializer.cs](../../Kavita.Services/HostedServices/ReadingSessionInitializer.cs), [StartupTasksHostedService.cs](../../Kavita.Services/HostedServices/StartupTasksHostedService.cs).

### Kavita.Services/Metadata

[CoverDbService.cs](../../Kavita.Services/Metadata/CoverDbService.cs), [WordCountAnalyzerService.cs](../../Kavita.Services/Metadata/WordCountAnalyzerService.cs).

### Kavita.Services/Plus

[ExternalMetadataService.cs](../../Kavita.Services/Plus/ExternalMetadataService.cs), [KavitaPlusApiService.cs](../../Kavita.Services/Plus/KavitaPlusApiService.cs), [KavitaPlusAuditService.cs](../../Kavita.Services/Plus/KavitaPlusAuditService.cs), [KavitaPlusProviderHealthService.cs](../../Kavita.Services/Plus/KavitaPlusProviderHealthService.cs), [LicenseService.cs](../../Kavita.Services/Plus/LicenseService.cs), [OAuthService.cs](../../Kavita.Services/Plus/OAuthService.cs), [ScrobblingService.cs](../../Kavita.Services/Plus/ScrobblingService.cs), [SmartCollectionSyncService.cs](../../Kavita.Services/Plus/SmartCollectionSyncService.cs), [WantToReadSyncService.cs](../../Kavita.Services/Plus/WantToReadSyncService.cs).

### Kavita.Services/Plus/ScrobbleService

[AniListScrobbleProviderService.cs](../../Kavita.Services/Plus/ScrobbleService/AniListScrobbleProviderService.cs), [ChapterScrobbleService.cs](../../Kavita.Services/Plus/ScrobbleService/ChapterScrobbleService.cs), [HardcoverScrobbleProviderService.cs](../../Kavita.Services/Plus/ScrobbleService/HardcoverScrobbleProviderService.cs), [MangabakaScrobbleProviderService.cs](../../Kavita.Services/Plus/ScrobbleService/MangabakaScrobbleProviderService.cs), [MyAnimeListScrobbleProviderService.cs](../../Kavita.Services/Plus/ScrobbleService/MyAnimeListScrobbleProviderService.cs), [ScrobbleRuleService.cs](../../Kavita.Services/Plus/ScrobbleService/ScrobbleRuleService.cs), [SeriesScrobbleService.cs](../../Kavita.Services/Plus/ScrobbleService/SeriesScrobbleService.cs).

### Kavita.Services/Reading

[ReaderService.cs](../../Kavita.Services/Reading/ReaderService.cs), [ReadingHistoryService.cs](../../Kavita.Services/Reading/ReadingHistoryService.cs), [ReadingItemService.cs](../../Kavita.Services/Reading/ReadingItemService.cs), [ReadingProfileService.cs](../../Kavita.Services/Reading/ReadingProfileService.cs), [ReadingSessionService.cs](../../Kavita.Services/Reading/ReadingSessionService.cs).

### Kavita.Services/ReadingLists

[CblExportService.cs](../../Kavita.Services/ReadingLists/CblExportService.cs), [CblGithubService.cs](../../Kavita.Services/ReadingLists/CblGithubService.cs), [CblImportService.cs](../../Kavita.Services/ReadingLists/CblImportService.cs), [CblSeriesMatcher.cs](../../Kavita.Services/ReadingLists/CblSeriesMatcher.cs), [ReadingListService.cs](../../Kavita.Services/ReadingLists/ReadingListService.cs).

### Kavita.Services/Repositories

[CoverDbRepository.cs](../../Kavita.Services/Repositories/CoverDbRepository.cs).

### Kavita.Services/Scanner

[BasicParser.cs](../../Kavita.Services/Scanner/BasicParser.cs), [BookParser.cs](../../Kavita.Services/Scanner/BookParser.cs), [ComicVineParser.cs](../../Kavita.Services/Scanner/ComicVineParser.cs), [DefaultParser.cs](../../Kavita.Services/Scanner/DefaultParser.cs), [DelayedScanRetime.cs](../../Kavita.Services/Scanner/DelayedScanRetime.cs), [FolderChangeCheck.cs](../../Kavita.Services/Scanner/FolderChangeCheck.cs), [ImageParser.cs](../../Kavita.Services/Scanner/ImageParser.cs), [KeptFiles.cs](../../Kavita.Services/Scanner/KeptFiles.cs), [KnownSeriesFolders.cs](../../Kavita.Services/Scanner/KnownSeriesFolders.cs), [LibraryWatcher.cs](../../Kavita.Services/Scanner/LibraryWatcher.cs), [ParseIssues.cs](../../Kavita.Services/Scanner/ParseIssues.cs), [Parser.cs](../../Kavita.Services/Scanner/Parser.cs), [ParseScannedFiles.cs](../../Kavita.Services/Scanner/ParseScannedFiles.cs), [PdfParser.cs](../../Kavita.Services/Scanner/PdfParser.cs), [ProcessSeries.cs](../../Kavita.Services/Scanner/ProcessSeries.cs), [RetimeMove.cs](../../Kavita.Services/Scanner/RetimeMove.cs), [RetimePlan.cs](../../Kavita.Services/Scanner/RetimePlan.cs), [ScanFolderJob.cs](../../Kavita.Services/Scanner/ScanFolderJob.cs), [ScanJob.cs](../../Kavita.Services/Scanner/ScanJob.cs), [ScanJobQueue.cs](../../Kavita.Services/Scanner/ScanJobQueue.cs), [ScanJobState.cs](../../Kavita.Services/Scanner/ScanJobState.cs), [ScannerService.cs](../../Kavita.Services/Scanner/ScannerService.cs), [ScanQueueSnapshot.cs](../../Kavita.Services/Scanner/ScanQueueSnapshot.cs), [ScanTarget.cs](../../Kavita.Services/Scanner/ScanTarget.cs).

### Kavita.Services/SignalR

[ActivityTracker.cs](../../Kavita.Services/SignalR/ActivityTracker.cs), [EventHub.cs](../../Kavita.Services/SignalR/EventHub.cs), [JobCorrelation.cs](../../Kavita.Services/SignalR/JobCorrelation.cs), [JobCorrelationFilter.cs](../../Kavita.Services/SignalR/JobCorrelationFilter.cs), [MessageHub.cs](../../Kavita.Services/SignalR/MessageHub.cs), [PresenceTracker.cs](../../Kavita.Services/SignalR/PresenceTracker.cs), [ProgressThrottle.cs](../../Kavita.Services/SignalR/ProgressThrottle.cs), [ScanEndRetimeFilter.cs](../../Kavita.Services/SignalR/ScanEndRetimeFilter.cs).

## Organização dos modelos, contratos e banco

- **Kavita.API**: Attributes (1), Database (2), Errors (2), Repositories (30), Services (74), Store (1).
- **Kavita.Models**: Attributes (1), AutoMapper (6), Builders (22), Constants (7), DTOs (429), Entities (141), Extensions (8), Helpers (1), Metadata (1), Misc (1), Parser (11), Scanner (1).
- **Kavita.Database**: Converters (4), Extensions (22), Interceptors (1), Migrations (447), Repositories (31).
- **Kavita.Server**: Assets (1), Attributes (4), config (10), Controllers (49), EmailTemplates (15), Extensions (3), Helpers (3), I18N (42), Logging (3), ManualMigrations (70), Middleware (9), Properties (1), Store (2), Swagger (1).

## UI Angular

Entrada: UI/Web/src/main.ts. Configuração: package.json, package-lock.json, angular.json, tsconfig e proxy.conf.json.

As áreas sob UI/Web/src/app são:

[admin](../../UI/Web/src/app/admin), [all-annotations](../../UI/Web/src/app/all-annotations), [all-filters](../../UI/Web/src/app/all-filters), [all-series](../../UI/Web/src/app/all-series), [announcements](../../UI/Web/src/app/announcements), [book-reader](../../UI/Web/src/app/book-reader), [bookmark](../../UI/Web/src/app/bookmark), [browse](../../UI/Web/src/app/browse), [cards](../../UI/Web/src/app/cards), [carousel](../../UI/Web/src/app/carousel), [chapter-detail](../../UI/Web/src/app/chapter-detail), [collections](../../UI/Web/src/app/collections), [common](../../UI/Web/src/app/common), [dashboard](../../UI/Web/src/app/dashboard), [library-detail](../../UI/Web/src/app/library-detail), [manga-reader](../../UI/Web/src/app/manga-reader), [metadata-filter](../../UI/Web/src/app/metadata-filter), [nav](../../UI/Web/src/app/nav), [ng-swipe](../../UI/Web/src/app/ng-swipe), [pdf-reader](../../UI/Web/src/app/pdf-reader), [person-detail](../../UI/Web/src/app/person-detail), [profile](../../UI/Web/src/app/profile), [reader-shared](../../UI/Web/src/app/reader-shared), [reading-list](../../UI/Web/src/app/reading-list), [registration](../../UI/Web/src/app/registration), [series-detail](../../UI/Web/src/app/series-detail), [settings](../../UI/Web/src/app/settings), [shared](../../UI/Web/src/app/shared), [sidenav](../../UI/Web/src/app/sidenav), [single-module](../../UI/Web/src/app/single-module), [statistics](../../UI/Web/src/app/statistics), [typeahead](../../UI/Web/src/app/typeahead), [user-settings](../../UI/Web/src/app/user-settings), [volume-detail](../../UI/Web/src/app/volume-detail), [want-to-read](../../UI/Web/src/app/want-to-read), [_directives](../../UI/Web/src/app/_directives), [_guards](../../UI/Web/src/app/_guards), [_helpers](../../UI/Web/src/app/_helpers), [_interceptors](../../UI/Web/src/app/_interceptors), [_migrations](../../UI/Web/src/app/_migrations), [_models](../../UI/Web/src/app/_models), [_pipes](../../UI/Web/src/app/_pipes), [_providers](../../UI/Web/src/app/_providers), [_resolvers](../../UI/Web/src/app/_resolvers), [_routes](../../UI/Web/src/app/_routes), [_services](../../UI/Web/src/app/_services), [_single-module](../../UI/Web/src/app/_single-module), [_types](../../UI/Web/src/app/_types), [_validators](../../UI/Web/src/app/_validators).

Templates HTML, SCSS, assets, temas e traduções fazem parte do frontend. Não confundir a presença de manifest web com comprovação de leitura offline completa.

## Fontes C# de teste e helpers

Lista de fontes sem fixtures binárias. Consultar a suíte antes de criar estruturas duplicadas.

### Kavita.Common.Tests

[Extensions/EnumerableExtensionsTests.cs](../../Kavita.Common.Tests/Extensions/EnumerableExtensionsTests.cs), [Extensions/PathExtensionsTests.cs](../../Kavita.Common.Tests/Extensions/PathExtensionsTests.cs), [Extensions/VersionExtensionTests.cs](../../Kavita.Common.Tests/Extensions/VersionExtensionTests.cs), [Helpers/CronConverterTests.cs](../../Kavita.Common.Tests/Helpers/CronConverterTests.cs), [Helpers/ExternalIdParserTests.cs](../../Kavita.Common.Tests/Helpers/ExternalIdParserTests.cs), [Helpers/HtmlHelperTests.cs](../../Kavita.Common.Tests/Helpers/HtmlHelperTests.cs), [Helpers/LanguageCodeHelperTests.cs](../../Kavita.Common.Tests/Helpers/LanguageCodeHelperTests.cs), [Helpers/RandfHelper.cs](../../Kavita.Common.Tests/Helpers/RandfHelper.cs), [Helpers/RateLimiterTests.cs](../../Kavita.Common.Tests/Helpers/RateLimiterTests.cs), [Helpers/StringHelperTests.cs](../../Kavita.Common.Tests/Helpers/StringHelperTests.cs).

### Kavita.Database.Tests

[AbstractDbTest.cs](../../Kavita.Database.Tests/AbstractDbTest.cs), [AbstractFsTest.cs](../../Kavita.Database.Tests/AbstractFsTest.cs), [Extensions/QueryableExtensionsTests.cs](../../Kavita.Database.Tests/Extensions/QueryableExtensionsTests.cs), [Repositories/ExternalSeriesMetadataRepositoryTests.cs](../../Kavita.Database.Tests/Repositories/ExternalSeriesMetadataRepositoryTests.cs), [Repositories/GenreRepositoryTests.cs](../../Kavita.Database.Tests/Repositories/GenreRepositoryTests.cs), [Repositories/MediaErrorRepositoryTests.cs](../../Kavita.Database.Tests/Repositories/MediaErrorRepositoryTests.cs), [Repositories/PersonRepositoryTests.cs](../../Kavita.Database.Tests/Repositories/PersonRepositoryTests.cs), [Repositories/SeriesRepositoryTests.cs](../../Kavita.Database.Tests/Repositories/SeriesRepositoryTests.cs), [Repositories/TagRepositoryTests.cs](../../Kavita.Database.Tests/Repositories/TagRepositoryTests.cs).

### Kavita.Integration.Tests

[Fixtures/KavitaPlusFixture.cs](../../Kavita.Integration.Tests/Fixtures/KavitaPlusFixture.cs), [Plus/KavitaPlusApiServiceTests.cs](../../Kavita.Integration.Tests/Plus/KavitaPlusApiServiceTests.cs), [Plus/LicenseServiceTests.cs](../../Kavita.Integration.Tests/Plus/LicenseServiceTests.cs).

### Kavita.Models.Tests

[DTOs/SignalR/MessageFactoryTests.cs](../../Kavita.Models.Tests/DTOs/SignalR/MessageFactoryTests.cs), [Entities/SeriesTests.cs](../../Kavita.Models.Tests/Entities/SeriesTests.cs), [Extensions/EncodeFormatExtensionsTests.cs](../../Kavita.Models.Tests/Extensions/EncodeFormatExtensionsTests.cs), [Extensions/EnumExtensionTests.cs](../../Kavita.Models.Tests/Extensions/EnumExtensionTests.cs).

### Kavita.Server.Tests

[Controllers/EndpointAccessTests.cs](../../Kavita.Server.Tests/Controllers/EndpointAccessTests.cs), [Helpers/BrowserHelperTests.cs](../../Kavita.Server.Tests/Helpers/BrowserHelperTests.cs), [ManualMigrations/ManualMigrationClearRootLowestFolderPathTests.cs](../../Kavita.Server.Tests/ManualMigrations/ManualMigrationClearRootLowestFolderPathTests.cs), [ManualMigrations/MigrateSmartFilterEncodingTests.cs](../../Kavita.Server.Tests/ManualMigrations/MigrateSmartFilterEncodingTests.cs), [Middleware/ClientInfoMiddlewareTests.cs](../../Kavita.Server.Tests/Middleware/ClientInfoMiddlewareTests.cs).

### Kavita.Services.Tests

[AccountServiceTests.cs](../../Kavita.Services.Tests/AccountServiceTests.cs), [AnnotationServiceTests.cs](../../Kavita.Services.Tests/AnnotationServiceTests.cs), [ArchiveServiceTests.cs](../../Kavita.Services.Tests/ArchiveServiceTests.cs), [BackupServiceTests.cs](../../Kavita.Services.Tests/BackupServiceTests.cs), [BookmarkServiceTests.cs](../../Kavita.Services.Tests/BookmarkServiceTests.cs), [BookServiceTests.cs](../../Kavita.Services.Tests/BookServiceTests.cs), [Cache/FakeHybridCache.cs](../../Kavita.Services.Tests/Cache/FakeHybridCache.cs), [Cache/FakeHybridCacheWithTracking.cs](../../Kavita.Services.Tests/Cache/FakeHybridCacheWithTracking.cs), [CacheServiceTests.cs](../../Kavita.Services.Tests/CacheServiceTests.cs), [CleanupServiceTests.cs](../../Kavita.Services.Tests/CleanupServiceTests.cs), [ClientDeviceServiceTests.cs](../../Kavita.Services.Tests/ClientDeviceServiceTests.cs), [CollectionTagServiceTests.cs](../../Kavita.Services.Tests/CollectionTagServiceTests.cs), [Comparers/ChapterSortComparerTest.cs](../../Kavita.Services.Tests/Comparers/ChapterSortComparerTest.cs), [Comparers/ChapterSortComparerZeroFirstTests.cs](../../Kavita.Services.Tests/Comparers/ChapterSortComparerZeroFirstTests.cs), [Comparers/SortComparerZeroLastTests.cs](../../Kavita.Services.Tests/Comparers/SortComparerZeroLastTests.cs), [CoverDbServiceTests.cs](../../Kavita.Services.Tests/CoverDbServiceTests.cs), [DelayedScanRetimeTests.cs](../../Kavita.Services.Tests/DelayedScanRetimeTests.cs), [DeviceServiceTests.cs](../../Kavita.Services.Tests/DeviceServiceTests.cs), [DeviceTrackingServiceTests.cs](../../Kavita.Services.Tests/DeviceTrackingServiceTests.cs), [DirectoryServiceTests.cs](../../Kavita.Services.Tests/DirectoryServiceTests.cs), [Entities/ComicInfoTests.cs](../../Kavita.Services.Tests/Entities/ComicInfoTests.cs), [EntityNamingServiceTests.cs](../../Kavita.Services.Tests/EntityNamingServiceTests.cs), [Extensions/AnnotationFilterTests.cs](../../Kavita.Services.Tests/Extensions/AnnotationFilterTests.cs), [Extensions/ChapterListExtensionsTests.cs](../../Kavita.Services.Tests/Extensions/ChapterListExtensionsTests.cs), [Extensions/ParserInfoListExtensionsTests.cs](../../Kavita.Services.Tests/Extensions/ParserInfoListExtensionsTests.cs), [Extensions/PersonFilterTests.cs](../../Kavita.Services.Tests/Extensions/PersonFilterTests.cs), [Extensions/ReadingListFilterTests.cs](../../Kavita.Services.Tests/Extensions/ReadingListFilterTests.cs), [Extensions/SeriesExtensionsTests.cs](../../Kavita.Services.Tests/Extensions/SeriesExtensionsTests.cs), [Extensions/SeriesFilterTests.cs](../../Kavita.Services.Tests/Extensions/SeriesFilterTests.cs), [Extensions/VolumeListExtensionsTests.cs](../../Kavita.Services.Tests/Extensions/VolumeListExtensionsTests.cs), [ExternalMetadataServiceMetadataProviderOverrideTests.cs](../../Kavita.Services.Tests/ExternalMetadataServiceMetadataProviderOverrideTests.cs), [ExternalMetadataServiceTests.cs](../../Kavita.Services.Tests/ExternalMetadataServiceTests.cs), [FileCacheServiceTests.cs](../../Kavita.Services.Tests/FileCacheServiceTests.cs), [FileSystemTests.cs](../../Kavita.Services.Tests/FileSystemTests.cs), [FolderChangeCheckTests.cs](../../Kavita.Services.Tests/FolderChangeCheckTests.cs), [Helpers/AnnotationHelperTests.cs](../../Kavita.Services.Tests/Helpers/AnnotationHelperTests.cs), [Helpers/BookSortTitlePrefixHelperTests.cs](../../Kavita.Services.Tests/Helpers/BookSortTitlePrefixHelperTests.cs), [Helpers/CacheHelperTests.cs](../../Kavita.Services.Tests/Helpers/CacheHelperTests.cs), [Helpers/CblFileBuilder.cs](../../Kavita.Services.Tests/Helpers/CblFileBuilder.cs), [Helpers/CblTestHelper.cs](../../Kavita.Services.Tests/Helpers/CblTestHelper.cs), [Helpers/FolderCalls.cs](../../Kavita.Services.Tests/Helpers/FolderCalls.cs), [Helpers/HangfireJobs.cs](../../Kavita.Services.Tests/Helpers/HangfireJobs.cs), [Helpers/HangfireStorageCollection.cs](../../Kavita.Services.Tests/Helpers/HangfireStorageCollection.cs), [Helpers/IpBlocklistTests.cs](../../Kavita.Services.Tests/Helpers/IpBlocklistTests.cs), [Helpers/KoreaderHelperTests.cs](../../Kavita.Services.Tests/Helpers/KoreaderHelperTests.cs), [Helpers/OrderableHelperTests.cs](../../Kavita.Services.Tests/Helpers/OrderableHelperTests.cs), [Helpers/ParsedCountHelperTests.cs](../../Kavita.Services.Tests/Helpers/ParsedCountHelperTests.cs), [Helpers/ParserInfoFactory.cs](../../Kavita.Services.Tests/Helpers/ParserInfoFactory.cs), [Helpers/PersonHelperTests.cs](../../Kavita.Services.Tests/Helpers/PersonHelperTests.cs), [Helpers/ReviewHelperTests.cs](../../Kavita.Services.Tests/Helpers/ReviewHelperTests.cs), [Helpers/ScannerHelper.cs](../../Kavita.Services.Tests/Helpers/ScannerHelper.cs), [Helpers/SeriesHelperTests.cs](../../Kavita.Services.Tests/Helpers/SeriesHelperTests.cs), [Helpers/SmartFilterHelperTests.cs](../../Kavita.Services.Tests/Helpers/SmartFilterHelperTests.cs), [Helpers/TagHelperTests.cs](../../Kavita.Services.Tests/Helpers/TagHelperTests.cs), [Helpers/TestCaseGenerator.cs](../../Kavita.Services.Tests/Helpers/TestCaseGenerator.cs), [Helpers/UnreadableFolders.cs](../../Kavita.Services.Tests/Helpers/UnreadableFolders.cs), [ImageServiceTests.cs](../../Kavita.Services.Tests/ImageServiceTests.cs), [LibraryWatcherTests.cs](../../Kavita.Services.Tests/LibraryWatcherTests.cs), [MediaErrorServiceTests.cs](../../Kavita.Services.Tests/MediaErrorServiceTests.cs), [MetadataServiceTests.cs](../../Kavita.Services.Tests/MetadataServiceTests.cs), [OidcServiceTests.cs](../../Kavita.Services.Tests/OidcServiceTests.cs), [OpdsServiceTests.cs](../../Kavita.Services.Tests/OpdsServiceTests.cs), [ParseIssuesTests.cs](../../Kavita.Services.Tests/ParseIssuesTests.cs), [Parsers/BasicParserTests.cs](../../Kavita.Services.Tests/Parsers/BasicParserTests.cs), [Parsers/BookParserTests.cs](../../Kavita.Services.Tests/Parsers/BookParserTests.cs), [Parsers/ComicVineParserTests.cs](../../Kavita.Services.Tests/Parsers/ComicVineParserTests.cs), [Parsers/DefaultParserTests.cs](../../Kavita.Services.Tests/Parsers/DefaultParserTests.cs), [Parsers/ImageParserTests.cs](../../Kavita.Services.Tests/Parsers/ImageParserTests.cs), [Parsers/PdfParserTests.cs](../../Kavita.Services.Tests/Parsers/PdfParserTests.cs), [ParseScannedFilesTests.cs](../../Kavita.Services.Tests/ParseScannedFilesTests.cs), [Parsing/BookParsingTests.cs](../../Kavita.Services.Tests/Parsing/BookParsingTests.cs), [Parsing/ComicParsingTests.cs](../../Kavita.Services.Tests/Parsing/ComicParsingTests.cs), [Parsing/ImageParsingTests.cs](../../Kavita.Services.Tests/Parsing/ImageParsingTests.cs), [Parsing/MangaParsingTests.cs](../../Kavita.Services.Tests/Parsing/MangaParsingTests.cs), [Parsing/ParserInfoTests.cs](../../Kavita.Services.Tests/Parsing/ParserInfoTests.cs), [Parsing/ParsingTests.cs](../../Kavita.Services.Tests/Parsing/ParsingTests.cs), [PersonServiceTests.cs](../../Kavita.Services.Tests/PersonServiceTests.cs), [ProcessSeriesTests.cs](../../Kavita.Services.Tests/ProcessSeriesTests.cs), [RateGateTests.cs](../../Kavita.Services.Tests/RateGateTests.cs), [RatingServiceTests.cs](../../Kavita.Services.Tests/RatingServiceTests.cs), [ReaderServiceRereadTests.cs](../../Kavita.Services.Tests/ReaderServiceRereadTests.cs), [ReaderServiceTests.cs](../../Kavita.Services.Tests/ReaderServiceTests.cs), [Reading/ReadingSessionBackfillGeneration.cs](../../Kavita.Services.Tests/Reading/ReadingSessionBackfillGeneration.cs), [ReadingHistoryServiceTests.cs](../../Kavita.Services.Tests/ReadingHistoryServiceTests.cs), [ReadingItemServiceTests.cs](../../Kavita.Services.Tests/ReadingItemServiceTests.cs), [ReadingLists/CblExportServiceTests.cs](../../Kavita.Services.Tests/ReadingLists/CblExportServiceTests.cs), [ReadingLists/CblImportServiceTests.cs](../../Kavita.Services.Tests/ReadingLists/CblImportServiceTests.cs), [ReadingLists/CblParserTests.cs](../../Kavita.Services.Tests/ReadingLists/CblParserTests.cs), [ReadingListServiceTests.cs](../../Kavita.Services.Tests/ReadingListServiceTests.cs), [ReadingProfileServiceTest.cs](../../Kavita.Services.Tests/ReadingProfileServiceTest.cs), [RecommendationHelperTests.cs](../../Kavita.Services.Tests/RecommendationHelperTests.cs), [ScanJobExtensionsTests.cs](../../Kavita.Services.Tests/ScanJobExtensionsTests.cs), [ScanJobQueueTests.cs](../../Kavita.Services.Tests/ScanJobQueueTests.cs), [ScannerServiceChangeDetectionTests.cs](../../Kavita.Services.Tests/ScannerServiceChangeDetectionTests.cs), [ScannerServiceIncrementalScanTests.cs](../../Kavita.Services.Tests/ScannerServiceIncrementalScanTests.cs), [ScannerServiceRetryTests.cs](../../Kavita.Services.Tests/ScannerServiceRetryTests.cs), [ScannerServiceScanFolderDedupeTests.cs](../../Kavita.Services.Tests/ScannerServiceScanFolderDedupeTests.cs), [ScannerServiceScanFolderTests.cs](../../Kavita.Services.Tests/ScannerServiceScanFolderTests.cs), [ScannerServiceScanSummaryTests.cs](../../Kavita.Services.Tests/ScannerServiceScanSummaryTests.cs), [ScannerServiceTests.cs](../../Kavita.Services.Tests/ScannerServiceTests.cs), [ScrobbleRuleHistoryTests.cs](../../Kavita.Services.Tests/ScrobbleRuleHistoryTests.cs), [ScrobbleRuleServiceTests.cs](../../Kavita.Services.Tests/ScrobbleRuleServiceTests.cs), [ScrobblingServiceTests.cs](../../Kavita.Services.Tests/ScrobblingServiceTests.cs), [SeriesServiceTests.cs](../../Kavita.Services.Tests/SeriesServiceTests.cs), [SettingsServiceTests.cs](../../Kavita.Services.Tests/SettingsServiceTests.cs), [SignalR/ActivityTrackerTests.cs](../../Kavita.Services.Tests/SignalR/ActivityTrackerTests.cs), [SignalR/EventHubTests.cs](../../Kavita.Services.Tests/SignalR/EventHubTests.cs), [SignalR/ProgressThrottleTests.cs](../../Kavita.Services.Tests/SignalR/ProgressThrottleTests.cs), [SiteThemeServiceTests.cs](../../Kavita.Services.Tests/SiteThemeServiceTests.cs), [SmartCollectionSyncServiceTests.cs](../../Kavita.Services.Tests/SmartCollectionSyncServiceTests.cs), [TachiyomiServiceTests.cs](../../Kavita.Services.Tests/TachiyomiServiceTests.cs), [TaskSchedulerFolderScanTests.cs](../../Kavita.Services.Tests/TaskSchedulerFolderScanTests.cs), [TaskSchedulerRetimeTests.cs](../../Kavita.Services.Tests/TaskSchedulerRetimeTests.cs), [TokenServiceTests.cs](../../Kavita.Services.Tests/TokenServiceTests.cs), [VersionUpdaterServiceTests.cs](../../Kavita.Services.Tests/VersionUpdaterServiceTests.cs), [WordCountAnalysisTests.cs](../../Kavita.Services.Tests/WordCountAnalysisTests.cs).

## Build, distribuição e utilitários

- .github/workflows/build-and-test.yml: testes backend em Windows/Linux, excluindo Category=Integration.
- .github/workflows/build-ui.yml: Node 24, instalação com legacy-peer-deps e build prod.
- .github/workflows/codeql.yml e .sonarcloud.properties: análise/configuração adicional; não assumir sucesso sem execução.
- release.yml, local-release.yml e .github/workflows/release-workflow.yml: distribuição com ferramentas externas de release.
- Dockerfile e entrypoint.sh: imagem multi-arquitetura a partir de _output/*.tar.gz.
- INSTALL.txt, README.md, CONTRIBUTING.md, SECURITY.md, LICENSE e pull_request_template.md: documentação e políticas upstream.
- scripts/file_layout_dump.py: ferramenta de layout de arquivos; ler antes de executar com acervo.
- scripts/generate_readinglists.py e scripts/ReadMe.MD: ferramenta e instruções de listas de leitura.
- scripts/ScanReport/scan_report.py: relatório de scan.
- scripts/FsProbe: diagnóstico de sinais/filesystem. Existem probes ativos: conferir README e efeitos antes de usar sobre arquivos reais.
- Logo, favicon e assets: recursos visuais; evitar alterações sem necessidade da tarefa.

## Como atualizar este mapa

Use rg --files (ou inventário equivalente se rg estiver indisponível), examine novos csproj, controllers, serviços, pastas da UI e testes. Refaça contagens se necessário, mas priorize manter responsabilidades e pontos de entrada corretos. Não incluir dependências, bin/obj, segredos ou acervo pessoal no contexto.

## Adições do fork: entrega offline F1

Organização por pastas: `Kavita.Services/Scanner/FolderParser.cs`, `ParseScannedFiles`, `ScannerService` e `ProcessSeries`; persistência/DTO em `Library`, `LibraryDto` e `UpdateLibraryDto`; configuração e proteção de migração em `LibraryController`. Testes em `FolderOrganizationScanTests`, `Parsers/FolderParserTests`, `LibraryOrganizationTests` e `FolderOrganizationMigrationTests`. A opção web fica em `folder-organization-setting.component`, com testes Angular/Vitest e alvo `npm test` integrado à CI.

Migração do catálogo existente: [migrate_folder_catalog.py](../../scripts/offline/migrate_folder_catalog.py) e [testes SQLite/CLI](../../scripts/offline/test_migrate_folder_catalog.py), executados também no workflow offline. Proteção temporária de clientes: `Kavita.Server/Middleware/FolderCatalogMaintenanceMiddleware.cs`, registrado em `Startup`, e `FolderCatalogMaintenanceTests`. Leia [o registro do principal](../validation/PASTAS_PRINCIPAL.md) antes de operar esses componentes.

- [deployment/offline](../../deployment/offline/README.md): Compose e exemplo de ambiente para o servidor isolado.
- [scripts/offline/prepare.mjs](../../scripts/offline/prepare.mjs): EPUB sintético, configuração e baseline sem sobrescrita.
- [scripts/offline/library-manifest.mjs](../../scripts/offline/library-manifest.mjs): captura/comparação SHA-256 de arquivos.
- [scripts/offline/verify-readonly.mjs](../../scripts/offline/verify-readonly.mjs): inspeção das montagens e prova ativa somente na amostra sintética.
- scripts/offline/*.test.mjs: testes Node de configuração, geração, preservação e verificações.
- [.github/workflows/offline-server.yml](../../.github/workflows/offline-server.yml): validação local e smoke test descartável com Docker.
- [docs/validation/F1.md](../validation/F1.md): evidências e aceites pendentes.
