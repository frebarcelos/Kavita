# Contexto do Kover e integração Android

Inspeção inicial em 2026-10-17, atualizada em 2026-10-18. Fork: https://github.com/frebarcelos/kover ; upstream: https://github.com/rodonisi/kover . Pasta irmã ../kover, branch main, HEAD a654cdc37d0571322d70f8357d53b94feb19705b. Este documento orienta o plano integrado. O fork Kover também recebeu AGENTS.md com TDD, proteção dos dados locais e referências para este contexto; a regra que ignorava esse arquivo foi retirada do .gitignore.

Estado em 2026-10-20: branch `fork/v1.0`, release do Kover Local instalado no S6 Lite e servidor por HTTPS. O que mudou no app e o que falta estão em [STATUS.md](STATUS.md). Novidades do fork no app:

- proteção do progresso pendente;
- downloads com novas tentativas, falha visível, checagem de espaço e serviço em segundo plano;
- selos de download em pastas, séries, volumes e capítulos;
- aba "Offline", filtro "Só baixados" e "Baixar pasta";
- confiança na autoridade HTTPS local;
- cliente da API gerado do fork;
- versão com o `git describe`.

## Stack e organização

.fvmrc fixa Flutter 3.47.7; pubspec.yaml requer Dart ^3.13.0. O código usa Riverpod/Hooks para estado e DI, Drift/SQLite para persistência, Freezed e codegen, Chopper/Swagger para API, secure storage para credenciais e Workmanager para execução em background. Confira as versões novamente antes do build.

| Área no Kover | Responsabilidade |
| --- | --- |
| lib/main.dart | Entrada do aplicativo |
| lib/pages e lib/widgets | Telas e componentes; leitores EPUB, imagem e PDF |
| lib/riverpod/providers | Estado, autenticação, configurações e clientes |
| lib/riverpod/managers | Download/sync engine, workers e filas |
| lib/riverpod/repository | Acesso a dados e coordenação com banco/sync |
| lib/database | Schema Drift, tabelas, DAOs e migrações |
| lib/sync | Wrappers de chamadas HTTP, mapeamento de DTO e background |
| lib/models e lib/mapping | Modelos do app e conversão de contratos |
| lib/utils | Leitura, layout, gestos, cancelamento, logs e utilitários |
| lib/l10n | Localização; seguir CONTRIBUTING.md para strings e Weblate |
| swaggers | Fontes de geração da API |
| drift_schemas e test/drift | Snapshots e testes de migração do banco |
| test e integration_test | Testes unitários/widgets/banco e integração de screenshots |
| android e demais pastas de plataforma | Embalagem nativa; foco deste uso é Android |
| tools e .github/workflows | Geração, dependências auxiliares e CI/release |

Arquitetura declarada em CONTRIBUTING.md: UI → Providers/Managers → Repositories → Database/SyncOperations → API. Use providers gerados para DI e os clientes gerados para HTTP; não editar código gerado manualmente.

## Comportamentos observados no código

- AppDatabase em lib/database/app_database.dart usa nome kover_db, schema 14 e diretório de suporte do app. Downloads não são necessariamente arquivos soltos: DownloadedPages guarda blobs com chave (chapterId, page).
- DownloadRepository.downloadChapter busca metadados remotamente, baixa páginas faltantes e persiste blobs. PDF é tratado como um payload; EPUB como conteúdo de páginas serializado com fontes guardadas separadamente; imagem/archive usa páginas de imagem. Não pressupor que o Kover use DownloadController.chapter para todo offline.
- DownloadRepository.deleteChapter/deleteVolume/deleteSeries delegam ao DownloadDao. Nesses métodos inspecionados, o DAO remove apenas registros de DownloadedPages do banco local, sem chamada HTTP ou remoção de ReadingProgress. Isto é evidência do caminho de repositório/DAO, ainda não valida todos os acionadores da UI ou concorrência.
- DownloadManager.deleteChapter chama o repositório diretamente; deleteVolume/deleteSeries também passam por _clearIds. Verificar cancelamento de capítulo em download antes de assumir que a remoção é estável.
- ReadingProgress é uma tabela distinta, com chapterId como chave, pagesRead, bookScrollId, lastModified e dirty. ReaderRepository.saveProgress grava localmente com dirty=true e tenta sincronizar; mergeProgress reenvia pendências. O sistema existente usa marcação dirty; não é necessário introduzir uma outbox separada sem demonstrar necessidade.
- clearDownloads remove blobs; clearDb remove também progresso e catálogo local. Não usar clearDb para implementar remoção de download ou troca segura de perfil com progresso offline pendente.
- DELETE SQL não implica que o tamanho do arquivo SQLite no Android diminua imediatamente. Há vacuum e ReclaimSpace em lib/riverpod/repository/database.dart; medir espaço recuperado e tratar falhas/custos de VACUUM antes de prometer liberação física instantânea.
- CredentialsState guarda um URL/apiKey ativo sob uma chave persistida credentials. CurrentUser é persistido e atualizado pela API de plugins. O fluxo mantém usuário conhecido durante certas falhas de rede; testar boot offline após reiniciar app/dispositivo.

