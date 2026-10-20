# Instruções para IA e desenvolvimento deste fork

Estas instruções se aplicam ao repositório inteiro. Converse e escreva a documentação do fork em português do Brasil; mantenha os identificadores e o estilo do código existente.

## Leia antes de alterar

1. [Índice do contexto](docs/ai/README.md).
2. [Arquitetura e domínio](docs/ai/PROJECT_CONTEXT.md).
3. [Desenvolvimento, TDD e validação](docs/ai/DEVELOPMENT.md).
4. [Inventário e navegação](docs/ai/REPOSITORY_MAP.md), para localizar a área da tarefa.
5. [Contexto do fork Kover e contas Android](docs/ai/KOVER_CONTEXT.md).
6. Para servidor, downloads, leitura e sincronização: [plano Kavita + Kover](docs/plans/KAVITA_KOVER_OFFLINE.md).

O código e as configurações atuais são a fonte de verdade. Verifique os arquivos da área antes de implementar. Diferencie comportamento observado, proposta e hipótese. Atualize o contexto quando mudar arquitetura, comandos, contratos ou decisões do fork.

## Objetivo e regras permanentes

- O PC guarda os originais; o Kavita os disponibiliza; o Kover no tablet mantém cópias para leitura offline.
- Baixar, ler, concluir leitura, remover download, limpar cache, sair da conta ou sincronizar NUNCA pode apagar, mover, renomear nem sobrescrever os originais no PC.
- A exclusão de um download pertence ao armazenamento local do tablet. Ela não pode excluir entidades do catálogo no servidor nem disparar ações administrativas remotas.
- É permitido sincronizar progresso e outros dados pessoais explicitamente previstos; isto é diferente de alterar os arquivos da biblioteca.
- Preserve progresso e eventos de sincronização pendentes mesmo quando o usuário remove a cópia offline. Remoção local não deve causar novo download automático.
- Na implantação, monte a biblioteca somente para leitura e mantenha configuração/banco/cache do Kavita separados e graváveis. Não remova essa proteção para contornar um erro.
- O servidor deste projeto funciona apenas no PC/rede doméstica. Mantenha 127.0.0.1 durante configuração; para tablets, publique somente no IP privado da interface doméstica e restrinja o firewall à sub-rede local. Não configurar publicação pública, encaminhamento no roteador ou túneis externos; não usar 0.0.0.0/:: para contornar conectividade.
- Use uma conta sem Admin para o leitor, com permissão Download. O papel chamado Read Only no código restringe gerenciamento de conta e não substitui proteção do filesystem.
- Há uma biblioteca unificada no PC para todas as contas locais. Separe progresso por pessoa/conta e downloads por dispositivo; a mesma conta pode usar vários tablets Android. Começar no Samsung Galaxy Tab S6 Lite.
- Os dois projetos são forks modificáveis. Prefira configurar e reaproveitar capacidades existentes antes de ampliar o código. O Kover é outro repositório: adapte estas instruções ao contexto daquele repositório antes de implementar mudanças nele.

Para organizar o acervo, leia também [o plano](docs/plans/ORGANIZACAO_ACERVO.md) e [a validação](docs/validation/ORGANIZACAO_ACERVO.md). Preserve os IDs de séries, volumes e capítulos usados pelo Kover. Reindexação forçada ou troca global de metadados/tipo exige ensaio no clone completo e comparação de identidade/progresso; os comandos de organização usam scan incremental. Em 2026-10-19 o usuário autorizou apagar os registros das 7 séries auxiliares (só do banco; os arquivos no PC ficam). Em 2026-10-20, com o backup automático validado (item 0.3 do [plano de robustez](docs/plans/ROBUSTEZ_E_MELHORIAS.md)), a conferência mostrou que elas já não existem no banco do principal: a migração para pastas gerou o catálogo sem elas. Não há exclusão pendente (item 4.10).

Decisão de 2026-10-18: priorizar organização por pastas com `Library.FolderBasedOrganization`. O caminho físico define a identidade; títulos normalizados não podem fundir pastas. Nesse modo, ignorar metadados internos e matching externo. Não retomar a fusão pontual de Century nem editar os originais para satisfazer o parser. Bibliotecas já preenchidas precisam de migração com preservação de referências, não de troca do flag seguida por scan.

