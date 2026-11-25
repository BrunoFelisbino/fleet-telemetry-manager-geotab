# Recuperação controlada: código original v0.3.0 no MyGeotab

## Diagnóstico do incidente (20/11/2026)

- A branch main foi revertida para a v0.3.0 (`e26c922448c26e3e0da9ebb00275b96aa412a8b6`), mas o JSON apontava para GitHub Pages (`/fleet-telemetry-manager-geotab/`), endereço com hífens. A documentação Geotab adverte que URLs externas com `-`, `@` e `#` podem não funcionar corretamente.
- O histórico das PRs #14 e #15 registrou problemas de CORS nas páginas do GitHub Pages. Não existe workflow de deploy Pages na versão v0.3.0 da main.
- A Vercel tem o domínio verificado `ftmbrunog2026.vercel.app`, mas seu último deployment de produção foi baseado no código v0.4.0 (`fa18e1d8`), diferente da main restaurada. A PR #15 registrou que novo deployment foi bloqueado por limite do plano (HTTP 402).
- A conclusão é que um rollback de código não atualiza automaticamente a origem realmente carregada pela sessão do MyGeotab.

## Recuperação proposta, SEM alterar a produção

Esta branch gera um pacote Files para o Add-In EXISTENTE, preservando seis módulos da v0.3.0:

1. Fleet Telemetry Manager (dashboard geral);
2. Quilometragem da Frota (filtros múltiplos, evolução diária, rankings e PDF);
3. Ocorrências e SLA;
4. Fleet Health Score;
5. Fleet Exception 360;
6. Fleet Trip 360.

O script de build lê os fontes da branch v0.3.0 e **embute somente JS e CSS locais nos seis HTMLs**. Não substitui regras de negócio, filtros, cálculos de API ou relatórios. Mantém as dependências remotas explícitas (como Leaflet via unpkg); testa a sintaxe dos módulos usados e a presença de assets.

O manifesto `addin-config.v030-local-files.json` usa seis URLs LOCAIS distintas, sem `?v=`, com `files: {}` e versão do manifesto `0.3.1`. Isso impede colisão de basename e evita baixar o documento principal de GitHub Pages ou Vercel. **Versão de manifesto ≠ versão do código funcional**, que continua 0.3.0.

## Como montar

Na branch:
```bash
node scripts/verify.mjs
node scripts/verify-incidents.mjs
node scripts/verify-mileage.mjs
node scripts/verify-mileage-pdf.mjs
node scripts/build-v030-geotab-files.mjs
```

O GitHub Actions **Package original v0.3.0 for MyGeotab Files** publica um artifact de recuperação contendo o pacote ZIP completo, o ZIP apenas dos arquivos, as seis páginas, o ícone, as traduções, o manifesto e as instruções.

## Como testar com segurança

1. Baixe o artifact ZIP da execução aprovada do GitHub Actions e extraia.
2. Faça backup da configuração JSON e dos arquivos atualmente instalados no MyGeotab.
3. **Edite o Add-In existente `fleetTelemetryManager`. Não instale um segundo Add-In com o mesmo nome.
4. Aba **Files**: importe os seis arquivos `restore030*.html` e `icon.svg`; importe traduções mantendo os nomes e diretório se a interface suportar. Confirme cada arquivo na lista. Subir só um ZIP, sem confirmar extração, não é suficiente.
5. Aba **Configuration**: cole `configuration.json` gerado e salve. Atualize a página.
6. Abra primeiro **Quilometragem da Frota** e **Fleet Telemetry Manager**. Verifique se carregam a interface real, se `initialize` é chamado, se as consultas Device/Group/Trip retornam os dados autorizados e se o PDF funciona.
7. Teste os outros quatro módulos e perfis antes de considerar a recuperação aprovada.

Se aparecer `Add-In files ... couldn't be loaded` ou HTTP 404, confirme os nomes dos arquivos locais e a aba Files. Se aparecer erro de API, capture a mensagem exata no console, ocultando tokens/cookies/dados pessoais.

## Limitações e segurança

- NÃO foi testado dentro de uma conta autenticada MyGeotab: CI confirma sintaxe e montagem, não permissões e funcionamento em produção.
- A importação manual em Files é necessária; o workflow GitHub não modifica a instalação da Geotab.
- Não recria nem apaga os dados operacionais e registros em AddInData.
- Alguns mapas ainda dependem da CDN Leaflet externa.
- Não faça merge/redeploy de produção até homologação do pacote e revisão de impacto. Se a versão 0.3.0 não carregar mesmo localmente, a próxima evidência necessária é o erro exato do Console e da aba Network.
