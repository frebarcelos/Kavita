# Organização por pastas — plano revisado

Decisão do usuário em 2026-10-18: a organização física do acervo passa a ser a fonte de verdade. Não corrigir os arquivos para satisfazer metadados ou regras de nomes do Kavita. O plano anterior, preservado abaixo como histórico, deixa de orientar novos agrupamentos.

Estado: P1 implementada e P3 aplicada ao principal em 2026-10-18, antes da árvore visual. O checkpoint migrado tinha 931 arquivos e 125 agrupamentos. Em 2026-10-19, o ciclo PDF no S6 Lite passou e, após autorização explícita, as Auth Keys foram reativadas e o Kover Local foi conectado ao principal. O catálogo atual sincronizou 934 arquivos e 127 agrupamentos; Century aparece uma vez com 22 itens. [Implantação](../validation/PASTAS_PRINCIPAL.md) e [aceite Android](../validation/KOVER_LOCAL.md). P2 e os demais aceites da P4 continuam pendentes. A P1.1 (pasta uniforme) e a P2 (árvore de pastas na web e no Kover offline) foram implementadas, ensaiadas num clone e aplicadas ao principal em 2026-10-19 (etapas 1 a 8). Leia [o registro](../validation/YAC_PASTAS.md).

## Contrato desejado

- Pastas e subpastas definem os agrupamentos; arquivos mantêm os nomes existentes. Volumes na pasta de uma obra aparecem juntos, mesmo com títulos ou séries diferentes dentro de PDFs, EPUBs ou ComicInfo.xml.
- O caminho completo distingue pastas homônimas, idiomas e edições. `A/B` e `AB` não representam a mesma pasta, mesmo quando o normalizador de títulos considera os nomes iguais.
- Cada arquivo de leitura permanece selecionável; números coincidentes não podem juntar livros independentes em um único capítulo. Páginas em imagens soltas formam um capítulo por pasta. O formato continua identificando o leitor adequado.
- A organização ignora metadados embutidos e matching externo. Extrair páginas, capas e conteúdo EPUB continua permitido: são operações necessárias para ler.
- Originais permanecem somente leitura. Índice, capas e progresso ficam nos dados operacionais. A política é optativa por biblioteca e não altera bibliotecas existentes automaticamente.
- A aplicação ao catálogo legado deve preservar os IDs usados por progresso, histórico e downloads. Reindexar não é uma migração segura por si só, mesmo com scan incremental.

## Fases de entregáveis verticais

| Fase | Entrega utilizável | Aceite e validação |
| --- | --- | --- |
| P1 — Biblioteca organizada por pastas | Opção na criação da biblioteca, API e persistência; scanner usa a pasta física e ignora metadados; cada arquivo continua legível pelos contratos atuais. | RED/GREEN com metadados conflitantes, nomes diferentes, pastas homônimas, arquivos na raiz, imagens e novo scan estável; piloto isolado. Para manter os leitores atuais, séries continuam separadas por formato dentro da mesma pasta. |
| P2 — Navegação pela hierarquia | Navegar pastas e subpastas na web, escolher arquivos e retornar à pasta; agregar formatos na mesma pasta visual; autorização por biblioteca. | Testes de API e interface, caminhos inválidos/fora da raiz negados, ordenação natural e paginação. A grade existente permanece utilizável na P1. |
| P3 — Catálogo atual migrado | Aplicada ao principal após clone completo, transferência das referências e restauração testada. Web e Kover Local liberados após aceite PDF e autorização explícita para reativar Auth Keys. | Checkpoint de 931 arquivos, 8 progressos e histórico preservados; IDs anteriores retidos. O usuário autorizou descartar somente os dados de teste do tablet; migração automática de payloads antigos divididos continua recusada. |
| P4 — Mesmo fluxo no Android | Kover Local conectado ao principal; ciclo PDF de download, reinício offline, leitura, remoção local e envio de progresso validado no clone. Hierarquia visual depende da P2. | 92 testes e aceite PDF no S6 Lite concluídos. Pendentes: novo aceite CBZ/EPUB, hierarquia, dois usuários/dispositivos e mesma conta em dois tablets. |

