# Plano de robustez e melhorias (Kavita + Kover)

Data: 2026-10-19. Base:
- **Kavita:** branch `fork/v1.0`, imagem `kavita-folders-yac:20261019-r12` em uso, com o modo "Livro" aceito no PC.
- **Kover:** branch `fork/v1.0`, árvore limpa, cinco commits sobre o upstream (`a654cdc`).

Este plano cobre os dois projetos e o tablet. Ele reúne:
- uma auditoria somente leitura dos dois repositórios;
- as pendências já registradas nos documentos de validação;
- o que esta sessão mostrou na prática, com o laço de progresso, o disco cheio e o pagefile.

O histórico da v1.0 e do modo "Livro" fica em [MELHORIAS.md](MELHORIAS.md). As ideias de experiência daquele documento (seções 1 a 4) continuam valendo e entram aqui na Fase 6.

## Andamento

Atualizado em 2026-10-20. Cada item foi feito com TDD; a evidência é o commit e a suíte indicada.

| Item | Situação | Onde |
| --- | --- | --- |
| 0.1 | Feito: modo "Livro" commitado, tag `fork-v1.1` | Kavita `c05402e`…`35046be` |
| 0.2 | Feito: `build-fork-image.ps1` exige árvore limpa e grava o SHA no label | Kavita `3951477` |
| 0.3 | Feito e validado em 2026-10-20: tarefa registrada pelo usuário; a primeira execução gerou 276 MB com `integrity_check` ok e hash conferido. Restauração num volume novo: mesmas contas (2), progresso (19), coleções (24) e capas de pasta (5) do principal, 940 capas, e servidor descartável em `127.0.0.1` saudável. Volume e container do teste apagados. Repetir a restauração todo mês | Kavita `3c6a08a`; testes de retenção (7) e de backup/restauração (10) |
| 0.4, 5.1 | Feito: `deploy-fork.ps1` com checkpoint sem cache, health, volta automática e 2 checkpoints. **Falta o primeiro uso no principal** | Kavita `3951477`; 17 testes de deploy |
| 5.2 | Feito: a imagem só contém o publish do fork | `Dockerfile.fork` |
| 0.6 | Feito: guia de implantação sem o rollback inexistente | `deployment/offline/README.md` |
| 1.1, 1.2 | Feito: progresso pendente só sai depois de aceito, e só como foi enviado | Kover `ec6ac14` |
| 1.3, 1.4 | Feito: troca de conta e limpar banco protegem o pendente | Kover `757579a` |
| 1.5 | Feito: fase `pendingProgress` sem dependência do catálogo | Kover `f23cea4` |
| 1.6 | Feito: a leitura mais recente vence (servidor) e hora em UTC (Kover) | Kavita `1e3f299`; Kover `e8eb9d4` |
| 1.7 | Feito: uma gravação a cada 300 ms por usuário e capítulo | Kavita `528fbc3` |
| 1.8 | Feito: leitor web grava depois de 500 ms na página | Kavita `c3c31ba` |
| 2.x | Feito no Kover: novas tentativas, cancelamento sem regravar, falha visível, selos por estado, checagem de espaço e serviço em primeiro plano. Aceite no S6 Lite em 2026-10-20: selos na tela inicial; download concluído com o app em segundo plano e o serviço parando sozinho; pedido da permissão de notificação e notificação publicada; remover a cópia manteve o "Continuar lendo" | Kover `8760436`, `59e4298`, `d2f5924`, `9a05513`, `e05612f`, `4a7ea0e`; 397 testes |
| 3.2 | Feito: "Configurações" mostra a versão com o `git describe` do build (`tool/build_apk.ps1`). No S6 Lite: `v1.0.0 (1) · edcddfc` | Kover `edcddfc`; 399 testes |
| 4.1–4.3 | Feito: pasta ou arquivo renomeado e biblioteca montada em outro caminho mantêm série, capítulos, progresso e capa. Cópia ou caso ambíguo vira série nova | Kavita `0b7aeae`, `ff4d1f5` |
| 4.4 | Feito: capas de pasta acompanham a troca de raízes da biblioteca | Kavita `f219a9e` |
| 4.5 | Conferido: já tratado no código | — |
| 4.6, 4.7 | Feito: capa de pasta removida apaga o arquivo; referências deixadas por scan interrompido são reparadas | Kavita `be05b67`, `4df68e1` |
| 4.8 | Medido, sem índice: com 20 mil arquivos em 2 mil pastas, o modo por pastas acompanha o upstream e `folder-series` leva 10–16 ms. O tempo está na varredura do disco, não na busca por `FolderPath`. A medição achou o erro corrigido em `df37f33` | `FolderOrganizationScanBenchmark` (tabela abaixo) |
| 4.10 | Conferido em 2026-10-20: nenhuma das 7 séries auxiliares (IDs 55, 100, 47, 107, 70, 87 e 23) existe no banco do principal, e nenhuma série é feita só de imagens. A migração para pastas (r3) gerou o catálogo sem elas, e os checkpoints antigos que as guardavam já foram apagados. Não há o que apagar | consulta somente leitura ao banco ativo |
| 4.9 | Testado: o watcher não recebe eventos do mount do Windows, mas a data da pasta chega. Solução: scan agendado incremental a cada hora, procedimento no guia de implantação. Um arquivo novo do mesmo tamanho de outro da pasta era tomado por renomeação; corrigido | `deployment/offline/README.md`; Kavita `df37f33`; teste `Scan_NewFileInAKnownFolder_IsFoundWithoutForcing_AndKeepsTheOtherChapters` |

Medição do 4.8 (2026-10-20, container do SDK com 4 CPUs, SQLite em arquivo temporário, um contexto por série como no servidor; arquivos vazios, sem leitura de páginas):

