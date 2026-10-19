# Organização por pastas — validação P1

Data: 2026-10-18. Este relatório registra a validação inicial em piloto isolado. Posteriormente, o usuário priorizou e autorizou a aplicação ao principal: veja a [implantação concluída e os limites Android](PASTAS_PRINCIPAL.md). Os detalhes de pilotos abaixo são históricos; a árvore visual e o aceite do Kover continuam pendentes.

## Comportamento entregue

- A opção **Organizar por pastas** aparece nas configurações avançadas ao criar uma biblioteca. O flag `FolderBasedOrganization` é persistido e retornado pela API.
- O caminho físico e o formato definem a identidade. Nomes normalizados não juntam pastas como `A/B` e `AB`. O nome relativo da pasta serve à apresentação.
- Metadados internos de PDF, EPUB e ComicInfo.xml não definem séries, títulos, volumes ou agrupamentos nesse modo. Matching externo e listas/coleções gerenciadas por metadados ficam desativados.
- Cada contêiner tem seu próprio capítulo, mesmo com números ou nomes-base coincidentes. PDFs e EPUBs preservam seus leitores; imagens soltas da mesma pasta formam um capítulo com várias páginas. Arquivos diretamente na raiz também são indexados.
- A API mantém compatibilidade quando clientes antigos omitem o flag. Bibliotecas preenchidas não podem trocar de modo pela edição comum: a API retorna HTTP 409 `library-organization-migration-required` antes de alterar os dados.
- Bibliotecas no modo antigo mantêm o comportamento anterior dos parsers. As correções globais de PDF experimentadas antes da mudança de plano foram retiradas; testes de caracterização protegem esse limite.
- A curadoria antiga de títulos/coleções ignora bibliotecas em modo por pastas. Ela não substitui a migração estrutural.

## TDD e regressões

| Área | Evidência |
| --- | --- |
| Parser por pastas | RED: 9 falhas funcionais em 10 casos; GREEN: 10 passaram. |
| Scanner integrado | RED: agrupamento, colisão de nomes e arquivos na raiz falharam; GREEN após a implementação. Casos adicionais cobrem imagens, nomes que normalizam para vazio, livros e formatos diferentes. |
| API de configuração | RED confirmado por alterações inseguras aceitas e políticas não aplicadas; GREEN: 4 casos. Uma falha inicial de fixture Hangfire foi corrigida antes de repetir o RED funcional. |
| Compatibilidade PDF | RED: 3 diferenças em relação ao comportamento legado; GREEN após restringir a nova organização ao modo optativo. |
| Migração de esquema | RED por migração ausente; GREEN em SQLite com bibliotecas já existentes. O flag novo recebe false e preserva IDs/nomes. |
| Interface | RED: 3 falhas de interação; GREEN: 3 testes Angular/Vitest/jsdom. Build de produção aprovado; lint dos arquivos alterados sem erros, com 2 avisos preexistentes no template. |
| Scripts de infraestrutura/organização | 45 testes aprovados, incluindo a proteção contra curadoria antiga em bibliotecas por pastas. |
| Kover | 70 testes de DAOs/repositórios aprovados; análise dos 4 arquivos alterados sem problemas. Nenhum APK gerado ou instalado. |

Regressões finais do backend: **341 testes de serviços, 27 de banco e 6 de API**, todos aprovados, sem testes pulados. A regressão de serviços inclui scanner, parsers, leitura de arquivos e os novos casos de pastas. A proteção do Kover é código preparado para a migração futura; o tablet em uso ainda não recebeu essas mudanças.

## Pilotos executados

O piloto novo usa uma imagem compilada do fork com a interface Angular atual. Foram cadastradas três bibliotecas com fontes reais montadas somente leitura e conta/progresso sintéticos. Configuração, banco e cache ficam em um volume operacional separado. A porta 5054 está publicada apenas em 127.0.0.1.

Resultados observados pela API:

- 24 arquivos de mangás, 22 de livros e 5 de quadrinhos: **51 contêineres e 51 capítulos**, todos com contagem de páginas positiva.
- **20th Century Boys: uma série com 22 volumes**; 21st Century Boys permaneceu separado.
- Downloads individuais de dois PDFs responderam com conteúdo PDF.
- Nova varredura do piloto preservou os IDs de arquivos/séries/volumes/capítulos e o progresso sintético salvo.
- Metadados, matching, scrobbling e gerenciamento de listas/coleções por metadados permaneceram desativados, mesmo quando enviados como true na criação.
- O HTML servido referencia os assets do build atual e a tradução portuguesa da opção foi servida corretamente. A interação do componente foi verificada por testes; não houve inspeção visual automatizada no navegador.
- Cinco originais, um por montagem de fonte, tiveram SHA-256 e tamanho iguais antes e depois. As cinco montagens de fontes são somente leitura; apenas os dados operacionais são graváveis.

Um segundo ensaio atualizou uma cópia consistente do volume do piloto anterior, após pará-lo. Seus **51 arquivos mantiveram os IDs**, as três bibliotecas receberam modo legado e o progresso sintético continuou salvo. A tentativa de trocar o modo de uma biblioteca preenchida recebeu 409 e não mudou o catálogo. Esse resultado valida **a atualização do esquema**; não comprova a migração estrutural do catálogo pessoal.

O healthcheck do servidor principal continuou respondendo 200. Os relatórios detalhados, tokens, credenciais sintéticas, hashes e catálogos estão em diretórios ignorados pelo Git. Não versioná-los nem colar credenciais na conversa.

## Reprodução e limites

Use os comandos do [guia de desenvolvimento](../ai/DEVELOPMENT.md) e o [Dockerfile do fork](../../deployment/offline/Dockerfile.fork). A imagem local validada é `kavita-folders-test:20261018`; o SDK usado foi o .NET 10 fixado no guia. A publicação foi self-contained para linux-x64 e incorporou o build de produção de UI/Web. O contexto da imagem foi somente o diretório publicado, conferido sem bancos pessoais. A configuração real usa volume separado e chave gerada para o piloto.

O ambiente ainda apresenta avisos preexistentes de compilação/dependências do upstream. O build web exigiu Node compatível com os engines; nesta sessão, foi usado 24.15.0 isoladamente. Windows Developer Mode não foi ativado; os testes do Kover usaram dependências/codegen preparados e --no-pub.

A grade atual apresenta séries por pasta e formato. Formatos diferentes na mesma pasta ainda podem produzir mais de um cartão; a árvore da P2 os reunirá visualmente. Mover/renomear arquivos ou migrar uma biblioteca já preenchida exige tratamento de identidade próprio. Não aplicar um scan forçado ao catálogo pessoal para ativar este modo. O teste de nova varredura ocorreu apenas nos pilotos e fixtures.

Próximas entregas: navegação hierárquica, migração com preservação das referências pessoais e atualização/validação do Kover no S6 Lite antes de depender de sua nova reconciliação no catálogo em uso.
