# Recuperação MyGeotab: manifesto HTTPS sem parâmetros (v0.4.11)

## Evidências da falha

Depois da tentativa com v0.4.10, o navegador entrou na rota interna `#addin-fleettelemetrymanager-index?v=0.4.10`, enquanto outras páginas não apareceram. A rota `?v=0.4.10` fez parte do endereço interno. Os erros de recursos `languages/.../pt-BR.json` com parâmetros de sessão e `geotab/checkmate/ui/.../.html` mostram referências mal resolvidas, mas não comprovam isoladamente que a query seja a única causa.

O manifesto antigo v0.4.9 apontava para `*049.html` **locais**, inexistentes na instalação; os diagnósticos antigos também continuavam carregados.

## Teste corretivo sem alterar dashboards

Novo arquivo: [`addin-config.restore-hosted-clean.json`](addin-config.restore-hosted-clean.json).

- 6 páginas HTML completas via HTTPS em `ftmbrunog2026.vercel.app`.
- URLs **sem** `?v=...` nem fragmentos `#`, para não poluir os nomes das rotas no MyGeotab.
- Mesmo `name=fleetTelemetryManager` e seis `items`, com `category=AddIns` e `path=ActivityLink/`.
- `files: {}` permitido para hospedagem externa; não requer subir arquivos locais.
- `version=0.4.11` apenas para identificar a nova configuração, sem alterar HTML, filtros ou relatórios.

## Aplicação segura

1. Em MyGeotab, abra Configurações do sistema → Add-Ins; localize **o mesmo** `Fleet Telemetry Manager`.
2. Faça backup da configuração anterior.
3. Substitua **todo** o conteúdo da aba Configuration pelo JSON v0.4.11 acima. Confirme que não há URLs com `?v=` ou arquivos `*049.html`.
4. Salve a configuração, feche as abas MyGeotab e entre novamente. Se a alteração não estiver refletida, releia a configuração efetivamente salva no Add-In antes de qualquer outra mudança.
5. Abra `Quilometragem da Frota`. O hash de navegação **não deve** incluir `?v=0.4.10`; verifique Network se o MyGeotab solicita `https://ftmbrunog2026.vercel.app/mileage/index.html`.

O teste funcional depende de uma sessão Geotab autorizada; GitHub Actions só valida o código e as URLs públicas.

## Erros de outro código

Mensagens `[UK] load error TypeError ... innerHTML` e bloqueios de Osano/Pendo/Sentry não devem ser atribuídos ao Fleet TM sem capturar a origem da chamada. Evite publicar logs com tokens, códigos de sessão, dados de login ou IDs sensíveis.

Referência: https://developers.geotab.com/myGeotab/addIns/developingAddIns/