## Contas e vários tablets

Requisito do usuário: começar no Samsung Galaxy Tab S6 Lite e depois usar vários tablets Android, todos com o mesmo acervo no PC. Contas são locais do servidor doméstico, sem exigir conta externa; servem para separar o estado de leitura das pessoas.

Modelo proposto: um usuário Kavita por pessoa, todos autorizados às mesmas bibliotecas. A mesma pessoa pode usar a mesma conta em vários tablets e compartilhar progresso. Downloads continuam pertencendo ao dispositivo: apagar no tablet A nunca apaga no B nem no PC.

A inspeção encontrou um banco de nome fixo e tabelas de progresso/download com IDs de capítulo, sem userId/serverId nessas tabelas. Isso não comprova suporte seguro a múltiplos perfis persistidos no mesmo app. Na primeira entrega usar uma conta ativa por instalação e testar usuários separados em instalações/dispositivos diferentes.

Para alternar perfis no mesmo tablet, planejar isolamento por (servidor, usuário), via banco separado ou chaves compostas, mantendo credenciais seguras e suspendendo workers do perfil anterior. Nunca enviar dirty progress da pessoa A autenticado como B. Preservar pendências offline, posição e downloads de cada perfil. Reutilizar o mesmo payload entre perfis só com verificação de autorização e referência compartilhada segura; não é requisito inicial.

Registrar downloads centralmente no PC é opcional e ainda não implementado/validado: se desejado, usar registros por usuário + dispositivo + obra, com lastSeen/estado conhecido. Um tablet offline pode estar desatualizado. Esse inventário não deve controlar exclusão remota nem propagar remoção entre aparelhos.

## TDD e comandos para a próxima etapa

Atualização em 2026-10-19: o usuário informou que a instalação é do Google Play e autorizou descartar os dados locais de teste. O caminho atual é uma instalação independente **Kover Local**, pacote debug `com.rodonisi.kover.local`, com catálogo limpo. Não é necessário migrar os payloads antigos desta instalação para liberar seu uso. Essa decisão não autoriza perder estado pessoal no servidor nem remover originais. A proteção continua recusando capítulos com conteúdo incompatível em instalações com dados a preservar.

A nova regressão passou com **92 testes**, incluindo reparentamento, pais omitidos de especiais/avulsos, configurações opcionais negadas ao leitor e interrupção da fila após falha. A análise passou sem problemas. O APK foi instalado no SM-P613/Android 14: PDF abriu após reinício offline, remoção local preservou o progresso e a reconexão o sincronizou no clone sem refazer o download. Após autorização explícita, Auth Keys foram reativadas no principal e o Kover Local foi conectado com catálogo limpo. No fechamento: três bibliotecas, 127 agrupamentos e 934 capítulos; Century uma vez com 22 itens. Consulte [Kover Local](../validation/KOVER_LOCAL.md) para artefato, evidências e limites. As notas de 2026-10-18 abaixo são históricas.

Atualização em 2026-10-18: Flutter 3.47.7/Dart 3.13.5 foram preparados, o codegen funcionou e 70 testes de DAOs/repositórios passaram. O fork agora protege dados locais quando séries desaparecem do catálogo. A reconciliação pode transferir referências mantendo IDs de volumes/capítulos; dados incompletos, mudança de biblioteca ou estado pessoal sem destino abortam a transação. Nenhum payload, progresso pendente ou bookmark deve sumir silenciosamente durante a organização por pastas. Ainda não foi gerado nem instalado um APK com essas alterações.