## P1.1 + P2 — Modelo YACReader: pastas como fonte única (proposta de 2026-10-19)

Pedido do usuário: a organização deve seguir o modelo do YACReader, com a pasta virando a série e os volumes dentro dela, e com navegação pela árvore de pastas. Hoje arquivos da mesma pasta ainda podem cair em séries diferentes, e não existe navegação por pastas. As duas questões foram juntadas num único plano: a P1.1 corrige o conteúdo de cada pasta, e a P2 mostra a árvore.

Decisões do usuário em 2026-10-19:
- O fork de terceiros avaliado (klamouri/Kavita, modo "strict") foi descartado. Ele achata subpastas e depende de renomear arquivos. Não usar nada dele.
- Arquivos cujo nome traz número de volume continuam como volumes. Arquivos sem número de volume continuam como especiais, como já acontece hoje. A mensagem do usuário chegou cortada ("como j…"); a leitura "como já está" é uma suposição a confirmar.

### Diferenças observadas no código atual

| Onde | Comportamento atual | Efeito visível |
| --- | --- | --- |
| Chave da série: `Series.cs:197`, `ScannerService.cs:430`, `ProcessSeries.cs:110`, `ParseScannedFiles.cs:671` | Identidade = `(FolderKey, Format)` | Uma pasta com PDF e CBZ vira duas séries. |
| `FolderParser.cs:26-37` | `ParseVolume` lê números do nome; arquivos sem número vão para o volume especial | Volumes e Especiais dentro da mesma série. **Mantido** por decisão do usuário. |
| Ordem dos especiais | Sem regra explícita no modo pastas | A ordem dos especiais precisa seguir a ordem natural dos nomes, como na pasta. |
| Leitores: Kover `reader_page.dart:55` e web `manga-reader:1168`/`book-reader:1002` | Escolhem o leitor por `series.format` | Este é o motivo de a P1 separar os formatos; uma série mista abriria arquivos no leitor errado. |

### Contrato alvo

- Uma pasta com arquivos de leitura = exatamente uma série, qualquer que seja o formato. Identidade = caminho normalizado da pasta.
- Cada arquivo-contêiner = um item da série. Regras aplicadas ao nome, nesta ordem (decisão do usuário em 2026-10-19, após a medição):
  1. Marcador de volume reconhecido pelo parser (`v01`, `Vol. 2`, `Volume 3`…) → volume N.
  2. Marcador de capítulo (`c0383`, `Cap. 5`, `Capítulo 5`, intervalo `c0139-c0175`) → capítulo N na seção Capítulos.
  3. Número no fim do último trecho separado por ` - ` (`Elric - 001`, `Série - Referência 002`) → volume N. Um número colado ao título sem ` - ` (`Exterminador 17`) não conta.
  4. Nenhum dos casos → especial.
- Volumes e capítulos em ordem numérica (`v2` antes de `v10`). Especiais na ordem natural do nome do arquivo. O título exibido de cada item é o nome do arquivo sem extensão.
- Dois arquivos com o mesmo número na mesma pasta (por exemplo, `v01.pdf` e `v01.epub`) ficam no mesmo volume como dois itens separados, sem se fundir.
- O formato serve só para escolher o leitor de cada item. Imagens soltas continuam formando um item por pasta.
- A capa da série vem do primeiro volume ou, se não houver volume, do primeiro especial.
- O nome do arquivo só decide volume ou especial dentro da pasta. Nem ele nem os metadados internos mudam a série a que o arquivo pertence.

### Contrato da árvore de pastas (P2)

