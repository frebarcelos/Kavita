# Plano de melhorias pós-v1.0 (Kavita + Kover)

Data: 2026-10-19. Ponto de partida: branch `fork/v1.0` dos dois repositórios, com organização por pastas no modelo do YACReader, árvore, capas de pasta e Kover offline já aplicados ao principal ([registro](../validation/YAC_PASTAS.md)).

O plano atual, que inclui robustez, operação e o tablet, está em [ROBUSTEZ_E_MELHORIAS.md](ROBUSTEZ_E_MELHORIAS.md). Este documento fica como histórico da v1.0 e do modo "Livro", e as seções 1 a 4 são referenciadas por lá.

As regras do [AGENTS.md](../../AGENTS.md) continuam valendo para cada item:
- TDD (RED → GREEN);
- originais no PC intactos;
- remoção de download só local;
- ensaio em clone antes de mexer no catálogo do principal;
- servidor apenas na LAN.

## Prioridades

| # | Melhoria | Projeto | Valor | Esforço |
| --- | --- | --- | --- | --- |
| 1 | Animação de virada de página | Kover (depois web) | Alto: pedido do usuário | Médio |
| 2 | O que está baixado (selos), aba "Offline" por pastas, capas e baixar pasta inteira | Kover | Alto: pedido do usuário e árvore completa sem rede | Médio |
| 3 | Progresso visível por pasta | Kavita + Kover | Médio | Baixo |
| 4 | Voltar da série para a pasta | Kavita + Kover | Médio | Baixo |
| 5 | Aceites pendentes (CBZ/EPUB, contas e tablets) | Ambos | Alto: segurança | Baixo |
| 6 | Implantação mais simples e backup automático | Kavita | Alto: operação | Médio |
| 7 | Manutenção do fork | Ambos | Médio | Contínuo |

## 1. Animação de virada de página

### Objetivo

Ao virar a página nos leitores horizontais do Kover, mostrar a folha se curvando como num livro, acompanhando o dedo, com uma opção para escolher o efeito.

### Onde se encaixa no Kover

- **Imagens (CBZ/CBR):** `image_reader/horizontal_paged_reader.dart` e `horizontal_spreads_reader.dart` usam `PageView` com imagens. É o melhor primeiro alvo: as páginas já são bitmaps, e o modo duplo ("spreads") já existe.
- **EPUB:** `epub_reader/epub_horizontal_subpages.dart` usa `PageView` com subpáginas medidas. Na hora da virada, cada subpágina precisa virar uma imagem.
- **PDF:** `pdf_reader/pdf_reader.dart` usa o `PdfViewer` do pdfrx, que é contínuo. A folha exige mostrar uma página por vez, renderizada como imagem (o pdfrx renderiza páginas isoladas), então vem por último.

### Referências encontradas