| Biblioteca | Primeiro scan | Scan sem mudança | Um arquivo novo | `folder-series` |
| --- | --- | --- | --- | --- |
| 3 mil arquivos, por pastas | 13,9 s | 0,16 s | 0,26 s | 13 ms |
| 20 mil arquivos, por pastas | 78–89 s | 3,9–10,4 s | 7,5–12,8 s | 10–16 ms |
| 20 mil arquivos, upstream (sem pastas) | 76 s | 3,7 s | 6,8 s | 12 ms |

Com 20 mil arquivos, o scan sem mudança gasta quase todo o tempo na varredura e comparação dos arquivos, que é código do upstream. O acervo atual tem cerca de 934 arquivos. Para repetir: `KAVITA_BENCH_FOLDERS=2000` e `KAVITA_BENCH_OUT=<arquivo>` no teste `FolderOrganizationScanBenchmark`; `KAVITA_BENCH_CLASSIC=1` mede sem a organização por pastas.

Imagem no principal: `kavita-fork:fork-v1.1-5-g528fbc3e7` (até o item 1.8). Imagem gerada com a fase 4, **aguardando o deploy pelo usuário**: `kavita-fork:fork-v1.1-16-g43a4ec98b`, sem migração de banco. Suítes em 2026-10-20: serviços 3.037 aprovados (sem falhas), servidor 113/113, banco 99/99, web 78/78, Kover 399/399 e `flutter analyze` limpo.

## Como ler

- **Origem:** **[F]** é fato observado no código, na configuração ou em execução; **[H]** é hipótese a confirmar com teste antes de corrigir.
- **Severidade:**
  - **alta:** risco de perder dados pessoais (progresso, marcadores, pendências), de quebrar a proteção dos originais ou de deixar o serviço fora do ar;
  - **média:** falha visível ou custo operacional relevante;
  - **baixa:** acabamento.
- **Ordem de trabalho:** cada item vira um ciclo TDD (RED pelo comportamento → GREEN → regressões), como manda o [AGENTS.md](../../AGENTS.md). Correções começam pelo teste de regressão. Itens [H] começam por um teste que confirme ou descarte a hipótese.
- **Regras que não mudam:**
  - originais no PC somente leitura;
  - remoção de download só no tablet;
  - progresso e pendências preservados;
  - servidor apenas na LAN;
  - ensaio em clone antes de mexer no catálogo do principal.

## Os dez riscos mais urgentes

| # | Risco | Onde | Sev. |
| --- | --- | --- | --- |
| 1 | O que está rodando no servidor (modo "Livro", r6 a r12) não está commitado; a imagem não é reproduzível | Kavita | alta |
| 2 | Não há backup automático nem cópia fora do disco do servidor | Kavita | alta |
| 3 | O tablet descarta o progresso offline quando o servidor responde erro | Kover | alta |
| 4 | Trocar de conta no tablet envia o progresso pendente de uma pessoa com a chave de outra | Kover | alta |
| 5 | Um conflito de catálogo trava toda a sincronização do tablet, sem tela para resolver | Kover | alta |
| 6 | Download que falha some da fila sem aviso; um servidor fora do ar esvazia a fila inteira | Kover | alta |
| 7 | Remover um download em andamento pode regravar páginas e baixar de novo | Kover | alta |
| 8 | Série de formatos misturados pode aparecer como "baixada" sem estar | Kover | alta |
| 9 | Renomear ou mover uma pasta no PC cria outra série e perde progresso e capa | Kavita | alta |
| 10 | Uma falha no cliente produz uma tempestade de gravações de progresso, sem limite no servidor (houve cerca de 8.400 em 20 minutos) | Kavita | alta |

## Fase 0: fechar o que está em produção

Antes de qualquer melhoria nova, o servidor precisa ser reproduzível e recuperável.

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| 0.1 | [F] O modo "Livro", o código incorporado em `UI/Web/src/app/_vendor/page-flip` e as traduções estão fora do Git. O HEAD é `7f6b7fb29` e a r12 foi construída da árvore suja. | Commits atômicos, como na v1.0. Tag `fork-v1.1` na revisão implantada. | `git status` limpo; a imagem reconstruída da tag tem os mesmos arquivos web da r12. |
| 0.2 | [F] As imagens não registram o commit do fork; os labels são do upstream (`image.version: latest`). | Build só com árvore limpa, label `org.opencontainers.image.revision` com o SHA do fork, tag `fork-<versão>-<sha curto>`. | `docker inspect` mostra o SHA; o build recusa árvore suja. |
| 0.3 | [F] Não há backup automático. Os checkpoints são manuais e ficam no mesmo disco; o backup nativo do Kavita fica dentro do volume. | Tarefa agendada no Windows que copia `kavita.db` (cerca de 2,6 MB) e `covers` (cerca de 340 MB) de forma consistente (backup do SQLite, não uma cópia do arquivo aberto) para uma pasta do PC fora do Docker e do repositório (decisão 1), com retenção (7 diários e 4 semanais). | A restauração num volume descartável abre o servidor com contas, progresso e capas iguais. O teste se repete a cada mês. |
| 0.4 | [F] Cada deploy copia o volume inteiro, cerca de 2,2 GB, dos quais 2 GB são `cache/` descartável. O r7 falhou com o disco cheio. | Checkpoint e `tar.gz` sem `cache/` e `temp/`. Manter só os 2 últimos checkpoints (decisão 5), com a remoção dos mais antigos mostrada antes de executar. | Um deploy custa menos de 400 MB; a restauração do checkpoint funciona sem o cache. |
| 0.5 | [F] A CI não roda na branch do fork. `release-workflow.yml` publicaria com os segredos do upstream se houvesse push para `develop`. | Gatilho em push para `fork/**`: testes .NET, Vitest, lint dos arquivos do fork e build da imagem. Desativar o release do upstream no fork. | Um push na branch produz testes verdes e uma imagem com o SHA. |
| 0.6 | [F] Os documentos apontam para um rollback que não existe mais: o volume r2 e a imagem `20261019` foram removidos na limpeza. `AGENTS.md`, `deployment/offline/README.md` e `PASTAS_PRINCIPAL.md` ainda os citam. | Atualizar o estado operacional: imagem atual, volume ativo `…-r3`, checkpoints existentes e como voltar. | Os documentos batem com `docker ps` e `docker volume ls`. |
| 0.7 | [F] Bancos de teste, `.env` e arquivos da configuração ficam em `_temp/offline-f1` (cerca de 21 GB), no mesmo disco do servidor e sem política de retenção. | Inventário do `_temp`: apagar o que não tem uso, com autorização; mover backups com valor para o destino do item 0.3. | `_temp` só com ferramentas e artefatos em uso. |