- Cada biblioteca mostra suas pastas como no explorador. Uma pasta pode ter subpastas, itens ou os dois. A pasta com itens abre a série correspondente; a pasta só com subpastas é apenas um nó de navegação.
- Implementação: o servidor entrega uma lista plana e autorizada (série → caminho relativo) em `api/library/folder-series`, e cada cliente monta a árvore com a mesma regra. O Kover guarda essa lista para navegar sem rede.
- A árvore é **derivada do catálogo** (`Series.FolderPath` relativo à raiz da biblioteca). Navegar não lê o disco, então não há como apontar para fora da raiz nem enumerar arquivos não indexados.
- A API expõe só caminhos **relativos** à raiz da biblioteca. O caminho absoluto do servidor não é enviado ao leitor. Hoje o `SeriesDto` envia `FolderPath` absoluto; deixar de enviá-lo para contas sem Admin é uma decisão de compatibilidade a testar.
- Autorização: cada usuário vê só as bibliotecas e séries a que já tem acesso. Pastas sem nenhuma série visível não aparecem.
- Ordem natural dos nomes nas pastas e nos itens. Paginação por nível da árvore.
- A grade de séries atual continua existindo. A árvore é uma visão a mais, não substitui buscas, coleções e "continuar lendo".
- No Kover a árvore precisa funcionar **offline**. O cliente guarda o caminho relativo de cada série no banco local e monta a árvore sem rede, inclusive mostrando quais itens estão baixados.

### Entregas (TDD em cada uma)

1. **Medição sem escrita.** Rodar sobre um clone do principal: quantas pastas têm mais de um formato, quantas têm itens em "Especiais" e quantas séries seriam fundidas. Também listar referências por `SeriesId` (progresso, histórico, avaliações, coleções, listas de leitura, want-to-read). Resultado local, fora do Git.
2. **Leitor por item, antes de juntar.**
   - Web: a navegação para próximo/anterior usa o formato do capítulo de destino, não `seriesFormat`.
   - Kover: o leitor e as preferências usam `chapter.format`.
   - RED: série sintética com PDF + EPUB + CBZ abre cada item no leitor correto, inclusive ao avançar.
   - Compatibilidade: séries de formato único continuam iguais.
3. **Uma série por pasta no scanner.**
   - Tirar o formato da chave da série no modo pastas. `FolderParser` mantém a regra volume/especial atual.
   - Especiais recebem `SortOrder` pela ordem natural do nome.
   - O casamento de capítulos continua pelo caminho do arquivo (`ProcessSeries.cs:950`), então os IDs se mantêm quando entra um arquivo novo.
   - `Series.Format` vira apenas indicativo (formato predominante ou um valor "misto", a decidir no RED), sem influir na identidade.
   - RED: pasta com `v01.cbz`, `v10.cbz`, `v2.cbz`, `Extra.pdf` e `Livro.epub` → 1 série; volumes 1, 2 e 10; especiais `Extra` e `Livro`, nessa ordem. Testar também: `v01.pdf` + `v01.epub` como dois itens do volume 1, arquivo novo sem trocar IDs, metadados conflitantes ignorados, pastas homônimas separadas e segundo scan estável.
   - Bibliotecas sem o flag continuam idênticas ao upstream.
4. **Apresentação.**
   - Web e Kover mantêm as seções Volumes e Especiais já existentes.
   - Conferir: especiais na ordem natural, títulos iguais ao nome do arquivo, volume com mais de um formato mostrando cada item, e "continuar lendo" seguindo volumes e depois especiais.
   - Testes de componente/widget com executor configurado e RED comprovado. Mudar só o que o RED mostrar errado.
5. **Árvore de pastas no servidor e na web.**
   - Endpoint de navegação por biblioteca e caminho relativo, montado a partir do catálogo. Ele lista subpastas (nome, caminho relativo, contagem, capa) e, se houver, a série da própria pasta.
   - Web: página "Pastas" com trilha de navegação (breadcrumb), voltar à pasta anterior e abrir a série.
   - RED no servidor: árvore aninhada com pasta mista (itens + subpastas), pasta só com subpastas, homônimas em ramos diferentes, `..` ou caminho absoluto recusados, biblioteca sem acesso negada, série com restrição de idade oculta, ordem natural e paginação.
   - RED na web: navegar dois níveis, voltar e abrir uma série.
6. **Árvore no Kover, offline.**
   - Sincronizar o caminho relativo da série, com migração do banco local (Drift). Reconciliação e remoção local continuam como hoje.
   - Tela de pastas montada do banco local, com o estado de download dos itens.
   - RED: árvore visível sem rede após reinício; remover um download não some com a pasta nem dispara novo download; servidor antigo sem o campo continua funcionando com a grade atual.
