# Fleet Telemetry Manager: recuperação com seis rotas exclusivas (v0.4.12)

## Diagnóstico

1. A v0.4.9 usa URLs locais `dashboard049.html`, `mileage049.html` etc. e `files: {}`; se os arquivos não forem enviados pelo MyGeotab, os menus dão **404**.
2. A configuração HTTPS anterior usava `index.html` como nome de arquivo em todas as seis rotas e ainda acrescentava `?v=0.4.10`. Na conta em teste, o MyGeotab abriu `#addin-fleettelemetrymanager-index?v=0.4.10`, indicando possível colisão de nomes de página e um hash de navegação com parâmetros.
3. O domínio `ftmbrunog2026.vercel.app` estava atribuído a um deployment antigo, da branch v0.4.3, não à `main` atual. Portanto, não basta atualizar o JSON do MyGeotab: a hospedagem estática precisa ser publicada no destino do domínio.

## Correção proposta (PR #14)

- `addin-config.restore-hosted-routes.json`: único Add-In `fleetTelemetryManager`, seis URLs HTTPS **sem** `?v=`.
- URLs terminam respectivamente em `dashboard.html`, `mileage.html`, `incidents.html`, `health.html`, `exceptions.html`, `trips.html` para evitar a colisão de seis `index.html`.
- `vercel.json`: seis regras `rewrites` encaminham os novos nomes para os seis HTMLs reais, sem copiar nem alterar a lógica de dashboards, API, filtros ou PDF.
- `scripts/verify-geotab-unique-routes.mjs`: valida que as seis páginas e os seis nomes são distintos, que os rewrites mapeiam os arquivos reais e que há script de inicialização Geotab.
- Os arquivos da versão hospedada foram verificados numa **prévia Vercel** e responderam HTTP 200 com as interfaces originais. Ainda não testamos a navegação autenticada dentro do MyGeotab.

## Ordem segura para publicar e instalar

1. Verificar/aceitar a PR #14, executar os testes CI.
2. Publicar a branch aprovada na Vercel (ou mesclar e deixar deploy da `main` concluir).
3. **Conferir que o domínio sem hífens `ftmbrunog2026.vercel.app` passou a apontar para o deployment novo.** Ele atualmente aponta para v0.4.3 e precisa ter o alias atualizado. Isso é uma alteração de tráfego que deve ser feita conscientemente e verificada.
4. **Antes de instalar no MyGeotab**, abrir as seis URLs HTTPS do JSON no próprio domínio `ftmbrunog2026.vercel.app`; todas precisam exibir páginas reais, sem 404 ou tela de diagnóstico.
5. MyGeotab → Configurações do sistema → Add-Ins → editar a instalação existente `fleetTelemetryManager`. Salvar backup do JSON anterior, substituir por `addin-config.restore-hosted-routes.json`, salvar e recarregar.
6. No menu do MyGeotab, testar `Quilometragem da Frota`. A rota interna esperada tem identificador **mileage**, sem `index?v=...`. Conferir Network e logs em sessão autenticada.

## Segurança e limites

- Não duplicar o Add-In com o mesmo `name` e não substituir a `main` ou o alias sem ter a prévia verificada.
- Os erros `[UK] load error`, Osano, Pendo e Sentry não comprovam falha do Fleet TM. Para investigar erro de DOM, identificar o script responsável na pilha de chamadas.
- Não publicar logs com dados de sessão, hashes OIDC, tokens, cookies ou informações privadas da frota.
- A validação HTTP da Vercel e a análise estática não equivalem à homologação funcional no MyGeotab.

Referências:
- https://developers.geotab.com/myGeotab/addIns/developingAddIns/
- https://vercel.com/docs/routing/rewrites
