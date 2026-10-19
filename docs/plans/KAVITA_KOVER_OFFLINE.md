# Plano de implementação por entregas verticais: Kavita + Kover

Prioridade revista em 2026-10-18: [organização por pastas](ORGANIZACAO_ACERVO.md), com fases P1–P4. A árvore física do acervo deve definir os agrupamentos, ignorando metadados internos. A migração do catálogo precisa manter referências de leitura e compatibilidade com os downloads do Kover. As jornadas offline abaixo continuam válidas; a correção de organização por metadados deixou de ser a estratégia principal.

A organização já foi aplicada ao principal para uso web: [implantação e evidências](../validation/PASTAS_PRINCIPAL.md). O Kover antigo está com sincronização por Auth Key pausada para proteger seu estado durante a mudança de hierarquia. O marco offline v1.0 abaixo é histórico; não comprova compatibilidade Android com o catálogo reorganizado. A próxima entrega deve atualizar/validar o cliente antes de reabrir a sincronização.

Estado atualizado em 2026-10-17: F1 em andamento, demais fases pendentes. Servidor de teste iniciado e saudável, com proteção somente leitura verificada dentro do container. O usuário confirmou contas, conexão do Kover, download e leitura com Wi-Fi desligado no tablet, estabelecendo o marco v1.0 da solução. Reinício offline, remoção local e sincronização permanecem pendentes. Evidências em [F1.md](../validation/F1.md).

## Resultado desejado

O PC mantém o acervo original. O Kavita publica catálogo/arquivos e guarda dados operacionais separados. O tablet usa o Kover para baixar cópias, ler offline e remover o download local após a leitura, preservando arquivos e catálogo do servidor. Progresso pode ser enviado ao Kavita quando houver conexão.

Cada fase entrega uma jornada utilizável de ponta a ponta: configuração do servidor, API, persistência, aplicativo Android e testes necessários àquela jornada. Reaproveitar as capacidades existentes e corrigir as lacunas dentro da própria fase, seguindo RED → GREEN → REFACTOR de [DEVELOPMENT.md](../ai/DEVELOPMENT.md). Uma fase só termina quando sua demonstração no dispositivo passa.

## O que sabemos e o que falta

| Item | Estado |
| --- | --- |
| Fork Kavita | Local, origin frebarcelos/Kavita, branch develop |
| Backend deste checkout | net10.0; assembly 0.9.1.14 |
| Kover upstream | README declara API Kavita, downloads offline e progresso local com sincronização |
| Exclusão local do Kover | Repositório/DAO inspecionados removem blobs locais; faltam testes do ciclo UI/concorrência/tablet |
| Fork/local do Kover | frebarcelos/kover, pasta irmã ../kover, main, HEAD a654cdc37d0571322d70f8357d53b94feb19705b |
| Tablet | Samsung Galaxy Tab S6 Lite primeiro; depois vários Android. Versão do sistema e espaço livre a confirmar |
| Acervo | Pastas reais, formatos e tamanho a confirmar; não inspecionados |
| PC/servidor | Checkout em Windows; confirmar onde o serviço rodará, Docker/WSL2 e disponibilidade do PC |
| Rede | Começar na rede doméstica; acesso de fora é uma etapa opcional posterior |

Inspeção local e detalhes: [KOVER_CONTEXT.md](../ai/KOVER_CONTEXT.md). O fork armazena downloads como blobs/páginas no SQLite e mantém progresso em tabela separada.