7. **Migração do catálogo atual (clone primeiro).**
   - Fundir as séries da mesma pasta. A série sobrevivente é a de menor ID ou a que tem progresso. Os capítulos mantêm seus IDs e vão para o volume de mesmo número (ou para os especiais) da série sobrevivente.
   - Todas as referências por `SeriesId`/`VolumeId` são reescritas. Os registros removidos são arquivados como na P3.
   - Aceite no clone: mesmo número de arquivos, nenhum capítulo perdido, progresso e histórico equivalentes por capítulo, scan seguinte sem alterações, originais com inventário e hashes iguais.
   - No Kover: a reconciliação aceita a fusão quando os capítulos mantêm o ID. Ausência de destino continua abortando antes de escrever.
8. **Aplicação no principal.** Exige backup consistente, pausa das Auth Keys durante a troca, autorização explícita do usuário e aceite PDF/EPUB/CBZ no S6 Lite com o novo APK, incluindo a árvore offline.

As etapas 5 e 6 não dependem da fusão de formatos e podem ser entregues antes das etapas 3 e 7, sobre o catálogo atual. Assim a navegação por pastas chega mais cedo, sem migração.

### Riscos e decisões pendentes

- Juntar séries muda o `SeriesId` de uma delas. Clientes Kover da Play Store não conhecem a fusão. Manter a pausa até o novo APK passar no aceite.
- Mesmo título em PDF e EPUB na mesma pasta aparece como dois itens, como no YACReader. Isso é intencional.
- Medição da etapa 1 (cópia somente leitura do principal, 2026-10-19): a fusão de formatos afeta só Livros, com 4 pastas e 4 séries a menos. Em Quadrinhos, 145 de 152 arquivos estavam como especiais porque o parser não aceitava número solto; isso motivou as regras 2 e 3. Referências por `SeriesId`: 8 progressos, 14 atividades de sessão, além de metadados de série. Relatório detalhado em `_temp/offline-f1/yac/`, fora do Git.
- Reclassificar volumes muda o `VolumeId` dos capítulos já existentes. O progresso guarda `VolumeId`, e o Kover precisa aceitar o capítulo em outro volume. Testar no clone antes de aplicar.
- Verificar no RED o efeito de "lido até o volume X", das estatísticas e do OPDS com séries de formato misto antes de assumir que funcionam.
- Pendente de confirmação: o fim cortado da mensagem do usuário sobre especiais.

TDD é obrigatório em todas as fases. Cada fase termina com código, testes pertinentes, documentação e evidência do comportamento observado. Uma entrega isolada não significa que já foi aplicada ao catálogo pessoal. O modo de bibliotecas preenchidas não pode ser trocado pela edição comum: exige a migração da P3.

## Diagnóstico que motivou a mudança

O catálogo em uso reúne alguns livros independentes em capítulos com vários arquivos e separa volumes que têm metadados divergentes. Um piloto anterior mostrou 20th Century Boys como uma série de 22 volumes, mas o resultado em catálogo novo não comprova preservação de identidade no legado. A auditoria encontrou 929 arquivos originais de contêiner suportados e 927 indexados; os dois ausentes são quadrinhos. Existem também imagens legítimas e auxiliares a distinguir. O MOBI original permanece preservado, com EPUB derivado separado.

A proposta de fusão pontual de Century foi substituída por esta política geral. As mudanças de apresentação já existentes permanecem até a migração validada.

Atualização operacional: a migração foi aplicada; o diagnóstico acima descreve o ponto de partida. A ordem atual prioriza a organização já disponível na web, a compatibilidade do Kover para reabrir sincronização e depois a árvore visual.

---

# Histórico do plano anterior (substituído)


# Organização do acervo para Kavita + Kover

Data: 2026-10-17. Estado: implementação de catálogo aplicada em 2026-10-18; revisões estruturais, auxiliares em cache e novo aceite no tablet pendentes. Evidências no [relatório de implementação](../validation/ORGANIZACAO_ACERVO.md).

## Resultado e estratégia

