const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function assertObsEndpoint(host: string, port: number): void {
  if (!LOOPBACK_HOSTS.has(host)) throw new Error('Por segurança, o OBS só pode ser acessado em localhost.')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('A porta do OBS é inválida.')
}

export function assertSafeExternalUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  const allowed = new Set([
    'vdo.ninja',
    'www.vdo.ninja',
    'obsproject.com',
    'www.obsproject.com',
    'youtube.com',
    'www.youtube.com',
    'studio.youtube.com',
    'facebook.com',
    'www.facebook.com',
    'liveproducer.facebook.com',
    'libreoffice.org',
    'www.libreoffice.org'
  ])
  if (url.protocol !== 'https:' || !allowed.has(url.hostname)) {
    throw new Error('Este endereço externo não é permitido pelo aplicativo.')
  }
  return url
}

export function assertRtmpUrl(server: string): void {
  const url = new URL(server)
  if (!['rtmp:', 'rtmps:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Use uma URL RTMP ou RTMPS válida fornecida pela plataforma.')
  }
}

export function safeError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error)
  return value
    .replace(/(key|password|senha|token)=?[^\s&]+/gi, '$1=[oculto]')
    .replace(/rtmps?:\/\/[^\s]+/gi, '[destino-rtmp-oculto]')
    .slice(0, 360)
}