Fonte de capacidades gerais: [README do Kover upstream](https://github.com/rodonisi/kover). Isso não comprova o comportamento do fork ou a compatibilidade com este checkout.

## Contas locais e biblioteca unificada

- Uma instância Kavita e as mesmas bibliotecas para todos; não duplicar o acervo por conta. Criar contas no próprio servidor doméstico, sem exigir provedor externo.
- Uma conta por pessoa para progresso, lidos, favoritos e preferências. A mesma pessoa pode usar a mesma conta em mais de um tablet e retomar leitura.
- Download é por dispositivo. Remover no S6 Lite não remove no segundo tablet nem no PC. Inicialmente o estado de download é mantido localmente em cada instalação.
- Primeira entrega: uma conta ativa por instalação. Perfis persistidos alternáveis no mesmo tablet exigem isolar banco/credenciais/workers por servidor e usuário; o código atual tem um banco de nome fixo e precisa de auditoria e testes antes desse uso.
- Não apagar dados locais nem trocar credenciais enquanto houver progresso pendente sem preservar sua identidade. Nunca enviar progresso de A com credenciais de B.
- Se for necessário exibir no PC quais tablets baixaram cada obra, tratar como uma etapa adicional: inventário por usuário/dispositivo/obra, sem sincronizar deleções e indicando que dispositivos offline podem estar desatualizados.

## Decisões propostas

1. Usar Docker Compose no PC se Docker Desktop/WSL2 estiver disponível e adequado. A biblioteca entra como bind mount somente de leitura; configuração do Kavita fica em volume/pasta local gravável, separado da biblioteca e da sincronização OneDrive.
2. Alternativa se Docker não for viável: serviço nativo com usuário do sistema que possa ler a biblioteca e escrever apenas em seus dados operacionais. Não rodar o leitor como administrador para contornar permissões.
3. Começar com versão fixada do Kavita e do Kover. Registrar versão/commit e compatibilidade; evitar latest como configuração permanente. Usar release oficial para validar fluxo existente, ou build identificado do fork quando mudanças locais forem necessárias.
4. Conta administrativa usada apenas para configuração. Kover recebe conta comum com bibliotecas permitidas e Download, usando Auth Key própria, revogável, guardada fora do repositório.
5. Conectar pela API nativa esperada pelo Kover. Usar URL do PC acessível ao tablet; localhost no tablet aponta para o próprio tablet. OPDS não é um requisito presumido para essa integração.
6. Exclusão manual com rótulo explícito “Remover download deste dispositivo”. Exclusão automática depois de lido será opcional, desligada por padrão e só implementada se desejada após validar a operação manual.

O bind mount deve incluir apenas o acervo, sem uma segunda montagem gravável da mesma pasta, links que escapem da raiz ou montagens aninhadas sem verificação. A opção somente leitura impede escrita pelo container; conferir a montagem efetiva e não apenas o YAML. [Documentação Docker](https://docs.docker.com/engine/storage/bind-mounts/).

O papel Read Only do Kavita limita gerenciamento de conta, conforme PolicyConstants.cs; não equivale a uma biblioteca protegida pelo sistema operacional.

## Separação dos dados

| Local | Dados | Permissões/efeito de remover download |
| --- | --- | --- |
| PC / acervo | EPUB, PDF, CBZ/CBR e demais originais | Somente leitura para Kavita; permanece íntegro |
| PC / dados Kavita | Banco, configuração, capas, cache, temporários e backups | Gravável; remover download não exclui catálogo |
| Tablet / conteúdo offline | Arquivos ou páginas baixadas, temporários, assets necessários ao leitor | Removível pelo app, no SQLite/armazenamento privado da instalação |
| Tablet / estado pessoal | Progresso, identificadores, fila de sync e preferências | Preservado ao remover conteúdo offline |

PC desligado ou rede indisponível: só o que já foi baixado e validado deverá abrir. Catálogo completo, imagens externas e novos downloads podem exigir conexão. Reiniciar o app não pode tornar a leitura baixada dependente de autenticação online.

## Ordem das entregas e marcos

| Fase | Entrega que a pessoa consegue usar | Depende de | Marco | Estado |
| --- | --- | --- | --- | --- |
| F1 | Baixar uma obra, ler offline no S6 Lite, remover só a cópia local e sincronizar progresso | Preparação mínima descrita na F1 | MVP individual em ambiente de teste | Em andamento |
| F2 | Usar os formatos prioritários e recuperar downloads interrompidos ou sem espaço | F1 | Offline pronto para o acervo escolhido | Pendente |
| F3 | Duas pessoas usam a mesma biblioteca, com contas e históricos independentes | F1 | Biblioteca compartilhada por contas locais | Pendente |
| F4 | A mesma pessoa continua a leitura em dois tablets, com downloads independentes | F2 + F3 | Uso em vários tablets Android | Pendente |
| F5 | Usar o acervo real, reiniciar, atualizar e recuperar o serviço a partir de backup verificado | F2 + F3 + F4 | Operação doméstica aceita | Pendente |
| F6 — opcional | Alternar pessoas no mesmo tablet, preservando os dados offline de cada perfil | F3 + F4 | Tablet compartilhado entre perfis | Fora do compromisso inicial |

Ordem sugerida: F1 → F2 → F3 → F4 → F5. A F3 também pode começar depois da F1 se essa prioridade mudar. A F6 não bloqueia o uso de várias contas em tablets separados.

Auditoria, SDKs, build, CI e correções são tarefas de apoio à fase que precisa delas. Não há uma entrega isolada de “backend pronto” ou “corrigir depois”: uma falha em um critério de aceite mantém a fase aberta. Quando o comportamento existente já passa, registrar testes de caracterização e evitar reimplementá-lo.

## F1 — Ler uma obra offline e remover somente o download

**Jornada:** “Escolho uma obra no PC, baixo no S6 Lite, leio com o PC inacessível, removo a cópia do tablet e depois encontro meu progresso no Kavita.”

**Recorte:** uma conta local de leitor, uma biblioteca de teste, uma obra de um formato prioritário, rede doméstica e remoção manual. Definir o formato com uma amostra representativa antes de iniciar. A preservação dos originais, do catálogo e do progresso pendente é obrigatória desde esta primeira entrega.

### Trabalho integrado

1. Confirmar versão Android/espaço do S6 Lite, pasta da amostra e disponibilidade de Docker/WSL2. Preparar os SDKs dos componentes que precisarem de alteração e registrar baseline; na inspeção anterior não havia SDK .NET disponível. Adaptar as instruções de TDD ao repositório Kover antes de alterá-lo.
2. Fixar builds/commits compatíveis e instalar um APK identificável no S6 Lite. Se usar imagem upstream para validar o fluxo, registrar que ela não contém mudanças locais do fork. O Dockerfile local espera artefatos _output/*.tar.gz preparados pelo fluxo de release.
3. Preparar serviço e biblioteca descartáveis: acervo somente leitura, dados operacionais graváveis fora do OneDrive, healthcheck e reinício. Criar Admin separado e leitor sem Admin com acesso à biblioteca e Download. Configurar URL LAN e Auth Key própria no Kover.
4. Auditar o caminho real UI → DownloadManager → DownloadRepository → DownloadDao, o leitor e ReaderRepository/mergeProgress. Confirmar que a remoção não chama ações administrativas remotas, inclusive via POST.
5. Escrever testes de caracterização ou regressão do fluxo, corrigir somente lacunas observadas e validar o caminho completo. Se houver download em execução, a remoção deve coordenar cancelamento ou bloquear com motivo claro; não pode recriar silenciosamente o conteúdo removido.
6. Disponibilizar estados compreensíveis de download pronto, falha e ausente; ação “Remover download deste dispositivo”; preservar ReadingProgress e sua marcação dirty antes de remover DownloadedPages. Erro ao persistir progresso deve preservar a cópia e informar a falha.

**Pontos principais:** configuração de implantação e autorização do Kavita; contratos Reader/Book/Plugin e downloads realmente usados pelo cliente; managers, repositórios, DAOs, leitores e credenciais do Kover. Não presumir que todo offline usa DownloadController.chapter: o fork também baixa páginas/blobs.

### Demonstração de aceite

- Dado o serviço de teste, o contexto do serviço não consegue criar, alterar nem excluir arquivos descartáveis na montagem do acervo; o leitor não consegue executar operações administrativas.
- Dada uma obra baixada por completo, ativar modo avião e tornar o PC inacessível; encerrar/reabrir o app e ler até uma posição conhecida. O leitor usa conteúdo local, incluindo assets necessários ao formato escolhido.
- Ainda offline, remover o download e reabrir o app. Conteúdo offline fica ausente, posição e pendência de sincronização permanecem; repetir a remoção é seguro.
- Reconectar: o progresso aparece no Kavita, o catálogo permanece e o app não baixa a obra de novo sozinho. Baixar novamente por ação explícita e retomar a posição.
- Nomes, caminhos relativos, tamanhos e hashes dos originais são iguais antes/depois. A observação das chamadas confirma ausência de exclusão administrativa remota.

**Artefatos de entrega:** configuração reproduzível do serviço de teste e exemplo de ambiente sem segredos; APK/build identificado; amostras/fixtures permitidas; testes automatizados da remoção/progresso/autorização relevantes; roteiro e registro da demonstração no S6 Lite.

**Limite:** uma conta ativa por instalação. Troca de perfil não pode ser anunciada como suportada; conservar os dados atuais em vez de limpar banco/pendências para trocar credenciais. Falhas de rede ou espaço devem ser seguras desde F1; retomada e experiência completa dessas falhas entram na F2.

## F2 — Baixar e ler o acervo prioritário mesmo com interrupções

**Jornada:** “Preparo minha leitura para sair de casa, recupero um download interrompido e libero espaço sem perder o que já li.”

**Depende de:** F1 aceita. Confirmar a lista finita de formatos/amostras prioritários; começar por EPUB, PDF e CBZ/CBR apenas se estiverem no acervo pretendido. O suporte declarado não substitui a validação de cada formato.

### Trabalho integrado

1. Acrescentar uma amostra por formato escolhido e repetir o ciclo completo da F1 em cada uma: catálogo, transferência, assets, abertura offline, progresso, remoção e novo download.
2. Conectar estados da fila e da UI com a persistência real: aguardando, baixando, pronto, falha e ausente. Só declarar pronto quando o payload e os assets essenciais forem utilizáveis offline; validar a integridade conforme o formato.
3. Implementar/testar retomada, cancelamento e retry explícito quando faltarem no fork. Reaproveitar páginas já persistidas; retomada de um arquivo via Range depende do suporte do endpoint e não será presumida.
4. Tratar interrupção de rede, encerramento do app, suspensão do Android, credencial expirada e falta de espaço sem perder progresso, apresentar arquivo parcial como pronto ou duplicar conteúdo.
5. Integrar a remoção com uma operação segura de recuperação de espaço. Medir o efeito do SQLite e de ReclaimSpace/VACUUM, inclusive espaço temporário e falhas. Não prometer redução física instantânea ao apagar blobs.

### Demonstração de aceite

- Interromper download, reiniciar o app e retomá-lo; o item só fica pronto quando pode ser lido integralmente sem rede.
- Simular falta de espaço e credencial expirada. O app explica a falha, preserva dados existentes e permite continuar depois da correção.
- Remover enquanto baixa/lê: cancelar ou bloquear de forma explícita, sem corrida que restaure o payload removido; reiniciar durante a operação deixa estado recuperável.
- Para cada formato prioritário, repetir leitura, remoção offline, sync e novo download; originais/catálogo/progresso ficam íntegros.
- Após remover uma obra e executar recuperação de espaço quando necessária, medir espaço disponível e confirmar que outras obras e pendências continuam utilizáveis.

**Artefatos de entrega:** matriz de formatos realmente validados, APK identificado, testes de falha/retomada/concorrência, evidência de espaço recuperado e comportamento no S6 Lite. Recursos de memória, tamanho de amostra e tempo observado ficam registrados, sem inventar metas antes da medição.

## F3 — Compartilhar o acervo entre contas locais

**Jornada:** “Duas pessoas escolhem obras da mesma biblioteca, e cada uma vê apenas seu próprio histórico e progresso.”

**Depende de:** F1 aceita. Usar duas instalações isoladas; emulador pode apoiar testes automatizados, com demonstração também no Android físico disponível. Uma conta ativa por instalação continua sendo o recorte.

### Trabalho integrado

1. Criar duas contas locais de leitor no mesmo Kavita, autorizadas às mesmas bibliotecas, com credenciais próprias e sem Admin. Manter um único conjunto de arquivos e um único catálogo no PC.
2. Configurar cada instalação Kover para sua conta; conferir autenticação, cache do usuário, consultas, progresso e marcações de lido por usuário no servidor.
3. Validar isolamento desde a interface até a API e o banco. Corrigir autorização/consultas somente onde os testes demonstrarem necessidade; não criar um sistema paralelo de contas se o Kavita já atende.
4. Tratar credencial inválida/revogada sem transferir pendências para outra pessoa. Não usar clearDb como solução de troca de usuário que elimine leitura offline não sincronizada.

### Demonstração de aceite

- A e B veem a mesma obra do catálogo. A termina e sincroniza; B continua com seu próprio estado de não lido ou sua posição anterior.
- A e B leem offline e sincronizam em momentos diferentes; cada progresso é atribuído ao usuário correto.
- A remove o download; o download da instalação de B, o catálogo e o original permanecem.
- Chamadas que tentem acessar/modificar estado privado de outra pessoa ou administrar o acervo são negadas; revogar uma credencial não prejudica a outra conta.

**Artefatos de entrega:** procedimento de criação/vinculação de contas sem segredos, testes de autorização e isolamento, demonstração com duas contas e registro de que ambas apontam para o mesmo acervo.

**Limite:** contas representam pessoas, não aparelhos. Inventário central de downloads no PC e seleção de perfis no mesmo app são extensões independentes.

## F4 — Continuar a mesma leitura em outro tablet

**Jornada:** “Leio no S6 Lite e continuo em outro Android usando minha conta; cada aparelho decide o que mantém baixado.”

**Depende de:** F2 e F3 aceitas, segundo tablet Android disponível e identificado. Emulação apoia testes, mas não encerra a aceitação de uso em dois tablets físicos.

### Trabalho integrado

1. Configurar a mesma conta em dois tablets, preferencialmente com Auth Key própria para cada instalação, mantendo as mesmas bibliotecas e identidade do usuário.
2. Validar envio e recepção de progresso, marcação de lido e releitura. Downloads continuam locais; compartilhar progresso não dispara download nem descarte no outro dispositivo.
3. Testar mergeProgress sob timeout, retry e novas leituras durante a sincronização. Confirmar somente a revisão enviada; uma resposta antiga não pode limpar uma atualização local mais recente ainda pendente. Reaproveitar dirty/lastModified se os testes comprovarem segurança, ampliando o contrato apenas se necessário.
4. Documentar a política de conflito antes do código: avanço sequencial sincronizado retoma a última posição confirmada; alterações concorrentes divergentes, inclusive releitura intencional, preservam as duas posições até resolução explícita, salvo política alternativa demonstrada e registrada. Nunca escolher cegamente a maior página nem depender somente dos relógios dos tablets.
5. Implementar indicação/resolução de conflito no cliente e suporte de API apenas se faltarem. Testar EPUB por sua posição própria, além de contagem de páginas de imagem/PDF.

### Demonstração de aceite

- Ler em A, sincronizar, abrir a mesma obra já baixada em B: B retoma a posição confirmada. Repetir no sentido inverso.
- Baixar nos dois, remover em A e manter B offline: B continua lendo; depois da reconexão o download de B permanece e o de A não reaparece.
- A e B avançam offline a partir de um estado comum e depois reconectam em ordens diferentes: aplicar a política documentada, preservando alterações pendentes e sem regressão silenciosa.
- Iniciar releitura, reenviar após timeout e ler durante um sync: o estado final mantém a intenção do usuário e não duplica efeitos de conclusão/histórico.

**Artefatos de entrega:** política de conflitos com exemplos, testes de sync/revisões/retry, builds identificados dos dois tablets e demonstração de continuidade com downloads independentes.

## F5 — Usar o acervo real e recuperar a instalação

**Jornada:** “Uso minha biblioteca diariamente e consigo reiniciar, atualizar ou restaurar o servidor, recuperando o estado do backup e reconciliando as pendências dos tablets.”

**Depende de:** F2, F3 e F4 aceitas. A ativação do serviço real é uma entrega planejada desta fase, não uma ação executada pela revisão deste documento.

### Trabalho integrado

1. Aplicar a configuração validada ao acervo real com acesso somente leitura e dados operacionais separados; fazer inventário inicial e confirmar que não existe outra montagem gravável da mesma pasta.
2. Definir início automático, reinício, acesso na rede privada e suspensão do PC conforme o uso. O PC é necessário para novos downloads e sync; leitura já baixada funciona com ele desligado.
3. Fazer backup consistente de banco/configuração/dados operacionais necessários e testar restauração isolada. Evitar SQLite ativo em pasta sincronizada; manter versões/commits e segredos fora do código.
4. Preparar atualização reproduzível com teste de migração e retorno à versão anterior usando backup compatível. Não presumir downgrade automático de schema. Preservar identidade de assinatura/instalação do APK para não perder os dados Android ao atualizar.
5. No ensaio de recuperação, manter tablets com progresso pendente. Após restaurar, validar associação de contas/obras e reconciliação sem apagar pendências; se o backup for anterior ao progresso já confirmado, tornar explícito esse limite de recuperação.

### Demonstração de aceite

- Reiniciar PC e serviço; cada conta volta a navegar/baixar e o conteúdo offline continua legível durante a indisponibilidade.
- Em ambiente isolado, restaurar um backup e repetir login, leitura, download, remoção local e sincronização com dados pendentes de teste.
- Atualizar uma versão de teste com migração, verificar o ciclo e ensaiar retorno com executável/imagem e banco compatíveis.
- Registrar intervalo de backup e perda máxima de dados aceita; evidenciar o que a restauração recupera. Dados posteriores ao último backup não podem ser prometidos como recuperáveis sem outra cópia.
- Comparar o inventário dos originais após os ciclos. O procedimento de restauração não escreve no acervo nem orienta limpar o armazenamento dos tablets.

**Artefatos de entrega:** configuração de operação com versões fixadas, guia de iniciar/parar/atualizar/restaurar, backups de teste restauráveis, resultados do ensaio e builds finais identificados. Só declarar operação aceita após essas demonstrações.

## F6 — Opcional: alternar perfis no mesmo tablet

**Jornada:** “Empresto o tablet para outra pessoa, ela abre seu perfil e depois volto à minha leitura, inclusive sem conexão.”

**Depende de:** F3 e F4 aceitas e confirmação de necessidade de tablet compartilhado. Essa capacidade não foi demonstrada no Kover atual: há uma credencial ativa e banco de nome fixo.

**Entrega integrada:** seleção de perfil na UI; credenciais seguras e armazenamento isolado por servidor/usuário; workers vinculados ao perfil; migração da instalação de conta única sem perda de dados. Escolher banco separado ou chaves compostas após auditar o código, com testes de migração. Não reutilizar payload entre perfis sem uma estratégia explícita de autorização e referências.

**Aceite:** ler offline como A, alternar para B, usar outro progresso/download, reiniciar, voltar a A e sincronizar. Dados e pendências continuam associados ao dono; nenhuma requisição de A sai autenticada como B. Revogar uma credencial ou remover um download não altera outro perfil. IDs iguais de capítulos em servidores distintos não colidem. Identificar claramente quais perfis já foram configurados e podem ser abertos offline.

**Artefatos de entrega:** APK com seleção de perfis, migração testada, testes de isolamento/concorrência e demonstração offline com duas pessoas no mesmo tablet. Mantém-se fora do compromisso inicial até ser priorizada.

## Contratos que todas as fases preservam

- Operações locais de limpeza, remoção, logout e sync não apagam, movem, renomeiam nem sobrescrevem originais e não removem entidades do catálogo remoto. Não liberar escrita no acervo para contornar erros.
- Remoção local é idempotente, preserva progresso pendente e não dispara novo download automático. Em SQLite, restringir DELETE ao payload correto; em arquivos auxiliares, validar o caminho canônico na raiz privada e rejeitar travessia/links que escapem dela.
- Toda pendência pertence ao servidor e usuário que a originaram. Downloads pertencem à instalação/dispositivo; identidade de conta não deve ser confundida com ID do aparelho.
- Credenciais, bancos pessoais e conteúdo do acervo não entram nos fixtures, logs ou artefatos versionados. Testes de escrita/exclusão usam somente dados descartáveis.

## Qualidade e evidências em cada fase

O TDD acompanha cada mudança funcional, não constitui uma fase posterior. Para cada critério novo ou bug: registrar teste que falha pelo comportamento (RED), alteração mínima que passa (GREEN), refatoração e regressões pertinentes. Comportamento existente que já funciona recebe caracterização; não criar uma falha artificial para alegar TDD. Configuração precisa de teste de comportamento isolado; documentação recebe revisão de fatos/links.

Antes de encerrar uma fase:

- Todos os critérios daquela fase passaram e os das fases anteriores continuam atendidos.
- Código alterado tem validação apropriada. No Kover: testes, analyze, formato, migrações quando houver e build Android; no Kavita: testes/build dos componentes alterados e autorização/contratos afetados. Mudança funcional na UI Angular exige preparar seu executor conforme DEVELOPMENT.md.
- Registrar versões/commits exatos do servidor e APK, Android/modelo, formatos/amostras, comandos, resultados e limitações. Não registrar tokens, senhas nem conteúdo pessoal.
- Guardar demonstração ponta a ponta e relatório em docs/validation/Fn.md no repositório Kavita, com referência às mudanças dos dois forks. Estes relatórios são entregáveis futuros, ainda não existem.
- Bloqueio de ferramenta/dispositivo deixa a fase pendente; build ou teste pulado não equivalem a aceite funcional.
- Se a fase alterar schema ou credenciais, validar recuperação em dados descartáveis antes da atualização real. Nunca voltar de versão apagando progresso offline.

## Rastreabilidade dos requisitos

| Requisito | Primeira fase que comprova | Ampliação/regressão |
| --- | --- | --- |
| Originais e catálogo preservados | F1 | Todas |
| Abrir sem rede após reiniciar app | F1, formato inicial | F2, demais formatos |
| Remover somente cópia local | F1 | F2, concorrência/espaço; F4, outro tablet |
| Progresso pendente sobrevive à remoção | F1 | F3, identidade; F4, conflitos/retry |
| Download parcial nunca aparece pronto | F1, falha segura | F2, retomada completa |
| Biblioteca única, histórico por pessoa | F3 | F4 e F5 |
| Mesma conta em vários tablets | F4 | F5 |
| Backup/restauração/atualização verificáveis | F5 | A cada mudança de operação/schema |
| Alternar pessoas no mesmo app | F6 opcional | Fora do aceite inicial |

## Extensões posteriores, sem bloquear as entregas principais

- **Inventário central de downloads:** ver no PC o último estado informado por usuário/dispositivo/obra, com data da informação. Um tablet offline pode estar desatualizado; esse registro nunca propaga exclusão de conteúdo. Primeiro comprovar o estado local na F1 e a independência na F4.
- **Remoção automática depois de lido:** opção desligada por padrão; reutilizar o contrato de remoção local e garantir progresso persistido antes do descarte.
- **Acesso fora de casa:** escolher acesso privado/VPN ou HTTPS autenticado e validar no Android. Não é necessário para ler downloads já concluídos durante uma viagem.

Cada extensão deverá ganhar seu próprio recorte vertical, testes e aceite quando priorizada. Não está incluída automaticamente na F5.

## Próxima entrega a executar

Iniciar F1: confirmar Android/espaço do S6 Lite e uma amostra de formato prioritário; preparar serviço e APK de teste; executar e corrigir o ciclo completo de baixar → ler offline → remover localmente → reconectar → sincronizar → baixar novamente. A configuração, a amostra sintética e os testes locais já estão implementados em [deployment/offline](../../deployment/offline/README.md). O servidor já está disponível na rede doméstica pelo IP privado configurado no .env local; login, download e leitura sem Wi-Fi foram confirmados no tablet como marco v1.0. O próximo passo é validar reinício offline, remoção local, sincronização e novo download explícito. Consulte [o registro F1](../validation/F1.md) antes de repetir preparações ou declarar a fase concluída.


## Organização do acervo existente

O diagnóstico e as entregas O0–O5 estão no [plano de organização](ORGANIZACAO_ACERVO.md). A enumeração das três pastas foi concluída; ajustes no catálogo, piloto e eventual preparação de cópias ainda não foram executados. Preservar originais e progresso durante a organização; esse trabalho não substitui os aceites offline das fases acima.
