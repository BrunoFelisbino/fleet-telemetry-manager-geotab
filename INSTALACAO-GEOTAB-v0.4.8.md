# Instalação experimental do Fleet Telemetry Manager v0.4.8 no MyGeotab

## Objetivo
Restaurar os **seis módulos reais com o visual, filtros, tabelas, indicadores e relatórios existentes** numa única instalação `fleetTelemetryManager`. Não são telas de diagnóstico.

O JSON de 404 KB e o de 48 KB com código embutido foram rejeitados pelo MyGeotab. Em contrapartida, o JSON diagnóstico de ~6 KB foi instalado e seis páginas executaram o ciclo de vida da Geotab; a v0.4.7 também consultou 20 veículos reais. Portanto, preservamos **seis páginas locais exclusivas** e **JSON mínimo**, transferindo o código pesado à aba **Files** do Add-In, em vez de embuti-lo no JSON.

## Arquivos gerados pela ação Package six real Geotab modules
- `configuration.json`: mesmo conteúdo de `addin-config.files-v0.4.8.json`, manifesto pequeno com 6 páginas.
- `fleet-telemetry-files-v0.4.8.zip`: seis páginas HTML completas e `icon.svg`, todos na raiz do ZIP. Arquivo para a **aba Files**.
- `fleet-telemetry-completo-v0.4.8.zip`: código e manifesto juntos, para importação em instalações que aceitam um ZIP pela aba de configuração.
- `LEIA-ME.txt`: instruções.

## Como testar preservando a instalação atual
1. Abra **Configurações do Sistema → Add-Ins** e **edite** o Fleet Telemetry Manager existente. Não crie outra instalação.
2. Salve uma cópia do JSON atual e exporte os arquivos, se a interface permitir.
3. Na aba **Files**, envie o `fleet-telemetry-files-v0.4.8.zip` (ou os 6 HTMLs mais `icon.svg` descompactados, se o MyGeotab exigir arquivos individuais).
4. Na aba **Configuration**, substitua pelo `configuration.json` ou pelo `addin-config.files-v0.4.8.json` da branch.
5. Salve, faça `Ctrl+Shift+R` e teste Dashboard, Quilometragem, Ocorrências, Saúde, Exceções e Viagens.
6. Confirme o Console: `[Fleet TM v0.4.8] ... script carregado`, e verifique o conteúdo real. Se aparecer `Carregando...` sem o log, checar aba Files e request dos HTMLs. Se aparecer log mas a interface falhar, capturar a exceção do módulo.

## Características preservadas
- **Dashboard**: indicadores de telemetria, relatórios e CSV.
- **Quilometragem**: filtros de frota/grupos, evolução diária, exportação PDF/CSV.
- **Ocorrências e SLA**: gerenciamento de registros e exportação.
- **Fleet Health Score**: pontuação e relatório de saúde, mapa quando aplicável.
- **Fleet Exception 360**: eventos/exceções, filtros, auditoria e exportação.
- **Fleet Trip 360**: histórico de viagens, filtros, rotas e PDF.

## Limites da validação
O pacote foi compilado automaticamente a partir das páginas reais da `main` v0.4.4, sem trocar a aplicação por placeholders. JavaScript e manifesto passaram nos testes automatizados. **Ainda falta teste no MyGeotab autenticado** com os arquivos da aba Files, incluindo o acesso a Leaflet externo (`unpkg.com`) para os módulos de mapa e a impressão.

A `main` e a versão publicada da Vercel não são alteradas até a confirmação do teste.