## Fase 1: proteger os dados pessoais (tablet e servidor)

| ID | Problema e evidência | Proposta | Aceite (testes RED primeiro) |
| --- | --- | --- | --- |
| 1.1 | [F] `sendProgress` (`kover/lib/sync/reader_sync_operations.dart`) não confere a resposta; o Chopper não lança exceção em erro, e `mergeProgress` (`reader_repository.dart`) limpa as pendências logo depois. Um 400 (capítulo inacessível) ou 5xx descarta o progresso offline. | Só limpar a pendência quando a resposta for 2xx. Erro permanente (400 ou 404) vai para uma lista de "progresso não aceito", visível ao usuário. Erro temporário mantém a pendência. | Testes com cliente falso que responde 400, 500 e sem rede: a pendência continua. Com 200, é limpa. |
| 1.2 | [F] `clearDirtyFlags` limpa todos os IDs lidos no início, mesmo que tenham sido gravados de novo durante o sync. | Limpar só quando o `lastModified` local for igual ao que foi enviado. | Teste de corrida: uma gravação durante o sync sobrevive. |
| 1.3 | [F] Trocar a credencial (`credentials.dart`) dispara um `fullSync` sem verificar pendências; o usuário atual persistido ainda é o anterior. | Bloquear a troca de conta com pendências, ou enviá-las antes com a credencial antiga. A médio prazo, separar o banco por (servidor, usuário). | Teste: com pendências de A, trocar para B não envia nada com a chave de B. |
| 1.4 | [F] "Limpar banco" em Configurações apaga também as pendências. | Avisar e exigir confirmação quando houver pendências; oferecer sincronizar antes. | Teste de widget e de DAO. |
| 1.5 | [F] Um capítulo protegido que sumiu no servidor gera `StateError` na reconciliação (`series_repository.dart`, `series_dao.dart`); como a fila é limpa no erro, o progresso nunca mais sobe. | Sincronizar o progresso pendente **antes** da reconciliação e independente dela. Conflito de catálogo vira estado visível ("Catálogo com conflito"), com detalhes e sem bloquear o resto. | Teste: com um conflito, o progresso de outra série ainda sobe. |
| 1.6 | [F] Conflitos entre aparelhos usam a última escrita, comparando o relógio do tablet com o `lastModifiedUtc` do servidor. [H] Com o relógio do tablet errado, vence o lado errado sem aviso. | Vence a data mais recente (decisão 2): o cliente envia a hora da leitura, o servidor compara com a gravada e limita horários no futuro; o descarte fica registrado. | Testes com relógio adiantado e atrasado. |
| 1.7 | [F] No servidor, `reader/progress` não tem limite: a regressão do modo "Livro" gerou cerca de 8.400 gravações em 20 minutos. | Limite por usuário e capítulo em `reader/progress`, por exemplo uma gravação por segundo, com 429; gravação idêntica e repetida não vira escrita nova. | Teste de API: rajada de 100 chamadas grava no máximo uma por janela, e o último valor vale. |
| 1.8 | [F] No leitor web, `setPageNum` grava o progresso a cada mudança, sem debounce. | Debounce de cerca de 500 ms e deduplicação, mantendo a gravação imediata ao fechar o leitor e ao trocar de capítulo. | Teste de componente ou de serviço: 20 mudanças rápidas, uma gravação. |
| 1.9 | [F] `allowBackup="false"` no Kover: desinstalar perde as pendências. | Exportar e importar o progresso pendente em JSON, só dados pessoais. | Teste de ida e volta da exportação. |

