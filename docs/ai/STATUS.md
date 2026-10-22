# Estado atual e pendências

Atualizado em 2026-10-21. Este é o resumo para retomar o trabalho. O detalhe item a item, com evidências e commits, fica no [plano de robustez](../plans/ROBUSTEZ_E_MELHORIAS.md). Confira sempre o código, a configuração e o servidor em execução antes de agir: este texto pode ficar desatualizado.

## Alteração local em revisão (2026-10-21)

EPUB como livro na web: **L1 e L2 aprovadas visualmente pelo usuário em 2026-10-21**, sem deploy. A L2 mantém texto vivo: após a reprovação inicial do recorte, o usuário escolheu corrigi-lo, e a geometria agora coincide com o leitor, inclusive no maior EPUB e no CSS de editor. A camada PageFlip existe somente durante a virada; no fim o leitor avança e salva uma vez. Uma/duas páginas, LTR/RTL, teclado, roda, botão e toque passaram no Chrome. Movimento reduzido usa o salto imediato da L1. **L3 aprovada pelo usuário em 2026-10-22 e implantada no principal no mesmo dia**: mudar fonte, entrelinha, margem, tema ou layout, inclusive durante uma virada, mantém o texto do topo da dupla (decisão do usuário de 2026-10-21); 130 testes web e 137 checks e2e passaram. Visual aprovado pelo usuário numa prévia local com o acervo real; o defeito das colunas vizinhas durante a virada foi corrigido (131 testes web, 143 checks e2e). Achado da prévia, corrigido em 2026-10-22 com autorização: o backup automático passou a incluir `config/themes` (tema personalizado do site); teste de backup/restauração com 12 checks verde e backup real do principal conferido com o tema. Consulte [a validação](../validation/EPUB_LIVRO.md) e [o plano](../plans/EPUB_LIVRO.md). L4 e L5 não iniciadas; L6 exige escolher as opções de texto, e L7 é opcional.

Validação local: 104 testes web, 94 de leitura/releitura no servidor e 58 checks e2e (16 PDF + 42 EPUB) passaram. O ensaio corrigiu também a perda de posição no primeiro HTML do EPUB: `pageNum == 0` com `bookScrollId` válido agora é salvo. Contrato de progresso e Kover mantidos. Há capturas sintéticas no registro; a imagem usada no e2e é descartável e não serve para deploy.

Validação mais recente da L2: **126 testes web e 107 checks e2e passaram** (58 anteriores, 43 de animação e seis de recorte); build de produção e lint dos arquivos alterados passaram, com avisos anteriores. No maior EPUB (35 MB), cinco montagens de recortes tiveram máximo de 14,8 ms e zero diferenças geométricas; uma virada completa levou 652 ms, com uma gravação e o índice HTML preservado. No sintético, viradas levaram 610–652 ms. Os ambientes descartáveis, inclusive a cópia pessoal, foram removidos após conferir o hash do original. O principal não foi alterado. A imagem de entrega de um worktree limpo continua pendente; a UI foi validada por montagem somente leitura sobre a imagem de testes da L1.

## Como está em produção

### Servidor (PC)

- **Imagem:** `kavita-fork:fork-v1.1-50-g11986f5fd`, em produção desde 2026-10-22 10:08, com autorização do usuário.
  - Contém o modo livro no PDF da web, as páginas de PDF sob demanda, o EPUB como livro (L1 a L3, com margem junto à lombada e capitulares misturadas ao papel) e a posição salva no primeiro HTML do EPUB.
  - Antes do deploy: e2e completo contra a imagem (147 checks); depois: health, HTTPS 200, montagens somente leitura e interface nova conferidos.
  - Rollback: checkpoints `kavita-checkpoint-kavita-offline-f1-20261022-100805` (antes desta imagem) e `...-20261022-091216`; imagens anteriores `kavita-fork:fork-v1.1-47-gfeb77a016` e `kavita-fork:fork-v1.1-36-g9feb36c54`. A retenção voltou a manter 2 checkpoints.
