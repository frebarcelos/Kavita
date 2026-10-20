# Desenvolvimento, TDD e qualidade

## Fontes de verdade e ambiente

Leia [AGENTS.md](../../AGENTS.md) antes da tarefa. Use versões de global.json, csproj, UI/Web/package.json, lockfile e workflows; CONTRIBUTING.md contém referências históricas a Node 18/net8 que não descrevem integralmente a stack atual.

- Backend principal: SDK .NET 10 compatível com global.json; não baixar o TargetFramework para fazer um ambiente antigo compilar.
- Frontend: Angular 22/TypeScript 6; as dependências instaladas requerem Node 24.15.0 ou outra versão compatível indicada por seus engines. A CI usa Node 24. Há testes Angular com Vitest e jsdom; use o lockfile.
- Git e editor com suporte a C#/Angular. Swashbuckle CLI é usado no CI/release; ferramentas EF são necessárias para gerar migrações.
- Dependências nativas de imagens/PDF/arquivos precisam estar disponíveis no sistema alvo. Verifique a documentação e falhas reais antes de instalar ferramentas adicionais.
- Não execute host, scripts, migrações ou testes contra o banco ou biblioteca pessoal. Use pastas e amostras descartáveis.

## Ciclo obrigatório para comportamento

1. Descreva um caso observável e critérios de aceite. Localize implementação, contratos, consumidores e testes da área.
2. Acrescente teste unitário, de componente ou integração no nível que reproduz o problema. Use AAA (Arrange/Act/Assert), entradas realistas e nomes que descrevem o comportamento.
3. Execute-o antes da alteração de produção. Registre falha esperada: RED por comportamento, não por instalação, compilação, timeout genérico ou credencial ausente.
4. Implemente a menor solução coerente com a arquitetura; execute o teste até GREEN.
5. Refatore se necessário; rode testes da área, regressões afetadas e checks apropriados.
6. Atualize contexto e contratos relevantes; relate evidências reais.

Para refatoração de legado, comece caracterizando comportamentos existentes. Mocke rede, relógio e filesystem nas fronteiras; não replique a implementação no teste. Banco: prefira os helpers SQLite existentes quando a semântica SQL importa. Arquivos: use MockFileSystem e, quando necessário, integração com diretório temporário. Evite sleeps como sincronização de teste.

Para este fork, toda alteração de download/limpeza/sync deve ter cobertura da invariável: originais e catálogo remoto permanecem preservados ao remover um download. Teste falhas e retomada além do caminho feliz.

Documentação sem mudança funcional: validar fatos, links e caminhos, sem criar testes artificiais. Infra/configuração: validar sintaxe e executar um teste de comportamento isolado. Se faltam ferramentas, registre o impedimento; não substitua TDD por uma alegação de que o código parece correto.

## Comandos de backend

Execute da raiz do repositório em PowerShell. O SDK .NET 10 já foi usado com sucesso em container Docker, com NuGet em volume dedicado. Os comandos abaixo pressupõem SDK instalado no host; o registro de validação de pastas também identifica a imagem usada nos testes.

~~~powershell
dotnet --info
dotnet restore Kavita.sln
dotnet build Kavita.sln --no-restore
dotnet test Kavita.Services.Tests/Kavita.Services.Tests.csproj --no-restore --filter 'FullyQualifiedName~ReaderServiceTests'
dotnet test Kavita.sln --no-restore --filter 'Category!=Integration'
~~~

Durante RED/GREEN troque o filtro pela classe ou pelo método da tarefa. O último comando corresponde à exclusão de testes de integração usada em .github/workflows/build-and-test.yml (Windows e Linux). Não use --no-build após alterar código sem recompilar.

Para desenvolvimento do host, somente depois de garantir configuração/banco isolados:

~~~powershell
dotnet run --project Kavita.Server/Kavita.Server.csproj -c Debug
~~~

A aplicação usa config/appsettings.json e lógica própria de diretórios/configuração; verifique Common/Configuration.cs, Program.cs e DirectoryService.cs ao separar ambientes. Swagger é disponibilizado no modo Debug descrito em CONTRIBUTING.md; confira a porta efetiva em configuração (normalmente 5000).

## Mapa dos testes

| Projeto | Foco e referências |
| --- | --- |
| Kavita.Common.Tests | Helpers e extensões compartilhadas |
| Kavita.Models.Tests | Entidades, extensões e modelos |
| Kavita.Database.Tests | Consultas/repositórios; AbstractDbTest usa SQLite em memória; AbstractFsTest auxilia filesystem |
| Kavita.Services.Tests | Scanner, parsers, arquivos, cache, leitura, listas, metadados e regras de serviço |
| Kavita.Server.Tests | EndpointAccessTests, middleware, helpers e migrações manuais |
| Kavita.Integration.Tests | Integrações Plus com configuração externa; pode pular testes sem credenciais |

