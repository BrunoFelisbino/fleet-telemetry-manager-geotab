# Recuperação do Fleet Telemetry Manager v0.3.0 usando SOMENTE JSON

## Por que o rollback para 0.3.0 não bastou

A versão 0.3.0 tinha filtros de vários grupos, gráficos e PDF funcionando após importar somente o JSON. A configuração referenciava arquivos remotos e, portanto, não exigia a aba **Files**.

O rollback atual restaurou o código 0.3.0 na \`main\`, mas manteve links para GitHub Pages contendo hífens. Conforme a documentação Geotab, URLs absolutas com hífens podem impedir o carregamento. O histórico das PRs #14 e #15 também registra problemas de CORS para os recursos do GitHub Pages e o alias Vercel ficando associado a uma versão posterior.

Existe uma publicação Vercel **READY** do commit exato original 0.3.0: \`e26c922448c26e3e0da9ebb00275b96aa412a8b6\`, deployment \`dpl_GqhgXS2bR7Yg86Y6aJ23RbmnVJ8f\`. Porém essa publicação não tem o novo arquivo de cabeçalhos CORS necessário à recuperação. O alias \`ftmbrunog2026.vercel.app\` estava associado ao deploy \`dpl_9SDNAwjMPsgjP9Srhu9taDAJAtyA\` baseado em v0.4.0.

## O que esta branch entrega

- Código funcional dos seis módulos **idêntico** à versão 0.3.0; copia os HTMLs originais para seis nomes distintos e mantém JS/CSS/PDF originais.
- \`vercel.json\` com \`Access-Control-Allow-Origin: *\` e headers de cache atualizáveis.
- \`addin-config.v030-hosted.json\` com nome \`fleetTelemetryManager\`, manifesto 0.3.1 (código 0.3.0), \`category: AddIns\` e seis URLs distintas sem hífen, \`@ \` ou \`#\`, hospedadas em \`https://ftmbrunog2026.vercel.app\`.
- Testes estáticos de igualdade byte a byte entre HTMLs originais e cópias, existência dos JS relativos, URL segura, namespace e CORS.

**Sem importar arquivos na Geotab e sem alterar as funcionalidades.**


## Teste isolado já preparado (somente JSON)

A Vercel recebeu o alias de teste **\`ftmbrunog2026teste.vercel.app\`** ligado ao deployment de recuperação \`dpl_Dg1obT8qN4Pxuojtqnv62LdNznqf\`. Esse deployment contém o código v0.3.0 sem mudanças funcionais, URLs exclusivas e cabeçalhos CORS.

Para testar sem afetar a produção, salve um backup do JSON da instalação e **cole apenas \`addin-config.v030-teste.json\` na configuração do mesmo Add-In**. Não é necessário importar arquivos na aba Files. Esse manifesto usa o host de teste; o \`addin-config.v030-hosted.json\` usa o alias de produção e só deve ser utilizado depois de apontarmos esse alias para o deployment homologado.

A atribuição do alias e o resultado das verificações de build não equivalem ao teste autenticado da Geotab. Valide a seleção de vários grupos, quilometragem, gráfico e PDF no MyGeotab antes de promover.

## Acompanhamento da publicação

A nova branch produz prévia automática na Vercel. **Não instale o novo manifesto enquanto o alias público não estiver ligado ao novo deployment verificado.** O CI apenas verifica os fontes; não confirma carregamento real no MyGeotab.

Etapas recomendadas:

1. Validar no deployment prévia os seis HTMLs da v0.3.0 e CSS/JS que carregam; resposta 200 e cabeçalho \`Access-Control-Allow-Origin: *\`.
2. Depois de validado, associar \`ftmbrunog2026.vercel.app\` ao deployment revisado (ou promover uma versão homologada). Confirmar as mesmas seis URLs no alias.
3. Salvar backup do JSON atual no MyGeotab. **Editar o Add-In existente** \`fleetTelemetryManager\`.
4. Colar **apenas** o JSON de \`addin-config.v030-hosted.json\` na configuração. **Não importar ZIP, HTML ou JS.**
5. Salvar e atualizar MyGeotab. Testar seleção simultânea de 2-3 grupos, consulta, gráfico e exportação PDF, depois todos os demais menus.
6. Conferir Network/Console se houver falha (HTTP 404, CORS, namespace, callback ou API). Não divulgar tokens da Geotab.

## Segurança de rollback

Não mudar o \`addin-config.json\` da \`main\` nesta PR antes de homologar. A PR fica em rascunho até testar e obter autorização de produção. Se o alias for movido, registrar o deployment anterior \`dpl_9SDNAwjMPsgjP9Srhu9taDAJAtyA\` para reversão imediata.

Documentação Geotab: https://developers.geotab.com/myGeotab/addIns/developingAddIns/