## Fase 2: downloads confiáveis no tablet

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| 2.1 | [F] Em `download_manager.dart`, o `finally` tira o capítulo da fila também quando houve erro, e o próximo começa. [F] A verificação de conexão só refaz o ping a cada 5 minutos. | Estado persistido "falhou", com motivo, e retry com backoff exponencial. Erro de rede invalida o ping e pausa a fila. | Teste: servidor fora do ar pausa a fila e não a esvazia; a fila volta quando ele volta. |
| 2.2 | [F] `.timeout(..., onTimeout: token.cancel)` em `download_worker.dart` termina como sucesso. | Timeout lança erro e o capítulo fica "falhou". Conferir o cancelamento também antes de gravar. | Teste: timeout não marca como pronto. |
| 2.3 | [F] `deleteChapter` não cancela a tarefa ativa nem tira o capítulo da fila; o `chunkedFetch` grava sem conferir cancelamento. | Remover = cancelar, aguardar o término e apagar, numa única operação. O capítulo removido sai da fila e não volta sozinho. | Teste de corrida: remover no meio do download não deixa páginas nem baixa de novo. |
| 2.4 | [F] O agregado de série e volume (`download_dao.dart`) mistura páginas e capítulos quando há formatos diferentes, e o volume pega o formato de um capítulo qualquer. | Agregar por capítulo com `isChapterDownloaded`: série pronta = todos os capítulos prontos. | Teste: CBZ completo e PDF ausente na mesma série ≠ pronta. |
| 2.5 | [F/H] "Pronto" é decidido só pela contagem de páginas; não há hash, tamanho nem versão. [H] Se o arquivo mudar no PC, a cópia antiga continua "pronta". | Guardar páginas esperadas, tamanho e data do arquivo no momento do download; invalidar (sem apagar) quando o servidor informar mudança. | Teste com metadados alterados. |
| 2.6 | [F] Download parcial aparece como "baixando" para sempre e não pode ser removido no capítulo. | Estado "parcial" com ações de retomar e remover. | Teste de widget. |
| 2.7 | [F] Não há checagem de espaço; downloads e progresso dividem o mesmo SQLite; `VACUUM` após limpeza exige espaço temporário do tamanho do banco. | Estimar o tamanho antes de baixar (o servidor sabe o tamanho do arquivo) e recusar com aviso. `auto_vacuum=incremental`. A médio prazo, PDF e CBZ em arquivos e o banco só com metadados. | Teste com espaço insuficiente simulado: nada é gravado e o progresso continua gravável. |
| 2.8 | [F] O download só roda com o app aberto. | Serviço em primeiro plano com notificação (padrão do Android para downloads longos), para "Baixar pasta". | Aceite no S6 Lite com a tela desligada. |

## Fase 3: app do tablet de verdade

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| 3.1 | [F] O "Kover Local" é um build **debug**: Flutter em JIT (mais lento e mais memória), app depurável e assinado com a chave de debug da máquina. Atualizar de outra máquina exige reinstalar e perde as pendências. | Build release ou profile com sufixo próprio e keystore do fork guardada fora do Git (com backup). Documentar a instalação por USB. | APK release instalado por cima do debug, sem perder dados (testar antes num aparelho descartável); a leitura fica visivelmente mais fluida. |
| 3.2 | [F] `version: 1.0.0+1` fixo e sem tags; não dá para saber qual commit está no tablet. | Versão derivada da tag do fork e SHA em "Sobre". | A tela "Sobre" mostra o SHA da tag. |
| 3.3 | [F] O cliente OpenAPI é da 0.9.1 e não conhece `folder-series`, `folder-covers` e `folder-cover`; erros dessas chamadas manuais são só registrados. | Regenerar a partir do `openapi.json` do fork. Erro de API vira estado visível. | Sem chamadas manuais; teste de contrato com o JSON do servidor. |
| 3.4 | [F] A CI do Kover herdada do upstream roda em qualquer push com matriz grande; os workflows de deploy dependem de segredos que o fork não tem. | CI enxuta do fork: análise, testes, `make-migrations` e build do APK release, sem segredos do upstream. | Push verde gera o APK como artefato. |

## Fase 4: identidade do acervo no servidor

O modelo por pastas usa o caminho físico como identidade (decisão de 2026-10-18). O plano protege essa decisão contra mudanças comuns no PC, sem trocá-la.

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| 4.1 | [F] A identidade é o caminho absoluto no container (`FolderParser.FolderKey`, `ScannerService`). [H] Renomear ou mover uma pasta cria outra série e a antiga some no scan, levando progresso, marcadores e capa da pasta. | Antes de remover a série antiga, procurar uma série nova com os mesmos arquivos (nome, tamanho e hash parcial) e **migrar** IDs e estado pessoal. Sem correspondência segura, recusar a remoção quando houver estado pessoal. | Ensaio em clone: renomear uma pasta mantém IDs, progresso e capa; o Kover não vê conflito. |
| 4.2 | [F] O capítulo é encontrado pelo caminho do arquivo. [H] Renomear um arquivo perde o progresso. | A mesma correspondência por conteúdo, no nível do arquivo. | Teste de scan com arquivo renomeado. |
| 4.3 | [F] O caminho absoluto inclui o destino da montagem (`/libraries/...`). [H] Mudar a montagem equivale a reindexar tudo. | Chave relativa à raiz da biblioteca, com migração testada em clone. Até lá, documentar como proibido. | Teste: trocar o destino da montagem não muda IDs. |
| 4.4 | [F] Com mais de uma raiz, o caminho relativo ganha prefixo. [H] Capas de pasta ficam órfãs ao adicionar uma segunda raiz. | Migrar as chaves das capas junto, ou usar sempre o prefixo. | Teste com segunda raiz. |
| 4.5 | [F] `SingleOrDefault` na busca por pasta e por arquivo. [H] Catálogo legado com duplicata lança exceção e trava aquela pasta. | Detectar a duplicata, registrá-la e seguir com as outras pastas. Relatório em Admin. | Teste com duplicata semeada. |
| 4.6 | [F] Ajustes de `VolumeId` no progresso rodam depois do commit (`ProcessSeries`). | Mesma transação, ou reparo idempotente no início do scan seguinte. | Teste com falha injetada entre as etapas. |
| 4.7 | [F] Capa de pasta removida deixa o arquivo `fldr*` em disco; arquivo ausente responde 500 em vez de 404. | Limpeza junto com a remoção; 404 quando o arquivo faltar. | Testes de API. |
| 4.8 | [F] Sem índice em `Series.FolderPath`; `folder-series` devolve a biblioteca inteira; a busca de capítulo é O(arquivos × capítulos). Para cerca de 934 arquivos não pesa; não foi medido para dezenas de milhares. | Índice com migração; medir com uma biblioteca sintética de 20 mil arquivos antes de otimizar. | Tempo de scan e de `folder-series` registrado. |
| 4.9 | [H] O watcher de pastas pode não receber eventos de bind mount do Windows no Docker Desktop. | Testar. Se não funcionar, scan agendado incremental e botão "Procurar arquivos novos" documentado. | Arquivo novo aparece sem intervenção manual, ou com o procedimento documentado. |
| 4.10 | [F] 7 séries auxiliares (registros de imagens de capa do YACReader, sem obra) ficam numa biblioteca de arquivo só do Admin (`validation/ORGANIZACAO_ACERVO.md`, `PASTAS_PRINCIPAL.md`). | Apagar só os registros, conforme a decisão 4, depois do 0.3: ensaio no clone, conferindo que nenhum progresso, marcador, coleção ou lista aponta para elas. | No principal, as 7 séries saem; arquivos no PC, contagens das bibliotecas de leitura e progresso iguais aos de antes. |

