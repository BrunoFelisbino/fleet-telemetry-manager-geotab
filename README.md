# Fleet Telemetry Manager (MyGeotab Add-In)

Projeto novo e independente, baseado na estrutura visual e técnica dos projetos **Fleet Health Score**, **Fleet Exception 360** e **Fleet Trip 360** de Bruno Henrique Felisbino Gonçalves. Licença MIT.

**Status: desenvolvimento / não homologado.** Os arquivos estão inicialmente na branch feat/telemetry-manager-mvp. O manifesto aponta para um endereço planejado de GitHub Pages, mas não significa que a hospedagem esteja ativa. Não instalar em produção sem testar e publicar de forma controlada.

## Páginas

- **Fleet Telemetry Manager (/):** oito indicadores do processo Gerir Telemetria, filtros por grupo, veículo e período, estado de comunicação, exportação CSV e impressão PDF com logo opcional.
- **Ocorrências e SLA (/incidents/):** abertura e acompanhamento de casos com grupo, veículo, criticidade, prazo, responsável, vínculo opcional a `ExceptionEvent`, histórico de ações e CSV. Os registros são persistidos via `AddInData` na base MyGeotab autorizada.
- **Fleet Health Score (/health/):** cópia adaptada do painel técnico, com filtros, dados de dispositivos e relatórios.
- **Fleet Exception 360 (/exceptions/):** cópia adaptada dos relatórios de regras, exceções e auditoria.
- **Fleet Trip 360 (/trips/):** cópia adaptada do histórico de viagens, condutores, rotas e relatórios.

Todas as páginas usam o namespace de Add-In geotab.addin.fleetTelemetryManager. Os projetos de origem permanecem intactos.

## Indicadores do documento

| Indicador | Meta sugerida | Fonte / estado |
| --- | --- | --- |
| Disponibilidade da telemetria | ≥ 98% | N/D: exige período previsto de operação e histórico de comunicação |
| Veículos monitorados | ≥ 98% | Device e DeviceStatusInfo: instantâneo da comunicação, não é disponibilidade histórica |
| Alertas tratados no prazo | ≥ 95% | AddInData da Central de Ocorrências, apenas no grupo explicitamente selecionado. Sem registros ou permissões: N/D |
| Tempo médio de tratamento | ≤ 24 h para não críticos | AddInData: diferença entre abertura e conclusão de alertas **não críticos** encerrados no período |
| Excesso de velocidade por 1.000 km | redução ≥ 10% | ExceptionEvent das regras de velocidade, dividido por km de Trip |
| Reincidência de ocorrências | ≤ 5% | AddInData: novo caso do mesmo tipo e veículo após ação corretiva concluída em janela de até 30 dias; usar como indicador de casos registrados, não de todos os eventos |
| Marcha lenta por veículo | redução ≥ 10% | Trip.idlingDuration / veículos monitorados na seleção, se disponível |
| Consumo médio (L/100 km) | redução ≥ 5% | N/D: exige litros confiáveis (FuelAndEnergyUsed, abastecimento ou sensores) |

A referência de indicadores recomenda **três meses de linha de base** antes da fixação das metas. Os cálculos são provisórios para homologação, não devem ser utilizados como resultado contratual sem validação de regras, horários, escopo e dados.

**Atenção aos campos:** o valor Trip.distance da API Geotab é em quilômetros, não em metros. Trip.stopDuration inclui veículo parado com motor desligado e não substitui Trip.idlingDuration.


## Quilometragem da Frota (v0.3.0)