Arquivos alterados: `lib/database/dao/series_dao.dart`, `lib/riverpod/repository/series_repository.dart` e testes de reconciliação/repositório. O servidor não deve migrar o catálogo real contando com essa proteção antes de atualizar e validar o aplicativo no tablet.

O usuário posteriormente priorizou a organização no principal, que foi aplicada para uso web. Essa implantação **não depende da proteção ainda não instalada no tablet**: as chamadas por `x-api-key` estão pausadas no servidor por `FolderCatalogMaintenanceMiddleware`, com HTTP 503 `folder-catalog-client-update-required`. Veja o [registro operacional](../validation/PASTAS_PRINCIPAL.md). A reconciliação preparada também precisa considerar os 16 capítulos que antes juntavam arquivos; não liberar a sincronização apenas porque os testes anteriores passaram. Preservar/exportar estado offline existente, validar atualização/assinatura do APK e pendências antes de remover a pausa. Não limpar dados ou reinstalar o Kover antigo como solução.

No Windows desta sessão, pub get resolveu as dependências, mas a criação de symlinks exigiu Developer Mode. Não foi alterada a configuração do sistema: após resolver dependências e gerar código, testes e análise usaram --no-pub. Isso não demonstra que o ambiente Android está pronto para compilar APK.

Do diretório Kover, seguindo CONTRIBUTING.md e .github/workflows/ci.yaml:

~~~powershell
fvm use
fvm flutter pub get
fvm dart run build_runner build --delete-conflicting-outputs
fvm flutter gen-l10n
fvm flutter test test/database/dao/download_dao_test.dart
fvm flutter test test/riverpod/repository/reader_repository_test.dart
fvm flutter test
fvm flutter analyze
fvm dart format --output=none --set-exit-if-changed .
fvm flutter build apk --debug
~~~

Os comandos descrevem o fluxo completo. Nesta implementação, dependências/codegen, os 70 testes de DAOs/repositórios e a análise dos quatro arquivos de código/testes alterados foram executados; build e instalação de APK permanecem pendentes. Gerar código pode atualizar arquivos: revisar diff e não sobrescrever trabalho existente. A CI também valida schema com drift_dev make-migrations; mudanças de banco devem incluir migrações e testes. Conferir SDK Android/JDK e dispositivo com flutter doctor/devices antes de instalar APK.

## Build e instalação atuais (desde 2026-10-20)

Use `..\kover\tool\build_apk.ps1`, não o `flutter build` direto. O script:

- grava o `git describe` do build, que aparece em Configurações;
- embute a raiz HTTPS do servidor de casa, se existir `C:\KavitaBackups\https\root.crt` (item 5.5);
- no `-Mode release` (ou `profile`), assina com `C:\KavitaBackups\kover-keystore`, uma cópia da chave debug (SHA-256 `9c8f74f3…`), com sufixo `.local`.

```powershell
..\kover\tool\build_apk.ps1 -Mode release
adb install -r ..\kover\build\app\outputs\flutter-apk\app-release.apk
```

O release instala por cima do debug e mantém downloads, progresso e credenciais. É AOT: abre em cerca de 6 s no S6 Lite, contra 15 a 20 s do debug, e não é depurável (`run-as` deixa de funcionar).

Desde 2026-10-20 o tablet usa `https://192.168.1.113:5443`. Perder a pasta da chave impede atualizar sem reinstalar: guarde uma cópia fora do PC.

Cobertura encontrada: DAOs (incluindo download_dao_test), migrações Drift, repositórios de leitura/fontes/bookmarks/séries, autenticação, settings, leitores e utilitários. Não confundir integration_test/screenshots_test.dart com prova do ciclo offline completo.

Prioridades para novos testes: remoção preserva dirty progress e não faz HTTP destrutivo; download concorrente não recria payload; sync reconhece só a revisão enviada; troca de conta não mistura dados; dois tablets da mesma pessoa sincronizam posição sem compartilhar descarte de downloads.
