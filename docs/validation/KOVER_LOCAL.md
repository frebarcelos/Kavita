# Kover Local e catálogo por pastas

Atualização em 2026-10-19. O usuário informou que o Kover instalado veio do Google Play e autorizou descartar seus dados de teste. O tablet está conectado por USB com depuração autorizada. Essa autorização vale para o cliente Android; os originais e o estado pessoal do servidor continuam protegidos.

## Implementação e testes

- A reconciliação consulta os pais atuais dos capítulos protegidos, mesmo quando a série anterior ainda existe. Aceita mudança de volume com identidade, formato e páginas estáveis e conserva payload, progresso pendente, bookmarks e timestamps.
- Atualização comum de detalhes não pode apagar capítulos protegidos. Respostas incompletas, pais não autorizados e reaproveitamento de ID com conteúdo diferente abortam antes de modificar os dados locais.
- A fila de sincronização interrompe fases dependentes quando uma etapa falha e mantém o erro visível. Uma nova sincronização pode tentar novamente.
- **92 testes** de DAOs, repositórios, sincronização e segurança do SyncManager passaram. Foram observadas falhas funcionais RED antes das correções. A análise dos arquivos Dart alterados terminou sem problemas; a verificação de whitespace passou nos dois repositórios.
- A consulta de configurações administrativas é opcional para leitores: HTTP 403 conserva o cache anterior ou os valores padrão existentes. HTTP 401/500 continuam sendo erros. Dois testes demonstraram RED para o 403; depois os cinco casos passaram, incluindo atualização autorizada e preservação do cache.
- A resposta de detalhes omite volumes estruturais de especiais, capítulos avulsos e storyline. O cliente agora busca seus pais reais, valida série/ID e persiste as referências. Esses volumes não criam seções duplicadas na apresentação. Houve RED para pais ausentes, proprietário incompatível e duplicação visual; os controles verificam preservação de payload/progresso, FKs em memória e volumes comuns visíveis.
- Não houve mudança de schema. Capítulos antigos que reuniam vários arquivos continuam sendo um caso ambíguo: a proteção recusa a migração automática do payload. O aceite desta instalação usará catálogo local limpo, conforme a decisão do usuário.

O build debug usa o pacote `com.rodonisi.kover.local`, com nome **Kover Local**. A instalação fica separada do aplicativo do Google Play. A configuração release do upstream permanece separada. Atualizações futuras da instalação Local precisam manter pacote e certificado compatíveis; guarde a chave de assinatura fora do Git. Referência: [assinatura Android](https://developer.android.com/studio/publish/app-signing).

## Ambiente de compilação

Flutter 3.47.7/Dart 3.13.5 conforme `.fvmrc`, SDK Android e cache Gradle preparados em `_temp/tools`, sem ativar Developer Mode. Executar `flutter pub get --offline` concluiu a preparação dos plugins Android sem mudar o lockfile. O primeiro APK compilava sem `GeneratedPluginRegistrant.java` e encerrava com falha JNI antes da tela inicial. Gerar o registrante pelas ferramentas Flutter e recompilar corrigiu a inicialização; não foi feita edição manual do arquivo gerado. **Não usar `--no-pub` antes de comprovar que os registrantes necessários existem.**

O projeto usa compile SDK 37.0; foi necessário declarar a versão minor e atualizar AGP de 9.1.0 para 9.1.1, compatível com Gradle 9.3.1. [Compatibilidade oficial](https://developer.android.com/build/releases/agp-9-1-0-release-notes).

## Aceite no dispositivo e principal

Dispositivo: Samsung SM-P613, Android 14. **APK final compilado, assinatura verificada e instalação por USB concluída**, versão 1.0.0+1. SHA-256 do APK: `70db2decdd388b808d695e166354b4fe64314e4ca99c108f98fe62cd9c4e2502`. Artefato local: `../kover/build/app/outputs/flutter-apk/app-debug.apk`. Certificado debug SHA-256: `9c8f74f3a37ffe539ced361b5876088d8bf024dbb6ab773adec90cf0d6abb055`.

O ensaio usou um clone isolado do checkpoint migrado: três bibliotecas, 125 agrupamentos e 931 capítulos. As fontes permaneceram somente leitura. Não foram executadas operações de exclusão contra o acervo real.

| Verificação no S6 Lite | Resultado observado |
| --- | --- |
| Download PDF | Um payload de 687.387 bytes; SHA-256 igual ao original |
| Reinício sem rede | Wi-Fi desligado, `adb reverse` removido e app encerrado/reaberto; PDF abriu |
| Leitura offline | Progresso de duas páginas persistido com `dirty=true` |
| Remover download pela interface | Zero payloads; linha de progresso inteira idêntica à anterior, ainda pendente |
| Reconectar e sincronizar | Após corrigir os pais omitidos, clone recebeu página 2 e o tablet passou a `dirty=false` |
| Não baixar novamente | Zero payloads após a sincronização |
| Originais | Três amostras mantiveram tamanho e SHA-256; fontes continuam montadas somente leitura |

O Wi-Fi precisou reconectar à rede doméstica antes do envio de progresso. A capa magnética fechada também impediu a primeira tentativa de interação; ambos foram resolvidos e não representam aceite presumido.

Após esse aceite, a revisão automática inicialmente bloqueou a reativação de Auth Keys por exigir autorização explícita. O usuário autorizou expressamente reativar e conectar o Kover Local. Foi aplicado somente `FolderOrganization:ApiKeyMaintenance=false` no JSON operacional, com cópia anterior preservada, e o principal foi reiniciado. Não foi substituído seu banco. Health e acesso por Auth Key retornaram HTTP 200; a conta leitora manteve somente `Pleb`, `Login` e `Download`, e configurações Admin retornaram HTTP 403.

Apenas os dados de teste da instalação **Local** foram limpos antes de trocar de servidor. Ela agora usa o IPv4 privado do PC, porta 5000, pela rede doméstica, sem `adb reverse`. O clone foi parado. O principal permaneceu publicado exclusivamente no IP privado e com todas as fontes somente leitura. O progresso de teste não foi enviado ao principal.

No fechamento, o catálogo atual sincronizou **três bibliotecas, 127 agrupamentos e 934 capítulos**; o clone usava o checkpoint anterior de 125/931. Century Boys aparece uma vez, com 22 itens, na seção que o Kover chama de “Especiais”. A instalação Local terminou sem downloads e sem progresso de teste. SQLite: `integrity_check=ok`, sem capítulos apontando para volumes ausentes. Persistem três referências antigas de dashboard para filtros inexistentes, também presentes no clone; não se declarou integridade referencial global nem se alterou esse módulo nesta entrega.

A árvore visual P2, a apresentação de formatos na mesma pasta, novo aceite específico de CBZ/EPUB e o cenário de dois tablets continuam pendentes. Não houve migração automática de payloads antigos com conteúdo dividido. Relatórios, bancos, credenciais, logs e screenshots permanecem locais e ignorados pelo Git; não versioná-los.
