# Arquitetura da Parte 1

```
React renderer ── IPC mínimo ── Electron main
                                    ├─ ObsBridge ── ws://127.0.0.1:4455 ── OBS Studio local
                                    ├─ PresentationBridge ── PDF.js / LibreOffice local
                                    ├─ VdoNinjaBridge ── links HTTPS externos
                                    └─ SecurityStore ── proteção de credenciais do Windows
```

O renderer não tem Node.js, só recebe métodos específicos no preload. O processo principal valida origem IPC, host loopback, URL RTMP/RTMPS, URL externa permitida e nomes de fontes. O OBS é o mecanismo que captura, compõe, mistura, grava e envia RTMP; a UI apenas dispara e observa a API 5.x.

VDO.Ninja sustenta as salas, chat e compartilhamento de tela no navegador. O aplicativo gera IDs com 160 bits de aleatoriedade hexadecimal e URLs diferentes para convidado e diretor. O link do diretor inclui aprovação manual e deve ficar privado.

PDF é renderizado localmente com PDF.js. PPT/PPTX é convertido pelo `soffice --headless --convert-to pdf` em diretório temporário do sistema e o original é preservado. A janela do apresentador é intencionalmente separada da janela de controle para o OBS capturar somente o conteúdo exibido.
