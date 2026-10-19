# Modelo YACReader por pastas — implementação e ensaio (2026-10-19)

Plano: [P1.1 + P2](../plans/ORGANIZACAO_ACERVO.md). Implementado com testes, ensaiado num clone descartável e numa instalação Android separada e, depois do aceite, **aplicado ao principal** (seção ao final).

## O que mudou

| Área | Mudança |
| --- | --- |
| Parser (`FolderParser`) | Marcador de volume → volume; marcador de capítulo (`c0383`, `Cap. 5`, `Capítulo 12`, intervalos) → seção Capítulos; número no fim do último trecho ` - ` → volume; o resto → especial. Regras próprias do modo pastas, independentes do tipo da biblioteca. |
| Identidade da série | No modo pastas, a série é só a pasta. O formato saiu da chave (`Series.MatchesParsedSeries`, `ScannerService`, `ParseScannedFiles`, `GetFullSeriesByFolderAsync`). `Series.Format` passa a indicar o formato predominante. |
| Proteção | Se o catálogo ainda tiver várias séries antigas na mesma pasta, o scan não as apaga (`RemoveSeriesNotInListAsync`) e recusa a pasta até a migração. |
| Capítulo que muda de volume | Mantém o ID. Marcadores, itens de lista de leitura e atividades são religados ao volume novo antes de o antigo ser apagado. Progresso, sumário e anotações recebem o `VolumeId` novo depois da gravação. Antes disso, o marcador era apagado em cascata e o progresso ficava com `VolumeId` órfão. |
| Leitor por item | `ChapterInfo`/`BookInfo.seriesFormat` informam o formato do arquivo do capítulo. Os leitores web de imagens, livro e PDF redirecionam quando o formato muda. No Kover, `ReaderState.format` usa o formato do capítulo. |
| Árvore de pastas | `GET api/library/folder-series?libraryId=` (`[LibraryAccess]`, restrição de idade, só caminhos relativos). Web: página `library/:id/folders` e botão "Pastas". Kover: tabela `series_folders` (schema 15), sincronizada após as séries, e tela "Pastas" que lê só o banco local e funciona sem rede. |
| Migração | `scripts/offline/merge_folder_series.py`: junta, numa cópia nova, as séries da mesma pasta. Capítulos e arquivos mantêm IDs, dados pessoais seguem a série sobrevivente, e a ferramenta recusa referências desconhecidas. |

## Testes executados

| Suíte | Resultado |
| --- | --- |
| `FolderParserTests` (RED 12 → GREEN) | 29/29 |
| `FolderOrganizationScanTests` (inclui reclassificação, série única por pasta, proteção contra exclusão) | 10/10; proteção desativada temporariamente reproduz a exclusão da série |
| Regressões de scanner, parsers, leitura e livros | 450/450 |
| Banco (`SeriesRepository`, `VolumeRepository`, `FolderOrganization`, `Progress`, `ChapterReaderFormatTests`, `FolderSeriesTests`) | 27/27 + 1 + 3 |
| API (`EndpointAccessTests`, `LibraryOrganizationTests`, `FolderCatalogMaintenanceTests`) | 11/11 |
| Web (Vitest: `reader-format`, `folder-tree`, `folder-browser`) | 16/16; lint sem problemas novos; build de produção OK |
| Kover (`flutter test`, inclui migração 14→15, DAO, repositório, widget e formato do leitor) | 332/332; `flutter analyze` sem apontamentos |
| Scripts offline (Python) | 18/18 (5 novos da fusão) |

## Ensaio no clone

Medição numa cópia somente leitura do principal: apenas Livros tinha pastas com mais de uma série (4 pastas). Em Quadrinhos, 145 de 152 arquivos eram especiais.

Clone `kavita-yac-rehearsal-20261019` com imagem `kavita-folders-yac:20261019`, bibliotecas montadas somente leitura, porta `127.0.0.1:5083`:

1. Fusão: 4 grupos, nenhuma duplicidade descartada.
2. Scan forçado das três bibliotecas:
   - 934 arquivos com o **mesmo capítulo e a mesma série**;
   - 105 mudaram de volume pela reclassificação;
   - 1 arquivo novo indexado;
   - nenhuma pasta com duas séries;
   - Livros com 10 séries, em vez de 14.
