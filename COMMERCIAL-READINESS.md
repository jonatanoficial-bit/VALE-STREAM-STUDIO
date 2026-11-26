# Preparação para distribuição comercial

## Entregue no produto

Identidade visual própria, SVGs de marca, ícone Windows em múltiplas resoluções, instalador com marca VALE, motor de slides e encoder locais. A gravação e a live direta não exigem OBS. O repositório mantém a licença MIT existente; criar uma marca não altera essa licença nem torna o código exclusivo.

## Pendências para lançamento comercial

- Assinatura Authenticode do instalador e do executável por um certificado do titular. O build atual não configura assinatura e não deve ser anunciado como assinado.
- Verificação do nome VALE STREAM STUDIO e do símbolo para registro de marca nos mercados pretendidos.
- Revisão das obrigações de redistribuição dos componentes, fontes correspondentes, avisos e possíveis patentes dos codecs. Esta lista não certifica conformidade jurídica.
- Termos de uso, política de privacidade, canal de suporte, política de reembolso e modelo comercial definidos pelo titular. Não há cobrança, ativação, assinatura ou sistema antifraude implementado.
- Ensaios com hardware real: câmera, interface externa, microfone e áudio de sistema; transmissão em conta habilitada e reunião com convidados de outra rede.

## Componentes e avisos

O FFmpeg fornecido por gyan.dev, versão 9.0.2 essentials, informa GPL v3 em seu README. A licença e o README são incluídos em `resources/encoder`. O VALE executa esse binário como processo separado; isso não constitui uma conclusão sobre todas as obrigações da distribuição comercial. A referência de código-fonte informada pelo fornecedor é https://github.com/FFmpeg/FFmpeg/commit/946fcce07b. Consulte https://ffmpeg.org/legal.html e o pacote exato do fornecedor, incluindo bibliotecas externas e instruções de construção. Uma referência de fonte isolada não substitui uma auditoria das fontes correspondentes completas.

O LibreOffice incluído conserva os arquivos de licença e avisos do pacote original em `resources/slides-engine`. Não é uma implementação própria de PowerPoint. A compatibilidade de fontes, animações e mídia precisa ser conferida em apresentações reais.

Electron/Chromium e as bibliotecas JavaScript continuam sujeitos às respectivas licenças e avisos. Não atribua esses componentes à VALE. YouTube e VDO.Ninja são serviços externos: disponibilidade, conta habilitada e conexão do usuário podem ser necessárias.

## Limites atuais do produto

Login e chat do YouTube abrem no navegador; não há OAuth integrado. A biblioteca de mídia é temporária por sessão. Não há projetos persistentes ou múltiplos destinos simultâneos. A saída nativa usa 1280 × 720 a 25 fps. A conversão de slides em PDF é estática; o slideshow original depende da compatibilidade do motor incluído.