## Fase 5: operação do servidor

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| 5.1 | [F] Um script por versão (`apply-main-r1` a `r12`), sem esperar o health e com rollback manual. | Um único `deploy.ps1 -Image <tag>`: verifica espaço (já feito no r7), faz checkpoint sem cache, sobe com `up -d --wait`, confere `/api/health` e, se falhar, **volta sozinho** ao override anterior. | Ensaio com uma imagem quebrada de propósito: o script volta para a anterior. |
| 5.2 | [F] O `Dockerfile.fork` sobrepõe a imagem 0.9.1 sem limpá-la; só `wwwroot` é apagado, e sobram binários antigos. [H] Uma DLL que saiu do publish pode continuar sendo carregada. | Diretório limpo antes de copiar, ou base runtime própria. | A imagem não contém arquivos fora do publish do fork. |
| 5.3 | [H] Depois de reiniciar o PC: o Docker Desktop só sobe após o login; se o Wi-Fi ainda não tiver o IP, a publicação em `192.168.1.113` falha; se o DHCP mudar o IP, o bind e o firewall quebram. Nunca testado (aceite da F5). | Reserva de DHCP no roteador; Docker Desktop iniciando com o Windows; tarefa no logon que confere o health e reinicia o container se necessário. | Teste real de reinício: o tablet sincroniza sem ninguém mexer no PC. |
| 5.4 | [F] Sem alerta para um container unhealthy. | Notificação do Windows a partir da tarefa do item 5.3. | Ensaio com o health falhando. |
| 5.5 | [F] HTTP sem TLS na LAN; a web passa `apiKey=` na URL das imagens e o Kover manda `x-api-key` em texto puro. | HTTPS na LAN, conforme a decisão 3: proxy com TLS, autoridade local, certificado embutido no Kover e `apiKey` fora das URLs. | Web e Kover só por HTTPS; HTTP e certificado errado recusados. |
| 5.6 | [F] Pagefile do Windows sem teto chegou a 96 GB durante o laço do leitor. | Orientação aplicada: mínimo 16 GB e máximo 32 GB (fora do repositório). | Registro no guia operacional. |
| 5.7 | [F] O fork mexe em pontos centrais do scanner; não há roteiro de atualização a partir do upstream. | Roteiro: fetch do upstream, rebase em branch de ensaio, suíte completa, ensaio em clone do principal, comparação de IDs e progresso. | Primeira atualização feita pelo roteiro. |
| 5.8 | [F] Logs cresceram 34 MB em 3 dias por causa da tempestade de progresso. | Monitorar `logs/` na tarefa do item 5.3; o item 1.7 reduz a origem. | Tamanho estável numa semana de uso. |

## Fase 6: experiência

### Tablet (Kover)

| ID | Situação no código | Proposta |
| --- | --- | --- |
| 6.1 | [F] Selos: o ícone atual usa "download" para o que já está baixado; não há estado "só no servidor", contagem nem selo nas pastas. | Nuvem com check, ícone de download, contagem "3/8" e anel de progresso, nos cards de pasta, série, volume e capítulo ([MELHORIAS.md](MELHORIAS.md), 2a). Depende dos itens 2.4 e 2.6. |
| 6.2 | [F] Não existe aba "Offline". | Aba organizada só por pastas, multibiblioteca ([MELHORIAS.md](MELHORIAS.md), 2b). |
| 6.3 | [F] Não existe "Baixar pasta"; `downloadCovers` vem desligado. | Baixar pasta com estimativa de espaço (item 2.7) e capas da árvore pré-baixadas. |
| 6.4 | [F] Não há animação de virada. | Ver a seção "Virada de página em todos os formatos" abaixo (V5 a V10). |
| 6.5 | [F] Direção de leitura global; a web tem "Duplo invertido" por perfil. | Direção e layout por biblioteca ou série, alinhados aos perfis de leitura do servidor. |
| 6.6 | [F] Página única decodifica a imagem em resolução cheia (`horizontal_paged_reader.dart`, sem `cacheWidth`); o PDF inteiro fica em memória. | `cacheWidth` pela largura da tela (como já faz o modo duplo); PDF lido a partir de arquivo. Medir no S6 Lite com o perfil do Flutter. |
| 6.7 | [F] Não há progresso por pasta nem trilha de volta para a pasta. | [MELHORIAS.md](MELHORIAS.md), 3 e 4. |

### Web (PC)

