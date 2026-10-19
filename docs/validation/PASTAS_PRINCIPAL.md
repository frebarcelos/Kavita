# Organização por pastas no servidor principal

Aplicada em 2026-10-18, às 23h50 (America/Sao_Paulo; 2026-10-19 em UTC), a pedido do usuário. O principal agora executa o fork e usa a organização por pastas nas bibliotecas Mangas, Livros e Quadrinhos. A navegação continua na grade existente; a árvore de pastas é outra entrega.

**Atualização de 2026-10-19:** após o ciclo PDF no S6 Lite e autorização explícita do usuário, Auth Keys foram reativadas e o Kover Local foi conectado ao principal com catálogo limpo. O servidor foi apenas reiniciado com a pausa desativada no JSON; seu banco não foi substituído. No fechamento, o catálogo atual sincronizou 934 arquivos e 127 agrupamentos. Leia [o aceite Android](KOVER_LOCAL.md). Os números e a pausa descritos abaixo registram o checkpoint original da implantação.

## Resultado observado

| Biblioteca | Arquivos de leitura |
| --- | ---: |
| Mangas | 747 |
| Livros | 35, incluindo o EPUB derivado do MOBI |
| Quadrinhos | 149 |
| Total | **931** |

Os arquivos aparecem em **125 agrupamentos por pasta e formato**, com um capítulo por contêiner. **20th Century Boys aparece em uma série com 22 volumes**, e 21st Century Boys permanece separado. Dois quadrinhos antes ausentes foram indexados. A migração desfez 16 capítulos que juntavam arquivos independentes.

Os **8 registros de progresso** existentes no checkpoint final mantiveram capítulos, páginas, posições EPUB e timestamps. Histórico, atividades, papéis, contas e chaves foram comparados. As referências de série/volume foram ajustadas para os novos pais; não foram apagadas linhas antigas de séries, volumes, capítulos ou arquivos. Foram mantidos todos os 201 IDs de séries, 747 de volumes, 998 de capítulos e 1.014 de arquivos do catálogo anterior. Isso não significa que todos os pais continuem iguais: reorganizar pastas exige reparentear entidades.

Registros substituídos e **85 imagens auxiliares** permanecem em uma biblioteca de arquivo, disponível apenas ao Admin, fora das três bibliotecas de leitura e sem monitoramento de pastas. Não houve exclusão dos sete agrupamentos auxiliares nem dos originais. As coleções de apresentação anteriores foram preservadas e receberam vínculos com os agrupamentos atuais; o arquivo também conserva seus vínculos históricos.

Um caminho antigo de quadrinho já não existia no Windows. Foi recuperado explicitamente no catálogo, preservando seu ID, após conferir uma correspondência única de hash KOReader armazenado, tamanho, páginas e formato com o arquivo atual. Não houve correspondência aproximada por título nem renomeação no disco.

## Proteção dos tablets durante a transição

**Durante a implantação, a sincronização por Auth Key foi pausada no principal.** O Kover antigo pode apagar dados locais quando séries desaparecem ou mudam de agrupamento. Além disso, capítulos que antes juntavam arquivos precisam de tratamento próprio no cliente. A reativação posterior usou a instalação Local limpa, pois o usuário autorizou descartar os testes do tablet; não houve aceite de migração automática desses payloads antigos.

O middleware `FolderCatalogMaintenanceMiddleware` retorna HTTP 503 com `folder-catalog-client-update-required` para chamadas `/api` com header `x-api-key` quando `FolderOrganization:ApiKeyMaintenance` está ativo. O navegador com JWT continua funcionando. Não atualizar, reinstalar ou limpar os dados do Kover antigo para contornar a pausa.

A configuração está no arquivo operacional `appsettings.Production.json`. O host limpa os providers padrão e lê JSON explicitamente: definir apenas `FolderOrganization__ApiKeyMaintenance` no ambiente **não ativa** essa proteção. Isso foi detectado no ensaio HTTP e corrigido antes da implantação. Não retirar a pausa antes de preparar e validar a atualização do cliente, os downloads existentes, o progresso pendente e os capítulos divididos. Nenhum APK foi instalado nesta entrega.

## Migração, ensaios e evidências

