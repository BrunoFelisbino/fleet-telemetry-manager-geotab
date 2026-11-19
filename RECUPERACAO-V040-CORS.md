# Recuperação do MyGeotab sem alterar o Fleet Telemetry Manager v0.4.0

## Evidência do erro

O MyGeotab não abre a v0.4.0 porque o GitHub Pages não retorna "Access-Control-Allow-Origin" nas respostas de HTML, ícone e translations. O Console mostra "blocked by CORS policy" e "Add-In files ... couldn't be loaded".

## Solução limitada ao carregamento

- Os HTMLs e scripts originais da v0.4.0 permanecem **inalterados** na raiz da aplicação.
- As seis páginas para o MyGeotab ficam em \`/geotab/restore040*.html\`, com CSS e JavaScript local incorporados a partir da **mesma versão 0.4.0**. Não foram modificadas consultas, filtros, KPIs ou relatórios.
- O manifesto de instalação separado é \`addin-config.v040-recovery.json\`. É um único Add-In com seis páginas e nomes distintos, no domínio HTTPS **sem hífens** \`ftmbrunog2026.vercel.app\`.
- O \`vercel.json\` permite requisições públicas cross-origin e a pasta \`geotab/translations/\` contém os idiomas.
- \`version: 0.4.13\` distingue o manifesto de recuperação. O **código funcional continua baseado na v0.4.0**.

## Validação e publicação

1. Revisar e testar a branch/PR; o teste \`node scripts/verify-v040-hosted.mjs\` verifica sintaxe, namespace Geotab, nomes de rota, traduções, CORS e que não há referências relativas de recursos.
2. Publicar primeiro uma prévia na Vercel e testar que os seis arquivos HTML e o ícone respondem com HTTP 200. Esse teste **não equivale** a testar a API numa sessão autenticada do MyGeotab.
3. Depois de aprovado, atualizar o alias \`ftmbrunog2026.vercel.app\` para esse deployment. Antes de atualizar o MyGeotab, conferir que \`https://ftmbrunog2026.vercel.app/geotab/restore040mileage.html\` já responde na **mesma URL do manifesto**.
4. Na conta do MyGeotab, editar o Add-In **existente** \`fleetTelemetryManager\`: salvar backup do JSON atual, substituir pelo conteúdo de \`addin-config.v040-recovery.json\`, salvar e recarregar. Não criar um segundo Add-In com o mesmo nome.
5. Verificar a tela de Quilometragem. O Console deve registrar \`[Fleet TM v0.4.0 restaurado]\`. Confirmar consultas reais, com permissões adequadas, antes de avançar para os outros cinco módulos.

## Por que não reinstalar o manifesto v0.4.0 original?

Porque ele referencia arquivos em \`https://brunofelisbino.github.io\` e esses URLs foram bloqueados por CORS pela origem \`https://my.geotab.com\`. Mudar \`?v=\` ou forçar a atualização do navegador não corrige um cabeçalho CORS ausente.

## Limites

- Algumas páginas usam Leaflet via unpkg.com; o CDN precisa estar acessível na rede usada pelo MyGeotab.
- O funcionamento da API Geotab e dos gráficos depende da sessão autenticada. Testes de JavaScript e HTTP não validam isso.
- Não compartilhar no Console tokens, cookies ou parâmetros de sessão.

Referências: https://developers.geotab.com/myGeotab/addIns/developingAddIns/ e https://support.geotab.com/pt-BR/community/sdk-api/sdk-api-add-ins/1103/mygeotab-add-in-broken-links
