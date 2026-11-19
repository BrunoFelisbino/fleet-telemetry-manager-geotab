# Recuperar o Fleet Telemetry Manager no MyGeotab (v0.4.9)

## Diagnóstico comprovado
A base ainda mostrou `TESTE OK: Add-In carregado e initialize executado` e `[Fleet TM diagnostico] Ocorrências OK`. Essas mensagens existem somente na configuração de diagnóstico v0.4.5/0.4.7, não nas seis páginas reais.

O JSON v0.4.8 da `main` faz referência a HTMLs locais, mas NÃO contém esses arquivos (`"files": {}`). Enviar apenas o JSON ou anexar o ZIP sem garantir a extração dos arquivos faz o MyGeotab conservar os arquivos de teste antigos. O log também mostra 404 para `translations/pt-BR.json`, que não existia no ZIP v0.4.8.

## O que muda na v0.4.9
- Mantém os seis módulos, suas interfaces completas, relatórios, filtros e APIs.
- Novos arquivos exclusivos `dashboard049.html`, `mileage049.html`, `incidents049.html`, `health049.html`, `exceptions049.html`, `trips049.html`. Esses nomes **não** existem nos diagnósticos antigos.
- Inclui `translations/pt-BR.json` e `translations/en.json` no pacote.
- O ícone passa a usar `icon.svg` local.
- A pasta `pages/` com os arquivos **extraídos** passa a fazer parte do artefato do GitHub Actions.

## Instalação correta em um único Add-In
1. Abra MyGeotab > Configurações do sistema > Add-Ins e **edite** o Fleet Telemetry Manager existente.
2. Faça backup do JSON atual e, se possível, dos arquivos da aba **Files**.
3. Na aba **Files**, remova as páginas dos testes anteriores, se houver. Elas não devem ficar associadas à instalação ativa.
4. Baixe o artefato `FleetTelemetryManager-v0.4.9` da execução **Package six real Geotab modules** da `main` no GitHub. Extraia o artefato. Dentro dele está a pasta `pages/`.
5. **Envie os arquivos de dentro da pasta `pages/` pela aba Files**: seis HTMLs com sufixo `049`, `icon.svg` e a pasta `translations/` contendo `pt-BR.json` e `en.json`. **Não basta enviar somente o ZIP.** A interface do MyGeotab pode permitir o upload da pasta inteira ou de arquivos individuais.
6. Confira visualmente na aba **Files** que `incidents049.html` e os outros cinco HTMLs aparecem, além de `translations/pt-BR.json`. Se não aparecerem, pare aqui: ainda não foram instalados.
7. Na aba **Configuration**, cole `configuration.json` do mesmo artefato ou `addin-config.json` v0.4.9 da `main`. Salve.
8. Atualize o navegador com `Ctrl+Shift+R` e abra **Ocorrências e SLA**.

**Validação real:** o console deverá mostrar `[Fleet TM v0.4.9] incidents: script carregado` e a interface completa, sem `TESTE OK`. Se aparecer erro de arquivo ausente, volte à aba Files e confirme os nomes exatos. Se não existir o recurso de upload de pasta ou se o MyGeotab mantiver os arquivos antigos, não adianta subir outra versão no GitHub: precisamos do estado real da aba Files para prosseguir.

## O que os testes não comprovam
O GitHub Actions verifica HTML, sintaxe de JavaScript, nomes, estrutura e ZIP. Isso **não** executa o Add-In dentro da sua conta Geotab. A consulta de 20 veículos que funcionou no v0.4.7 comprova apenas que a API lê Devices, não que a UI completa esteja instalada.
