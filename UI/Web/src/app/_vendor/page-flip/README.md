# page-flip (StPageFlip incorporado)

Cópia do código-fonte do [StPageFlip](https://github.com/Nodlik/StPageFlip), usada pelo modo **Livro** do leitor de imagens (`manga-reader/_components/book-renderer`).

- Origem: `src/` do repositório `Nodlik/StPageFlip`, commit `ab30ecc1d9f6d98de1a99b8e296469382f41c120` (2021-04-18).
- Licença: MIT, Copyright (c) 2020 Nodlik — texto completo em [LICENSE](LICENSE). A MIT é compatível com a GPLv3 do Kavita; mantenha este aviso e o arquivo `LICENSE`.
- O código não é uma dependência do npm: foi incorporado para ser alterado à vontade. Não há atualização automática a partir do original.

## Alterações feitas para o Kavita

Todos os arquivos `.ts` copiados começam com o comentário `// StPageFlip (MIT …), modified for Kavita`.

- Só o modo HTML foi mantido. O modo canvas (`loadFromImages`/`updateFromImages`, `ImagePageCollection`, `CanvasRender`, `CanvasUI`, `ImagePage`) foi removido; era ele que desenhava a sombra fixa no centro entre duas páginas abertas.
- Tipos ajustados para o `strict` do Kavita (`null!`, asserções `!`) e um ternário usado como instrução trocado por `if` (lint), sem mudar o comportamento.
- `Render`: o laço de `requestAnimationFrame` guarda o id e para em `stop()`. O original continuava rodando depois do `destroy()`, prendendo CPU e memória a cada capítulo aberto.
- `PageFlip.destroy()` chama `render.stop()`.
- `UI.destroy()` remove o listener de `resize` da janela, que o original deixava registrado.
- `Settings.forcePortrait` (novo, padrão `false`): sempre uma página por vez, independente da largura da janela. Respeitado em `Render.calculateBoundsRect` e no cálculo de largura da `UI`.
- `PageFlip.setForcePortrait()` (novo): troca entre uma e duas páginas durante a leitura, mantendo a página atual. O leitor abre o livro de uma página em duas ao chegar numa página dupla (spread).
- `Flip.flipPrev()` mira o canto a partir da borda esquerda do livro (`rect.left + 10`), como o `flipNext` faz pela direita. O original usava `x: 10` fixo, que num livro centralizado não acerta o canto; com `disableFlipByClick` a virada para trás era descartada em silêncio.
- O CSS (`Style/stPageFlip.css`) é carregado pelo componente, não importado pelo `PageFlip.ts`.

Testes: `page-flip.spec.ts` cobre as alterações acima.