ReaderServiceTests, ReaderServiceRereadTests, DirectoryServiceTests, FileSystemTests e FileCacheServiceTests são pontos iniciais relevantes para o fluxo pessoal. EndpointAccessTests ajuda a entender os testes de política existentes; ele não deve ser confundido com uma suíte HTTP ponta a ponta completa.

Testes Plus podem ser executados separadamente com:

~~~powershell
dotnet test Kavita.Integration.Tests/Kavita.Integration.Tests.csproj --filter 'Category=Integration'
~~~

Leia primeiro Fixtures/KavitaPlusFixture.cs: há endpoint externo, licença e configuração por ambiente. Use dados dedicados de teste. Um teste pulado não comprova integração funcionando.

## Frontend

Da pasta UI/Web:

~~~powershell
npm ci --legacy-peer-deps
npm test
npm run lint
npm run prod
npm run start-proxy
~~~

O CI instala com --legacy-peer-deps e executa prod. start-proxy encaminha chamadas ao backend por proxy.conf.json; confira interfaces/portas antes de expor o servidor de desenvolvimento, que usa host 0.0.0.0.

Desde 2026-10-18, npm test usa @angular/build:unit-test com Vitest/jsdom e tsconfig.spec.json. O primeiro componente testado é a escolha de organização por pastas. A CI build-ui.yml executa os testes além do build; o workflow Playwright histórico não é a validação atual. Para novas telas e interações, manter RED/GREEN e ampliar a cobertura pertinente. Build/lint não substituem teste funcional.

Scripts build-backend/build-backend-prod usam rm/cp e substituem wwwroot; no Windows precisam de shell compatível e cuidado com o diretório alvo. Para uma alteração apenas na UI, prefira validar com prod sem limpar o backend. O release local usa Kavita.ReleaseTools e local-release.yml; não presumir que docker build compila a solução.

## Banco e contratos

- Modifique entidades e gere migração com o contexto DataContext e startup Kavita.Server. Revise SQL e teste dados legados e atualização.
- Nunca edite migrações já usadas em produção para modificar seu efeito retrospectivamente.
- Faça backup consistente antes de atualizar; restauração inclui versão anterior do executável/imagem e do banco. Não se presume downgrade automático do schema.
- Mudança de API exige teste do contrato consumido, autorização e estratégia para versões do Kover. Confira e regenere openapi.json pelo processo de build apropriado.
- Não use bancos reais ou segredos como fixtures. Não faça logs de Auth Keys ou URLs que os contenham.

## Definição de pronto

- Critérios de aceite atendidos e mudança focada, revisada no diff.
- RED observado antes da implementação e GREEN depois para comportamento novo/corrigido; refatoração protegida por cobertura.
- Testes afetados e checks de build/lint pertinentes passam; checks não executados ou falhas anteriores estão discriminados.
- Sem alteração de originais, exclusão remota indevida, perda de progresso pendente ou novo download não solicitado.
- Tratamento de falhas, autorização e compatibilidade revisados quando aplicáveis.
- Documentação atualizada. Entrega informa resultados reais, limitações e riscos concretos.

## Ferramentas desde 2026-10-20

Execute da raiz do Kavita, no Windows PowerShell 5.1, sem redirecionar stderr (`2>&1`) nos testes de deploy.

| Para | Comando |
| --- | --- |
| Testes .NET no container do SDK | `./_temp/offline-f1/yac/run.ps1 <projeto.csproj> "<filtro>" <log>` (não versionado; usa a imagem do SDK fixada acima) |
| Testes web | `npm exec --yes --package=node@24.15.0 -- node node_modules/@angular/cli/bin/ng.js test --watch=false` em `UI/Web` |
| Leitor ponta a ponta (7.1) | `./scripts/e2e/run.ps1 -Image <imagem>`: Kavita descartável em `127.0.0.1:5066`, biblioteca sintética, web de `UI/Web/dist/browser` montada, Chrome por CDP numa janela fora da tela; `-Keep` mantém tudo para inspeção em caso de falha |
| Medição do scan (4.8) | teste `FolderOrganizationScanBenchmark` com `KAVITA_BENCH_FOLDERS` e `KAVITA_BENCH_OUT` |
| Imagem do servidor | `./deployment/offline/build-fork-image.ps1` (árvore limpa; com mudanças locais, a partir de `_temp/build-worktree` e `npm ci --legacy-peer-deps`) |
| Deploy e testes | `deploy-fork.ps1 -Image <tag>`; `tests/deploy-fork.tests.ps1 -ImageA <a> -ImageB <b>` |
| Backup | `backup-config.ps1`; `tests/backup-retention.tests.ps1`; `tests/backup-config.tests.ps1 -Image <tag>` |
| Saúde | `check-health.ps1 -WhatIf`; `tests/health-rules.tests.ps1`; `tests/check-health.tests.ps1 -Image <tag>` |
| HTTPS | `enable-https.ps1`, `lan-https-only.ps1` (`-Undo`), `firewall-lan.ps1` (admin); `tests/https-proxy.tests.ps1`, `tests/enable-https.tests.ps1`, `tests/lan-https-only.tests.ps1` |
| Kover | `flutter test`, `flutter analyze`, `dart format --set-exit-if-changed .`; APK com `..\kover\tool\build_apk.ps1 [-Mode release]` |