Entregar três bibliotecas navegáveis no PC e no Kover: séries e volumes em ordem, idiomas/edições distinguíveis, livros independentes e nenhuma capa ou arquivo do YACReader aparecendo como leitura. Preservar os originais e manter o Kavita somente leitura. O usuário autorizou a implementação. Foram aplicadas configurações e nomes/coleções no catálogo e criada uma cópia EPUB derivada do MOBI, mantendo os originais intactos.

Começar pelas configurações existentes e pelo resultado de um piloto. Manter a estrutura atual onde funcionar. Para problemas que exigirem mudança de nome, diretório ou metadados internos, preparar uma proposta por arquivo e experimentar em cópias separadas; não modificar o acervo durante leitura, download, remoção local ou sincronização. Não remover dados do YACReader.

## Diagnóstico observado

Inventário por nomes/diretórios, sem abrir os livros, arquivos compactados ou bancos do YACReader, sem hashes ou comparação de conteúdo. Nenhum link/junction encontrado, erro de enumeração ou truncamento. Os nomes detalhados estão apenas no relatório local ignorado _temp/offline-f1/library-structure.json.

| Pasta | Arquivos totais | Candidatos a leitura por extensão | Observações |
| --- | ---: | --- | --- |
| Mangas | 1.779 | 480 CBZ + 22 CBR + 245 PDF = 747 | Pastas por série, volumes v001, capítulos avulsos, edições e idiomas; 277 imagens em pastas capas; 755 arquivos auxiliares do YACReader |
| books | 72 | 27 PDF + 7 EPUB + 1 MOBI = 35 | Categorias temáticas, livros avulsos e algumas pastas por obra; variantes de idioma e PDF/EPUB da mesma obra; 37 arquivos auxiliares do YACReader |
| Quadrinhos | 299 | 114 CBZ + 4 CBR + 28 PDF = 146 | Obras e coleções, subdivisões por idioma/edição; 153 arquivos auxiliares do YACReader |

Total: 2.150 arquivos, sendo 928 candidatos a leitura por extensão. Isso não é contagem de obras únicas, volumes efetivos, formatos suportados ou duplicatas: o conteúdo ainda não foi analisado. Não há arquivos diretamente na raiz das três pastas. Subpastas e nomes de volume já presentes são uma boa base; não há motivo demonstrado para reorganizar tudo.

## Regras de organização propostas

| Aspecto | Regra |
| --- | --- |
| Bibliotecas | Mangas: Manga; Livros: Book; Quadrinhos: avaliar Comic (Flexible), que oferece volumes e agrupamento flexível. Conferir o tipo atual antes de qualquer alteração; Comic e Comic (Flexible) são opções diferentes. |
| Série | Uma identidade por obra/edição/idioma que o usuário precisa escolher separadamente. Reunir os volumes correspondentes; relacionar sagas e continuações por coleção. |
| Mangás | Preservar nomes v001, v002 etc. Capítulos avulsos usam c001 etc quando realmente forem capítulos. Não transformar números de capítulos em volumes automaticamente. |
| Quadrinhos | Distinguir edição/issue de encadernado, integral, especial e nova publicação. Não aplicar v001 indiscriminadamente a toda numeração existente. |
| Idioma e edição | Separar PT-BR/EN e colorido/preto e branco quando houver conteúdo alternativo. Pasta ou sufixo entre colchetes, isoladamente, não garantem identidades diferentes no parser; confirmar nome reconhecido e metadados. |
| Livros | Categoria → obra ou autor/obra como organização física candidata; categorias temáticas também podem virar coleções. Não agrupar livros independentes como volumes de uma categoria. |
| Metadados | Consultar ComicInfo.xml e metadados EPUB/PDF antes de propor renomeação: podem prevalecer sobre o nome do arquivo. A inspeção atual não os leu. |
| Capas e YACReader | Ignorar no scanner as pastas auxiliares, mantendo-as em disco. Testar padrões específicos para .yacreaderlibrary e capas em todos os níveis. Não excluir JPG/PNG globalmente sem verificar se existem páginas legítimas em imagens. |
| Mesmo título em vários formatos | Manter PDF/EPUB e versões alternativas. Verificar como aparecem no catálogo e permitir escolha clara; mesma obra não significa arquivo redundante descartável. |
| MOBI | Um arquivo identificado; validar suporte na versão executada. Se não houver suporte, propor cópia derivada EPUB com ferramenta adequada e validar leitura; preservar MOBI original. |