3. Banco depois do scan:
   - 8 de 8 progressos com capítulo e páginas iguais, e `VolumeId`/`SeriesId` coerentes com o capítulo;
   - 14 de 14 atividades coerentes;
   - Quadrinhos com 96 volumes e 56 especiais; Mangas com 738 volumes; 4 arquivos na seção Capítulos.
4. Segundo scan incremental: nenhum arquivo mudou de série, volume ou capítulo.

As chaves de acesso do ensaio foram criadas **apenas no clone** e ficam em `_temp/` (fora do Git).

## Aceite no S6 Lite (contra o clone)

App de teste separado `com.rodonisi.kover.yac` ("KoverTeste"). O Kover Local e a versão da Play Store não foram tocados. A conta leitora sem Admin usou uma chave criada só no clone, e o acesso ao servidor foi apenas por `adb reverse`.

| Item | Resultado |
| --- | --- |
| Login e sincronização | 124 séries, 935 capítulos e 124 caminhos de pasta no banco local |
| Árvore sem servidor | "Pastas de Quadrinhos" com contagem por pasta. Subpastas (Blueberry → Edição Definitiva / Mister Blueberry) e trilha de navegação funcionam. Livros mostra as raízes `books` e `derived-books`. |
| Série mista | `Tecnologia/Robert C. Martin - Clean Code` é uma série com 3 especiais (EPUB EN, PDF EN, PDF PT-BR). O EPUB (capítulo 1032) abriu no leitor EPUB e o PDF (1042) no leitor de PDF, embora a série seja marcada como PDF. |
| Offline | Download dos 3 itens, servidor cortado e app reiniciado; navegação pela árvore e leitura do EPUB e do PDF funcionaram. |
| Remoção local | Downloads zerados. Capítulos, pastas e progresso pendente preservados. Ao reconectar, o progresso foi enviado sem novo download. |
| Progresso | Página 4 do PDF chegou ao servidor com `VolumeId`/`SeriesId` coerentes. |

Ao final, o `adb reverse` foi removido, o clone foi parado (volume preservado) e os arquivos das chaves descartáveis foram apagados. Capas de pastas ainda não baixadas aparecem como espaço reservado quando não há conexão.

## Aplicação no principal (2026-10-19, autorizada pelo usuário)

O usuário executou `_temp/offline-f1/yac/apply-main.ps1`, porque a revisão automática de permissões bloqueou a execução pelo agente. O script:
1. validou o Compose candidato (imagem, volume, bind no IP privado da LAN e 4 montagens somente leitura);
2. parou o Kavita;
3. copiou o volume ativo r2 para o checkpoint `kavita-folders-main-checkpoint-20261019-yac`, para o arquivo `config-before.tar.gz` (SHA-256 `0B6561EF…403C9B`) e para o novo volume ativo `kavita-folders-main-active-20261019-r3`;
4. fundiu 4 grupos de Livros;
5. ativou a pausa de Auth Keys;
6. subiu `kavita-folders-yac:20261019`.

O volume r2 ficou intacto para rollback (restaurar `_temp/offline-f1/yac/main/compose.libraries.before.yaml` sobre o override e subir de novo).

| Verificação | Resultado |
| --- | --- |
| Scan forçado (Mangas, Livros, Quadrinhos) | 934 arquivos com o mesmo capítulo e a mesma série; 105 reclassificados de volume; 1 arquivo novo; nenhuma pasta com duas séries; séries 50/10/64 |
| Banco | `integrity_check` ok; 8 de 8 progressos iguais; progresso, atividade e marcadores sem volume ou série inconsistentes |
| Chave admin temporária | Removida pela API e o arquivo local apagado; nenhuma chave `yac*` restante |
| Kover Local | Atualizado por `adb install -r` (APK SHA-256 `AD5EC5B3…551680`), sem progresso pendente nem downloads antes da troca. Banco local migrou para a v15 e sincronizou 124 séries, 935 capítulos e 124 pastas com o principal. O app de teste `.yac` foi desinstalado. |
| Pausa | Reativado o acesso por Auth Key (`ApiKeyMaintenance=false`, arquivo idêntico ao anterior) e reiniciado o Kavita: saudável |

## Ajustes pedidos depois da aplicação (2026-10-19)

