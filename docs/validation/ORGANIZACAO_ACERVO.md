# Organização do acervo — validação da implementação

Este relatório registra a estratégia anterior de ajustes de apresentação. A organização por pastas já foi aplicada ao principal; consulte a [implantação atual e seus limites](PASTAS_PRINCIPAL.md), a [validação inicial](PASTAS.md) e o [plano revisado](../plans/ORGANIZACAO_ACERVO.md). As pendências e contagens abaixo pertencem à etapa histórica; os registros auxiliares foram preservados em arquivo, sem exclusão.

Data: 2026-10-18. Estado: ajustes de catálogo aplicados; revisões estruturais e nova aceitação no tablet pendentes.

## Entrega aplicada

- Três bibliotecas mantidas nos diretórios originais, com montagens somente leitura.
- Exclusões de .yacreaderlibrary e capas adicionadas sem remover arquivos do PC; sete séries auxiliares ainda em cache ficaram apenas listadas para aprovação.
- PDF habilitado em Quadrinhos, preservando os formatos que já tinham sido indexados. Comic (Flexible) já estava configurado; o tipo não foi trocado.
- 118 nomes de séries/livros corrigidos no catálogo e nomes de ordenação fixados, sem renomear arquivos. Nomes manuais existentes são preservados pelo planejador.
- 24 coleções por obra, conjunto ou categoria temática, disponibilizadas aos leitores com acesso às respectivas bibliotecas. Volumes antes separados por metadados foram reunidos para navegação em coleções; não foram fundidos em uma única entidade de série.
- Conta comum com acesso às três bibliotecas e os mesmos papéis Login, Download e Pleb; sem Admin.
- Um MOBI convertido com Calibre 8.13.0 para cópia EPUB 3. O MOBI original foi preservado. O derivado foi indexado na mesma biblioteca Livros, em volume Docker dedicado kavita-derived-books, montado somente leitura em /libraries/derived-books.

Não houve mudança no código C#/Angular/Dart, esquema de banco dos aplicativos, imagem upstream fixada ou APK. Não houve commit, push ou publicação de release. Conteúdo, credenciais e relatórios detalhados continuam fora do Git.

## TDD e verificações

A suíte passou: **37 testes, 37 aprovados, nenhuma falha ou teste pulado**:

