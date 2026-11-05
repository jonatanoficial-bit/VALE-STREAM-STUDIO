# Segurança

- Janela Electron: isolamento de contexto, sandbox, Node desabilitado e navegação externa bloqueada.
- IPC: exposição por métodos específicos, sem `ipcRenderer` bruto; origem local validada pelo processo principal.
- OBS: apenas loopback e porta válida; autenticação obrigatória no servidor OBS.
- Segredos: chaves RTMP e senha OBS não são retornadas à interface, registradas ou commitadas. Quando persistidas, usam `safeStorage` do Electron. Se indisponível, a sessão pode operar sem persistência.
- Links: apenas HTTPS para domínios oficiais permitidos e RTMP/RTMPS para destinos de streaming.
- Dados: gravações, documentos e conversões são locais. Não publique mídia, credenciais, QR de convite ativo, logs com segredos ou dados pessoais.

Reporte vulnerabilidades de forma privada ao proprietário do repositório. Não abra a porta WebSocket do OBS na internet.