- **Containers do projeto Compose `kavita-offline-f1`:**
  - `kavita`: HTTP só em `127.0.0.1:5000`, para manutenção no próprio PC;
  - `https`: proxy Caddy, só em `192.168.1.113:5443`, com autoridade certificadora local.
- **Volume ativo:** `kavita-folders-main-active-20261019-r3`. Os 2 checkpoints mais recentes são mantidos pelo `deploy-fork.ps1`.
- **Rede:**
  - IP do PC reservado no roteador (DHCP).
  - Firewall `KavitaOfflineF1-*` libera só a porta 5443, só para `192.168.1.0/24`.
  - Nenhuma publicação pública.
- **Tarefas do Windows:**
  - "Kavita - backup": diária às 03:00, para `C:\KavitaBackups`, com retenção 7 diários + 4 semanais. Restauração testada em 2026-10-20.
  - "Kavita - saude": no logon e a cada 15 min. Abre o Docker Desktop, religa os containers e notifica problemas.
  - O Docker Desktop inicia com o Windows. O reinício real do PC foi testado.
- **`C:\KavitaBackups`** (privada; o usuário guarda uma cópia cifrada na nuvem particular):
  - `kavita-config-*.tar.gz`: banco, capas e configuração;
  - `https\root.crt` e `https\root.key`: a raiz da autoridade local;
  - `kover-keystore\`: a chave de assinatura do Kover Local, cópia da chave debug (SHA-256 `9c8f74f3…`).

  **Nunca versionar nem copiar para o repositório.**
- **Navegador do PC:** confia na raiz (`certutil -user`) e usa `https://192.168.1.113:5443`.

### Tablet (Samsung Galaxy Tab S6 Lite, Android 14)

- **App:** Kover Local **release** (`com.rodonisi.kover.local`), do commit `baa6cb4`. Foi instalado por cima do debug, com os dados preservados.
- **Servidor no app:** `https://192.168.1.113:5443`, com a raiz embutida no APK. "Ignorar validação do certificado" fica desligado.
- **Para gerar e instalar:**
  ```powershell
  ..\kover\tool\build_apk.ps1 -Mode release
  adb install -r ..\kover\build\app\outputs\flutter-apk\app-release.apk
  ```
  O APK grava o `git describe` (visto em Configurações), embute a raiz e assina com a chave do fork.

### Repositórios

- **Kavita, `fork/v1.0`:** sincronizado com `origin`. O push foi feito fora desta sessão, pela sincronização do editor. A CI `fork-ci.yml` pode ter rodado; confira no GitHub.
- **Kover, `fork/v1.0`:** 21 commits à frente de `origin`. **Push pendente da confirmação do usuário.**
- **`docs/plans/KAVITA_KOVER_OFFLINE.md`:** tem alteração local do usuário que não deve ser commitada sem pedido.

## O que foi feito (2026-10-19 e 2026-10-20)

| Área | Resultado |
| --- | --- |
| Web: modo "Livro" | Virada de página no leitor de imagens (StPageFlip vendorizado), páginas duplas, proporção real, sem laços de progresso |
| Web: PDF como livro (V1) | Com o modo ligado, PDF abre no leitor de imagens; botão "Livro" no leitor de PDF; progresso de PDF agora é índice da página, igual ao Kover |
| Servidor: PDF sob demanda (V2) | Página renderizada quando pedida; abertura de 125 págs. em 0,75 s (era 13 s) e de 1336 em 5,8 s (era 8 min) |
| Proteção do progresso (fase 1) | Pendência só sai quando aceita; troca de conta protegida; leitura mais recente vence; limite de 1 gravação/300 ms no servidor; debounce na web |
| Downloads no tablet (fase 2) | Novas tentativas, cancelamento seguro, falha visível, selos por estado, checagem de espaço, serviço em segundo plano com notificação |
| App release (fase 3) | Release AOT assinado com a chave do fork, versão com SHA, cliente da API gerado do fork, CI dos dois repositórios |
| Acervo (fase 4) | Pasta ou arquivo renomeado e troca de montagem mantêm séries e progresso; capas de pasta acompanham; reparo após scan interrompido; arquivo novo no PC entra pelo scan agendado de hora em hora |
| Operação (fases 0 e 5) | Deploy com checkpoint e volta automática; backup automático testado; tarefa de saúde; HTTPS com autoridade local; roteiro de atualização do upstream |
| Tablet: experiência (6.1 a 6.3) | Selos de download nas pastas ("3/8"), aba "Offline" por pasta, filtro "Só baixados", "Baixar pasta" com estimativa de espaço, capas de séries sempre sincronizadas |
| Testes (7.1) | `scripts/e2e/run.ps1`: Kavita descartável + Chrome por CDP, 16 verificações do modo livro no PDF |

