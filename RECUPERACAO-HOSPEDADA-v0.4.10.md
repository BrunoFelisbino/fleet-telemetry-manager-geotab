# Recuperação pelo carregamento HTTPS (manifesto v0.4.10)

## Quando usar

Se o Fleet Telemetry Manager fica em branco, exibe `TESTE OK` ou não encontra os arquivos `dashboard049.html`, `incidents049.html` etc. na aba **Files**, use esta configuração alternativa. O problema do manifesto v0.4.9 é que ele só contém caminhos **locais** e `"files": {}`. Esses caminhos funcionam somente depois do envio correto dos HTMLs, ícone e traduções.

## Instalação (um único Add-In)

1. Salve uma cópia do JSON atual da instalação no MyGeotab.
2. Confirme que o domínio público `https://ftmbrunog2026.vercel.app/index.html` responde e apresenta a interface real. A hospedagem deve ter os seis HTMLs publicados.
3. Entre em MyGeotab → Sistema → Configurações do sistema → Add-Ins e **edite** `Fleet Telemetry Manager` existente. **Não** crie outro Add-In com o mesmo nome.
4. Na aba **Configuration**, substitua o JSON pelo arquivo [`addin-config.restore-hosted.json`](addin-config.restore-hosted.json). Não altere `name`. Salve.
5. Atualize o MyGeotab com `Ctrl+Shift+R`. Abra os menus `Fleet Telemetry Manager`, `Quilometragem da Frota`, `Ocorrências e SLA`, `Fleet Health Score`, `Fleet Exception 360` e `Fleet Trip 360`.
6. No Console, confirme `[Fleet TM v0.4.4]` (identificador dos scripts HTML da versão hospedada). Não deve aparecer a tela antiga `TESTE OK`.

## Por que esta configuração é diferente?

- Usa seis URLs **HTTPS absolutas** no domínio público sem hífens, com `?v=0.4.10` para evitar o cache do manifesto anterior.
- Não exige o upload manual de arquivos na aba **Files**, nem depende da presença dos arquivos `049` da v0.4.9.
- Mantém os mesmos seis módulos, códigos e relatórios da versão hospedada. O número **0.4.10 é apenas a versão deste manifesto de recuperação**, não uma alteração funcional dos HTMLs.
- O `files: {}` é válido **neste modo**, porque `items[].url` contém URLs externas completas. Isso **não** vale para os arquivos locais `049`.

## Limitações e depuração

O GitHub Actions valida os seis HTMLs no repositório e executa verificações de disponibilidade HTTP/CORS na hospedagem. Isso **não garante** carregamento numa conta autenticada do MyGeotab, nem valida todas as consultas da API. Se uma página falhar, confira na aba Network o status HTTP e o endereço efetivamente carregado. Um 404/403/erro de CORS indica a hospedagem ou o manifesto, enquanto um erro JavaScript após o carregamento precisa ser depurado no módulo específico. Não compartilhe tokens, cookies ou dados privados da frota.

A alternativa de instalação com arquivos locais continua disponível em [`INSTALACAO-GEOTAB-v0.4.9.md`](INSTALACAO-GEOTAB-v0.4.9.md).

Referência: https://developers.geotab.com/myGeotab/addIns/developingAddIns/index.html