1. **Sem o botão "Abrir itens desta pasta".** Uma pasta só com arquivos (sem subpastas) abre direto a série a partir do card. Se a pasta tiver arquivos e subpastas, os arquivos aparecem como mais um card, "Itens desta pasta", na grade. Um link direto para uma pasta só com arquivos redireciona para a série.
2. **Pastas como padrão.**
   - Web: preferência do usuário `BrowseLibrariesByFolder`, ligada por padrão. A migração `20261019183213_BrowseLibrariesByFolder` grava `true` também para usuários existentes. O campo é opcional no `update-preferences`, então clientes que não o enviam mantêm o valor. Um guard na rota da biblioteca leva às pastas, e o botão "Todas as séries" (`?view=series`) abre a grade.
   - Kover: opção "Abrir bibliotecas por pastas" em Configurações, ligada por padrão, inclusive para configurações salvas antes; a tela de pastas ganhou o botão "Todas as séries".

Testes: migração (RED com `false` → GREEN), `BrowseByFolderPreferenceTests` 3/3, API 99/99, banco 96/96, web 20/20 e build de produção, Kover 335/335 e análise sem apontamentos.

Implantação:
- Kover Local atualizado no tablet (APK SHA-256 `32F56FC9…0D51F8`).
- Imagem `kavita-folders-yac:20261019-r2` construída. A troca no principal é feita por `_temp/offline-f1/yac/apply-main-r2.ps1`, executado pelo usuário: checkpoint `kavita-folders-main-checkpoint-20261019-yac-r2`, `.tar` e override anterior guardados.

## Capas de pasta (2026-10-19)

- **Servidor:** tabela `FolderCover` (migração `20261019191116_FolderCovers`; única por biblioteca e caminho; apagada com a biblioteca). Endpoints:
  - `POST upload/folder-cover` (Admin): só aceita pastas que existem na árvore do catálogo; sem imagem, volta à capa da primeira série;
  - `GET library/folder-covers` e `GET image/folder-cover`, ambos com `[LibraryAccess]`; o caminho é procurado no banco, nunca no disco.
  - O arquivo se chama `fldr{biblioteca}-{sha256}`, fora dos padrões que a limpeza automática de capas apaga.
- **Web:** menu "⋮" em cada card de pasta para Admin, com "Editar capa" (abre o seletor de imagem) e "Remover capa" (quando há capa própria). Sem capa própria, continua a capa da primeira série.
- **Kover:** tabela `folder_covers` (schema 16), sincronizada depois das pastas; baixa só capas novas ou alteradas e remove as apagadas; 404 ou erro mantém as guardadas. A tela de pastas usa a capa guardada também sem rede. A edição fica na web.

Testes:
- servidor: nome do arquivo 5/5, upload 8/8, repositório 2/2, API 107/107, banco 98/98;
- web: 23/23 e build de produção;
- Kover: 353/353 e análise sem apontamentos.

Implantação:
- Kover Local atualizado no tablet (APK SHA-256 `C9B2C664…91B566`).
- Imagem `kavita-folders-yac:20261019-r3`; a troca no principal é feita por `_temp/offline-f1/yac/apply-main-r3.ps1`, executado pelo usuário, com checkpoint e `.tar` antes.

## Ajustes de 2026-10-19 (tarde)

- **MOBI substituído, por pedido do usuário.** O EPUB derivado foi copiado para `books/Literatura`, com SHA-256 `c9a89c2c…e7cf02` conferido, e o MOBI original foi para a Lixeira do Windows (recuperável). O usuário removeu `/libraries/derived-books` da biblioteca Livros e escaneou: Livros tem uma só origem, e Literatura tem os 4 livros. O volume `kavita-derived-books` foi preservado como cópia.
- **Bug: lista de pastas presa ao trocar de biblioteca.** A rota `library/:id/folders` reaproveita o componente, e a lista só era carregada no `ngOnInit`. Agora pastas e capas acompanham o `libraryId` da rota, e cada resposta traz a biblioteca a que pertence, para que uma resposta atrasada não mostre pastas de outra biblioteca nem dispare redirecionamento. Teste de página: RED reproduzindo o bug → GREEN; web 25/25 e build. Imagem `kavita-folders-yac:20261019-r4`, aplicada por `_temp/offline-f1/yac/apply-main-r4.ps1`. O Kover não tem o problema: cada biblioteca abre uma tela nova.

## Pendente

- O Kover da Play Store não conhece séries mistas nem a árvore. Se for aberto, pode abrir um item de série mista no leitor errado. Use o Kover Local.
- Indicador de percentual baixado de uma série mista é aproximado (conta por capítulo ou por página conforme o formato predominante).