Estrutura de referência para novos itens ou cópias de preparação, não uma migração já decidida:

~~~text
Mangas/
  Serie A - PT-BR - Colorido/
    Serie A - PT-BR - Colorido v001.cbz
    Serie A - PT-BR - Colorido v002.cbz
  Serie A - PT-BR - Preto e branco/
    Serie A - PT-BR - Preto e branco v001.cbz
Quadrinhos/
  Colecao A/
    Serie principal/
    Derivacao/
books/
  Categoria/
    Autor - Obra/
      Autor - Obra [PT-BR].epub
      Autor - Obra [PT-BR].pdf
~~~

O piloto deve confirmar essa representação na imagem 0.9.1 em execução e no Kover; não assumir que o checkout 0.9.1.14 ou a documentação mais recente produz exatamente o mesmo resultado. Separar identidades nos metadados de cópias de preparação quando necessário; a árvore sozinha não impõe a apresentação na interface.

## Fases com entregas verticais

### O0 — Diagnóstico inicial concluído

Entrega: inventário local e este plano, com formatos, estruturas e pontos de atenção. Feito: enumeração das três pastas. Pendente: tamanho total/espaço necessário, disponibilidade local dos arquivos do OneDrive, metadados, reconhecimento efetivo no catálogo, versões Android/APK e progresso existente. Não presumir que os títulos estão errados ou duplicados antes de comparar com o catálogo.

### O1 — Piloto limpo e legível no tablet

Preparar instância/catalogação isolada com cópias de poucos arquivos representativos: dois volumes da mesma série, uma obra em duas edições, um quadrinho e um livro. Capturar hashes das fontes selecionadas antes e depois da cópia e manter as cópias de preparação fora das pastas originais, sem hardlinks. Fazer backup consistente dos dados operacionais existentes antes de eventual alteração na instância em uso.