Nova página \`/mileage/\`, separada para não sobrecarregar o painel geral com consultas de uma frota grande.

- Filtros: frota total permitida pela sessão, **seleção de vários grupos e vários veículos ao mesmo tempo**, grupos hierárquicos, pesquisa por nome ou placa (sem diferenciar acentos/maiúsculas), chips removíveis, mês atual, mês anterior, últimos 7/30/90 dias e período personalizado.
- KPIs: KM total do filtro, quantidade de veículos, média de KM por veículo, veículos sem viagens.
- Visões: cards executivos, **gráfico de evolução diária / por blocos de dias**, **Top 5 veículos**, ranking completo por grupo sem duplicação, ranking individual e CSV para cada tabela.
- **Baixar PDF:** gera diretamente um documento A4 paginado no navegador, sem bibliotecas externas, com resumo executivo, gráficos de KM, rankings de grupo e veículo, odômetros e filtros utilizados. Somente após a consulta concluída. O PDF da prévia demonstra dados fictícios explicitamente.
- O PDF é gerado a partir do mesmo conjunto de resultados já consultado e, portanto, não dispara uma nova leitura de API nem altera dados; não inclui logo personalizado neste estágio.
- Odômetro final usa \`Trip.odometer\` em **metros**, convertido em quilômetros; odômetro inicial é **inferido** do odômetro final da primeira viagem menos \`Trip.distance\`. Se faltar informação confiável, o campo fica **N/D**.
- Quilometragem da viagem: \`Trip.distance\` já é em **quilômetros**. A versão incluída do Fleet Trip 360 também teve essa conversão corrigida.
- Escala: uma consulta por veículo, com ritmo moderado, três consultas em paralelo e divisão recursiva de intervalos que atinjam o limite de registros. Não existe corte artificial em 50 veículos nesta nova página; o processo demora conforme tamanho da frota e volume de dados.
- Se alguma consulta falhar ou vier truncada, a página **não publica total parcial** como resultado completo. Há progresso visual e cancelamento.
- Viagens que cruzam as datas de corte são consideradas integralmente. O sistema alerta sobre este limite; o cálculo exato do trecho da viagem dentro do filtro exige leituras de odômetro/telemetria nos limites do período.
- **Explorar um grupo no resultado:** depois da consulta de vários grupos, clique na barra ou na linha do grupo em **KM por grupo operacional**. Os outros ficam opacos e todos os demais KPIs, gráfico diário, Top 5 e ranking de veículos passam a considerar somente os veículos contabilizados naquele grupo. Clique no mesmo grupo novamente, em outro grupo ou em **Mostrar todos** para alternar, sem nova chamada à API.
- **Exportações por grupo em foco:** o PDF e o CSV usam o mesmo subconjunto exibido no dashboard. O nome do grupo em foco aparece no relatório.
- A classificação por grupo é exclusiva. Dispositivos associados a vários grupos aparecem sob "Múltiplos grupos" na visão da frota total. Selecionar um grupo no resultado mantém essa atribuição exclusiva e não soma veículos de outro grupo.


### Testar agora

**Prévia do visual com dados fictícios**: abra \`https://fleet-telemetry-manager-geot-git-6df792-poze1988-4802s-projects.vercel.app/mileage/?demo=1\`. O modo demonstrativo é explicitamente sinalizado e não consulta a Geotab.

**Teste com dados reais somente em base homologada**: instale o conteúdo de \`addin-config.preview.json\` em **MyGeotab → Sistema / Configurações → Add-Ins** (nomenclatura do menu varia conforme versão/permissões). A versão de teste é hospedada em uma URL separada, aponta para a branch de desenvolvimento e utiliza a sessão e as permissões da base escolhida. Abra o menu "Quilometragem da Frota", filtre e clique em "Consultar".

- A URL de prévia **não deve ser tratada como publicação definitiva**, nem aplicada a uma base de produção sem autorização e teste.
- Não insira credenciais ou dados reais no repositório ou em chamadas públicas. O Add-In só utiliza a API contextual do MyGeotab.
- A hospedagem da prévia é pública para os arquivos do Add-In; os dados só são consultados dentro da sessão autenticada do MyGeotab.
- Executar localmente: \`node scripts/verify.mjs\`, \`node scripts/verify-incidents.mjs\` \`node scripts/verify-mileage.mjs\` e \`node scripts/verify-mileage-pdf.mjs\`.

## Limitações e cuidados

- Consultas históricas são feitas por veículo com concorrência limitada a quatro; máximo de 50 veículos selecionados e 5000 registros por consulta/veículo. Se atingir o limite ou faltar alguma resposta, os índices históricos ficam como N/D, não são extrapolados.
- Grupo é filtrado por associação direta de Device.groups. A hierarquia deve ser avaliada antes de aplicação contratual.
- Regra de excesso de velocidade é identificada pelo nome da Rule; a configuração deve ser conferida.
- O status de comunicação é instantâneo e não mede a disponibilidade mensal.
- A Central de Ocorrências usa a **Storage API `AddInData`** com o identificador próprio `a2UzOGI0NTgtMGNmNC00MTg` e grupos operacionais da própria base. É obrigatório ter permissão `ViewAddInData` para ler e `ManageAddInData` para gravar; validar em usuários e grupos distintos.
- Cada abertura e transição gera um objeto `AddInData` independente. Isto preserva a sequência de ações **na aplicação**, mas não equivale a um log imutável criptográfico ou substitui controles administrativos e de auditoria corporativa.
- Prazo de cada ocorrência é **informado pelo operador** conforme SLA do contrato. O KPI de 24 horas do documento é uma meta para *tempo médio de tratamento* não crítico, não deve virar prazo automático para todos os chamados.
- Evidências nesta fase são **descrição textual e referências**; uploads de fotos/documentos e integração ERP/OS ainda estão pendentes. Não armazenar anexos ou documentos sensíveis em campos JSON.
- Os KPIs de tratativas só são consolidados ao escolher um grupo específico. `ExceptionEvent` por si só não comprova tratamento, e eventos não importados/manualizados não entram no denominador.
- A leitura `AddInData` é limitada a 5.000 objetos por grupo. Ao atingir o limite, o módulo recusa métricas potencialmente incompletas. Requer paginação/serviço para escalar.
- Associação e autorização por grupos seguem a configuração da base, mas *não foi testada* contra todos os perfis de segurança. Não presumir que grupos aninhados estejam incluídos.
- Nenhuma credencial, placa ou informação real de clientes deve ser adicionada a este repositório público. As consultas são realizadas na sessão autorizada do MyGeotab.
- O Add-In ainda não foi testado em banco de homologação. Confirmar permissões, volumes, fusos e regras na operação real.

## Verificação

Na raiz do projeto: `node scripts/verify.mjs` e `node scripts/verify-incidents.mjs`.

Depois, validar manualmente no MyGeotab em base de testes: carregamento de todas as páginas, filtros, ausência de dados, CSV, impressão com e sem logo, regras, quilometragem, marcha lenta e bloqueios de acesso.

## Política operacional da Central

1. Selecionar operação/grupo e veículo. Uma ocorrência registrada exige natureza, criticidade, resumo, responsável e prazo manual.
2. Opcionalmente carregar um `ExceptionEvent` dos últimos sete dias para vincular a abertura a um evento real.
3. Percorrer estados: aberta → em análise/encaminhada → em tratamento → concluída. Ocorrência sem necessidade de ação pode ser justificada com motivo; casos finalizados podem ser reabertos.
4. Cada mudança exige justificativa e fica identificada pelo usuário da sessão `api.getSession`. Eventos duplicados podem ocorrer por gravações simultâneas e devem ser auditados.
5. O SLA é apurado pelas ocorrências **concluídas no período** e pelas **abertas com prazo vencido no período**, excluindo alertas ainda no prazo; não há contagem dupla. O tempo médio considera apenas os alertas não críticos concluídos. Reincidência considera os concluídos no período após correção anterior no mesmo veículo/tipo.

## Próxima entrega

Homologar criação, consulta e transições de `AddInData` por perfil e grupo. Implantar escopo hierárquico de grupos, anexos com armazenamento autorizado, paginação para frotas maiores, reconciliação concorrente, alertas automáticos e integração com sistema de manutenção/ERP. 
A publicação no GitHub Pages e o registro no MyGeotab **não** são feitos por esta PR.

Autor: Bruno Henrique Felisbino Gonçalves. Não oficial, sem afiliação ou endosso da Geotab.