| ID | Situação | Proposta |
| --- | --- | --- |
| 6.8 | [F] Arrastar o canto da página não vira, porque a camada de paginação do leitor fica por cima. | Desligar essa camada no modo "Livro" e deixar o livro tratar clique e arraste, mantendo o teclado. |
| 6.9 | [F] Os renderizadores antigos continuam montados e escondidos. [H] Baixam imagens além da janela do livro. | Medir as requisições no Chrome; se confirmado, separar o cálculo de paginação dos componentes visuais. |
| 6.10 | [F] Virar a última página com o mouse não abre o próximo capítulo. | Tratar o fim do livro como a seta do teclado. |
| 6.11 | [F] Progresso por pasta e trilha de volta. | [MELHORIAS.md](MELHORIAS.md), 3 e 4. |

## Virada de página em todos os formatos (PC e tablet)

Pedido do usuário: o modo "Livro" que funciona hoje nas imagens do PC também no PDF, e uma virada de página semelhante no tablet, em todos os formatos.

### O que o modo "Livro" do PC já resolve (r5 a r12)

Esta é a referência de comportamento que o PDF e o tablet devem repetir. Cada linha tem testes no Kavita (`UI/Web/src/app/manga-reader/_components/book-renderer`):
1. **Layouts do leitor:** uma página, duplo (capa sozinha), duplo invertido (mangá: a página menor do par à direita) e duplo sem capa (pares desde a primeira página); leitura da direita para a esquerda.
2. **Páginas largas (spread num arquivo só):** ocupam o livro aberto, uma metade de cada lado, com página em branco quando a metade esquerda cairia à direita. No modo de uma página, o livro abre em duas no spread e fecha depois.
3. **Total ímpar em leitura da direita para a esquerda:** página em branco no fim da leitura, para os pares baterem com os do leitor.
4. **Proporção real das páginas** (mediana das páginas comuns), para a imagem ocupar a altura da tela.
5. **Sincronização pela página visível:**
   - o livro não vira para uma página que já está na tela;
   - só informa uma virada quando a página do leitor sai da tela, pela primeira do par na ordem de leitura;
   - ignora os próprios eventos durante a montagem e durante a abertura ou o fechamento do livro.

   Isso evitou os laços que travaram o Chrome e geraram cerca de 8.400 gravações de progresso.
6. **Imagens carregadas só perto da página atual** (±3).
7. **Ciclo de vida:** o livro é refeito a cada capítulo e destruído sem deixar laço de animação nem listener.

### PC

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| V1 | [F] PDF abre no leitor de PDF do Kavita (`pdf-reader`, por `readerFor` em `_helpers/reader-format.ts`), que não tem o modo "Livro". [F] O servidor já sabe gerar as páginas do PDF como imagens (`BookService.ExtractPdfImages`, usado pelo cache do leitor de imagens). | Com o modo "Livro" ligado, o PDF abre no leitor de imagens, e todas as regras acima valem sem código novo de virada. O leitor de PDF continua sendo o padrão quando o modo está desligado (texto selecionável, busca e zoom vetorial). Um botão de livro no leitor de PDF leva ao leitor de imagens na mesma página. | Testes de roteamento (PDF + modo ligado → leitor de imagens, na página salva). No Chrome com um PDF real: viradas, páginas duplas, proporção, progresso igual ao do leitor de PDF. |
| V2 | [H] A qualidade e o tempo da imagem gerada pelo servidor para o PDF não foram medidos; as dimensões de página (`pageDimensions`) podem não vir para PDF. | Medir com PDFs do acervo no clone: resolução, tempo da primeira página e uso do cache. Se a qualidade for ruim, a alternativa é o V3. | Registro das medidas; as páginas largas e a proporção funcionam com PDF. |
| V3 | Alternativa ao V1, se o V2 reprovar. | O livro dentro do leitor de PDF, com o pdf.js desenhando cada página em imagem na resolução da tela, só perto da página atual. | As mesmas regras 1 a 7, com os testes do `book-renderer` reaproveitados. |
| V4 | [F] O EPUB no PC usa o leitor de livros do Kavita, com paginação em colunas HTML. | Mais tarde: a virada sobre uma captura da coluna atual e da próxima. Fica depois do PDF e do tablet. | — |

### Tablet

O tablet repete as mesmas regras, adaptadas ao toque e à tela, e funciona offline com as cópias baixadas.

| ID | Problema e evidência | Proposta | Aceite |
| --- | --- | --- | --- |
| V5 | [F] O Kover não tem virada de página animada; os leitores usam `PageView` (imagens e EPUB) e o `PdfViewer` contínuo do pdfrx. | Um componente de livro único no Kover, que recebe imagens de páginas e não sabe de que formato elas vieram. Os leitores só fornecem as imagens. | — |
| V6 | Para o tablet e o PC se comportarem igual, as regras 1 a 5 não podem divergir. | Portar `bookLayout`, `viewAt`, `typicalPageRatio` e `bookShape` para Dart e criar **casos de teste compartilhados**: um arquivo JSON gerado a partir dos testes do Kavita (layout, direção, total, páginas largas → posições, pares e página informada), lido pelos testes do Kover. | O mesmo JSON passa nos dois projetos; mudar uma regra exige atualizar os dois. |
| V7 | Escolha do motor de animação. | O spike do [MELHORIAS.md](MELHORIAS.md), seção 1 (`flip_page`, `book_page_flip` ou desenho próprio), com critérios extras: no S6 Lite, a folha segue o dedo e permite desistir no meio, 60 fps, e virar com toque nas laterais e com as teclas de volume. | Medidas registradas; motor escolhido. |
| V8 | Imagens (CBZ, CBR e pastas de imagens): primeiro alvo. | Regras 1 a 7 com as páginas baixadas. Retrato = uma página; paisagem = duas, conforme o layout da série. Decodificar na resolução da tela (item 6.6). | Testes de widget com imagens sintéticas (layouts, spread, RTL, total ímpar, sincronização sem laço); aceite no S6 Lite em modo avião. |
| V9 | PDF. | O pdfrx desenha uma página por vez em imagem, a partir do arquivo baixado (não o PDF inteiro em memória, item 6.6), e entrega ao mesmo componente. | Os mesmos testes do V8 com um PDF sintético; aceite com um PDF real. |
| V10 | EPUB. | Cada subpágina já medida (`epub_horizontal_subpages.dart`) vira imagem na hora da virada; a paginação e o progresso continuam os atuais. | Testes de widget; aceite com um EPUB ilustrado e um só de texto. |
| V11 | Progresso no tablet. | A virada usa a mesma regra de sincronização (5) e o debounce do item 1.8. Gravação imediata ao sair do leitor. | Teste: virar rápido 20 vezes gera uma gravação e a página certa. |
| V12 | Opções. | "Virada de página": Nenhuma, Deslizar (atual) ou Livro. "Reduzir animações" força Nenhuma. A escolha fica no aparelho. | Teste de configuração. |

