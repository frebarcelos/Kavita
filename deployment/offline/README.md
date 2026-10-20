# Servidor de teste offline — F1

**Estado da instalação pessoal:** o principal usa o fork com organização por pastas; web e Kover Local estão disponíveis na LAN. Auth Keys foram reativadas após aceite PDF e autorização explícita em 2026-10-19. Leia [a implantação](../../docs/validation/PASTAS_PRINCIPAL.md) e [o aceite Android](../../docs/validation/KOVER_LOCAL.md). Os comandos da amostra abaixo não substituem o procedimento da instância pessoal.

Esta entrega prepara uma instância Kavita isolada com uma obra EPUB sintética, acervo somente leitura e dados operacionais em volume Docker. O [aceite completo da F1](../../docs/plans/KAVITA_KOVER_OFFLINE.md) ainda inclui Kover e tablet.

Pré-requisitos: Node 24, Python 3 para os testes de estrutura EPUB e Docker Desktop/Engine com containers Linux e Compose disponível. O Docker Desktop precisa estar iniciado. Os comandos PowerShell e Bash/WSL usam sintaxe e caminhos diferentes; escolha o bloco do terminal em uso.

## Preparar e validar

Execute da raiz do repositório:

~~~powershell
node --test scripts/offline/compose.test.mjs scripts/offline/library-manifest.test.mjs scripts/offline/prepare.test.mjs scripts/offline/verify-readonly.test.mjs
node scripts/offline/prepare.mjs
~~~

A preparação cria _temp/offline-f1 com library, .env e before.json. A pasta deve ser nova: uma execução repetida recusa sobrescrever. Use um novo destino para outra amostra, por exemplo node scripts/offline/prepare.mjs _temp/offline-f1-2. O EPUB foi escrito para os testes, com três capítulos e sem conteúdo pessoal ou recursos de rede.

O banco não vai para _temp nem para o OneDrive: fica no volume Docker config. O projeto usa nome kavita-offline-f1 para separar a instância de outros serviços. Use COMPOSE_PROJECT_NAME se precisar manter mais de uma instância de teste.

## Iniciar o servidor

~~~powershell
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml config --quiet
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml up -d --wait --wait-timeout 180
node scripts/offline/verify-readonly.mjs _temp/offline-f1/.env
node scripts/offline/library-manifest.mjs verify _temp/offline-f1/library _temp/offline-f1/before.json
~~~

Se o plugin não for descoberto no Windows, o executável instalado pelo Docker Desktop também pode ser chamado diretamente:

~~~powershell
& 'C:/Program Files/Docker/Docker/resources/bin/docker-compose.exe' --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml config --quiet
~~~

Substitua docker compose pelo executável também nos comandos de iniciar/parar. Os testes e verify-readonly.mjs procuram esse caminho automaticamente; KAVITA_COMPOSE permite indicar outro executável Compose. Não é necessário copiar ou alterar a configuração pessoal do Docker.

