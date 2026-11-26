# VALE STREAM STUDIO

## Windows 0.5.0

A interface usa superfícies grafite, acentos verdes, ícones vetoriais e controles com foco de teclado e estados de interação. A mesa de produção organiza prévia, fontes, saídas, níveis de áudio e mídia em áreas separadas. A página inicial direciona gravação e transmissão ao motor independente e não apresenta o estado do OBS como se fosse o estado das saídas nativas.

Identidade visual e ícones: [branding/README.md](branding/README.md). Situação e pendências para distribuição comercial: [COMMERCIAL-READINESS.md](COMMERCIAL-READINESS.md). O instalador atual não possui assinatura Authenticode configurada.

Ainda precisam de validação no equipamento do usuário: câmera, interface externa, captura de áudio do PC e transmissão em uma conta real. Login e chat do YouTube continuam no navegador; a biblioteca de mídia dura uma sessão. Não há autenticação OAuth interna, projetos persistentes ou transmissão simultânea para vários destinos.

Em **Produção**, importe imagens e vídeos em **Biblioteca de mídia**. Escolha o item em **Mídia no ar** ou volte à tela e à câmera durante a gravação ou live. O vídeo tem controles de reprodução, posição, repetição e volume próprio. Em **Marca e identificação**, adicione um logotipo, ajuste canto, tamanho e opacidade e escreva uma faixa com nome ou título. A prévia mostra a mesma composição enviada à gravação e à transmissão. A biblioteca é mantida durante a sessão do aplicativo.

Execute o instalador x64. O instalador completo inclui o motor de apresentações do LibreOffice e permite abrir PPT, PPTX e PDF no VALE sem instalar uma suíte Office separada. Em **Apresentações**, use **Abrir apresentação** para navegar pelas páginas ou **Abrir slideshow original** para abrir o arquivo pelo motor incluído. A compatibilidade de animações e vídeos depende do arquivo.

Em **Produção**, selecione um monitor inteiro, uma janela ou uma câmera. A câmera pode acompanhar a tela como sobreposição. Escolha a entrada de som que o Windows reconhece e confira os níveis nos medidores de pico. **Gravar WebM** salva um vídeo local sem OBS. **Live direta** usa o FFmpeg incluído e um destino RTMP/RTMPS. Marque **Gravar também no PC** para salvar uma cópia durante a live. A gravação continua se o envio falhar. O login e o chat do YouTube abrem no navegador. A reunião privada usa VDO.Ninja com convite protegido por senha.

Para empacotar no Windows, execute `apps/desktop/scripts/prepare-slides-engine.ps1` e `apps/desktop/scripts/prepare-encoder.ps1`. Defina `VALE_SLIDES_ENGINE` e `VALE_ENCODER_DIR` com as pastas retornadas e execute `pnpm dist`.

Aplicativo Windows para aulas, gravação local, apresentações, reuniões por convite e transmissão RTMP.

## Integrações da Parte 1

| Recurso | Implementado | Testado neste ambiente | Situação |
| --- | --- | --- | --- |
| Shell Electron seguro em português | Sim | TypeScript | Pronto para build |
| Controle do OBS WebSocket 5.x local | Sim | Sem OBS/hardware | Validar em Windows |
| Cenas, fontes, mute, gravação e live OBS | Sim | Sem OBS/hardware | Validar em Windows |
| PDF local | Sim | Build automatizado | Validar arquivo real |
| PPT/PPTX com LibreOffice local | Sim | Sem LibreOffice | Validar em Windows |
| Sala e chat VDO.Ninja | Sim (link/diretor externo) | Sem rede de convidados | Validar manualmente |
| YouTube ou Facebook RTMP individual | Sim | Sem conta/chave | Validar manualmente |
| YouTube + Facebook simultâneos | Não | — | Parte 2 |

Nenhuma entrada, medidor ou status indica sucesso sem retorno do OBS ou do provedor. Gravação e live são independentes. Não há backend, VPS, banco remoto, login obrigatório ou assinatura na configuração básica.

## Pré-requisitos

- Windows 10/11 64-bit.
- Node.js LTS e pnpm.
- [OBS Studio](https://obsproject.com/) é opcional. Para usar a integração, habilite o servidor WebSocket local com senha.
- Para desenvolver sem empacotar, disponibilize o motor de slides no PATH. O instalador completo traz sua própria cópia.
- Para reunião: internet, navegador atual e VDO.Ninja disponível.
- Para live: conta elegível e URL/chave RTMP ou RTMPS fornecida pela plataforma.

## Rodar localmente

```powershell
pnpm install
pnpm dev
```

Comandos de validação:

```powershell
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm dist
```

`pnpm dist` gera instalador NSIS e versão portátil para Windows. Sem certificado de assinatura, o SmartScreen pode alertar; não desative antivírus para instalar.

## Uso rápido

1. Abra o OBS, ative o servidor WebSocket local e crie uma coleção/cenas VALE sem apagar seu trabalho existente.
2. Abra **Configurações**, conecte em `127.0.0.1:4455` com a senha do OBS e confirme o status.
3. Em **Produção**, selecione uma cena existente, crie/ajuste fontes no OBS e inicie/parе a gravação. O botão responde ao estado real do OBS.
4. Em **Apresentações**, abra PDF local ou PPT/PPTX. PPT/PPTX usa o LibreOffice local e avisa sobre possíveis perdas de animações/fontes. Abra a janela de apresentação e capture-a no OBS.
5. Em **Criar reunião**, copie o convite VDO.Ninja. Abra como anfitrião para usar os controles e chat reais do provedor. O link do diretor não deve ser compartilhado.
6. Em **Destinos**, informe URL RTMP/RTMPS e chave para YouTube, Facebook ou servidor compatível; inicie a saída pelo OBS e confirme a publicação no painel da plataforma.

## Segurança e privacidade

- A ponte OBS aceita apenas loopback (`127.0.0.1`, `localhost`, `::1`), nunca uma URL remota.
- `contextIsolation`, sandbox e `nodeIntegration: false` são usados nos renderizadores.
- Senhas do OBS e chaves RTMP são salvas apenas pela proteção do sistema operacional quando disponível; não entram em logs, UI, Git ou documentação.
- PDFs, apresentações convertidas e gravações ficam locais. Não envie mídia, convites ativos ou dados de convidados ao repositório público.
- VDO.Ninja é um provedor externo: ele recebe as conexões e metadados necessários para a reunião. O app não fornece sinalização, TURN ou SFU próprios.

Consulte [arquitetura](docs/ARCHITECTURE.md), [guia do usuário](docs/USER_GUIDE.md), [segurança](docs/SECURITY.md), [limitações](docs/LIMITATIONS.md), [matriz de testes](docs/TEST_MATRIX.md) e [roadmap](docs/ROADMAP.md).

## Licença

O código original está sob [MIT](LICENSE). OBS Studio, VDO.Ninja, PDF.js, Electron, LibreOffice e demais dependências mantêm suas próprias licenças e condições; veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). OBS não é distribuído neste repositório nem empacotado com o aplicativo.
