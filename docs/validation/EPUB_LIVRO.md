# EPUB como livro na web — L1, L2 e L3

Registro de 2026-10-21, referente ao [plano EPUB_LIVRO](../plans/EPUB_LIVRO.md). Implementação local, sem deploy no principal. A L1 apresenta o livro aberto; a animação pertence à L2. O usuário aprovou visualmente a L1 em 2026-10-21, autorizando o início da L2.

**Estado mais recente:** o usuário escolheu corrigir o recorte mantendo texto vivo e **aprovou visualmente a L2 em 2026-10-21**, incluindo a sombra inicial em 0,5. A entrega teve **126 testes web e 107 checks e2e aprovados**, recortes sem diferenças geométricas e virada em 652 ms no maior EPUB, gravando uma vez. A **L3 foi implementada localmente e aguarda aceite visual**: 130 testes web e 137 checks e2e aprovados (seção [L3](#l3-mudar-a-aparência-sem-perder-o-lugar)). As seções abaixo mantêm o histórico dos ensaios. Não houve deploy, commit ou push.

## Comportamento implementado

- A chave **Livro** reaproveita `kavita--reader-book-mode`, a preferência local já usada em imagens e PDF.
- Em escrita horizontal e layout paginado, ligar a chave mostra duas páginas. O layout local não é copiado para o perfil do servidor, inclusive quando outras preferências são salvas. É possível escolher uma página no menu; em janela estreita a apresentação também usa uma página.
- Rolagem e escrita vertical ocultam o botão e a decoração. Desligar Livro devolve o layout do perfil.
- `EpubBookDecorationComponent` acrescenta lombada apenas em duas páginas, sombras e bordas de 1 a 9 px conforme o avanço no HTML atual. Em RTL, os lados das bordas se invertem. Temas escuro e preto usam bordas claras e sombra mais suave; branco e papel usam bordas escuras.
- A margem do usuário é mantida. No livro de duas páginas, o intervalo interno entre colunas passa de 20 para 64 px; o cálculo do avanço horizontal recebe o mesmo intervalo.
- O texto permanece no leitor original, com seleção e links disponíveis. Não há rasterização, cópias do capítulo nem novos listeners na decoração. Fonte, tamanho, entrelinha, margem e tema usam os controles existentes.
- Uma atualização de layout atrasada não desfaz uma virada posterior. As bordas atualizam também nos HTMLs sem âncoras de sumário.

## Progresso e compatibilidade

O payload continua `pageNum` (índice do HTML) + `bookScrollId` (posição do texto); a coluna virtual não é enviada. Não houve mudança de DTO, schema, autenticação ou código do Kover.

O teste integrado encontrou um defeito anterior em `ReaderService.SaveReadingProgress`: quando não existia registro e `PageNum == 0`, o servidor retornava sucesso sem salvar, mesmo com `BookScrollId` válido. A correção preserva a posição no primeiro HTML. Com `BookScrollId` nulo ou vazio, abrir a primeira página continua sem criar um registro vazio. A regressão cobre IDs de elemento, XPath, string vazia e `null` em SQLite descartável.

## TDD e verificações

Antes das alterações de paginação, quatro testes de caracterização passaram usando os métodos reais do leitor: contar telas virtuais, avançar, saltar à tela N e voltar em `Column1`/`Column2`, LTR/RTL. O teste isola somente o pacote externo de seleção de cores, cujo componente não compila em JIT/jsdom neste ambiente.

REDs observados antes das respectivas correções:

1. Preferência lembrada: esperado `Column2`, recebido `Column1`.
2. Decoração: quatro falhas pela ausência de lombada, bordas e classe de tema.
3. Troca para escrita vertical: esperado layout de uma coluna, recebido duas.
4. Restauração atrasada: o leitor voltava ao elemento anterior depois de uma nova virada.
5. Bordas sem âncoras: a mudança de coluna não marcava a apresentação para atualização.
6. Servidor: os dois casos de posição no primeiro HTML falharam em `Assert.NotNull`; os dois casos de progresso vazio já passavam. Uma primeira tentativa tinha erro de compilação na fixture e não foi considerada RED.

Comandos executados, da pasta `UI/Web` (Node 24.15.0):

```powershell
npm exec --yes --package=node@24.15.0 -- node node_modules/@angular/cli/bin/ng.js test --watch=false
npm exec --yes --package=node@24.15.0 -- node hash-localization.js
npm exec --yes --package=node@24.15.0 -- node node_modules/@angular/cli/bin/ng.js build --configuration production
```

Também foi usado diretamente o executável Node 24.15.0 já presente no cache do npm, com os mesmos argumentos. Resultado da suíte web: **104 testes, 16 arquivos, sem falhas**. O build de produção passou. Persistem avisos anteriores de Sass, orçamento de estilos e dependências CommonJS.

O ESLint dos arquivos TypeScript/templates alterados passou sem erros. Nove erros anteriores no componente legado foram confirmados contra `HEAD` e resolvidos com ajustes mecânicos de `const`, declarações e remoção de atribuições sem uso. Avisos anteriores de acessibilidade e tipagem permanecem. `node --check` passou nos dois scripts e2e e `python -I -m py_compile` passou no gerador de fixtures.

Backend, em container do SDK .NET 10 com SQLite descartável:

```powershell
./_temp/offline-f1/yac/run.ps1 Kavita.Services.Tests/Kavita.Services.Tests.csproj 'FullyQualifiedName~SaveReadingProgress_FirstHtmlFile' epub-progress-red
./_temp/offline-f1/yac/run.ps1 Kavita.Services.Tests/Kavita.Services.Tests.csproj 'FullyQualifiedName~ReaderServiceTests|FullyQualifiedName~ReaderServiceRereadTests' epub-progress-green
```

O helper acima já existia localmente e não é versionado; o comando equivalente é `dotnet test Kavita.Services.Tests/Kavita.Services.Tests.csproj -p:RunAnalyzers=false --filter '<filtro>'`. Conferir o resultado do log, pois o helper pode retornar código zero mesmo quando a suíte falha.

Resultado GREEN: **94 testes de leitura/releitura passaram**, incluindo os quatro casos da nova regressão. A suíte completa do backend não foi executada nesta entrega; o restore apresentou avisos anteriores de dependências e vulnerabilidades, sem atualização de pacotes fora do escopo.

## Ensaio no Chrome

`scripts/e2e/run.ps1` gera PDF, CBZ e EPUB sintéticos e usa uma instância descartável em `127.0.0.1:5066`. A biblioteca foi conferida por `docker inspect`: `/media` e `/kavita/wwwroot` somente leitura; apenas `/kavita/config` gravável. Nenhum banco ou arquivo do principal foi usado.

O gerador EPUB inclui dois HTMLs com 90 parágrafos cada. O ensaio cobre colunas reais, setas LTR/RTL, avanço e retorno, abertura na posição salva, número de gravações, controles de aparência, temas, janela estreita e apresentação desligada. Mantém os 16 checks anteriores de PDF.

O teste configura o mesmo dispositivo que o Chrome identifica nos cabeçalhos públicos. A primeira tentativa configurava outro perfil e foi corrigida no próprio teste. O viewport explícito permite capturar o Chrome oculto sem depender da composição de uma janela visível. As primeiras tentativas reprovadas não são evidência de aceite.

A imagem original `kavita-fork:fork-v1.1-36-g9feb36c54` comprovou as regressões de PDF e revelou a perda de posição no primeiro HTML. Para ensaiar a correção, foi criada **somente para testes** `kavita-epub-l1-test:20261021`: a imagem original mais `Kavita.Services.dll` do build Debug validado pelos testes. A comparação de `9feb36c54..HEAD` não mostrou outras mudanças em Services/API/Models/Common. O contexto de build continha apenas Dockerfile e essa DLL, sem bancos ou configuração pessoal. A UI usa o build de produção montado pelo runner. Essa imagem descartável **não é uma imagem de entrega de um worktree limpo** e não deve ser usada para deploy.

```powershell
./scripts/e2e/run.ps1 -Image kavita-epub-l1-test:20261021 -Keep
```

Capturas sintéticas e medidas são geradas em `_temp/epub-livro/`, preservadas após a limpeza do ambiente e2e. A conclusão do ensaio e suas medidas são registradas abaixo.

**Resultado final: 58/58 checks passaram**, sendo 16 de PDF e 42 de EPUB. O runner encerrou com código zero e removeu o container, o volume e a pasta `_temp/e2e`. A imagem descartável permaneceu disponível localmente; o principal não foi alterado.

Medidas no Chrome com viewport de 1600 × 950, biblioteca sintética e resposta observada pelo CDP. São medições de uma execução local, não um benchmark de EPUBs reais. A comparação de gravações conta dois comandos consecutivos (avançar e voltar), com paradas entre eles; a reabertura foi medida separadamente.

| Apresentação | Direção | Resposta à seta | Gravações em avançar + voltar |
| --- | --- | ---: | ---: |
| Sem Livro, uma coluna | LTR | 8 ms | 2 |
| Sem Livro, uma coluna | RTL | 9 ms | 2 |
| Sem Livro, duas colunas | LTR | 8 ms | 2 |
| Sem Livro, duas colunas | RTL | 9 ms | 2 |
| Livro, duas páginas | LTR | 8 ms | 2 |

As [medidas brutas](assets/epub-livro/medidas.json) foram preservadas. As seis capturas foram inspecionadas visualmente e contêm somente conteúdo sintético; o navegador de teste usa inglês, por isso o botão aparece como “Book”. A tradução `pt_BR` mostra “Livro”. O aviso na janela estreita é a notificação já existente de redução para uma coluna.

| Captura | O que conferir |
| --- | --- |
| [Papel, duas páginas](assets/epub-livro/papel-duas-paginas.png) | Lombada central, margem interna e bordas externas |
| [Papel, uma página e outra fonte](assets/epub-livro/uma-pagina.png) | Preferências aplicadas ao texto vivo e ausência de lombada |
| [Escuro](assets/epub-livro/dark.png) | Sombra suave e bordas claras |
| [Preto](assets/epub-livro/black.png) | Borda clara no fundo preto |
| [Branco](assets/epub-livro/white.png) | Lombada e bordas no tema claro |
| [Janela estreita](assets/epub-livro/janela-estreita.png) | Uma página, sem lombada |

## Pendências de aceite e implantação

- Aceite visual da L1 confirmado pelo usuário em 2026-10-21.
- Imagem de entrega a partir de commit/worktree limpo. A árvore contém alterações anteriores do usuário; nenhum commit foi feito para contornar a exigência de limpeza.
- Deploy no principal depende de autorização explícita e não foi executado.
- A L2 está implementada localmente e aguarda aceite visual; L3 a L5 aguardam esse aceite. L6 exige a escolha das novas opções de texto; L7 é opcional. Não houve aceite no tablet. Os ensaios posteriores da L2.2 com EPUB pessoal estão registrados abaixo, separados da entrega L1.

## Histórico da retomada: L2.1 e primeiro ponto de decisão L2.2

Em 2026-10-21, o usuário respondeu “aprovados” ao pedido de aceite das capturas da L1. A apresentação parada está aprovada; isso não autorizou deploy no principal. A L2 foi iniciada com o gerador e a medição previstos no plano, antes da integração da animação.

Nesse primeiro ensaio, `epub-book/epub-book-pages.ts` era um **protótipo isolado**, sem importação no componente do leitor. Recebia as dimensões e o avanço de coluna já medidos, clonava o HTML, copiava a tipografia computada e deslocava o clone dentro do recorte. Incluía página vazia no fim e tornava os recortes inertes/ocultos da árvore de acessibilidade. A correção posterior da cascata e a integração estão na seção final.

Os quatro testes novos foram executados em RED com o gerador ainda sem implementação: falharam com `EPUB column clipping is not implemented`, sem erros de compilação. Após a implementação mínima, os quatro passaram. A suíte web completa passou com **108 testes em 17 arquivos**. O lint dos dois arquivos TypeScript novos passou. Os avisos anteriores de Sass continuam. Nesta retomada não houve mudança no backend nem repetição dos testes .NET; os 94 testes mencionados acima pertencem à L1.

### Medição no Chrome

O probe `scripts/e2e/epub-clipping.e2e.mjs` empacota o gerador e o PageFlip vendorizado diretamente dos fontes e os executa apenas no Chrome descartável. A aplicação usada foi o build de produção da L1 já existente, montado somente leitura; não foi gerada imagem de entrega. A medição inclui criar quatro recortes (duas telas de duas páginas), montar o PageFlip e forçar leitura da geometria. Compara os retângulos dos elementos visíveis após o primeiro frame. São cinco montagens locais, não um benchmark geral nem teste de uma virada completa.

Foram conferidos nove EPUBs nas montagens somente leitura. O maior tem **35.298.699 bytes**; uma cópia temporária foi conferida por SHA-256, sem guardar seu nome, caminho, texto ou hash no repositório. O probe selecionou o maior HTML retornado pelo leitor desse EPUB (183.302 caracteres após processamento, 3.049 elementos). O banco pessoal não foi copiado. O servidor de medição usou o projeto Compose `kavita-epub-l2-measure`, em `127.0.0.1:5067`, com `/media` e `/kavita/wwwroot` somente leitura e configuração em volume exclusivo.

| Entrada | Maior montagem nas cinco amostras | Comparações geométricas divergentes |
| --- | ---: | ---: |
| EPUB sintético simples | 10,7 ms | 0 |
| Maior EPUB do acervo | 22,5 ms | 26 |
| EPUB sintético com CSS de editor | 9,3 ms | 1 |

As [medidas sem conteúdo](assets/epub-livro/l2-medidas.json) incluem somente índices, quantidades, tempos e coordenadas. A posição original foi preservada em todas as entradas. Uma primeira medição mostrou o mesmo padrão; a repetição com coordenadas confirmou o defeito. No EPUB maior, um parágrafo passou de 24,33 para 26 px de altura e deslocou os seguintes cerca de 1,67 px. Na amostra de editor, a nota `position: fixed` passou de y=80 para y=118 e de 18 para 24 px de altura quando o PageFlip criou seu contexto de transformação. A fixture também contém colunas internas do editor. A tentativa inicial do helper tratou HTML como JSON e foi corrigida antes dessas medições; não foi considerada evidência de reprovação do recorte.

**Resultado inicial da L2.2: o tempo ficou abaixo de 100 ms, mas o CSS não foi preservado.** Conforme a instrução explícita do plano — “Se montar uma virada passar de 100 ms ou o CSS quebrar o recorte, parar e decidir com o usuário entre corrigir o recorte e capturar em imagem” — a integração da animação foi interrompida nesse ponto. A recomendação foi corrigir o recorte com texto vivo. O usuário escolheu essa opção, e a seção final registra o RED/GREEN e a integração posteriores. Captura em imagem não foi adotada; qualidade e custo dessa alternativa não foram medidos.

### Reprodução só com conteúdo sintético

```powershell
./scripts/e2e/run.ps1 -Image kavita-epub-l1-test:20261021 -MeasureEpubClipping
```

O parâmetro novo gera também `Livro EPUB CSS` e acrescenta a medição depois dos checks existentes da L1. O modo normal não carrega o protótipo. A saída sem conteúdo fica em `_temp/epub-l2/synthetic-measurements.json`. O teste opcional compara os elementos e deve reprovar a nota fixa enquanto o recorte não for corrigido; isso é o critério de decisão da L2.2, não uma regressão da L1.

**Execução inicial confirmada:** os **58 checks anteriores da L1 passaram novamente**. Dos seis checks extras do probe, cinco passaram e um falhou pela geometria da nota fixa, reproduzindo o ponto de decisão; código de saída 1. Na reprodução só com sintéticos, os máximos foram 12,9 ms (simples) e 10,9 ms (CSS de editor). O runner removeu seu container, volume e perfil. O ambiente separado com a cópia pessoal também foi removido, após nova conferência do hash do original; restaram somente os dois containers do principal. Nenhum deploy, commit ou push foi feito. A integração da L2.3 aguardou a decisão do usuário prevista no plano.

Os comandos do gerador e da suíte completa foram `ng test --watch=false --include='**/epub-book-pages.spec.ts'` e `ng test --watch=false`, pelo executável Node 24.15.0 já instalado no cache. `node --check` passou nos scripts `epub-clipping.e2e.mjs` e `reader.e2e.mjs`; `python -I -m py_compile scripts/e2e/make_fixtures.py` e o parser de PowerShell de `run.ps1` passaram. A tentativa inicial via `npm exec` dentro do sandbox não acessou o cache; não foi considerada RED.

## L2 corrigida e integrada após a escolha do usuário

Em 2026-10-21, o usuário escolheu seguir a recomendação de **corrigir os recortes mantendo texto vivo**. A imagem rasterizada não foi adotada. O resultado está localmente em revisão e depende do aceite visual antes da L3.

### Correção do recorte

- A cópia de todos os estilos computados da raiz foi removida. Ela transformava a entrelinha relativa herdada em pixels, alterando notas e trechos de fonte menor. O clone agora permanece na árvore do leitor e conserva a cascata original.
- Um viewport interno do tamanho da janela reproduz o contexto de `position: fixed` do EPUB. Sua origem é compensada para cada meia página. Assim, a transformação do PageFlip não reposiciona a nota em relação à folha.
- O recorte fica num filho da página: `HTMLPage` substitui os estilos inline do elemento externo durante os frames e, antes, apagava `overflow: hidden`.
- O fundo vem do `.reader-container` real, com cor opaca e imagem/textura do tema. O texto original fica oculto somente durante a animação, com valor e prioridade CSS da visibilidade restaurados antes do avanço. Isso evita a transparência e o texto duplicado encontrados na inspeção visual do primeiro ensaio integrado.

Os testes novos do recorte interno e do contexto de viewport falharam antes da implementação e passaram depois. A regressão real de CSS já estava em RED no probe anterior; passou no Chrome com a correção. Os testes de fundo e ocultação do original também tiveram RED observado antes da correção visual. O jsdom não mantém `!important` na propriedade `visibility`, mesmo sem executar o código do fork: essa limitação foi isolada e a preservação exata da prioridade é validada no Chrome nas quatro combinações de layout e direção.

### Integração e sincronização

`EpubBookAnimationComponent` cria recortes somente da tela atual e da de destino. Em duas páginas são quatro cópias do HTML; em uma página são duas, mais dois slots vazios para evitar a capa rígida automática do motor. Os recortes são inertes e ocultos da acessibilidade. A duração inicial é de 600 ms, sombra máxima 0,5. O motor não recebe mouse diretamente; arraste de canto pertence à L5.

A camada aparece ao receber o comando. O leitor original mantém a posição durante a virada; somente o estado final `read` confirma um avanço pelo método existente. Eventos de montagem e `flip` não gravam progresso. A confirmação destrói o livro fora do callback interno do motor, restaura o texto e executa uma vez o avanço/retorno. Nenhum formato novo de progresso foi criado.

Durante uma virada, comandos repetidos são absorvidos, inclusive um comando contrário no limite do HTML. Redimensionamento, mudança de aparência, troca de HTML e destruição cancelam sem confirmar uma posição antiga. Se o motor não responder, o limite de 850 ms remove a camada e confirma uma vez o comando original. Se a montagem falhar, o leitor avança pelo caminho original. “Reduzir animações” usa diretamente o salto da L1. Roda do mouse, setas, botão e toque nas laterais usam os mesmos ganchos. A roda absorve a continuação do mesmo gesto por 180 ms.

Os limites entre arquivos HTML mantêm a navegação original imediata: depois da última coluna abre o HTML seguinte; antes da primeira volta ao anterior. A virada interna não fabrica uma coluna fora desses limites. Esta entrega não implementa animação entre arquivos HTML distintos. Preservação adicional do trecho ao alterar a aparência durante a virada é L3; links, seleção e destaques durante a virada são L4.

Os testes do componente começaram com RED por ausência da animação, incluindo retorno `false` em vez de `true`. Os ganchos do leitor tiveram dois REDs (avanço imediato e roda sem virada); a regressão do comando contrário na borda falhou com uma navegação indevida antes da proteção. Recuperação por timeout e falha do motor, cancelamento e destruição também estão cobertos.

### Evidências finais

Com Node 24.15.0, da pasta `UI/Web`:

```powershell
node node_modules/@angular/cli/bin/ng.js test --watch=false
node node_modules/eslint/bin/eslint.js src/app/book-reader/_components/epub-book/*.ts src/app/book-reader/_components/book-reader/book-reader.component.ts src/app/book-reader/_components/book-reader/book-reader.component.html src/app/book-reader/_components/book-reader/book-reader.pagination.spec.ts
node hash-localization.js
node node_modules/@angular/cli/bin/ng.js build --configuration production
```

Resultado: **126 testes em 18 arquivos passaram**; lint sem erros, com 19 avisos anteriores nos arquivos legados; build de produção passou, mantendo avisos de Sass, orçamento de estilos e CommonJS. Nenhuma dependência foi atualizada. Não houve mudança no backend ou repetição das suítes .NET nesta correção.

Da raiz:

```powershell
./scripts/e2e/run.ps1 -Image kavita-epub-l1-test:20261021 -MeasureEpubClipping -Keep
```

**107/107 checks passaram**, saída zero: 58 regressões da L1/PDF, 43 de animação e seis de recorte. Verificam rotação real do HTML, texto original parado e oculto durante a virada, folhas opacas, restauração da visibilidade e sua prioridade CSS, avanço/retorno em uma/duas páginas e LTR/RTL, uma gravação por avanço, rajada de 20 comandos, roda, botão, toque, movimento reduzido e travessia nos dois sentidos entre HTMLs. O primeiro ensaio integrado identificou transparência real e um seletor incorreto no cenário do botão (o controle está na barra inferior); os dois foram corrigidos antes da execução final. A [captura sintética durante a virada](assets/epub-livro/l2-virada.png) foi inspecionada após a correção.

| Layout | Direção | Virada completa | Gravações |
| --- | --- | ---: | ---: |
| Uma página | LTR | 623 ms | 1 |
| Uma página | RTL | 610 ms | 1 |
| Duas páginas | LTR | 652 ms | 1 |
| Duas páginas | RTL | 628 ms | 1 |

As [medidas da animação](assets/epub-livro/l2-animacao-medidas.json) e o [probe sintético corrigido](assets/epub-livro/l2-sinteticos-corrigidos.json) não contêm conteúdo pessoal. O probe sintético final teve máximos de 2,5 ms (simples) e 1,4 ms (CSS de editor), ambos com zero diferenças.

A medição na cópia pessoal descartável foi repetida com o código final. O maior HTML do maior EPUB teve **zero divergências**, máximo de **14,8 ms** nas cinco montagens, e a virada real terminou em **652 ms**, com **uma gravação** e o índice HTML preservado. O simples teve máximo de 2,2 ms e a amostra com CSS de editor, 1,4 ms, ambos com zero divergências. Veja as [medidas corrigidas sem conteúdo](assets/epub-livro/l2-medidas-corrigidas.json). Os valores são observações locais, sem promessa de desempenho para todo EPUB ou dispositivo.

O hash do original foi conferido novamente antes de remover a cópia e o ambiente de medição. Os dois ensaios usaram somente configuração/banco/cache descartáveis, biblioteca e UI somente leitura, e endereços `127.0.0.1`. O runner remove o ambiente sintético mesmo com `-Keep` quando a execução passa. O principal permaneceu intacto. A imagem de entrega de um worktree limpo e o deploy continuam pendentes; nenhum commit, push ou alteração no Kover foi feito.

## L3: mudar a aparência sem perder o lugar

Implementação local de 2026-10-21, sem deploy, commit ou push. Aguarda aceite visual.

### Defeitos encontrados e corrigidos

Cada correção começou por um teste que falhou pelo comportamento, em [book-reader.pagination.spec.ts](../../UI/Web/src/app/book-reader/_components/book-reader/book-reader.pagination.spec.ts) e em [epub-reflow.e2e.mjs](../../scripts/e2e/epub-reflow.e2e.mjs).

1. **Comando antes da restauração.** Uma seta apertada antes do quadro que restaura a posição avançava a partir do deslocamento antigo e voltava cerca de 39 mil px (esperado 57000, obtido 18240). Agora `movePage` aplica primeiro a restauração pendente.
2. **Dupla partida.** Com duas páginas, `scrollIntoView` encostava a coluna do trecho na borda; se o trecho estava na página da direita, o leitor parava em meia dupla (19,5 e 28,5 duplas medidas). A restauração em colunas horizontais alinha ao início da dupla que contém o alvo.
3. **Recuo acumulado.** A âncora era o início de um elemento. Um parágrafo que atravessa colunas era restaurado pelo início, e a captura seguinte escolhia o parágrafo anterior, de modo que cada mudança podia recuar até uma dupla. A âncora passou a ser o primeiro caractere da dupla visível, achado pela geometria do texto (busca binária em `Range`). O teste de clique foi descartado porque o menu de configurações cobre o leitor durante a mudança. Sem esse texto, o leitor volta ao elemento, como antes.
4. **Troca de layout.** A troca entre uma e duas páginas restaurava pelo último elemento salvo, depois da restauração tipográfica. Agora usa a mesma âncora de texto.
5. **Virada interrompida.** Durante a virada nenhum elemento está inteiro na tela, e a restauração não era agendada. Agora basta a âncora de texto.

O ensaio também corrigiu o próprio teste: em 150% a entrelinha coincide com o padrão do leitor (com 100% o Kavita remove o estilo), por isso o cenário usa 180%.

### Decisão do usuário

Em 2026-10-21, quando o texto do topo e o elemento do `bookScrollId` não cabem na mesma dupla, **vale o texto do topo**. O Kavita escolhe como `bookScrollId` um elemento inteiro na tela; com a fonte dobrada, esse parágrafo pode ir para a dupla seguinte. A medição registra `savedElementVisible: false` nas seis mudanças, como consequência esperada; o progresso salvo continua sendo índice HTML + `bookScrollId` do Kavita.

### Comandos e resultados

Da pasta `UI/Web`, com Node 24.15.0:

```powershell
node node_modules/@angular/cli/bin/ng.js test --watch=false
node node_modules/eslint/bin/eslint.js src/app/book-reader/_components/book-reader/book-reader.component.ts src/app/book-reader/_components/book-reader/book-reader.pagination.spec.ts
node node_modules/@angular/cli/bin/ng.js build --configuration production
```

**130 testes em 18 arquivos passaram**; lint sem erros, com 10 avisos em linhas antigas; build de produção passou.

Da raiz (o cenário focado usa `-EpubReflowOnly`):

```powershell
./scripts/e2e/run.ps1 -Image kavita-epub-l1-test:20261021
```

**137/137 checks passaram**: as regressões de PDF, L1 e L2 e os 36 de reflow. Para cada mudança (fonte, família, entrelinha, margem, uma página, tema escuro), o caractere do topo continua visível e a dupla termina alinhada. Também passaram: mudança de fonte durante a virada, que cancela a animação no texto original com no máximo uma gravação; próxima virada com o tamanho novo; comando imediato antes do quadro de restauração; e dez remontagens sem listener de `resize` a mais. Medidas sem conteúdo em `_temp/epub-l3/reflow-measurements.json`.

RED comprovado contra a restauração por elemento: com a âncora de texto desligada no build, o critério do texto do topo falhou em fonte, família e uma página. Um primeiro ensaio com teste de clique foi descartado, porque a medição falhava por causa do menu, não pelo comportamento.

### Limites

- A L3.2 cobre tema e fontes do sistema. Fontes enviadas ao servidor não foram exercitadas no e2e.
- Uma execução do e2e completo falhou uma vez ao carregar o primeiro EPUB (tempo esgotado em 20 s); nas quatro execuções completas seguintes ele carregou normalmente. Não houve reprodução.
- Escrita vertical continua com a restauração original por elemento.
- Sem aceite no tablet e sem deploy.

### Prévia com o acervo real e defeito da virada (2026-10-21)

O usuário avaliou numa prévia local descartável (`kavita-preview-l3`, `127.0.0.1:5068`). Ela usou o build local, a imagem de teste, um volume de configuração restaurado do backup automático de 08:38 (SHA-256 conferido) e as bibliotecas somente leitura; uma escrita em `/libraries/books` foi recusada. **O usuário aprovou o visual** e apontou colunas vizinhas aparecendo durante a virada.

Reproduzido no livro real com janela de 946×541 e escala 2. Cada folha da virada cobre meia área do leitor, margens incluídas, e o clone do texto tinha `overflow: visible`; com margem grande, as colunas vizinhas apareciam nas margens. No leitor, a própria caixa de texto as esconde. O ensaio sintético anterior usava margem pequena e não pegou o caso. Correção em `epub-book-pages.ts`: o clone fica numa caixa com a posição e o tamanho do texto e `overflow: hidden`; notas fixas do editor continuam presas à janela, como no leitor. Teste RED em `epub-book-pages.spec.ts` (sem recorte na caixa do texto). Depois da correção: 131 testes web e **143/143 checks e2e** com `-MeasureEpubClipping` (zero diferenças de geometria no EPUB simples e no CSS de editor). A regravação quadro a quadro no livro real não mostrou mais as colunas vizinhas. Durante a virada, a lombada fica coberta pelas folhas, como antes.

Observado também na prévia: o backup automático guarda banco, capas e `appsettings`, mas não `themes/`. O tema personalizado do site ficou de fora e a cópia restaurada mostrou "Theme file missing or invalid" até o arquivo ser copiado do principal (só leitura). Pendência registrada no estado atual; o script de backup não foi alterado.

Em 2026-10-22 o usuário aprovou a virada corrigida e autorizou incluir os temas no backup. O RED de `tests/backup-config.tests.ps1` falhou nos dois checks novos (tema no arquivo e no servidor restaurado); uma sondagem sem `covers/` e `themes/` também falhou (`tar` sem arquivos após `-C`) e foi corrigida. Resultado: 12/12 checks de backup/restauração, 7/7 de retenção, arquivo sem pastas opcionais válido. Um backup real do principal (`kavita-config-20261022-085228.tar.gz`, `integrity_check` ok, SHA-256 conferido) contém `themes/darknight.css`; ele substituiu o backup das 08:33 do mesmo dia pela retenção diária.

Também foi encontrado que `deployment/offline/backup/` (script, Dockerfile da ferramenta e retenção) nunca foi versionado: a regra `Backup*/` do `.gitignore` do Visual Studio a ignorava, porque o Git deste repositório não diferencia maiúsculas. Uma exceção `!/deployment/offline/backup/` foi acrescentada; os arquivos aguardam commit.

### Deploy no principal (2026-10-22)

Com autorização do usuário: commits `3895aa1b6` a `bb041ad0c`, imagem `kavita-fork:fork-v1.1-47-gfeb77a016` gerada de worktree limpo (`feb77a016`). O e2e contra a imagem e a interface do worktree passou com 143/143 checks. Antes disso, duas execuções falharam por corridas do roteiro, não do produto: um 429 do limite de 300 ms por capítulo do próprio fork e um scan esperado por contagem de pastas; ambas corrigidas em `bb041ad0c`. Uma execução teve uma virada isolada de 3.080 ms com a máquina recém-reiniciada; a repetição ficou em 670 ms.

`deploy-fork.ps1` criou o checkpoint `kavita-checkpoint-kavita-offline-f1-20261022-091216` e subiu a imagem nova. Por engano, o stderr foi redirecionado (`2>&1`), o que o README proíbe: o aviso do Docker sobre o container órfão do proxy encerrou o script depois do `up`, sem a espera do health e sem a retenção. Conferido à mão: container saudável, `127.0.0.1:5000`, HTTPS `192.168.1.113:5443` com 200, biblioteca e fontes somente leitura, `themes/darknight.css` presente e interface com o modo Livro. Ficaram 3 checkpoints; o próximo deploy volta a manter 2. Sem aceite no tablet nesta entrega.

### Ajustes após o uso em produção (2026-10-22)

O usuário apontou dois pontos no principal:

1. **Capitular com fundo branco.** Em *A hora da estrela* (lido só para inspeção), a capitular é um JPEG (`img.cap`); JPEG não tem transparência. No modo Livro com tema claro, as imagens do texto passam a usar `mix-blend-mode: multiply`: o branco assume a cor do papel e o traço escuro fica igual. Nos temas escuro e preto não há mistura, porque multiply escureceria a imagem; o fundo branco continua nesses temas. Fotos ficam levemente tingidas pelo papel no tema Papel. O leitor fora do modo Livro não mudou.
2. **Margem sem efeito no meio.** O espaço entre as páginas era fixo em 64 px; a margem do leitor só afastava as bordas externas. Agora o espaço do meio é 64 px (lombada) + 2 × margem, então cada página tem a margem dos dois lados e mais 32 px junto à lombada (`epub-book-layout.ts`).

RED: unidade (`epub-book-layout.spec.ts`, 64 em vez de 224) e e2e (meio de 64 px com margem de 160 px; imagem sem mistura no tema Papel). GREEN: 133 testes web e **147/147 checks e2e** com `-MeasureEpubClipping`, inclusive recorte sem diferenças e, com margem de 160 px, meio de 384 px. Na mesma rodada, o roteiro passou a esperar todas as pastas da fixture: esperar só as do PDF e do EPUB começava os cenários de PDF antes do fim do scan e reprovava oito checks de PDF.
