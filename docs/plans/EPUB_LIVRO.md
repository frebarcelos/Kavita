# EPUB como livro na web (PC)

Criado em 2026-10-21. Detalha o item V4 do [plano de robustez](ROBUSTEZ_E_MELHORIAS.md#virada-de-página-em-todos-os-formatos-pc-e-tablet), que estava fora do escopo. Marcações: [F] fato conferido no código, [H] hipótese a medir, sem marcação = proposta.

## Execução em 2026-10-21

- **L1 aprovada pelo usuário em 2026-10-21:** implementação local da chave Livro, layout de duas páginas sem alterar o perfil salvo, lombada, bordas proporcionais, temas e margem interna. Passaram 104 testes web, 94 de leitura/releitura e 58 checks e2e. Evidências, capturas e limites no [registro de validação](../validation/EPUB_LIVRO.md).
- **L2 aprovada visualmente pelo usuário em 2026-10-21:** recorte com texto vivo, PageFlip somente durante a virada e confirmação única ao terminar. Passaram 126 testes web e 107 checks e2e; a medição final no maior EPUB teve zero divergências, montagem em até 14,8 ms e virada em 652 ms. Sombra inicial em 0,5 aceita.
- **L3 aprovada pelo usuário em 2026-10-22** (prévia local com o acervo real; corrigidas as colunas vizinhas durante a virada): ao mudar a aparência o leitor mantém o texto que estava no topo da dupla, alinha a dupla inteira, restaura antes de um comando imediato e também durante uma virada interrompida. Passaram 130 testes web e 137 checks e2e. Decisão do usuário em 2026-10-21: quando o texto do topo e o elemento do `bookScrollId` não cabem juntos, vale o texto do topo (L3.1 revisada). L4 e L5 não iniciadas.
- **L4 implantada no principal em 2026-10-22 (`kavita-fork:fork-v1.1-53-g9b31efd1d`) e aceita pelo usuário:** a virada fecha a seleção e o menu; destaques aparecem nas folhas que viram; links internos, sumário, anotações, marcadores e sumário pessoal com destino no HTML aberto viram até ele com uma única virada. Não há busca dentro do livro no leitor de EPUB; o item da busca não se aplica. 138 testes web e 164 checks e2e.
- **L5 implantada no principal em 2026-10-22 (`kavita-fork:fork-v1.1-56-g29db2c653`), aguardando aceite no PC:** a ponta da página levanta sob o mouse perto de um canto externo; arrastar além da lombada vira, soltar antes volta sem gravar; o canto esquerdo volta uma dupla; no fim do HTML, o arraste abre o arquivo seguinte. A camada de toque libera o mouse só enquanto o livro está sob ele. Não depende mais do item 6.8: a solução é própria do leitor de EPUB. 147 testes web e 174 checks e2e.
- **L6 implementada localmente em 2026-10-22:** justificar, hifenização, espaço entre parágrafos, recuo da primeira linha e ignorar estilos do livro, no perfil de leitura do servidor (migração `EpubTextOptions`). Valem com e sem o livro.
- **L7 implementada localmente em 2026-10-22:** a lombada do EPUB entre duas páginas abertas do leitor de imagens e do PDF, fora da capa sozinha, das páginas largas e do modo de uma página; sombra da virada em 0,5. Com L6 e L7: 161 testes web, 3.061 testes de serviços (3.055 aprovados, 6 ignorados já existentes) e 197 checks e2e.
- Nenhum deploy no principal nem mudança no Kover nesta entrega.

## Pedido

No app web do PC, o EPUB deve abrir num "livro virtual" com virada de página, como o modo "Livro" já faz com imagens e PDF. Dentro do livro continua possível mudar tamanho e estilo da fonte, tema, margens e o resto das preferências de leitura, e o livro se refaz com o texto novo. O livro deve parecer um livro: lombada no meio, bordas das folhas, sombras e ponta que dobra, ocupando a tela inteira com duas colunas, uma por página.

## O que existe hoje

- [F] O EPUB abre no leitor de livros do Kavita (`UI/Web/src/app/book-reader/_components/book-reader`), que pagina o capítulo HTML em colunas CSS e anda pela rolagem horizontal (`pageWidth`, `getVirtualPage`).
- [F] Layouts do leitor (`BookPageLayoutMode`): `Default` (rolagem), `Column1` (uma coluna por tela) e `Column2` (duas colunas, como livro aberto).
- [F] Preferências no perfil de leitura (`reading-profiles.ts`): família da fonte (inclusive fontes enviadas ao servidor, `EpubFont`), tamanho, espaçamento entre linhas, margem, tema (branco, papel, escuro, preto), direção de leitura, escrita horizontal ou vertical, toque para paginar e modo imersivo.
- [F] O progresso do EPUB é o índice do arquivo HTML do capítulo (`pageNum`) mais a posição do texto dentro dele (`bookScrollId`). A coluna virtual não é gravada.
- [F] O modo "Livro" das imagens usa o StPageFlip vendorizado (`_vendor/page-flip`) com `loadFromHTML`: as páginas do livro já são elementos HTML, não imagens. A escolha "Livro" fica no navegador (`book-mode.ts`, `localStorage`).
- [F] No modo HTML, o StPageFlip só desenha a sombra da folha que vira (`HTMLRender.ts`), e o fork a usa com `maxShadowOpacity: 0.3` (`book-renderer.component.ts`). A dobra da ponta ao passar o mouse (`showPageCorners`, ligada por padrão) não aparece, porque a camada de paginação do leitor recebe o mouse (item 6.8). Não há sombra fixa no meio nem bordas de folhas.
- [F] Recursos que dependem do texto vivo: seleção, destaques e anotações, marcadores, links internos, notas de rodapé, busca e sumário.

## Decisões de desenho

1. **A paginação continua sendo a do leitor de livros.** O livro não calcula páginas. Ele mostra as colunas que o leitor já mediu. Assim, mudar fonte, tamanho, margem ou tema só refaz a paginação existente, e o livro é remontado em seguida.
2. **Página do livro = coluna do leitor, e o livro ocupa a tela inteira.** Em `Column2`, que é o padrão do modo Livro, a tela vira um livro aberto: cada coluna é uma página, com metade da largura e a altura toda. Nas imagens e no PDF, a proporção da página vem do arquivo e sobram faixas na tela. No EPUB o texto se redistribui, então a página tem a proporção que a tela permitir. Em janela estreita ou em `Column1`, uma página só. `Default` (rolagem) não tem modo Livro.
3. **Texto vivo, não captura de tela.** Cada página do livro é um recorte do conteúdo do capítulo deslocado até a coluna certa: o texto continua vetorial e nítido em qualquer zoom e sem custo de rasterizar. A captura em imagem, prevista no V4 original, fica como alternativa se a medição da L2 reprovar.
4. **Livro só durante a virada (híbrido).** Em repouso, o que aparece é o leitor atual, com seleção, anotações, links e busca funcionando como hoje. Ao virar, o livro se sobrepõe com a página atual e a de destino, anima, e o leitor salta para a coluna nova por baixo. Com isso não é preciso reimplementar nenhum recurso dentro das páginas do livro.
5. **As mesmas regras de sincronização do modo Livro das imagens** (regra 5 do plano de robustez): o livro não informa virada durante montagem, abertura ou fechamento, e só a coluna de destino vira posição do leitor. O progresso gravado continua `pageNum` + `bookScrollId`, sem formato novo para o Kover.
6. **Aparência de livro também em repouso.** Lombada, bordas das folhas e sombras ficam numa camada decorativa sobre o leitor (`pointer-events: none`), toda em CSS do fork e sem alterar o motor.
7. **A mesma chave "Livro"** que já existe no leitor de imagens, guardada no navegador. Escrita vertical e "Reduzir animações" do sistema desligam a virada; lombada e bordas continuam.

## Entregas verticais

Cada entrega vai da interface ao teste ponta a ponta e pode ir para produção sozinha: depois de cada uma, o leitor de EPUB funciona inteiro, com ou sem a chave "Livro". A próxima só começa depois do aceite da anterior.

### Pronto, para toda entrega

- Cada mudança de comportamento começa com o teste em RED, executado e falhando pelo motivo certo (regra do [AGENTS.md](../../AGENTS.md)).
- Suíte web do fork e lint dos arquivos do fork verdes; os cenários novos da entrega em `scripts/e2e/run.ps1`, com EPUB sintético e servidor descartável, nunca o principal.
- Com a chave "Livro" desligada, o leitor se comporta como antes: os cenários e2e sem livro continuam verdes.
- Nenhuma gravação de progresso a mais que no modo sem livro; a página responde em menos de 1 s depois de cada tecla.
- Imagem gerada de um worktree limpo. O deploy no principal fica a cargo do usuário ou exige autorização explícita.
- Registro em `docs/validation/EPUB_LIVRO.md`, com comandos, números das suítes, medidas e limitações. `STATUS.md` atualizado.

### L1: livro aberto parado

**O que o usuário ganha:** com "Livro" ligado, o EPUB aparece como um livro aberto na tela inteira, com duas páginas, lombada e bordas das folhas. A página troca como hoje, sem animação. Fonte, tema e margens continuam ajustáveis.

| Tarefa | Descrição |
| --- | --- |
| L1.1 | Testes de caracterização do leitor atual, com um capítulo sintético: número de colunas, coluna atual e salto para a coluna N, em `Column1` e `Column2`, LTR e RTL. Devem passar no código de hoje, antes de qualquer mudança. |
| L1.2 | Botão "Livro" no menu do leitor de livros, ligado à preferência de `book-mode.ts`. Aparece só com escrita horizontal e fora de `Default`. Ao ligar, o layout passa a `Column2` sem alterar o perfil de leitura salvo no servidor. |
| L1.3 | Camada decorativa (componente próprio do fork): lombada com gradiente no meio, só com duas páginas, e bordas das folhas nas laterais externas, com espessura proporcional à coluna atual no capítulo. |
| L1.4 | Margem interna maior perto da lombada, para o texto não cair na sombra, sem mudar a margem configurada pelo usuário. |
| L1.5 | Cores pelos temas: nos temas escuro e preto, sombra preta mais suave e borda clara. |
| L1.6 | Mudar fonte, tamanho, espaçamento, margem ou tema com o livro ligado repagina e atualiza a espessura das bordas. |
| L1.7 | e2e: abrir no progresso salvo com "Livro" ligado, avançar e voltar, conferir o progresso igual ao do modo sem livro. |

**Aceite:** testes de componente (lombada só com duas páginas, bordas que mudam com a coluna, cores por tema, chave que liga, persiste e some na escrita vertical) e aceite visual do usuário no PC, com capturas registradas.

**Depende de:** nada. Pode começar já.

### L2: virada animada

**O que o usuário ganha:** com setas, toque nas laterais, roda do mouse e o botão de avançar, a folha vira com animação e sombra, e o texto continua nítido durante a virada.

| Tarefa | Descrição |
| --- | --- |
| L2.1 | Gerador de páginas do livro: recebe o elemento do capítulo e o índice da coluna e devolve o recorte (clone com deslocamento e `overflow: hidden`). Gera só a página atual, a de destino e, em `Column2`, as vizinhas do par. Testes de unidade: coluna certa, largura, página em branco no fim. |
| L2.2 | **Ponto de decisão.** [H] Medir no Chrome, no clone descartável, com o maior EPUB do acervo e com um EPUB com CSS do editor (posições fixas, colunas próprias). Se montar uma virada passar de 100 ms ou o CSS quebrar o recorte, parar e decidir com o usuário entre corrigir o recorte e capturar em imagem. |
| L2.3 | Camada do StPageFlip por cima do leitor durante a virada; ao fim, o leitor salta para a coluna de destino por baixo, e a camada some sem deixar laço de animação nem listener. |
| L2.4 | Regra de sincronização 5: uma virada gera um salto de coluna; virar rápido 20 vezes não cria laço nem gravações extras. Testes de componente com livro falso, como em `book-renderer.component.spec.ts`. |
| L2.5 | Virar depois da última coluna passa para o próximo arquivo do capítulo, e antes da primeira volta ao anterior, como as setas fazem hoje. |
| L2.6 | Sombra da virada mais forte que 0,3, com valor escolhido no Chrome junto com o usuário. "Reduzir animações" troca a virada pelo salto da L1. |
| L2.7 | e2e: viradas em `Column1` e `Column2`, LTR e RTL, passagem para o próximo arquivo, tempo de resposta e número de gravações. |

**Aceite:** e2e verde; aceite do usuário no PC com o EPUB do acervo usado na medição.

**Depende de:** L1.

### L3: mudar a aparência sem perder o lugar

**O que o usuário ganha:** no meio do capítulo, com o livro aberto, trocar fonte, tamanho, tema ou layout mantém na tela o trecho que estava sendo lido, e a próxima virada já usa o texto novo.

| Tarefa | Descrição |
| --- | --- |
| L3.1 | Teste RED: aumentar a fonte no meio do capítulo deve manter visível o texto que estava no topo da dupla. **Revisada em 2026-10-21 por decisão do usuário:** a redação anterior pedia o elemento do `bookScrollId`, que o Kavita escolhe entre os elementos inteiros na tela; com colunas mais estreitas ele pode ir para a dupla seguinte, e restaurar o início de elementos fazia o leitor recuar a cada mudança. |
| L3.2 | Ao mudar a aparência, o livro da virada é destruído e refeito sem animação; as páginas herdam o tema e as fontes do leitor, inclusive as fontes enviadas ao servidor. |
| L3.3 | Mudar a aparência durante uma virada cancela a animação e termina na coluna do trecho certo. |
| L3.4 | e2e: mudar a fonte e o tema com o livro aberto, virar e conferir o progresso. |

**Aceite:** os testes acima e nenhum listener sobrando depois de 10 remontagens.

**Depende de:** L2.

### L4: destaques, seleção e links com o livro

**O que o usuário ganha:** destaques, anotações, marcadores, links internos, notas e busca continuam funcionando com o livro ligado, e os destaques aparecem também na folha que vira.

| Tarefa | Descrição |
| --- | --- |
| L4.1 | Durante a virada, seleção e menus ficam fechados; os destaques aparecem nas páginas do livro porque fazem parte do HTML clonado. |
| L4.2 | Link interno, nota, item do sumário e resultado da busca viram até a página de destino, em vez de saltar. |
| L4.3 | e2e: selecionar, destacar, virar e voltar mantém o destaque; seguir um link interno vira para o destino. |

**Aceite:** e2e verde.

**Depende de:** L2. Pode andar em paralelo com a L3.

### L5: ponta que dobra e arraste do canto

**O que o usuário ganha:** ao passar o mouse perto do canto, a ponta da página se levanta; arrastar a ponta vira a folha e permite desistir no meio.

| Tarefa | Descrição |
| --- | --- |
| L5.1 | Perto do canto, o livro é montado e a camada do leitor é liberada nesse canto, para o StPageFlip receber o mouse (mesma solução do item 6.8 do leitor de imagens). |
| L5.2 | Arrastar e soltar além da metade vira; soltar antes volta, e o leitor fica na coluna de antes. |
| L5.3 | Virar a última folha com o mouse passa para o próximo arquivo (como o item 6.10). |
| L5.4 | e2e: dobra ao passar o mouse, arraste completo e arraste desistido, sem gravação de progresso na desistência. |

**Aceite:** e2e verde e aceite do usuário no PC.

**Depende de:** L2 e do item 6.8. Se o 6.8 for feito antes nas imagens, a solução é reaproveitada.

### L6: novas opções de texto

**O que o usuário ganha:** as opções que faltam no menu de leitura, com ou sem o livro.

| Tarefa | Descrição |
| --- | --- |
| L6.1 | **Decidido pelo usuário em 2026-10-22:** as cinco candidatas, guardadas no perfil de leitura do servidor: alinhamento justificado, hifenização, espaçamento entre parágrafos, recuo da primeira linha e "ignorar estilos do livro". |
| L6.2 | Campos no perfil de leitura do servidor, com migração e teste de compatibilidade com o Kover, que não usa esses campos. |
| L6.3 | Uma opção por vez no leitor, cada uma com seu teste RED e cenário e2e, repaginando como na L3 quando o livro estiver ligado. |

**Aceite:** um teste por opção; Kover em produção abrindo e sincronizando EPUB com o servidor novo.

**Depende de:** só da L6.1. Pode andar em paralelo com as outras entregas.

### L7 (opcional): lombada e sombra nas imagens e no PDF

**O que o usuário ganha:** a mesma lombada e a sombra mais forte no modo Livro do leitor de imagens e do PDF. A tela inteira e as bordas proporcionais ficam só no EPUB, porque nas imagens a proporção vem do arquivo.

| Tarefa | Descrição |
| --- | --- |
| L7.1 | Reaproveitar a camada decorativa da L1 no `book-renderer`, só com duas páginas e fora das páginas largas. |
| L7.2 | Rodar os 16 cenários e2e atuais do modo Livro do PDF e acrescentar a lombada. |

**Depende de:** L1 e L2.

## Ordem e paralelismo

L1 → L2 → (L3 e L4 em paralelo) → L5. A L6 corre por fora, desde que a lista seja aprovada. A L7 entra quando o usuário quiser. Encaixa no item 4 de "O que falta" do [estado atual](../ai/STATUS.md), junto com o acabamento do modo Livro (6.8 a 6.10).

## Fora do escopo

- Virada no EPUB do tablet: é o V10 do plano de robustez, no Kover.
- Livro no modo de rolagem (`Default`) e na escrita vertical.
- Mudar o formato do progresso do EPUB ou gravar a coluna virtual.

## Riscos

- [H] O leitor de livros tem cerca de 2.700 linhas e lógica de paginação espalhada. Mexer nele sem a L1.1 é arriscado; preferir um serviço novo que só leia o estado do leitor.
- [H] CSS do próprio EPUB pode quebrar o recorte. Por isso a L2.2 é um ponto de decisão.
- Atualizações do upstream no `book-reader` geram conflito: manter o código novo em arquivos próprios do fork e os ganchos no componente mínimos.