## Fase 7: testes e qualidade

| ID | Lacuna | Proposta |
| --- | --- | --- |
| 7.1 | [F] O leitor web não tem spec; os laços do modo "Livro" só apareceram no Chrome real. | Teste end-to-end repetível com o método desta sessão: servidor descartável (imagem do fork em `127.0.0.1`, biblioteca sintética somente leitura, conta de teste), Chrome via CDP ou Playwright, sem tocar no principal. Cenários: abrir no progresso salvo, páginas duplas nos três layouts e "Página sem resposta" (a página precisa responder em menos de 1 s depois de cada tecla). |
| 7.2 | [F] Kover sem testes em `DownloadManager`, `DownloadRepository`, remoção preservando pendências, `mergeProgress` (erro HTTP, corrida, relógio), troca de credencial e agregados de formatos. | Esses testes entram como RED dos itens das Fases 1 e 2. |
| 7.3 | [F] Servidor sem testes para renomear/mover, montagem alterada, segunda raiz e arquivo de capa ausente. | RED dos itens da Fase 4. |
| 7.4 | [F] Lint completo da web com erros herdados; só os arquivos do fork são verificados. | Manter "arquivos do fork sem apontamentos" na CI; não corrigir o legado fora do escopo. |
| 7.5 | [F] `.gitattributes` só cobre `*.sh`, e aparecem avisos LF/CRLF. | Normalizar as extensões do fork. |

## Aceites ainda pendentes

Itens antigos que continuam abertos:
- **CBZ e EPUB no tablet:** download, leitura offline, remoção e sincronização. O PDF já foi aceito.
- **Duas contas no mesmo tablet e a mesma conta em dois tablets,** conferindo que o progresso não se mistura. Fazer depois da Fase 1.
- **F2 a F5 do [plano offline](KAVITA_KOVER_OFFLINE.md):** restauração verificada, atualização e reinício.
- **[F1](../validation/F1.md):** fechar a checklist ou remeter aos registros novos.
- **EPUB derivado do MOBI:** EPUBCheck e leitura no tablet.
- **Kover da Play Store:** abre série mista no leitor errado. Documentar ou detectar o servidor do fork.
- **Documentação:** trocar títulos do acervo por nomes genéricos nos registros versionados.

## Decisões do usuário (2026-10-19)

1. **Backup automático (0.3): numa pasta do próprio PC,** fora do Docker e fora do repositório (por exemplo `C:\KavitaBackups`), com a retenção e o teste de restauração do item 0.3.
   - Limite assumido: o backup protege contra erro de operação, banco corrompido e volume apagado, mas não contra falha do disco. Uma segunda cópia em outro disco fica como melhoria futura (F1 abaixo).
2. **Conflito entre aparelhos (1.6): vence o progresso com a data mais recente.** Para a regra valer de verdade:
   - [F] hoje o servidor ignora o horário enviado pelo cliente e grava a hora em que recebe. Uma leitura offline antiga, enviada depois, venceria uma leitura mais nova feita no PC;
   - o cliente passa a enviar a hora da leitura (UTC) e o servidor só aceita se ela for mais nova que a gravada;
   - horário no futuro além de uma tolerância (por exemplo 5 minutos) é limitado à hora do servidor, para um relógio errado não "congelar" o progresso;
   - o tablet deve usar a hora automática da rede, o que entra no checklist de instalação;
   - testes: leitura offline antiga não sobrescreve a nova; relógio adiantado não trava; empate mantém o servidor.
3. **HTTPS na LAN (5.5): sim.** Desenho proposto, a validar num ensaio descartável antes do principal:
   - proxy reverso com TLS (por exemplo Caddy) no mesmo Compose, publicado só no IP da LAN, e o Kavita deixa de publicar a porta HTTP;
   - certificado emitido por uma autoridade local própria para o IP `192.168.1.113`, com a chave guardada fora do Git e no backup;
   - no PC, a autoridade instalada no repositório de certificados do Windows;
   - no tablet, [H] o `dart:io` do Kover não confia em autoridades instaladas pelo usuário no Android, então o certificado da autoridade vai **dentro do app** (o fork já é nosso), sem desligar a verificação;
   - a chave `apiKey` some das URLs da web (header ou cookie), para não aparecer em logs;
   - aceite: web e Kover funcionando só por HTTPS, HTTP recusado, certificado errado recusado.
