# Arquitetura e contexto do projeto

## Finalidade do fork

Servidor pessoal de leitura baseado no Kavita, com acervo no PC e Kover no tablet. A experiência desejada é navegar conectado, baixar uma cópia, ler sem rede, manter progresso e remover só o download local após a leitura. O arquivo original continua no PC, disponível para novo download.

A preservação vale para conteúdo, nome e localização dos originais. Banco, configurações, capas, cache e progresso do servidor são dados operacionais graváveis separados do acervo. Atualizações de progresso são permitidas. Exclusão de catálogo no servidor não faz parte de remover download no tablet.

A biblioteca será unificada para todas as contas locais do Kavita. Progresso e histórico pertencem à pessoa; cada tablet mantém seus downloads. A mesma conta em dois dispositivos compartilha progresso, sem compartilhar remoção de cópias locais. Primeiro tablet: Samsung Galaxy Tab S6 Lite; dispositivos seguintes também Android. Consulte [KOVER_CONTEXT.md](KOVER_CONTEXT.md) para a inspeção do cliente.

## Stack observada

| Parte | Evidência local |
| --- | --- |
| Backend principal | C# / net10.0; global.json solicita SDK 10.0.0 com rollForward latestMajor |
| HTTP | ASP.NET Core; host em Kavita.Server, controllers e middleware |
| Persistência | EF Core + SQLite; DataContext, repositórios, UnitOfWork e migrações |
| Autenticação | Identity, JWT, Auth Keys, OIDC e políticas por papel |
| Tarefas | Hangfire; Startup configura armazenamento de jobs em memória |
| Eventos | SignalR em Kavita.Services/SignalR |
| Frontend | Angular 22, TypeScript 6, RxJS, Bootstrap/SCSS e Transloco |
| Testes backend | xUnit, NSubstitute, SQLite em memória e MockFileSystem conforme a área |
| Imagens/formatos | NetVips, Docnet, bibliotecas de arquivos compactados e VersOne.Epub |
| Distribuição | scripts YAML de release e Dockerfile que empacota artefatos já compilados |

A versão de assembly em Kavita.Common é 0.9.1.14 e o snapshot openapi.json declara essa versão. O package.json da UI ainda declara 0.7.12.1: não o use para deduzir compatibilidade do servidor. Kavita.Email mira net8.0 e está fora de Kavita.sln.

## Camadas e responsabilidades

- **Kavita.Common:** configuração, headers, erros, paginação, caminhos, hashes, ambiente e helpers compartilhados.
- **Kavita.Models:** entidades, enums, DTOs, builders, AutoMapper e estruturas do parser/scanner. Referencia Common.
- **Kavita.API:** interfaces de serviços, repositórios, banco e stores. Apesar do nome, os controllers HTTP ficam em Server. Referencia Models.
- **Kavita.Database:** DataContext, EF, consultas, repositórios, UnitOfWork, seed e migrações. Referencia API e Models.
- **Kavita.Services:** implementação de regras, leitura, scan, cache, arquivos, downloads, autenticação, metadados, integrações e jobs. Referencia API, Database e Models.
- **Kavita.Server:** executável, composição de dependências, inicialização, controllers, autenticação, middleware, Swagger, traduções e assets de runtime. Referencia as camadas de backend.
- **UI/Web:** aplicação Angular; consumidores HTTP em _services, DTOs em _models e navegação em app-routing.module.ts/_routes. É independente do aplicativo Kover.
- **Kavita.Email:** pequeno projeto de DTOs de e-mail, fora da solução principal.
- **Kavita.Benchmark:** medições BenchmarkDotNet; não confundir benchmarks com testes de correção.

O mapa detalhado está em [REPOSITORY_MAP.md](REPOSITORY_MAP.md).

## Modelo de domínio

O fork acrescenta o modo optativo `Library.FolderBasedOrganization`: pastas e nomes de arquivos são a fonte da organização. A identidade do scanner usa o caminho físico exato de `Series.FolderPath` e o formato; o nome relativo da pasta serve à apresentação. Isso distingue caminhos como `A/B` e `AB`, mesmo com títulos normalizados iguais. Contêineres têm um capítulo por arquivo, mantendo os contratos de leitura existentes. Formatos diferentes continuam em séries separadas na primeira entrega; a árvore visual é uma fase posterior. Consulte o [plano revisado](../plans/ORGANIZACAO_ACERVO.md).

O DTO de atualização aceita o flag omitido para preservar a escolha anterior. Criar/editar uma biblioteca nesse modo desativa metadados, matching externo e listas/coleções gerenciadas por metadados. A edição comum rejeita mudança de modo em bibliotecas preenchidas com HTTP 409 `library-organization-migration-required`. Isso impede tratar uma reindexação destrutiva como migração do legado.

