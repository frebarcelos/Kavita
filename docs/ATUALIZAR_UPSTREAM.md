# Atualizar o fork a partir do upstream

Roteiro do item 5.7 do [plano de robustez](plans/ROBUSTEZ_E_MELHORIAS.md). Vale para o Kavita (`Kareadita/Kavita`) e para o Kover (`rodonisi/kover`).

O fork mexe no scanner, na identidade das séries e no progresso. Uma atualização sem ensaio pode trocar IDs e deixar o tablet em conflito. Siga as etapas na ordem e pare na primeira que falhar.

Em 2026-10-20 nenhum dos dois upstreams tinha commits novos depois da base do fork. O Kavita estava 40 commits à frente de `upstream/develop`, e o Kover 19 à frente de `upstream/main`.

## 1. Ver o que mudou

```powershell
git fetch upstream --tags
$base = git merge-base HEAD upstream/develop     # no Kover: upstream/main
git log --oneline "$base..upstream/develop"
# Arquivos alterados dos dois lados: onde haverá conflito
git diff --name-only "$base..HEAD" > fork.txt; git diff --name-only "$base..upstream/develop" > up.txt
Compare-Object (Get-Content fork.txt) (Get-Content up.txt) -IncludeEqual -ExcludeDifferent
```

Leia as notas de versão do upstream. Procure migrações de banco, mudanças no scanner e mudanças em DTOs consumidos pelo Kover.

## 2. Juntar numa branch de ensaio

```powershell
git switch -c ensaio/upstream-<versão> fork/v1.0
git merge upstream/develop
```

Use **merge**, não rebase: a branch do fork já foi usada em imagens e no tablet, e o histórico precisa continuar rastreável pelo SHA gravado na imagem.

Pontos quentes do Kavita, onde o fork tem mais código:

| Área | Arquivos | O que preservar |
| --- | --- | --- |
| Scanner por pastas | `Kavita.Services/Scanner/ProcessSeries.cs`, `ParseScannedFiles.cs`, `FolderParser.cs`, `ScannerService.cs` | Pasta = série; renomeação e movimentação mantêm IDs; reparo de referências após o scan |
| Repositórios | `SeriesRepository.cs`, `VolumeRepository.cs`, `LibraryRepository.cs` | `folder-series`, capas de pasta, `RebaseFolderCoversAsync` |
| API | `LibraryController.cs`, `UploadController.cs`, `ReaderController.cs`, `Helpers/ProgressWriteThrottle.cs`, `Middleware/FolderCatalogMaintenanceMiddleware.cs` | Contratos usados pelo Kover; limite de gravação de progresso |
| Progresso | `ReaderService.SaveReadingProgress` | A leitura mais recente vence |
| Web | `manga-reader/`, `book-renderer/`, `library-folders/`, `_vendor/page-flip` | Modo "Livro", debounce de progresso, árvore de pastas |

**Migrações.** As do fork são `20261018204036_FolderBasedOrganization`, `20261019183213_BrowseLibrariesByFolder` e `20261019191116_FolderCovers`, já aplicadas no principal. Não as renomeie nem as reordene. Em conflito no `DataContextModelSnapshot.cs`, junte os dois lados e confira que o modelo bate com as migrações:

```powershell
dotnet ef migrations has-pending-model-changes --project Kavita.Database --startup-project Kavita.Server
```

Se acusar diferença, crie uma migração nova do fork. Nunca edite uma migração já aplicada.

## 3. Suítes completas

Rode as mesmas suítes da entrega normal, todas verdes:

- serviços, servidor e banco no container do SDK (`_temp/offline-f1/yac/run.ps1`);
- web (`npm test` em `UI/Web`);
- `deployment/offline/tests/*.ps1`.

No Kover:

- `build_runner`, `flutter gen-l10n`, `make-migrations` sem diferença, `flutter analyze` e `flutter test`;
- regenere `swaggers/openapi.json` a partir do servidor novo (item 3.3): o teste de contrato `test/api/fork_api_contract_test.dart` precisa passar.

## 4. Ensaio num clone do principal

1. Gere a imagem pelo worktree limpo ([guia de implantação](../deployment/offline/README.md)).
2. Copie o volume ativo para um volume de ensaio. O backup diário em `C:\KavitaBackups` serve de fonte.
3. Suba o clone em `127.0.0.1`, com a biblioteca **somente leitura**.
4. Antes e depois de um scan **incremental** (não forçado), registre:
   - séries, volumes, capítulos e arquivos por biblioteca;
   - para cada arquivo, o `ChapterId` e o `SeriesId`;
   - o progresso por usuário e capítulo (`AppUserProgresses`) e as coleções.
5. Compare. Nenhum ID de série ou capítulo pode mudar, e nenhum progresso pode sumir. Qualquer diferença bloqueia a atualização até ser explicada.
6. Opcional: aponte o Kover Local para o clone com `adb reverse` e confira uma sincronização sem conflito.

## 5. Implantar

```powershell
./deployment/offline/deploy-fork.ps1 -Image kavita-fork:<versão>
```

O script tira checkpoint, espera a saúde e volta sozinho se a imagem nova falhar. Depois de aprovado, junte a branch de ensaio em `fork/v1.0`. Atualize o `docs/ai` se algum contrato ou decisão mudou.

## Kover

- Versão do schema do Drift: uma migração nova do upstream precisa vir depois das do fork. Confira `make-migrations` e os testes de migração.
- Instale o APK novo por cima do Kover Local (`adb install -r`) e confira em Configurações o `git describe` do build (item 3.2).
- Antes de instalar, sincronize o progresso pendente do tablet.