Números das suítes na última execução: Kavita serviços 3046 (sem falhas), servidor 113, banco 99, web 88; Kover 444; e2e 16/16.

## O que falta, em ordem sugerida

1. **Virada de página no tablet (V5 a V12, item 6.4):**
   - regras compartilhadas com o PC, com casos de teste em JSON comuns (V6);
   - escolha do motor de animação no S6 Lite (V7);
   - imagens (V8), PDF (V9) e EPUB (V10);
   - progresso (V11);
   - opção Nenhuma / Deslizar / Livro (V12).
2. **Leitura no tablet:**
   - direção e layout por série (6.5);
   - `cacheWidth` pela tela e PDF lido do arquivo (6.6).
3. **Progresso por pasta e trilha de volta**, no tablet e na web (6.7 e 6.11, MELHORIAS 3 e 4).
4. **Acabamento do modo livro na web:**
   - arrastar o canto (6.8);
   - medir os renderizadores escondidos (6.9);
   - última página abre o próximo capítulo (6.10).
5. **Robustez:**
   - **2.5:** cópia no tablet de um arquivo que mudou no PC (guardar tamanho e data no download);
   - **1.9:** exportar/importar progresso pendente;
   - **0.7:** inventário do `_temp`, cerca de 21 GB. Apagar só com autorização;
   - **2.8:** aceite do download com a tela desligada;
   - **5.6:** registrar no guia o pagefile de 16 a 32 GB.
6. **Aceites manuais:**
   - CBZ e EPUB no tablet (baixar, ler offline, remover, sincronizar);
   - duas contas no mesmo tablet e a mesma conta em dois tablets;
   - F1 a F5 do plano offline;
   - EPUB derivado do MOBI;
   - Kover da Play Store com o servidor do fork;
   - nomes genéricos no lugar de títulos do acervo nos registros versionados.
7. **Administração:**
   - push do Kover (aguarda o usuário);
   - conferir a CI no GitHub;
   - a raiz da autoridade vale até 2036.

**Fora do escopo por enquanto:**
- V3: não é necessário, porque o V2 resolveu o tempo;
- V4: L4 a L7 do [EPUB como livro no PC](../plans/EPUB_LIVRO.md); L1 a L3 estão aprovadas e implantadas;
- as melhorias futuras F1 a F19 do plano.

## Cuidados aprendidos nesta fase

- **Navegador nos testes:** o Chrome headless não carrega o visualizador de PDF da web; a e2e usa janela fora da tela e perfil novo a cada execução (um perfil antigo serve a web velha do cache).
- **Arquivos que parecem texto:** documentos e imagens são binários no `.gitattributes`. Um PDF só ASCII era corrompido pelo CRLF.
- **Cache de capítulo:** `CacheService.GetCachePath` termina em barra; pastas próprias de cache ficam ao lado da pasta do capítulo, não dentro.
- **Progresso de PDF:** é o índice da página (0 = primeira); o leitor de PDF da web converte com `pdf-progress.ts`.
- **Builds do servidor:** com mudanças locais do usuário, gere a imagem de um worktree limpo (`_temp/build-worktree`), com `npm ci --legacy-peer-deps`.
- **Scripts no Windows PowerShell 5.1:**
  - PowerShell com textos acentuados precisa de BOM;
  - não redirecione stderr dos testes de deploy (`2>&1`);
  - tarefas agendadas rodam via `conhost.exe --headless powershell.exe …`: com `-WindowStyle Hidden` um console piscava na tela a cada execução.