O catálogo pessoal já foi migrado por ferramenta offline com referência de parsers reais e saída em banco novo. IDs anteriores foram retidos; pais de séries/volumes foram remapeados e registros substituídos ficaram em uma biblioteca de arquivo apenas para Admin. A implantação e os limites estão em [PASTAS_PRINCIPAL.md](../validation/PASTAS_PRINCIPAL.md). Durante a transição, `FolderCatalogMaintenanceMiddleware` pausa chamadas com `x-api-key` quando o JSON operacional define `FolderOrganization:ApiKeyMaintenance`; JWT da web continua aceito. Não assumir que variáveis de ambiente padrão são lidas: `Program` limpa os providers e adiciona JSON explicitamente.

A organização central é Library → Series → Volume → Chapter → MangaFile. Verifique as entidades e DTOs antes de assumir cardinalidade, unidade de download ou paginação. Um capítulo pode envolver mais de um arquivo; downloads de volumes/séries podem ser agregados em ZIP. O tablet deve validar o conteúdo recebido para seu leitor, não apenas confiar na extensão.

Além do catálogo há usuários, permissões e acesso a bibliotecas, progresso/histórico/sessões, perfis de leitura, anotações e bookmarks, coleções, listas de leitura, Want to Read, filtros, pessoas, gêneros, tags, avaliações, estatísticas, dispositivos e configurações. Ler/finalizar e ter um download são estados distintos.

## Fluxos principais

1. **Inicialização:** Program prepara configuração/chave JWT e executa migrações/seed; Startup registra serviços, HTTP, autenticação, Swagger, cache, SignalR e jobs. Executar o host pode modificar o banco, portanto desenvolvimento usa configuração isolada.
2. **Indexação:** LibraryWatcher e jobs acionam ScannerService; parsers identificam arquivos, ParseScannedFiles/ProcessSeries atualizam o catálogo. Há lógica de retry, deduplicação e scans incrementais. RetimeMove/DelayedScanRetime reprogramam jobs; o nome não significa alteração de timestamps dos arquivos.
3. **Navegação:** controllers consultam repositórios respeitando o usuário e retornam DTOs/paginação. UI e aplicativos externos consomem estes contratos.
4. **Leitura:** ReaderController, BookController, ImageController e serviços de leitura/cache entregam arquivos, páginas, imagens e conteúdo EPUB/PDF. Os leitores web ficam em book-reader, manga-reader e pdf-reader.
5. **Download:** DownloadController usa IDownloadService e IArchiveService; serve arquivos ou prepara ZIP em área temporária. A classe exige DownloadPolicy, que aceita Download ou Admin. As validações de autorização por conteúdo devem continuar preservadas em qualquer alteração.
6. **Progresso:** ReaderController oferece get-progress, progress e marcações de lido; ReaderService persiste dados do usuário. Eventos SignalR e sessões complementam o fluxo. Progresso offline deve sobreviver ao descarte do payload baixado.
7. **Limpeza e backup:** CleanupService, CacheService, DirectoryService e BackupService lidam com dados operacionais. Métodos genéricos de filesystem podem excluir arquivos: a raiz recebida precisa ser conferida, e o acervo deve ficar protegido por permissões de sistema.

## Contratos relevantes para o tablet

| Contrato | Onde conferir |
| --- | --- |
| Auth Key / x-api-key | Startup.cs, Middleware/AuthKeyAuthenticationHandler.cs, Common/Constants/Headers.cs |
| Acesso por papel | Models/Constants/PolicyConstants.cs e PolicyGroups.cs; configuração de Identity |
| Catálogo / capítulos | LibraryController, SeriesController, VolumeController, ChapterController |
| Arquivos offline | DownloadController: GET chapter, volume, series e endpoints de tamanho |
| Posição atual | ReaderController: GET get-progress / POST progress e DTOs/Progress |
| Concluir leitura | ReaderController: mark-chapter-read, mark-read e demais variantes |
| EPUB e páginas | BookController, ReaderController e ImageController |
| Descoberta / compatibilidade | openapi.json, Swagger do build em execução e ServerController |
| OPDS e outros clientes | OPDSController, KoreaderController, TachiyomiController |

Confira rotas completas, parâmetros e payloads no código/Swagger da versão executada. openapi.json é um snapshot versionado que pode estar desatualizado. Kover usa integração direta com a API, conforme o README upstream; não presumir que sua conexão principal depende de OPDS.

As rotas administrativas de exclusão de séries em SeriesController exigem Admin e removem entidades do catálogo via SeriesService. Elas não são uma operação de descarte offline e nunca devem ser chamadas por essa ação no tablet. A inspeção desse fluxo não comprova o comportamento de todas as exclusões do sistema.

## Integrações e limites

Há suporte a e-mail, OIDC/OAuth, OPDS, KOReader, Tachiyomi, plugins, scrobbling e serviços Kavita+. As implementações Plus e seus testes de integração dependem de serviços/credenciais externos e não são pré-requisito do fluxo básico de biblioteca pessoal. Leia os pontos de integração antes de alterar formatos/IDs.

O host de trabalho é Windows e o repositório fica no OneDrive. Para implantação, planejar dados operacionais locais em pasta dedicada; não usar um banco SQLite ativo em pasta com sincronização de arquivos. Não foi inspecionado nenhum acervo pessoal nem confirmada a instalação de Docker/Flutter ou a versão Android do tablet.