~~~powershell
node --test scripts/offline/*.test.mjs
~~~

Foram observadas falhas RED e correções GREEN para exclusões precisas, preservação de configuração, limite de URL local, transporte de credenciais em header sem redirects, erro sem corpo sensível, concorrência, identificação por biblioteca, preservação de formatos indexados e planejamento de nomes/coleções. Os testes anteriores de Compose, EPUB sintético, manifesto e montagem protegida continuam passando. A CI existente já usa o glob de testes e inclui os novos arquivos; execução remota não realizada.

O piloto usou 14 cópias representativas em instância separada. Os hashes SHA-256 das 14 fontes foram novamente conferidos ao final e permaneceram iguais. O MOBI também manteve seu hash após conversão. O EPUB derivado passou na leitura independente do ZIP/CRC e XML OPF e foi reconhecido pelo Kavita como EPUB. Não foi executado EPUBCheck completo nem um novo ensaio desse EPUB no tablet.

Uma cópia isolada do banco/configuração completo, em porta limitada ao loopback e volume independente, validou a reindexação incremental e a apresentação. Nessa cópia, nomes persistiram após scan e séries, volumes e capítulos do conteúdo real mantiveram seus IDs. Na instância principal, os IDs foram novamente comparados antes/depois das mudanças.

Auditoria final do banco principal: integrity_check e foreign_key_check aprovados; **7 registros de progresso do conteúdo real, 8 atividades de leitura e o histórico preservados**, com comparação dos registros. Os três registros de posição zero associados às capas não representam leitura de obras; o histórico já registrado permaneceu preservado. Papéis dos usuários, bookmarks, anotações e avaliações foram conferidos. Isso não verifica pendências que só existam no armazenamento offline do tablet.

Montagens efetivas conferidas: quatro binds somente leitura (três pastas pessoais e a amostra), volume de derivados somente leitura e o mesmo volume operacional gravável. Sem modo privilegiado; publicação restrita ao IP privado do Wi-Fi e regras de firewall habilitadas. Health HTTP 200. Piloto e clone foram parados ao concluir os ensaios, com seus estados preservados.

## Reindexação rejeitada e recuperação executada

Uma primeira aplicação com reindexação forçada não passou na auditoria: PDFs já presentes no catálogo não estavam habilitados na configuração antiga de Quadrinhos, e parte do catálogo legado foi reinterpretada com novos IDs. O piloto pequeno não representou todas essas condições do catálogo existente. A operação não foi aceita como entrega.

O serviço foi pausado e o checkpoint consistente foi restaurado. A recuperação conferiu o estado pessoal e preservou o histórico que havia sido materializado depois do checkpoint. Os registros de progresso do conteúdo real foram recuperados antes de retomar a implementação. A nova tentativa foi validada primeiro na cópia completa, acrescentando os formatos já indexados e usando **scan incremental, force=false**. A auditoria final acima corresponde a essa tentativa corrigida.

Não usar force scan ou desligar metadados globalmente como atalho para organizar este catálogo. A interpretação de alguns agrupamentos legados exige migração testada que considere os IDs usados pelo Kover. Uma nova passagem forçada ou troca de tipo precisa ser ensaiada no clone completo antes de afetar a instalação atual.

## Pendências concretas

- **7 casos estruturais** ficaram preservados para revisão: 2 com variantes já misturadas, 2 com livros agrupados e 3 com nomes ambíguos. Não dividir/fundir entidades, trocar IDs ou escolher idiomas por inferência. Os detalhes estão no relatório local; sua resolução precisa considerar capítulos e downloads/progresso pendentes.
- **7 séries auxiliares, 108 imagens de capas** permaneceram no catálogo por causa de registros em cache. Todas foram identificadas como séries inteiras de imagens auxiliares, sem progresso no servidor na auditoria final. A exclusão automática na instância principal foi bloqueada pela revisão automática, pelo risco de perder vínculos/progresso sem autorização explícita dessa remoção. Nenhuma tentativa de contornar o bloqueio foi feita. O código versionado apenas identifica esses candidatos para revisão, sem executar sua exclusão.
- A remoção autorizável é somente dos registros dessas sete séries, mantendo os arquivos e os sete casos estruturais. A lista concreta e as pastas foram preparadas em _temp/offline-f1/auxiliary-review.md. Pendências exclusivamente locais no tablet continuam dependendo de verificação do usuário.
- Confirmar no Kover as bibliotecas e coleções após sincronização. Repetir reinício offline, escolha de formato/idioma, remoção somente local, reconexão e progresso. O relato anterior comprova download/leitura sem Wi-Fi da v1.0, não esses novos aceites.

O plano de organização permanece parcialmente aceito até essas revisões e o ciclo no tablet. A F1 completa e as fases seguintes do plano integrado não foram marcadas como concluídas.

## Ferramentas e operação

[organization.mjs](../../scripts/offline/organization.mjs) contém as regras de exclusão, preservação de formatos e identidade. [organization-api.mjs](../../scripts/offline/organization-api.mjs) usa autenticação normal na API local e detecta edição concorrente. [organization-presentation.mjs](../../scripts/offline/organization-presentation.mjs) prepara nomes e coleções e preserva nomes manuais e casos ambíguos.

As CLIs separam proposta e aplicação:

~~~text
node scripts/offline/organize-catalog.mjs plan URL_LOCAL DIRETORIO_NOVO
node scripts/offline/organize-catalog.mjs apply URL_LOCAL DIRETORIO_NOVO BACKUP_JSON
node scripts/offline/organize-presentation.mjs plan URL_LOCAL DIRETORIO_NOVO
node scripts/offline/organize-presentation.mjs apply URL_LOCAL DIRETORIO_NOVO BACKUP_JSON
~~~

Exigem KAVITA_API_KEY no ambiente local, conta administrativa e, para aplicar, um registro de backup consistente do mesmo servidor com arquivo tar.gz e checksum SHA-256 conferido. Credenciais não são argumentos nem parte dos relatórios. Remova a variável do ambiente ao terminar. Propostas, snapshots, tentativas e ledgers são locais e exclusivos; não repetir aplicação após falha sem conferir o estado.

Os comandos concretos usados e os checkpoints estão nos diretórios locais organization-stable-20261018 e presentation-stable-20261018. A instância deve ser retomada com Compose base **e** override local, conforme o guia operacional. O volume derivado é externo ao projeto Compose e precisa acompanhar a estratégia de backup/restauração, ou ser regenerado de forma validada a partir do MOBI e do manifesto.