Os scripts PowerShell com texto acentuado são salvos em UTF-8 com BOM. Documentos e imagens são binários no `.gitattributes`. Os comandos de operação estão no [guia de implantação](../../deployment/offline/README.md).

## Ferramentas da entrega offline F1

A infraestrutura de teste em deployment/offline usa Node 24 e Compose; a validação estrutural da amostra EPUB usa Python 3 (biblioteca padrão). Execute da raiz:

~~~powershell
node --test scripts/offline/compose.test.mjs scripts/offline/library-manifest.test.mjs scripts/offline/prepare.test.mjs scripts/offline/verify-readonly.test.mjs
~~~

Os testes de configuração usam o parser real do Compose sem exigir daemon. A verificação das permissões efetivas e o healthcheck exigem motor Docker acessível. O [guia do servidor](../../deployment/offline/README.md) e o [registro F1](../validation/F1.md) distinguem os checks locais do aceite integrado. Gerador e testes não usam conteúdo pessoal.


## Ferramentas de organização do catálogo

As regras e clientes de API ficam em scripts/offline/organization*.mjs; as CLIs organize-catalog.mjs e organize-presentation.mjs separam proposta de aplicação. A suíte atual usa node --test scripts/offline/*.test.mjs e passou com 45 testes em 2026-10-18. A curadoria de apresentação antiga ignora bibliotecas em modo por pastas; não é uma ferramenta de migração estrutural. O workflow offline-server.yml seleciona os testes pelo glob. Consulte [o relatório anterior](../validation/ORGANIZACAO_ACERVO.md) para o ensaio no clone e a restauração executada. Não executar testes de remoção ou reindexação forçada contra a instância pessoal. Relatórios de identidade e credenciais permanecem fora do versionamento.

## Ambiente usado para organização por pastas

SDK executado em Docker: `mcr.microsoft.com/dotnet/sdk:10.0@sha256:0d99ebf1ccad15037b5c98c9fe8979d6b8dbac23812feae2277a0b277b5c5ffa`, checkout montado em `/work`, NuGet no volume `kavita-dotnet-nuget` e limite de 4 CPUs. O SDK efetivo da imagem foi 10.0.402. Para publicar self-contained, restaurar também para `linux-x64`; um restore de testes sem RID não garante esse alvo.

Para testes, usar os filtros de `FolderOrganizationScanTests`, `FolderParserTests`, `FolderOrganizationMigrationTests` e `LibraryOrganizationTests`, além das regressões de scanner e repositório. A migração EF do flag foi gerada com ferramenta 10.0.12 e fábrica de design descartável, sem executar o host ou conectar ao banco pessoal. As bibliotecas existentes recebem false; mudar sua organização é outra operação e exige o plano de migração.

Os testes web usam Angular/Vitest/jsdom. Nesta sessão, o Node do host era 24.11.0; o Node 24.15.0 foi executado isoladamente via npm exec para satisfazer os engines, sem trocar a instalação global. Para build direto com ng, executar antes `node hash-localization.js`, como faz o script prod. A suíte de interface passou com 3 testes; o build de produção também passou. O lint dos arquivos alterados não encontrou erros e apresentou dois avisos preexistentes no template.

Alterou código? Recompile antes de usar --no-build. Restaurar um arquivo mantendo timestamp antigo pode reutilizar um assembly anterior; confirme a recompilação ao repetir RED/GREEN. Build, publicação e sucesso de uma migração de esquema não comprovam migração do catálogo ou aceite Android.

## Migração estrutural do catálogo

[migrate_folder_catalog.py](../../scripts/offline/migrate_folder_catalog.py) usa apenas a biblioteca padrão do Python 3.11+ e grava um banco novo a partir de entrada fria e referência por pastas. Não executar a ferramenta contra um SQLite ativo. Não sobrescrever entradas, relatórios ou um volume do servidor em uso. As operações reais estão documentadas no [registro do principal](../validation/PASTAS_PRINCIPAL.md).

~~~powershell
python -m unittest discover -s scripts/offline -p 'test_*.py'
~~~

Foram aprovados 13 testes SQLite/CLI, incluindo preservação de IDs e estado pessoal, cobertura de arquivos, divisão sem ambiguidade, rollback, arquivos auxiliares arquivados e proteção dos caminhos de saída. O workflow offline executa a suíte. A proteção temporária dos clientes tem 5 testes em `FolderCatalogMaintenanceTests`; junto às regressões de configuração/autorização, 11 testes de API passaram. O ensaio HTTP confirmou a necessidade do JSON operacional: o host limpa os providers padrão e ignora a variável de ambiente tentada inicialmente.