Decisão de 2026-10-19: seguir o modelo do YACReader. Pasta = série, qualquer que seja o formato. Pelo nome, cada arquivo vira volume (marcador ou número no fim do último trecho ` - `), capítulo (`c0383`) ou especial. Há navegação em árvore na web e no Kover offline. Foi aplicado ao principal em 2026-10-19, com autorização: imagem `kavita-folders-yac:20261019`, volume ativo `kavita-folders-main-active-20261019-r3`, e o r2 preservado para rollback. O Kover Local foi atualizado para o schema 15. Leia [o registro](docs/validation/YAC_PASTAS.md).

A migração já foi aplicada ao principal: leia [o registro operacional](docs/validation/PASTAS_PRINCIPAL.md). Em 2026-10-19, após aceite PDF no S6 Lite e autorização explícita do usuário, as Auth Keys foram reativadas com `FolderOrganization:ApiKeyMaintenance=false` no JSON operacional. O Kover Local está conectado ao principal com catálogo limpo; os dados antigos do tablet eram testes e seu descarte foi autorizado. Leia [o aceite Android](docs/validation/KOVER_LOCAL.md). Em instalações com dados a preservar, capítulos divididos continuam exigindo tratamento próprio: não remover as proteções para contornar uma reconciliação recusada. Os registros anteriores do servidor, inclusive auxiliares, foram preservados em arquivo; nenhuma exclusão dessas séries foi executada.

## TDD para toda mudança de comportamento

Atualização de autorização em 2026-10-19: o usuário confirmou que os dados do Kover são apenas testes e podem ser descartados. A instalação do Google Play será mantida separada do debug **Kover Local**, com catálogo limpo e aceite por USB. Não é necessário migrar os payloads antigos deste tablet. Validar o ciclo do novo cliente antes de retirar a pausa; manter a proteção e os testes de reconciliação para instalações futuras com dados reais. Leia [o aceite Android](docs/validation/KOVER_LOCAL.md).

1. Defina o comportamento e os critérios de aceite antes do código de produção.
2. RED: escreva o menor teste relevante e execute-o; confirme que falha pelo comportamento ausente ou pelo bug reproduzido. Erro de compilação ou ambiente não comprova RED.
3. GREEN: implemente o mínimo necessário e execute o teste até passar.
4. REFACTOR: melhore o desenho mantendo os testes verdes.
5. Execute regressões da área e as verificações adequadas; registre comandos, resultados e limitações reais.

Correções devem começar com um teste de regressão. Para código legado sem cobertura, faça testes de caracterização antes de refatorar. Use fixtures descartáveis e mocks nas fronteiras; nunca teste exclusão com a biblioteca real. Para UI sem executor, configure um executor apropriado à stack e comprove RED antes da mudança de comportamento. Não declare build/lint como teste funcional.

Documentação sem alteração de comportamento dispensa testes de código: confira fatos, links, caminhos e consistência. Para configuração/infraestrutura, valide sintaxe e comportamento em ambiente descartável, incluindo a proteção dos originais.

## Práticas de implementação e entrega

- Faça alterações pequenas e focadas; preserve o trabalho do usuário e evite refatorações ou atualizações de dependências fora do escopo.
- Confira o estado do Git. Não faça reset, limpeza destrutiva, rebase de trabalho alheio, commit, push ou deploy sem escopo que os autorize.
- Siga .editorconfig, convenções locais, DI e abstrações existentes. Evite regras de negócio em controllers/componentes e abstrações sem necessidade concreta.
- Preserve compatibilidade dos contratos consumidos pelo Kover; mudanças de DTO, auth, paginação, arquivos e progresso precisam de testes e plano de compatibilidade.
- Respeite autorização por usuário/biblioteca, cancelamento, tratamento explícito de falhas e limites de memória/espaço. Downloads incompletos não podem parecer prontos.
- Não registre nem versione tokens, Auth Keys, senhas, bancos pessoais, caminhos privados ou conteúdo da biblioteca. Não exponha o servidor publicamente por padrão.
- Migrações exigem dados de teste, backup consistente e estratégia de restauração. Não aponte desenvolvimento ou testes para o banco de produção.
- Preserve licenças e atribuições dos projetos. Mantenha mudanças do fork fáceis de revisar e atualizar a partir do upstream.
- Ao entregar, informe o que mudou, a evidência de validação, limitações e próximos passos. Nunca afirme ter executado uma verificação que não executou.