Configurar tipos de biblioteca, formatos e exclusões no piloto. Validar padrões candidatos como **/.yacreaderlibrary/** e **/capas/** com a versão real; não apresentá-los como já testados. Desativar leitura de imagens soltas somente se o inventário e o piloto confirmarem que não são conteúdo desejado. Testar ajustes de metadados da UI e se resistem a novo scan; mudanças em arquivos ficam restritas às cópias.

Aceite: cada item esperado aparece uma vez na identidade correta, nenhuma capa/cache vira obra, a conta comum encontra e baixa o item e o Kover abre offline após reinício. Fontes selecionadas com hashes idênticos. Entregar regras verificadas e lista de casos que ainda exigem tratamento.

### O2 — Mangás em ordem, com variantes escolhíveis

Aplicar as regras aprovadas ao catálogo de mangás, por lotes pequenos. Começar pelas séries que já têm v001; depois tratar capítulos avulsos, continuações, versões coloridas/preto e branco e idiomas. Preferir ajustes persistentes no catálogo quando suficientes. Se o scanner não representar uma variante, registrar o caso e preparar mudança em cópia, sem alterar originais nem ampliar o parser antes de reproduzir o problema.

Aceite: abrir uma série e escolher volumes na ordem correta; abrir separadamente duas variantes sem páginas misturadas; baixar cada variante no tablet e ler offline. Conferir contagem de arquivos associados e exceções por lote. Uma sequência numérica ausente é alerta a revisar, não prova de arquivo perdido.

### O3 — Quadrinhos com séries e edições reconhecíveis

Validar Comic (Flexible) no piloto antes de decidir o tipo da biblioteca existente. Tratar séries principais, derivados e encadernados, com coleções para franquias quando necessário. Separar idiomas e publicações diferentes com identidade explícita. Preservar a numeração que representa issues; padronizar apenas ambiguidades demonstradas.

Aceite: encontrar uma série, escolher a edição/idioma correto, ler os números na ordem e baixar no Kover. Confirmar que editar ou reindexar um lote não faz sumir obras nem perde progresso. Não apagar/recriar bibliotecas existentes como atalho para mudar tipo ou agrupamento.

### O4 — Livros independentes e formatos acessíveis

Revisar identificação de cada PDF/EPUB por título, autor, série e idioma. Manter categorias temáticas como organização ou coleções; garantir que não viraram uma única série indevida. Conferir como PDF e EPUB da mesma obra são apresentados, preservando ambos. Tratar o MOBI como exceção, com conversão derivada somente se necessária.

Aceite: buscar pelo título/autor, distinguir idioma/formato e abrir PDF e EPUB offline no S6 Lite. Uma obra independente não aparece como volume de outra sem relação. Casos pendentes de metadados ficam listados.

### O5 — Catálogo consolidado, progresso e rotina

Consolidar as regras e aplicar somente os ajustes demonstrados necessários. Antes de qualquer troca de fonte, nome ou identidade de catálogo, ensaiar em ambiente isolado a associação dos IDs e do progresso do Kavita/Kover; trocar o caminho pode gerar nova entidade e deixar downloads ligados à antiga. Não aceitar perda de histórico como consequência implícita da organização.

Entregar guia para novos arquivos, escaneamento e relatório de exceções. Na instalação Windows/Docker, conferir scan manual/agendado; não depender de eventos automáticos de pasta sem validação. Se houver reorganização física futura, gerar manifesto origem → destino, detectar colisões, estimar espaço, manter originais e preparar restauração antes de aplicar cópias derivadas. Não executar renomeação/movimentação em lote dos originais como parte automática deste plano.

Aceite: reindexar e continuar encontrando as mesmas obras e progresso; baixar, desligar Wi-Fi, reiniciar app, ler, remover só o download, reconectar, sincronizar e baixar explicitamente de novo. Catálogo e fontes preservados. Resultado complementa a F1/F2 e a preparação da F5 do plano principal, sem declarar essas fases completas antecipadamente.

## Evidências, TDD e reversão

- Configuração: testar em instância isolada com dados sintéticos/cópias, conferindo o resultado no catálogo e a montagem somente leitura. Documentação e este inventário não são implementação de scanner.
- Se surgir necessidade de script de organização: TDD para simulação sem escrita, colisões, Unicode/espaços, exclusões precisas, múltiplas edições, formatos alternativos, links, idempotência e preservação dos hashes. O script deve gerar proposta revisável e copiar para destino separado por padrão; não sobrescrever nem apagar fontes.
- Se surgir bug no Kavita/Kover: reproduzir com fixture sintética, RED por comportamento, correção mínima, GREEN e regressões; validar o APK/imagem identificados. Não adicionar regra global baseada em um único nome particular do acervo.
- Backup operacional consistente e restauração ensaiada antes de alterações do catálogo usado. Não testar contra banco pessoal; registrar efeito dos scans e eventual impacto nos IDs. Rollback das cópias e configurações não deve apagar progresso adquirido depois do backup.
- Relatórios com nomes completos, caminhos, metadados e hashes permanecem locais e fora do Git. O diagnóstico, o piloto técnico e os ajustes seguros de catálogo foram executados. O aceite no tablet, sete casos estruturais e a aprovação da remoção de sete séries auxiliares permanecem pendentes; consultar o relatório antes de alterar o catálogo ou declarar O1–O5 concluídas.

## Fontes verificadas

- [Scanner e estrutura](https://wiki.kavitareader.com/guides/scanner/): varredura recursiva, organização por série e prevalência de metadados; o catálogo não replica a árvore física.
- [Tipos de biblioteca, formatos e exclusões](https://wiki.kavitareader.com/guides/admin-settings/libraries/): distinção Comic/Comic (Flexible), filtros e glob; conferir funcionamento na versão instalada.
- [Nomes de volumes e capítulos](https://wiki.kavitareader.com/guides/scanner/managefiles/).
- [EPUB](https://wiki.kavitareader.com/guides/scanner/epub/) e [PDF](https://wiki.kavitareader.com/guides/scanner/pdf/): identificação por metadados com regras próprias.
- Evidência local: LibraryType.cs distingue Comic (Flexible), valor 1, de Comic, valor 5; serviço executado continua sendo a imagem upstream 0.9.1. O inventário não comprova metadados ou suporte a todos os formatos enumerados.