4. **Séries auxiliares (4.10): apagar os registros (opção b), autorizado pelo usuário.** A execução só acontece depois do backup automático (0.3) funcionando e testado, com ensaio no clone e a conferência descrita abaixo. Os arquivos no PC não são tocados.
   - O que são: 7 registros do catálogo antigo, criados quando o Kavita leu pastas de capas e imagens auxiliares do YACReader como "séries" (108 imagens, nenhuma obra).
   - Onde estão: depois da migração por pastas, numa biblioteca de arquivo que só o Admin vê. A conta leitora e o tablet não as veem. Os arquivos no PC não foram tocados.
   - Opções:
     - **(a) manter:** risco zero e custo desprezível no banco;
     - **(b) apagar os registros** (só do banco, com os arquivos no PC intactos), depois do backup automático (0.3) estar funcionando, ensaiando antes no clone e conferindo que nenhum progresso, marcador ou coleção aponta para elas.
   - Escolha: (b), depois do 0.3. Os "7 casos estruturais" eram do modelo antigo e ficam encerrados, porque a organização por pastas os substituiu.
5. **Checkpoints (0.4): manter 2,** sem `cache/` e `temp/`.

## Ordem sugerida

1. **Agora:** Fase 0 completa (commits e tag, backup automático, checkpoints sem cache, CI e documentos corretos).
2. **Antes de usar o tablet para valer:** Fase 1 (dados pessoais) e itens 2.1 a 2.4 (downloads honestos), seguidos dos aceites de CBZ, EPUB e duas contas.
3. **Depois:** Fase 3 (app release), que melhora o desempenho no S6 Lite e permite atualizar sem reinstalar, junto com o HTTPS (5.5), porque o certificado da autoridade local vai dentro do APK release.
4. **No PC, quando quiser:** V1 e V2 (modo "Livro" no PDF), que reaproveitam o que já funciona e podem andar em paralelo com os itens anteriores. O teste end-to-end (7.1) vem junto, para não repetir os travamentos no Chrome.
5. **Em seguida:** itens 6.1 a 6.3 (selos, aba "Offline", baixar pasta), já sobre downloads confiáveis.
6. **Virada no tablet:** V5 a V12, nesta ordem: regras compartilhadas (V6), motor (V7), imagens (V8), PDF (V9), EPUB (V10).
7. **Em paralelo e sem pressa:** Fase 4 (identidade do acervo), sempre com ensaio em clone; Fase 5 a partir do script único de deploy; apagar as séries auxiliares (4.10) depois do backup.
8. **Por último:** o acabamento da web (6.8 a 6.11) e o EPUB no PC (V4).

## Melhorias futuras

São ideias, não compromissos: entram depois das Fases 0 a 3 e cada uma passa pelo mesmo TDD. Esforço: P (dias), M (semanas), G (mais que isso).

### Proteção e operação

| ID | Ideia | Valor | Esforço |
| --- | --- | --- | --- |
| F1 | Segunda cópia do backup em outro disco ou HD externo, cifrada, para sobreviver a uma falha do disco do PC. | Alto | P |
| F2 | Rodar o Kavita sem depender do login no Windows (serviço ou máquina sempre ligada), com Wake-on-LAN pelo tablet. | Médio | M |
| F3 | Painel de saúde no Admin: espaço em disco, último backup, último scan, tamanho dos logs, versão e SHA da imagem. | Médio | M |
| F4 | Relatório de integridade do acervo: arquivos que não abrem, CBZ corrompido e pastas duplicadas, sempre só leitura. | Médio | M |
| F5 | Atualização periódica a partir do upstream do Kavita e do Kover pelo roteiro do item 5.7, por exemplo a cada trimestre. | Médio | Contínuo |

### Tablet

| ID | Ideia | Valor | Esforço |
| --- | --- | --- | --- |
| F6 | Downloads inteligentes: baixar o próximo volume ao chegar perto do fim e liberar, com confirmação, os volumes já lidos; limite de espaço configurável. | Alto | M |
| F7 | Instalação de um tablet novo em minutos: QR code no Admin com endereço, certificado e chave de uma conta; checklist (hora automática, bateria sem restrição para o app). | Alto | M |
| F8 | Versões otimizadas para o tablet: o servidor gera páginas na resolução da tela (por exemplo WebP), reduzindo espaço e memória. Os originais continuam intocados. | Alto | G |
| F9 | Busca offline na árvore e nas séries baixadas. | Médio | P |
| F10 | Marcadores, anotações e "quero ler" sincronizados com a mesma regra de "data mais recente" do progresso. | Médio | M |
| F11 | Modos de leitura para telas e olhos: noturno, sépia e brilho por série, e preferências de layout por série vindas do servidor (item 6.5). | Médio | P |
| F12 | Estatísticas de leitura no tablet, offline, a partir do progresso local. | Baixo | M |

### Web e servidor

| ID | Ideia | Valor | Esforço |
| --- | --- | --- | --- |
| F13 | Opções do modo "Livro": velocidade da virada, sombra durante a virada, atalho de teclado para ligar e desligar e lembrar a escolha por série. | Médio | P |
| F14 | Detecção de páginas duplas divididas em dois arquivos (como num mangá com a arte contínua entre as páginas 3 e 4), sugerindo o layout duplo certo. | Médio | M |
| F15 | Ajustes por pasta sem tocar nos originais: arquivo opcional de configuração da pasta, guardado no servidor, com direção de leitura, layout e capa. | Médio | M |
| F16 | OPDS na LAN (o Kavita já tem um `OPDSController`) para usar outros leitores no tablet, depois do HTTPS. | Baixo | P |
| F17 | Contas da família com restrição por biblioteca ou idade, aproveitando o controle de acesso que já existe. | Baixo | P |

### Qualidade

| ID | Ideia | Valor | Esforço |
| --- | --- | --- | --- |
| F18 | Teste end-to-end também no tablet (`integration_test`), com servidor descartável: baixar, ler sem rede, remover e sincronizar. | Alto | M |
| F19 | Carga sintética: biblioteca de 20 mil arquivos e 5 aparelhos simulados, medindo scan, `folder-series` e sincronização. | Médio | M |
