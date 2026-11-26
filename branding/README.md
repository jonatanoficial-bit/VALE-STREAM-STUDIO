# Identidade VALE STREAM STUDIO

Símbolo vetorial desenhado para este projeto: duas hastes formam o V, com um segmento superior separado representando continuidade de sinal. O símbolo não usa imagem de banco, fonte de ícones ou logotipo de outro aplicativo.

- `vale-logo-horizontal.svg`: assinatura horizontal para fundo grafite; letras VALE em curvas vetoriais.
- `vale-app-icon.svg`: matriz do ícone Windows, 512 × 512.
- `../apps/desktop/src/assets/vale-symbol.svg`: símbolo sobre fundo transparente.
- `../apps/desktop/build/icon.png`: exportação PNG gerada localmente.
- `../apps/desktop/build/icon.ico`: ícone gerado para Windows, 16/24/32/48/64/128/256 px.

Paleta: grafite `#121817`, verde claro `#B6D8CB`, verde médio `#7D9E8D`, branco `#EDF2EE`. Reserve ao redor da marca pelo menos um quarto de sua altura. Não estique, não aplique contornos adicionais e não use o símbolo de marca registrada sem registro válido. Use a versão clara em fundo escuro.

Geração reproduzível: em `apps/desktop`, execute `node scripts/prepare-brand.mjs`. A geração usa o Chromium do Electron para rasterizar o SVG e monta um ICO com sete tamanhos. O processo não depende de um serviço de imagens.

A disponibilidade do nome e do desenho para registro de marca não foi verificada. Este pacote é uma identidade visual do projeto, não um certificado de exclusividade.
