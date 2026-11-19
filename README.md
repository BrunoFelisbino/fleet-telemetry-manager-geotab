# Fleet Telemetry Manager (MyGeotab Add-In)

Projeto novo e independente, baseado na estrutura visual e técnica dos projetos **Fleet Health Score**, **Fleet Exception 360** e **Fleet Trip 360** de Bruno Henrique Felisbino Gonçalves. Licença MIT.

**Status: desenvolvimento / não homologado.** Os arquivos estão inicialmente na branch feat/telemetry-manager-mvp. O manifesto aponta para um endereço planejado de GitHub Pages, mas não significa que a hospedagem esteja ativa. Não instalar em produção sem testar e publicar de forma controlada.

## Páginas

- **Fleet Telemetry Manager (/):** oito indicadores do processo Gerir Telemetria, filtros por grupo, veículo e período, estado de comunicação, exportação CSV e impressão PDF com logo opcional.
- **Fleet Health Score (/health/):** cópia adaptada do painel técnico, com filtros, dados de dispositivos e relatórios.
- **Fleet Exception 360 (/exceptions/):** cópia adaptada dos relatórios de regras, exceções e auditoria.
- **Fleet Trip 360 (/trips/):** cópia adaptada do histórico de viagens, condutores, rotas e relatórios.

Todas as páginas usam o namespace de Add-In geotab.addin.fleetTelemetryManager. Os projetos de origem permanecem intactos.

## Indicadores do documento

| Indicador | Meta sugerida | Fonte / estado |
| --- | --- | --- |
| Disponibilidade da telemetria | ≥ 98% | N/D: exige período previsto de operação e histórico de comunicação |
| Veículos monitorados | ≥ 98% | Device e DeviceStatusInfo: instantâneo da comunicação, não é disponibilidade histórica |
| Alertas tratados no prazo | ≥ 95% | N/D: exige chamados e ações corretivas com data |
| Tempo médio de tratamento | ≤ 24 h para não críticos | N/D: exige registro de abertura e conclusão |
| Excesso de velocidade por 1.000 km | redução ≥ 10% | ExceptionEvent das regras de velocidade, dividido por km de Trip |
| Reincidência de ocorrências | ≤ 5% | N/D: exige ações corretivas e janela de recorrência |
| Marcha lenta por veículo | redução ≥ 10% | Trip.idlingDuration / veículos monitorados na seleção, se disponível |
| Consumo médio (L/100 km) | redução ≥ 5% | N/D: exige litros confiáveis (FuelAndEnergyUsed, abastecimento ou sensores) |

A referência de indicadores recomenda **três meses de linha de base** antes da fixação das metas. Os cálculos são provisórios para homologação, não devem ser utilizados como resultado contratual sem validação de regras, horários, escopo e dados.

**Atenção aos campos:** o valor Trip.distance da API Geotab é em quilômetros, não em metros. Trip.stopDuration inclui veículo parado com motor desligado e não substitui Trip.idlingDuration.

## Limitações e cuidados

- Consultas históricas são feitas por veículo com concorrência limitada a quatro; máximo de 50 veículos selecionados e 5000 registros por consulta/veículo. Se atingir o limite ou faltar alguma resposta, os índices históricos ficam como N/D, não são extrapolados.
- Grupo é filtrado por associação direta de Device.groups. A hierarquia deve ser avaliada antes de aplicação contratual.
- Regra de excesso de velocidade é identificada pelo nome da Rule; a configuração deve ser conferida.
- O status de comunicação é instantâneo e não mede a disponibilidade mensal.
- Esta versão **ainda não implementa gestão e armazenamento de ocorrências**. Não confundir ExceptionEvent com ocorrência tratada.
- Nenhuma credencial, placa ou informação real de clientes deve ser adicionada a este repositório público. As consultas são realizadas na sessão autorizada do MyGeotab.
- O Add-In ainda não foi testado em banco de homologação. Confirmar permissões, volumes, fusos e regras na operação real.

## Verificação

Na raiz do projeto: node scripts/verify.mjs

Depois, validar manualmente no MyGeotab em base de testes: carregamento de todas as páginas, filtros, ausência de dados, CSV, impressão com e sem logo, regras, quilometragem, marcha lenta e bloqueios de acesso.

## Próxima entrega

Fluxo de tratativas com SLA por criticidade, áreas responsáveis, anexos de evidências, ações corretivas, auditoria, reabertura e reincidência. Avaliar backend privado e integração com sistema de manutenção para não armazenar dados de clientes no GitHub público.

Autor: Bruno Henrique Felisbino Gonçalves. Não oficial, sem afiliação ou endosso da Geotab.
