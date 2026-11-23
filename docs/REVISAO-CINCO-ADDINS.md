# Revisão dos Add-Ins da Geotab (sem alterar KM Rodado)

Escopo da revisão: dashboard, Fleet Health Score, Fleet Exception 360, Ocorrências e SLA, Fleet Trip 360. O módulo **Quilometragem da Frota**, especialmente `mileage/mileage030.html`, seus arquivos auxiliares e a URL `addin-fleettelemetrymanager-mileage030`, é intocável.

## Status de integração

| Entidade | O que fornece | Atenções |
|---|---|---|
| Device / Group | Frota, placas, hierarquia | Respeitar grupos visíveis ao usuário |
| DeviceStatusInfo | Último status e comunicação instantânea | Não representa uptime histórico |
| Trip | KM em quilômetros, odômetro final em metros, direção, paradas | Viagens cruzando limites de período exigem tratamento explícito |
| LogRecord | GPS e velocidade em km/h | Polilinha GPS não equivale a trajeto ajustado à malha viária; ler em páginas se necessário |
| ExceptionEvent / Rule | Eventos por regras configuradas | Evento gerado não prova ação ou correção |
| StatusData / Diagnostic | Dados disponibilizados por diagnósticos/sensores | Ausência de leitura não é garantia de ausência de defeito |
| FaultData | Registros de falhas e DTC quando disponíveis | A disponibilidade varia por veículo, instalação e permissões |
| Driver / DriverChange | Condutor informado ou identificado | Atribuição depende da configuração da frota |
| AddInData | Dados de ocorrências do Add-In | Limite e permissões; não equivale a trilha criptograficamente imutável |

## Critérios de UI e dados

- Visual monocromático neutro, sem efeitos luminosos, com responsividade e foco acessível, apenas nos cinco Add-Ins.
- Os números são indicadores do **recorte de dados consultado**; não prometer cobertura mecânica ou CAN apenas por haver dispositivo GPS.
- Não usar distância haversine entre pontos GPS como quilometragem oficial de viagem.
- Falhas nas fontes opcionais devem ser visíveis como indisponibilidade; falha em Trip deve interromper a consulta de viagens.
- Eventos de exceção e registros de tratativa são indicadores distintos; não inferir resolução pelo encerramento de um evento.
- Nenhum arquivo do mileage, manifesto, nome de namespace Geotab, rota ou URL de produção é alterado nesta revisão.

## Homologação antes de integrar

1. Confirmar que o manifesto existente abre cada uma das seis URLs na mesma conta Geotab.
2. Exercitar dashboard com vários grupos, 0 dados e 50+ veículos; índices parciais não podem parecer completos.
3. Health: testar grupos com falhas GPS, tensão, FaultData e nenhum StatusData. Avaliar o score como **saúde do rastreador** e não diagnóstico completo do motor.
4. Exceptions: validar regras personalizadas, consultas vazias, relatórios e auditoria por veículo.
5. Incidents: validar permissões `ViewAddInData` e `ManageAddInData`, grupos distintos, mudança de estado e exportações.
6. Trip 360: identificar veículo, tempo, viagem sem GPS, GPS sem Trip, falha na API de Trip, condutor ausente e PDF com mapa.
7. Validar responsividade (390px), teclado, modo impressão e bloqueio de pop-up para impressão.
8. Revisar todas as mudanças do PR antes de eventual publicação. A branch não altera o Add-In já instalado por si só.

Fontes: https://developers.geotab.com/myGeotab/addIns/developingAddIns/ ;
https://developers.geotab.com/myGeotab/apiReference/objects/Trip/ ;
https://developers.geotab.com/myGeotab/apiReference/objects/StatusData/ ;
https://developers.geotab.com/myGeotab/apiReference/objects/FaultData/ .