A ferramenta [migrate_folder_catalog.py](../../scripts/offline/migrate_folder_catalog.py) lê um banco frio e uma referência validada no modo por pastas, e grava **outro banco**. Recusa sobrescrita do destino, perda de cobertura, mudança de páginas/formato e estado pessoal ambíguo em capítulos com vários arquivos. A referência usa os parsers reais do fork. A migração mantém os IDs existentes, arquiva registros substituídos e atualiza referências de progresso, sessões, bookmarks, perfis e histórico em uma transação.

Validações executadas:

- RED funcional de agrupamento/proteções antes da implementação; **13 testes SQLite/CLI** passaram com fixtures descartáveis. Uma regressão adicional demonstrou RED para relatório usando o mesmo caminho do banco de saída; a CLI agora recusa essa colisão e reserva os destinos sem sobrescrita. O workflow offline passou a executar essa suíte.
- A pausa dos clientes apresentou **2 falhas funcionais RED**; depois passaram os **5 testes do middleware** e as regressões de biblioteca/autorização, **11 testes de API** no total.
- O clone completo manteve identidade e progresso após varredura incremental; downloads e capas das três bibliotecas responderam corretamente.
- Backup completo consistente, checksum SHA-256 e ensaio de restauração em volume separado: o servidor antigo voltou saudável e seus registros pessoais permaneceram idênticos.
- Novo checkpoint consistente imediatamente antes da troca, capturando o oitavo progresso criado desde o primeiro ensaio. O volume operacional anterior foi preservado.
- Validação do catálogo migrado e da pausa de Auth Keys em staging antes da publicação na LAN.
- No principal: health 200, três bibliotecas no novo modo, 931 capítulos individuais, Century com 22 volumes, IDs iguais aos do staging, downloads PDF/EPUB/CBZ e três capas aprovados.
- Inventário de **930 contêineres originais** com caminhos, tamanhos e mtimes iguais antes/depois; três PDFs de amostra mantiveram SHA-256. O 931º item é o EPUB derivado, em volume separado somente leitura. Nenhuma prova de escrita foi executada no acervo pessoal.
- Inspeção efetiva do container: fontes somente leitura, dados operacionais separados, sem modo privilegiado e publicação apenas no IPv4 privado da interface doméstica. Pilotos encerrados após a validação.

Uma primeira troca foi interrompida antes de substituir o principal porque a porta 5060 de staging é reservada pelo cliente Fetch. O servidor anterior foi retomado automaticamente; a operação seguinte usou 5080 no loopback e um checkpoint novo. A primeira tentativa não foi tratada como implantação aprovada.

Imagem aplicada: `kavita-folders-main:20261019`, ID local `sha256:229b9e1a9d721129ae1627a70143de5a21f8c68ff5ae770833e39e162bd70343`. Build com o [Dockerfile do fork](../../deployment/offline/Dockerfile.fork), backend self-contained linux-x64 e interface de produção. Os testes anteriores de scanner, leitura, banco, UI e Kover estão no [relatório P1](PASTAS.md); não foram repetidos sem mudança nessas áreas. Não houve inspeção visual automatizada do navegador nem novo aceite Android.

Relatórios, catálogos, backups, hashes e configurações privadas ficam em `_temp/offline-f1/folders`, ignorados pelo Git. Não versioná-los. Os backups contêm o banco e a configuração de autenticação e devem permanecer privados.

## Operação e próximos passos

O override local `compose.libraries.yaml` aponta para a imagem do fork e o volume operacional externo `kavita-folders-main-active-20261019-r2`. Os comandos existentes com Compose base **e override local** continuam corretos; consulte o [guia operacional](../../deployment/offline/README.md). Não usar apenas o Compose base, apagar volumes antigos ou sobrescrever o volume ativo com um piloto.

O principal pode receber novas leituras pelo navegador. Uma restauração futura precisa considerar esses registros posteriores ao checkpoint; não voltar ao banco antigo automaticamente. A volta testada nesta operação foi um ensaio isolado, não uma autorização para descartar progresso novo.

Atualização do Kover e ciclo PDF concluídos conforme o registro Android. Próximos entregáveis: navegação hierárquica, agregação visual de formatos e demais aceites de formatos/contas/dispositivos. A implantação da organização no PC está concluída; migração de payloads antigos divididos continua sendo uma entrega própria.
