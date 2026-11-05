# Avisos de terceiros

Este repositório não redistribui OBS Studio, LibreOffice ou binários FFmpeg.

- **Electron** e dependências npm: licenças publicadas nos respectivos pacotes e em `node_modules` durante o build.
- **OBS Studio**: aplicativo externo, GPL-2.0-or-later. O VALE STREAM STUDIO usa a API pública obs-websocket em uma instalação local já existente; não inclui código ou binários do OBS.
- **obs-websocket-js**: cliente JavaScript de obs-websocket. Consulte a licença da versão no lockfile.
- **PDF.js** (`pdfjs-dist`): Apache-2.0.
- **VDO.Ninja**: serviço externo usado por link; consulte os termos e a licença do projeto no site oficial.
- **LibreOffice**: aplicativo externo, licenciado pelos seus mantenedores. É detectado localmente somente para conversão de PPT/PPTX.
- **QRCode**: dependência JavaScript; licença disponível na distribuição do pacote.

Antes de redistribuir binários adicionais, audite as licenças e inclua os avisos exigidos pela versão efetivamente distribuída.
