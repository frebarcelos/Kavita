# Contexto do fork para IA

Este conjunto é a memória versionada do projeto. A entrada automática para agentes fica em [AGENTS.md](../../AGENTS.md). Leia o contexto e depois apenas os arquivos relevantes à tarefa; não é necessário carregar o repositório inteiro a cada sessão.

| Documento | Conteúdo |
| --- | --- |
| [STATUS.md](STATUS.md) | **Comece aqui:** o que está em produção (servidor, tablet, chaves, tarefas), o que foi feito e o que falta, em ordem |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Objetivo, arquitetura, domínio, fluxos, integrações e limites |
| [KOVER_CONTEXT.md](KOVER_CONTEXT.md) | Fork Android, armazenamento offline e modelo de contas/dispositivos |
| [DEVELOPMENT.md](DEVELOPMENT.md) | TDD obrigatório, ambiente, comandos, testes e definição de pronto |
| [REPOSITORY_MAP.md](REPOSITORY_MAP.md) | Inventário de áreas, projetos, controllers, serviços e testes |
| [Servidor de teste](../../deployment/offline/README.md) | Configuração executável, amostra sintética, comandos e proteção do acervo |
| [Validação F1](../validation/F1.md) | Resultados reais, limitações e aceites pendentes da implementação |
| [KAVITA_KOVER_OFFLINE.md](../plans/KAVITA_KOVER_OFFLINE.md) | Fases verticais, entregáveis, dependências, critérios de aceite e proteção dos originais |
| [Robustez e melhorias](../plans/ROBUSTEZ_E_MELHORIAS.md) | Plano em fases para servidor, web, implantação e tablet: riscos, deficiências, testes, aceites e decisões pendentes |
| [Atualizar do upstream](../ATUALIZAR_UPSTREAM.md) | Roteiro para trazer versões novas do Kavita e do Kover: pontos quentes, migrações, suítes, ensaio no clone com comparação de IDs e progresso |
| [Melhorias pós-v1.0](../plans/MELHORIAS.md) | Próximas melhorias dos dois projetos, incluindo a animação de virada de página no Kover, com referências |
| [Organização do acervo](../plans/ORGANIZACAO_ACERVO.md) | Diagnóstico das três pastas e entregas para organizar séries, edições, livros e exclusões do YACReader |
| [Validação por pastas](../validation/PASTAS.md) | Modo optativo, testes, piloto com 51 arquivos, atualização de esquema e limites de implantação |
| [Pastas no principal](../validation/PASTAS_PRINCIPAL.md) | Migração aplicada, 931 arquivos, preservação dos dados, backup/restauração e pausa dos clientes antigos |

## Base desta documentação

Inspeção local em 2026-10-17, branch develop, commit 2d225367f0310ac7354423b772a4c6a7caf63fd2, antes da inclusão destes documentos. A árvore de trabalho estava limpa. Fork: https://github.com/frebarcelos/Kavita ; upstream: https://github.com/Kareadita/Kavita . Não foi feita comparação completa entre os históricos do fork e do upstream.

A inspeção cobriu estrutura, projetos, dependências, pontos de inicialização, configurações de build/CI, organização dos testes e os contratos relevantes para downloads/progresso. O inventário cobre as áreas do repositório; não representa auditoria de cada método nem comprovação de todos os fluxos em execução.

O usuário confirmou o fork Kover em ../kover e o primeiro tablet Samsung Galaxy Tab S6 Lite, com outros tablets Android depois. O fork foi inspecionado em leitura e o comportamento observado está em KOVER_CONTEXT.md. As contas compartilharão a biblioteca do PC e separarão o estado pessoal; downloads pertencem ao dispositivo. O ciclo completo no tablet ainda precisa ser executado.

## Manutenção do contexto

- Ao mudar módulos ou fluxos, atualize arquitetura e mapa na mesma alteração.
- Ao mudar SDK, dependências, comandos ou CI, atualize DEVELOPMENT.md.
- Ao decidir uma etapa do servidor/offline, atualize o plano e registre evidências reais de aceite.
- Para decisões com alternativas relevantes, acrescente um registro datado em docs/decisions/ quando necessário, com contexto, escolha e consequências.
- Mantenha pendências como pendências. Não transforme planos em capacidades existentes sem código e validação.

## Estado inicial

O estado atual está em [STATUS.md](STATUS.md); as seções abaixo são o histórico do início do fork.

Apenas documentação foi adicionada nesta tarefa. Não há servidor implantado, tablet configurado ou funcionalidade do Kover alterada por estes documentos. O runtime de comandos encontrou Node 24.11.0, mas não encontrou SDK .NET compatível disponível para executar build/test. Não foram executadas suítes de aplicação nesta etapa documental.

## Implementação em andamento

Em 2026-10-18 o usuário priorizou organização por pastas no principal. O checkpoint migrado tinha 931 arquivos e 125 agrupamentos; preservou os 8 progressos e todos os IDs anteriores. Em 2026-10-19 o **Kover Local** foi instalado e validado com PDF: reinício offline, remoção local e sincronização do progresso no clone. Após autorização explícita, as Auth Keys foram reativadas e o cliente foi conectado ao principal, cujo catálogo atual sincronizou 934 arquivos e 127 agrupamentos. Century Boys aparece uma vez com 22 itens. Leia [a implantação](../validation/PASTAS_PRINCIPAL.md) e [o aceite Android](../validation/KOVER_LOCAL.md). A árvore visual permanece no [plano](../plans/ORGANIZACAO_ACERVO.md).

A F1 já possui Compose, preparação de amostra EPUB sintética, manifesto de hashes, verificação de montagens e workflow de CI. Os 19 testes locais passaram. Com o Docker Desktop ativo, o servidor foi iniciado fora do sandbox: container saudável, interface/health HTTP 200 e verificação real de somente leitura aprovada. O usuário confirmou a conta comum com Login e Download. O acesso LAN foi habilitado somente no IP privado do Wi-Fi após conferir as regras de firewall limitadas à sub-rede; HTTP e proteção do acervo passaram novamente no PC. O usuário confirmou login no tablet, conexão do Kover, download e leitura com Wi-Fi desligado: marco v1.0 da solução integrada. Reinício offline, remoção local e sincronização de progresso ainda precisam de aceite; a F1 completa permanece em andamento. Consulte o registro F1 para comandos e evidências.


A pedido do usuário, três pastas pessoais também foram montadas somente leitura em /libraries/mangas, /libraries/books e /libraries/quadrinhos. A instância local exige o override _temp/offline-f1/compose.libraries.yaml junto do Compose base nos comandos up; consulte o guia operacional antes de recriar o container. As três bibliotecas foram cadastradas/indexadas e compartilhadas com a conta leitora. O inventário de nomes foi feito; hashes completos do acervo não foram calculados.


Em 2026-10-18 foram aplicados 118 nomes e 24 coleções, exclusões de auxiliares e preservação dos formatos indexados. Um MOBI ganhou cópia EPUB em volume dedicado somente leitura. A suíte passou com 37 testes. Leia o [relatório de organização](../validation/ORGANIZACAO_ACERVO.md): ele registra uma reindexação rejeitada/restaurada, o resultado corrigido com IDs/progresso preservados e os casos pendentes. Não usar scan forçado como atalho para organizar o catálogo legado.