| Projeto | Como faz | Observações para o Kover |
| --- | --- | --- |
| [flip_page](https://pub.dev/packages/flip_page) (Flutter, MIT, 0.1.4) | Curva de papel com física e sombra; páginas são widgets; `FlipPageController` com `next`, `previous` e `animateTo` | Puro Flutter e todas as plataformas. Sem RTL documentado, o que importa para mangá. |
| [book_page_flip](https://pub.dev/packages/book_page_flip) (Flutter, MIT, 0.1.0) | Malha 3D que segue o dedo; páginas por `builder`, widgets ou `ui.Image`; resolução da malha e textura configuráveis | O efeito mais fiel, mas organiza o livro em pares de páginas, que encaixa no modo duplo e não no retrato de página única. Depende de `vector_math`. |
| [page_curl_flip](https://pub.dev/packages/page_curl_flip) (Flutter, MIT, 0.2.4) | Cilindro em 28 fatias sobre um bitmap capturado; RTL automático | Não segue o dedo, só gesto rápido, e foi testado apenas em Android/iOS. É útil como referência de RTL e da captura em 2× do pixel ratio. |
| [flutter_page_curl](https://pub.dev/documentation/flutter_page_curl/latest/) (Flutter) | Shader GLSL na GPU, segue o dedo | Mais leve em CPU. No Android depende do Impeller ligado. |
| [page_turn_animation](https://pub.dev/documentation/page_turn_animation/latest/) (Flutter) | Anima a curva sobre `ui.Image` capturadas, com borda configurável | Referência simples de animação sobre imagens. |
| [flutter_book_reader](https://pub.dev/packages/flutter_book_reader) (Flutter) | Leitor completo com modo de curva que segue o dedo | Útil para ver a integração com paginação e progresso; não serve como dependência. |
| [StPageFlip / `page-flip`](https://www.cssscript.com/book-page-flip-animation/) (JavaScript) | Livro com páginas em imagem (canvas) ou HTML, folhas rígidas ou macias, toque, retrato e paisagem | Candidato para a web do Kavita, com wrapper React ([README](https://cdn.jsdelivr.net/npm/page-flip@2.0.7/README.md)). Verificar a licença antes de considerar o turn.js. |
| [android-page-curl](https://github.com/banta/android-page-curl) e [irurueta-android-gl-curl](https://github.com/albertoirurueta/irurueta-android-gl-curl) (Android) | Curva em Canvas 2D ou OpenGL | Referência de matemática e sombreamento; não são Flutter. |

### Abordagem proposta

1. **Spike comparativo (1 a 2 dias) num ramo separado,** com 3 candidatos:
   - `flip_page`;
   - `book_page_flip`;
   - um `CustomPainter`/fragment shader próprio, que curva as imagens da página atual e da próxima.

   Critérios, medidos no S6 Lite com um CBZ real:
   - segue o dedo e permite desistir no meio do gesto;
   - suporta RTL (mangá), página única em retrato e modo duplo em paisagem;
   - mantém 60 fps e uso de memória aceitável com páginas grandes;
   - convive com zoom (sem curva enquanto houver zoom);
   - funciona com teclado/controles e com o pré-carregamento atual.
2. **Integração como opção, sem trocar o comportamento padrão.** "Animação de virada" em Configurações do leitor: Nenhuma, Deslizar (atual) ou Folha. A opção "Reduzir animações", que já existe, força "Nenhuma". Progresso, marcadores e pré-carregamento continuam vindo do provider atual; a animação só muda a apresentação.
3. **Ordem de entrega:**
   1. imagens em página única;
   2. modo duplo;
   3. EPUB, a partir da captura das subpáginas;
   4. PDF em modo página a página.
4. **Web do Kavita (uso no PC), por último:** um modo "Livro" no leitor de imagens usando o StPageFlip. O leitor contínuo e o webtoon ficam como estão.

### Web: StPageFlip sem sombra no centro das páginas duplas

O usuário avaliou o StPageFlip como bom para o PC. Em páginas duplas, porém, não deve aparecer sombra no centro, a "lombada".

O que o código da biblioteca mostra ([Nodlik/StPageFlip](https://github.com/Nodlik/StPageFlip), MIT, último commit em 2024-01):
- **Modo canvas (`loadFromImages`):** desenha sempre uma sombra fixa no meio do livro aberto (`drawBookShadow` em `src/Render/CanvasRender.ts`), e `drawShadow` não a desliga.
- **Modo HTML (`loadFromHtml`):** não tem essa sombra fixa, só as sombras do movimento da folha (`stf__outerShadow`, `stf__innerShadow`, `stf__hardShadow`), controladas por `drawShadow` e `maxShadowOpacity`.

Decisão proposta:
- usar o **modo HTML**, com cada página como `<img>` vinda do endpoint de imagens atual do Kavita;
- deixar configurável a sombra durante a virada: ligada e suave (`maxShadowOpacity` baixo) por padrão, ou desligada (`drawShadow: false`);
- nenhuma sombra parada entre as duas páginas;
- capa e contracapa sozinhas com `showCover`;
- retrato automático (`usePortrait`) em janelas estreitas.

#### Código incorporado ao projeto, não dependência

Decisão do usuário (2026-10-19): trazer o código-fonte do StPageFlip para dentro do Kavita e ajustá-lo livremente, como parte da nossa implementação, em vez de instalá-lo como pacote npm.

A licença MIT permite isso: copiar, modificar e redistribuir, inclusive misturado ao nosso código, com uma condição: manter o aviso de copyright e o texto da licença MIT junto às cópias ou partes substanciais. Ela é compatível com a GPLv3 do Kavita: o código incorporado mantém o aviso MIT, e o conjunto e as nossas alterações seguem a GPLv3.

Como fazer:
- **Local:** `UI/Web/src/app/_vendor/page-flip/` (ou uma pasta de componente própria), só com os fontes TypeScript usados.
- **Licença:** `LICENSE` original com o copyright do autor e um `README.md` de procedência (repositório, commit exato copiado, data e lista das nossas alterações). Cada arquivo de origem mantém o cabeçalho original, quando existir, e acrescenta uma linha "Modificado para o Kavita".
- **Créditos:** citar o componente na lista de terceiros do projeto ou num `NOTICE`.
- **Primeiras alterações:**
  - remover a sombra fixa do centro (`drawBookShadow`) também no modo canvas;
  - retirar o que não usarmos;
  - tipar para o TypeScript estrito do Kavita;
  - integrar ao ciclo de vida do Angular (criar e destruir com o leitor, sem vazamento de listeners).
- **Testes próprios:** como o código passa a ser nosso, ele ganha testes (Vitest) do motor de virada: cálculo do canto e do ângulo, troca de páginas, retrato e paisagem, e direção.
- **Atualizações futuras:** como o upstream está parado desde 2024, não há sincronização automática. Correções de lá entram à mão, registradas no `README.md` de procedência.

Cuidados:
- `usePortrait` clona os elementos HTML, o que pede atenção à memória com capítulos grandes: carregar só a janela de páginas próximas;
- direção direita-para-esquerda para mangá: confirmar no protótipo, ou inverter a ordem das páginas;
- teclado e cliques laterais do leitor atual devem continuar funcionando;
- o progresso é salvo como hoje.

Testes:
- componente (Vitest/jsdom) que verifica as opções enviadas ao `PageFlip` (modo HTML, sombra configurável, `showCover`, direção);
- teste que garante que o modo "Livro" não monta o renderizador canvas;
- aceite visual no navegador do PC com um CBZ de páginas duplas: centro limpo parado e durante a virada.

#### Situação em 2026-10-19: implementado, aguardando aceite no navegador

- Código em `UI/Web/src/app/_vendor/page-flip/`, com `LICENSE`, `README.md` de procedência (commit `ab30ecc…` copiado e lista de alterações), cabeçalho em cada arquivo e crédito no `README.md` da raiz.
- O modo canvas foi **removido** em vez de corrigido: sem ele não há `drawBookShadow`, e o componente nunca cria `<canvas>`.
- Corrigidos dois vazamentos do original: o laço de `requestAnimationFrame` seguia rodando depois do `destroy()` e o listener de `resize` ficava registrado.
- No lugar do retrato automático (`usePortrait`), uma opção nova `forcePortrait`: uma ou duas páginas segue o layout do leitor (Single ou duplo), não a largura da janela. Assim não há clonagem de páginas.
- Componente `app-book-renderer`: carrega só as imagens a até 3 páginas da atual, inverte a ordem em RTL, vira com animação para a página vizinha e salta para as distantes. Um clique no meio da página abre o menu do leitor; os cantos e o arraste viram a página.
- No leitor de imagens, botão de livro na barra inferior, visível só no modo esquerda/direita. A escolha fica salva no navegador (`localStorage`). Os renderizadores atuais continuam montados e escondidos, porque a paginação pergunta a eles quanto avançar; teclado, cliques laterais, troca de capítulo e progresso seguem o caminho de sempre.
- Testes: `page-flip.spec.ts` (4), `book-pages.spec.ts` (10), `book-renderer.component.spec.ts` (20), `book-renderer.engine.spec.ts` (11) e `book-mode.spec.ts` (4), todos com RED comprovado. Suíte web 74/74, lint sem apontamentos nos arquivos novos e build de produção concluído.
- Primeiro aceite (r5): em janela larga o livro passava da altura da tela, porque o StPageFlip deriva a altura da largura. Corrigido no r6: a largura fica limitada a altura da tela × proporção do livro.
- Segundo aceite (r6): páginas duplas (spread, `isWide` das dimensões do capítulo) apareciam como uma página comum. No r7:
  - com duas páginas, o spread ocupa o livro aberto inteiro, uma metade da imagem de cada lado; quando a metade esquerda cairia no lado direito, entra uma página em branco antes, como num livro impresso;
  - com uma página, o livro abre em duas ao chegar no spread (decisão do usuário) e volta a uma depois;
  - o livro é refeito a cada capítulo carregado, mesmo com o mesmo número de páginas, já com as dimensões conhecidas.
- Terceiro aceite (r7): ao abrir um capítulo com progresso salvo, as imagens não apareciam e o servidor registrou cerca de 8.400 gravações de progresso em 20 minutos, alternando entre as páginas 0 e 5 (o problema já existia no r6). Causa: durante o `loadFromHTML` o PageFlip mostra a primeira posição e depois a inicial, cada uma com evento `flip`, e o componente as repassava ao leitor como viradas. Corrigido no r8: eventos durante a montagem são ignorados. Regressão em `book-renderer.engine.spec.ts`, com o motor real, porque o livro falso não reproduzia o problema.
- Quarto aceite (r8): depois da primeira virada o laço voltou, entre as páginas 0 e 2, e o pagefile do Windows subiu para 80 GB. Causas e correções no r9:
  - o leitor (pares de página do servidor) e o livro (posição da esquerda do par, que em RTL é a página maior) nomeiam o mesmo par por regras diferentes e se corrigiam sem fim. Agora a sincronização é pelo que está visível: o livro não vira para uma página que já está na tela, e só informa uma virada quando a página do leitor saiu da tela, pela primeira página do par na ordem de leitura;
  - `flipPrev` do motor mirava `x: 10` fixo e, com o livro centralizado e `disableFlipByClick`, a virada para trás (e todo avanço em RTL) era descartada.
- Quinto aceite (r9): "Página sem resposta" no Chrome. Diagnóstico no Chrome real (web em modo desenvolvimento em 127.0.0.1:4200 com proxy para o servidor, perfil temporário, CDP com rastreamento por `console.warn` dos métodos do livro, do motor e do leitor): ao abrir ou fechar o livro de uma página em torno de uma página dupla, `setForcePortrait` reexibe a posição anterior com eventos `flip` intermediários, que eram repassados ao leitor; abrir e fechar se alternavam numa cadeia infinita de microtarefas (0, 2, 0, 2…). Corrigido no r10: eventos durante a abertura ou o fechamento feitos pelo próprio componente são ignorados. Regressões com o motor real para 2→1, 3→2, 1→2 e 2→3 (sem a correção: `[0, 1]` e laços com mais de 600 avisos). Conferido depois no Chrome: passagens pela página dupla nos dois sentidos, sem travar e sem avisos espúrios.
- Sexto aceite (r10): sem travamentos, mas a imagem não ocupava a tela cheia: cada página do livro tinha proporção fixa de 2:3, e as do Elric são mais largas (0,743). No r11 o livro usa a proporção típica do capítulo (mediana das páginas comuns, de `pageDimensions`); no Chrome o livro passou a ocupar 944 de 945 px de altura.
- Sétimo aceite (r11): num mangá, a página dupla separada em dois arquivos (páginas 3 e 4 do capítulo) não se emendava. O leitor usa o layout "Duplo invertido" (mangá: página menor do par à direita), que o livro ignorava. No r12 o livro segue os três layouts duplos (`bookShape`): invertido lê da direita para a esquerda, "sem capa" pareia desde a primeira página. Também corrigido: em leitura da direita para a esquerda com total ímpar, os pares do livro saíam deslocados dos do leitor, porque o PageFlip pareia a partir do fim do livro invertido; uma página em branco no fim da leitura alinha os dois. Conferido no Chrome: par 4|3 emendado, → para 6|5, ← para 4|3 e 2|1.
- Limitação observada: arrastar o canto da página com o mouse não vira, porque a área de paginação do leitor (camada lateral transparente) fica por cima do livro. Clique nas laterais e teclado funcionam.
- Limitações conhecidas: o leitor não tem spec própria, então a ligação no template só é verificada pelo build e pelo aceite manual. Virar a última página no livro com o mouse não abre o próximo capítulo; as setas e o teclado abrem.

### Testes e aceite

- **RED/GREEN:**
  - controlador de virada: o gesto além do limiar vira a página, e abaixo dele volta;
  - em RTL a direção inverte;
  - com zoom não há curva;
  - "Reduzir animações" vale como "Nenhuma";
  - o progresso salvo é o mesmo nos três modos.
- **Teste de widget:** com imagens sintéticas.
- **Aceite manual no S6 Lite:** CBZ em retrato e paisagem, mangá RTL, EPUB e PDF, também sem rede.
- **Desempenho:** medido com o perfil do Flutter, com a meta registrada.

## 2. Pastas completas offline no Kover

### 2a. Mostrar o que está baixado no dispositivo

Pedido do usuário: deixar visível quais pastas e quais exemplares estão no tablet.

- **Marcador visual pedido pelo usuário:**

  | Estado | Ícone (canto do card) | Observação |
  | --- | --- | --- |
  | Baixado no tablet (completo) | **Nuvem com check** (`LucideIcons.cloudCheck`, disponível no `lucide_icons_flutter` que o Kover já usa) | O check deixa claro que a cópia já está no aparelho, e não só disponível no servidor. |
  | Parcial (pasta ou série com parte baixada) | Nuvem com check e contagem "3/8" | Sem estado ambíguo. |
  | Só no servidor | **Ícone de download** (`KoverIcons.download`, já existente) | Tocar no ícone pode iniciar o download, com confirmação de espaço. |
  | Baixando | Anel de progresso no lugar do ícone | Download incompleto nunca mostra a nuvem. |

  Os ícones aparecem nos cards de pasta, série, volume e capítulo, nas listas e na página da série, com contraste suficiente sobre qualquer capa (fundo semitransparente) e rótulo de acessibilidade ("Baixado no dispositivo" / "Disponível só no servidor").
- **Estado da pasta:** vale para a pasta e todas as subpastas. Uma série é "baixada" quando todos os seus capítulos estão baixados por completo; download incompleto conta como não baixado (regra do AGENTS.md).
- **Série, volume e capítulo** (cards, listas e página da série): o mesmo selo. O percentual de séries com formatos misturados passa a ser calculado por capítulo, corrigindo a aproximação atual.
- **Fonte dos dados:** `downloaded_pages` e `series_folders`, já locais, então funciona sem rede.
- **Testes:**
  - DAO: estado da pasta com capítulos baixados, parciais e ausentes, incluindo subpastas e download incompleto;
  - widget: selos nos três estados;
  - remover um download atualiza o selo sem nova sincronização e sem novo download.

### 2b. Aba "Offline"

Pedido do usuário: uma aba que lista tudo o que está disponível sem rede, de todas as fontes, organizada **apenas pelas pastas**.

- **Destino novo na barra de navegação,** "Offline" (`NavbarDestinations.offline`), que o usuário pode posicionar como os outros.
- **Conteúdo:** a mesma árvore e os mesmos cards da tela "Pastas", mas só com séries que têm algum capítulo baixado.
  - Bibliotecas e origens diferentes não são separadas por tipo: o primeiro nível são as pastas de origem do PC (Mangas, Livros, Quadrinhos…), como no Explorer.
  - Pastas sem nada baixado não aparecem.
  - Uma pasta só com arquivos abre direto a série.
- **Ao abrir uma série pela aba,** os itens baixados aparecem destacados, e há um filtro "só baixados".
- **Leitura:** sem rede e direta. A remoção local a partir da aba segue as regras atuais: apaga só a cópia do tablet, preserva o progresso e não dispara novo download.
- **Reuso:** a função `folderView` e o `FolderBrowser` atuais. A diferença é a fonte das entradas: uma consulta que junta `series_folders` com as séries baixadas de todas as bibliotecas, prefixando o nome da biblioteca como pasta raiz.
- **Testes:**
  - DAO: a consulta multibiblioteca mantém só séries baixadas e põe o nome da biblioteca como raiz;
  - widget: aba vazia, árvore com duas bibliotecas e navegação até a série;
  - aceite no S6 Lite em modo avião.

### 2c. Também nesta frente

- **Pré-baixar as capas usadas na árvore,** também as das séries, junto com a sincronização. Hoje as capas de séries ainda não abertas aparecem vazias sem rede.
- **"Baixar pasta":** baixa todas as séries de uma pasta e das subpastas, mostrando o espaço necessário antes. A remoção local da pasta inteira apaga só os downloads, preservando progresso e pendências.

## 3. Progresso por pasta

- **Kavita:** nos cards de pasta da web, uma barra ou contagem de lidos e não lidos, calculada a partir do progresso existente, sem dado novo.
- **Kover:** o mesmo indicador calculado no banco local, funcionando offline.

## 4. Navegação de volta à pasta

- **Na página da série (web e Kover),** uma trilha com o caminho da pasta, levando de volta ao nível de origem. Hoje o "voltar" depende do histórico.
- **Busca dentro da árvore:** filtrar pastas e séries pelo nome a partir do nível atual.

## 5. Aceites e testes pendentes

- **Ciclos ainda não testados:** CBZ e EPUB com download, leitura offline, remoção e sincronização (o PDF já foi validado).
- **Duas contas no mesmo tablet e a mesma conta em dois tablets,** conferindo que o progresso de cada pessoa não se mistura.
- **Kover da Play Store:** documentar que ele não conhece séries mistas, ou detectar o servidor do fork e avisar.
- **Documentação:** trocar títulos do acervo por nomes genéricos nos registros versionados.

## 6. Operação do servidor

- **Um único script de implantação parametrizado** (imagem e volume): validar, fazer checkpoint, trocar e conferir saúde. Ele substitui os scripts por versão (`apply-main-r*.ps1`), e o build da imagem do fork vai para a CI.
- **Backup automático do banco:** cópia consistente agendada, com retenção e teste de restauração.
- **Limpeza documentada do que não é mais usado:**
  - volume `kavita-derived-books`;
  - imagens antigas;
  - volumes de clone e checkpoint antigos.

  Cada remoção só com autorização explícita.
- **Avaliar o scan automático por mudança de pasta** (folder watching) com o acervo no PC, ou documentar o scan manual após adicionar arquivos.

## 7. Manutenção do fork

- **Processo de atualização a partir do upstream** (Kavita e Kover), com as mudanças do fork isoladas e a lista de testes a rodar depois de cada atualização.
- **Regenerar o cliente OpenAPI do Kover** a partir do Kavita do fork, retirando as chamadas manuais (`folder-series`, `folder-covers`, `folder-cover`).
- **Assinatura e versão do APK Kover Local** para instalações fora do modo debug.

## Ordem sugerida

1. Item 5 (aceites) e o spike do item 1, em paralelo.
2. Itens 2a (selos de download) e 2b (aba "Offline"), que reaproveitam a árvore pronta.
3. Item 1 (folha) nas imagens do Kover.
4. Item 2c.
5. Itens 3 e 4.
6. Item 1 no EPUB e no PDF do Kover e modo "Livro" (StPageFlip em modo HTML, sem sombra central) na web.
7. Itens 6 e 7, de forma contínua, com o backup automático o quanto antes.