A imagem padrão é upstream 0.9.1, fixada por digest multi-arquitetura. Ela não incorpora o checkout local 0.9.1.14 e sua compatibilidade com o Kover deste fork ainda será validada. O [registro consultado](https://hub.docker.com/v2/repositories/jvmilazz0/kavita/tags/0.9.1) forneceu o digest registrado em .env.example em 2026-10-17. Para testar alterações do fork, empacote seu próprio build identificado e substitua KAVITA_IMAGE no .env local; o Dockerfile do projeto requer os artefatos _output/*.tar.gz.

## Iniciar pelo Bash/WSL

No WSL, o projeto fica em /mnt/c/... e variáveis são declaradas sem espaços ao redor do sinal de igual. O .env da amostra foi gerado no Windows; exporte o caminho Linux para usá-lo com o cliente Docker do WSL:

~~~bash
cd /caminho/para/o/checkout/Kavita
export KAVITA_LIBRARY_PATH="$PWD/_temp/offline-f1/library"
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml config --quiet
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml up -d --wait --wait-timeout 180
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml ps
~~~

O export vale para esse terminal e preserva o .env compartilhado com o Windows. Após a inicialização, abra http://localhost:5000 no navegador do PC. Não execute a atribuição $compose = ... nem caminhos C:\... em Bash; o WSL já disponibiliza docker compose diretamente.

Para parar nesse mesmo terminal:

~~~bash
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml stop
~~~

## Configurar o leitor e o S6 Lite

1. Abra http://127.0.0.1:5000 no PC e crie a conta administrativa. Não há credencial pré-definida por estes scripts.
2. Cadastre biblioteca do tipo livro usando o caminho interno /media e aguarde o scan do EPUB sintético.
3. Em Usuários, abra Convidar/Invite. Apesar do rótulo E-mail, informe só o nome local, por exemplo leitor (sem @). Selecione a biblioteca e as permissões Login e Download, sem Admin. Conclua pelo link Configurar conta/Setup User Account exibido após o convite; defina usuário e senha. Se já existir um convite pendente, use Setup User/Configurar usuário na lista. Nenhuma caixa de e-mail ou SMTP é necessária para esse fluxo. Entre como o leitor e gere uma Auth Key própria para o Kover; não registre a chave neste repositório.
4. No .env gerado, troque KAVITA_BIND_ADDRESS de 127.0.0.1 pelo IP privado específico do PC acessível ao tablet. Reaplique up -d --wait. Restrinja a regra de firewall à rede privada necessária; não configure redirecionamento público de portas.
5. No Kover, use http://IP-PRIVADO:5000 e a chave do leitor. Confirme build, versão Android e espaço disponível. localhost no tablet aponta para o próprio tablet.
6. Execute o ciclo: baixar por completo → ativar modo avião → encerrar/reabrir app → ler → remover só o download → reabrir → reconectar → verificar progresso → baixar novamente explicitamente. Verifique também que o catálogo permanece e não há download espontâneo.
7. Rode novamente library-manifest.mjs verify e registre o resultado em [F1.md](../../docs/validation/F1.md). As contas de todas as pessoas deverão usar as mesmas bibliotecas; progresso é por pessoa e downloads são por aparelho.

## Contas locais e acesso apenas na rede doméstica

O formulário de convite também aceita contas só com nome de usuário, conforme a [documentação de usuários do Kavita](https://wiki.kavitareader.com/guides/admin-settings/users/). O cadastro é concluído por link local/Setup User. Se a conta já está pendente, continue a configuração existente. Recuperação de senha dessas contas é feita pelo Admin.

A publicação inicial é 127.0.0.1:5000, restrita ao PC. Para o tablet, usar somente o IP privado da interface doméstica, com firewall limitado à sub-rede local. Este projeto não configura encaminhamento no roteador, domínio público, túnel ou proxy externo. Não substituir o bind por 0.0.0.0 ou :: para contornar falhas de conexão.

## O que a verificação ativa faz

verify-readonly.mjs inspeciona as montagens efetivas do container e exige exatamente o bind /media somente leitura e um volume Docker gravável em /kavita/config. Recusa configuração privilegiada, montagens extras e biblioteca sem marcador sintético.

Somente nos arquivos descartáveis .offline-probe da amostra, tenta criar, alterar, excluir e renomear pelo processo do container. Todas as tentativas precisam ser negadas. Também compara hashes antes/depois. O manifesto independente before.json verifica que nada mudou desde a geração da amostra.

Não use a verificação ativa com acervo pessoal; use apenas a amostra gerada. Para acervo real, o comando capture/verify faz apenas leitura, mas seu manifesto pode conter nomes privados: guarde-o fora do acervo e do versionamento. capture recusa sobrescrever arquivo existente.

## Parar e retomar

~~~powershell
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml stop
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml up -d --wait
~~~

O volume de configuração é preservado. A CI em [.github/workflows/offline-server.yml](../../.github/workflows/offline-server.yml) cria um projeto descartável próprio e remove seus volumes ao encerrar o job. A configuração não cria a pasta de biblioteca silenciosamente: caminho inexistente deve falhar.

## Instância local com as três pastas pessoais

A pedido do usuário, a instância existente recebeu três binds adicionais somente leitura: /libraries/mangas, /libraries/books e /libraries/quadrinhos. Os caminhos Windows ficam apenas no override local ignorado _temp/offline-f1/compose.libraries.yaml. /media continua sendo a amostra sintética; o volume de configuração e o IP privado foram preservados. Esta configuração local não cria as bibliotecas no catálogo automaticamente.

No navegador, entre como Admin e adicione as bibliotecas usando esses caminhos internos: Mangas (tipo Manga), Livros (tipo Book) e Quadrinhos (tipo Comic). Aguarde o scan e confira o acesso da conta leitora às três bibliotecas.

**Nesta instância, use os dois arquivos Compose para reaplicar ou retomar o serviço.** Usar somente o arquivo base em up recria o container sem os três binds adicionais:

~~~powershell
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml -f _temp/offline-f1/compose.libraries.yaml config --quiet
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml -f _temp/offline-f1/compose.libraries.yaml up -d --wait --wait-timeout 180
docker compose --env-file _temp/offline-f1/.env -f deployment/offline/compose.yaml -f _temp/offline-f1/compose.libraries.yaml stop
~~~

Os caminhos privados desse override estão no formato Windows; execute esses comandos no PowerShell. O fluxo Bash acima é para a amostra base, sem essas montagens pessoais.

verify-readonly.mjs continua deliberadamente limitado ao ambiente sintético com exatamente duas montagens; ele recusa a instância ampliada. Não relaxar essa guarda nem executar testes de escrita/exclusão no acervo pessoal. A ativação das pastas foi validada por inspeção das montagens efetivas, acesso de leitura aos diretórios e um container descartável usando somente a amostra nos três destinos. Inventário completo dos originais, backup/restauração e aceite operacional permanecem pendentes.
## Organização aplicada e EPUB derivado

A instância local teve 118 nomes de catálogo ajustados e 24 coleções disponibilizadas aos leitores. Os nomes de arquivo e a estrutura original no Windows foram preservados. Consulte [o relatório da implementação](../../docs/validation/ORGANIZACAO_ACERVO.md) antes de repetir scans ou ajustar agrupamentos legados.

Livros agora usa /libraries/books e /libraries/derived-books. O segundo caminho contém uma cópia EPUB convertida do MOBI original e usa o volume externo kavita-derived-books, montado somente leitura pelo override local. Não copiar essa biblioteca para o Git. Ao migrar o servidor, preservar esse volume e o manifesto local do derivado, além do volume operacional; não apontar o catálogo existente para uma cópia vazia e iniciar reindexação.

Os comandos PowerShell com os dois arquivos Compose da seção anterior continuam corretos. A configuração base para fixtures/CI permanece inalterada. A verificação sintética verify-readonly.mjs recusa a instalação ampliada por projeto; não remover essa guarda para testar escrita no acervo pessoal.

A reindexação incremental e os ajustes de nomes/coleções foram validados no clone completo antes da aplicação corrigida. Não usar reindexação forçada ou desligar metadados globalmente para tentar juntar séries. Existem sete casos estruturais para revisão e sete séries auxiliares em cache com remoção pendente de aprovação explícita. Os scripts de organização não executam essa exclusão.

Para uma nova operação, as ferramentas organize-catalog.mjs e organize-presentation.mjs geram primeiro uma proposta local, exigem Admin e conferem backup consistente e IDs antes/depois de aplicar. Os relatórios atuais contêm dados privados e ficam em _temp. Uma aplicação interrompida exige conferir o ledger e o catálogo antes de gerar outra proposta. Não repetir comandos antigos automaticamente nem restaurar o volume de um piloto sobre o servidor em uso.

Após sincronizar o Kover, confira as três bibliotecas e a aba Coleções. Leitura, retomada e remoção offline após essa organização ainda precisam de aceite no tablet; nenhuma instalação de APK foi modificada nesta etapa.

## Imagem do fork com organização por pastas

A primeira fase foi validada em piloto separado. A pedido do usuário, a organização também foi aplicada ao principal, com 931 arquivos, 125 agrupamentos e progresso preservado. Os pilotos foram encerrados. Consulte o [registro do principal](../../docs/validation/PASTAS_PRINCIPAL.md), o [relatório inicial](../../docs/validation/PASTAS.md) e o [plano por entregas](../../docs/plans/ORGANIZACAO_ACERVO.md) antes de operar bibliotecas existentes.

O [Dockerfile.fork](Dockerfile.fork) recebe somente a publicação self-contained linux-x64 do backend, com o build de produção da interface dentro de `wwwroot`. Prepare esses artefatos conforme o [guia de desenvolvimento](../../docs/ai/DEVELOPMENT.md). O comando usado para construir a imagem local foi:

~~~powershell
docker build --file deployment/offline/Dockerfile.fork --tag kavita-folders-main:20261019 _temp/offline-f1/folder-server
~~~

Execute a partir da raiz do checkout. O contexto deve conter apenas os artefatos publicados, sem bancos, credenciais ou configurações pessoais; não substitua esse caminho pela raiz do repositório. Construir a imagem não altera os containers existentes.

O override local `compose.libraries.yaml` aponta a imagem em uso e o volume externo `kavita-folders-main-active-20261019-r3`, e mantém as fontes somente leitura. Continue usando os **dois arquivos Compose** nos comandos da instância pessoal. O volume r2 e as imagens antigas foram removidos na limpeza de 2026-10-19, com autorização; o rollback passa a ser o checkpoint do último deploy (abaixo). Nunca restaurar sobre o volume ativo automaticamente, pois novas leituras podem ter ocorrido.

### Build e deploy a partir de um commit (desde a v1.1)

Os scripts por versão (`apply-main-r*.ps1`) foram substituídos por dois scripts versionados. Execute a partir da raiz do checkout.

1. **Build:** `./deployment/offline/build-fork-image.ps1`.
   - Recusa árvore com alterações.
   - Publica o backend no container do SDK .NET e faz o build de produção da interface.
   - Gera `kavita-fork:<git describe>` com o SHA do commit em `org.opencontainers.image.revision`.
   - O [Dockerfile.fork](Dockerfile.fork) apaga os arquivos da 0.9.1 em `/kavita` (exceto `config/`) antes de copiar o publish do fork.
2. **Deploy:** `./deployment/offline/deploy-fork.ps1 -Image kavita-fork:<versão>`. O script:
   - recusa rodar com menos de 5 GB livres;
   - valida o Compose novo, que precisa manter a imagem, o volume ativo e o IP da LAN;
   - para o servidor;
   - copia o volume de configuração **sem `cache/` e `temp/`** para um checkpoint identificado pelo label `kavita.fork.checkpoint`, e gera `config.tar.gz` em `_temp/offline-f1/deploys/<data>`;
   - sobe a imagem nova e espera o health check.
   - Se a imagem não ficar saudável, devolve o override anterior e sobe a imagem anterior.
   - Mantém os 2 checkpoints mais recentes, decisão do usuário. Só apaga volumes com o label do script; os checkpoints antigos sem label não são tocados.
3. **Testes do deploy:** `./deployment/offline/tests/deploy-fork.tests.ps1 -ImageA <imagem> -ImageB <outra>`.
   - Roda num projeto descartável em `127.0.0.1:5057`, com volume e biblioteca próprios, e remove tudo no fim.
   - Cobre recusa sem espaço, sucesso sem o cache, imagem quebrada com volta automática e retenção de 2.
   - Execute sem redirecionar stderr (`2>&1`): no Windows PowerShell isso transforma o progresso do Docker em erro.

### Backup automático (desde a v1.1)

- **Backup:** `./deployment/offline/backup-config.ps1` copia do servidor em execução, sem pará-lo:
  - o `kavita.db`, pelo backup online do SQLite, conferido com `integrity_check`;
  - as capas (`covers/`) e os `appsettings*.json`.

  O cache fica de fora. O destino padrão é `C:\KavitaBackups` (decisão do usuário: uma pasta do PC fora do Docker e do repositório), com `kavita-config-<data>.tar.gz` e `.sha256`. A retenção mantém o mais novo de cada um dos últimos 7 dias e de cada uma das 4 semanas anteriores.
- **Atenção:** o arquivo contém os segredos do servidor (configuração e chaves no banco). Mantenha a pasta privada e não a versione.
- **Agendamento:** `./deployment/offline/install-backup-task.ps1` registra a tarefa "Kavita - backup" na conta do usuário, diária às 03:00. Se o PC estiver desligado no horário, ela roda assim que possível. O log fica em `C:\KavitaBackups\backup.log`. Use `-WhatIf` para ver a tarefa sem registrar.
- **Restauração:** extraia o arquivo num volume **novo** e suba um container de teste em `127.0.0.1` antes de trocar o volume do principal. Nunca restaure sobre o volume ativo.
- **Testes:**
  - `./deployment/offline/tests/backup-retention.tests.ps1`, sem Docker;
  - `./deployment/offline/tests/backup-config.tests.ps1 -Image <imagem>`: backup e restauração num servidor descartável em `127.0.0.1`.

### Arquivos novos no PC (item 4.9)

O watcher de pastas do Kavita **não recebe eventos** do bind mount do Windows no Docker Desktop. Teste de 2026-10-20: `inotifywait` num mount somente leitura terminou por tempo esgotado (exit 2) depois da criação de um arquivo no Windows. A data de modificação da pasta, porém, chega ao container (`stat` mostrou a pasta atualizada), e o scan incremental se baseia nela.

- **Automático:** em Admin → Tarefas, troque "Escanear Biblioteca" para personalizado com `0 * * * *` (a cada hora). O scan agendado é incremental, não forçado, e só reprocessa pastas alteradas. Ele só lê a biblioteca, que continua montada somente leitura.
- **Na hora:** no menu da biblioteca, use "Varrer Biblioteca", ou o menu da série, para uma só pasta.
- **Não use** "Forçar Escaneamento" para isso. A reindexação forçada segue as regras do AGENTS.md.

A pausa de clientes usa `FolderOrganization.ApiKeyMaintenance` em `config/appsettings.Production.json` no volume operacional. O valor atual é **false**, após validação e autorização explícita do usuário. O host não carrega os providers de ambiente padrão; uma variável de ambiente com esse nome não basta. Não alterar esse controle para contornar reconciliação recusada em instalações com dados reais: payloads antigos divididos ainda exigem tratamento próprio. O navegador usa JWT.
