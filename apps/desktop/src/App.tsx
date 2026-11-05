import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { Meeting, ObsSnapshot, PresentationFile } from '../shared/contracts'
import { PdfViewer } from './components/PdfViewer'

type View = 'home' | 'production' | 'documents' | 'destinations' | 'settings' | 'help'
type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null

const initialObs: ObsSnapshot = {
  connection: { connected: false, host: '127.0.0.1', port: 4455 },
  scenes: [], inputs: [], inputKinds: [], recording: { active: false }, streaming: { active: false }
}

const navigation: Array<{ id: View; label: string; icon: string }> = [
  { id: 'home', label: 'Início', icon: '◆' },
  { id: 'production', label: 'Produção', icon: '◉' },
  { id: 'documents', label: 'Apresentações', icon: '▤' },
  { id: 'destinations', label: 'Destinos', icon: '↗' },
  { id: 'settings', label: 'Configurações', icon: '⚙' },
  { id: 'help', label: 'Ajuda', icon: '?' }
]

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Ocorreu um erro inesperado.'
}

export function App(): JSX.Element {
  const presenter = window.location.hash === '#/presenter'
  if (presenter) return <Presenter />
  return <Studio />
}

function Studio(): JSX.Element {
  const [view, setView] = useState<View>('home')
  const [obs, setObs] = useState<ObsSnapshot>(initialObs)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [presentation, setPresentation] = useState<PresentationFile | null>(null)
  const [presentationBytes, setPresentationBytes] = useState<Uint8Array | null>(null)
  const [system, setSystem] = useState<{ obsExecutable?: string } | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.vale.app.getStatus().then(setSystem).catch(() => undefined)
    void window.vale.obs.snapshot().then(setObs).catch(() => undefined)
    return window.vale.obs.onState(setObs)
  }, [])

  async function run(task: () => Promise<void>, success?: string): Promise<void> {
    setBusy(true)
    try {
      await task()
      if (success) setNotice({ tone: 'success', text: success })
    } catch (reason) {
      setNotice({ tone: 'error', text: errorMessage(reason) })
    } finally {
      setBusy(false)
    }
  }

  async function openPresentation(): Promise<void> {
    await run(async () => {
      const file = await window.vale.presentation.import()
      if (!file) return
      const bytes = await window.vale.presentation.read(file.path)
      setPresentation(file)
      setPresentationBytes(bytes)
      setView('documents')
    }, 'Apresentação importada localmente. O arquivo original não foi enviado nem alterado.')
  }

  async function createMeeting(): Promise<void> {
    await run(async () => setMeeting(await window.vale.meeting.create()), 'Convite seguro criado para uma nova sala.')
  }

  const content = useMemo(() => {
    switch (view) {
      case 'home':
        return <Home onOpen={(target) => setView(target)} onCreateMeeting={createMeeting} onOpenPresentation={openPresentation} obs={obs} />
      case 'production':
        return <Production obs={obs} busy={busy} presentation={presentation} meeting={meeting} onCreateMeeting={createMeeting} onOpenPresentation={openPresentation} onNotice={setNotice} />
      case 'documents':
        return <Documents presentation={presentation} bytes={presentationBytes} onOpen={openPresentation} onNotice={setNotice} />
      case 'destinations':
        return <Destinations obs={obs} onNotice={setNotice} />
      case 'settings':
        return <Settings obs={obs} system={system} onObs={setObs} onNotice={setNotice} />
      case 'help':
        return <Help />
    }
  // callbacks intentionally close over current user actions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, obs, busy, presentation, presentationBytes, meeting, system])

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">V</span><span><b>VALE</b><small>STREAM STUDIO</small></span></div>
        <nav aria-label="Navegação principal">
          {navigation.map((item) => <button key={item.id} data-settings-link={item.id === 'settings' || undefined} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.id)}><i>{item.icon}</i>{item.label}</button>)}
        </nav>
        <div className="sidebar-footer">
          <span className={obs.connection.connected ? 'status-dot ready' : 'status-dot'} />
          <div><strong>{obs.connection.connected ? 'OBS conectado' : 'OBS aguardando'}</strong><small>{obs.connection.connected ? 'Controle local seguro' : 'Configure em Ajustes'}</small></div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">ESTÚDIO LOCAL • WINDOWS</span><h1>{navigation.find((item) => item.id === view)?.label}</h1></div>
          <div className="status-row">
            <StatusChip label="Câmera" value={obs.connection.connected ? 'via OBS' : 'aguardando'} good={obs.connection.connected} />
            <StatusChip label="Áudio do PC" value="configure no OBS" />
            <StatusChip label="VDO.Ninja" value="externo" />
            <StatusChip label="Internet" value="necessária p/ sala/live" />
          </div>
        </header>
        {notice && <div className={`notice ${notice.tone}`} role="status"><span>{notice.tone === 'error' ? '!' : '✓'}</span>{notice.text}<button aria-label="Fechar aviso" onClick={() => setNotice(null)}>×</button></div>}
        <div className="page-content">{content}</div>
      </section>
      {meeting && <MeetingModal meeting={meeting} onClose={() => setMeeting(null)} onNotice={setNotice} />}
    </main>
  )
}

function StatusChip({ label, value, good }: { label: string; value: string; good?: boolean }): JSX.Element {
  return <span className="status-chip"><i className={good ? 'status-dot ready' : 'status-dot'} /> <b>{label}</b> {value}</span>
}

function Home({ onOpen, onCreateMeeting, onOpenPresentation, obs }: { onOpen: (view: View) => void; onCreateMeeting: () => void; onOpenPresentation: () => void; obs: ObsSnapshot }): JSX.Element {
  return <>
    <section className="hero-card">
      <div><span className="eyebrow accent">PRONTO PARA COMEÇAR</span><h2>Crie, ensine, grave e transmita <em>com controle local.</em></h2><p>Seu estúdio VALE usa o OBS como motor de mídia. Reuniões usam VDO.Ninja, um serviço externo gratuito, e lives saem diretamente do seu computador.</p></div>
      <div className="hero-orbit"><span className="orbit-core">V</span><i /><i /><i /></div>
    </section>
    <section className="quick-grid" aria-label="Ações principais">
      <button className="quick-card blue" onClick={() => onOpen('production')}><span className="quick-icon">▣</span><b>Iniciar aula</b><small>Prepare cena, tela, áudio e participantes.</small><strong>→</strong></button>
      <button className="quick-card violet" onClick={onCreateMeeting}><span className="quick-icon">◌</span><b>Criar reunião</b><small>Gere um convite real via VDO.Ninja.</small><strong>→</strong></button>
      <button className="quick-card gold" onClick={() => onOpen('production')}><span className="quick-icon">●</span><b>Gravar vídeo</b><small>Controla a gravação local confirmada pelo OBS.</small><strong>→</strong></button>
      <button className="quick-card teal" onClick={() => onOpen('destinations')}><span className="quick-icon">↗</span><b>Transmitir ao vivo</b><small>Configure um destino RTMP/RTMPS por vez.</small><strong>→</strong></button>
    </section>
    <section className="dashboard-grid">
      <article className="panel setup-panel"><div className="panel-heading"><div><span className="eyebrow">PRIMEIRO USO</span><h3>Assistente de preparação</h3></div><span className="step-count">{obs.connection.connected ? '2/4' : '1/4'}</span></div>
        <ol className="checklist"><li className="done">Windows e aplicativo prontos</li><li className={obs.connection.connected ? 'done' : ''}>Conectar OBS local com senha</li><li>Definir cena, fontes e pasta de gravação</li><li>Fazer teste com arquivo e áudio real</li></ol><button className="button secondary" onClick={() => onOpen('settings')}>Abrir ajustes do OBS</button>
      </article>
      <article className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">STATUS DE PRODUÇÃO</span><h3>Saídas atuais</h3></div></div><div className="output-list"><OutputState label="Gravação local" active={obs.recording.active} detail={obs.recording.timecode ?? 'Parada'} /><OutputState label="Live RTMP" active={obs.streaming.active} detail={obs.streaming.timecode ?? 'Desconectada'} /><OutputState label="Sala de convidados" active={false} detail="Crie uma sala para abrir" /></div><button className="text-button" onClick={onOpenPresentation}>Abrir apresentação local →</button></article>
    </section>
  </>
}

function OutputState({ label, active, detail }: { label: string; active: boolean; detail: string }): JSX.Element {
  return <div className="output-state"><span className={active ? 'status-dot live' : 'status-dot'} /><div><b>{label}</b><small>{detail}</small></div><strong className={active ? 'live-label' : ''}>{active ? 'ATIVA' : 'EM ESPERA'}</strong></div>
}

function Production({ obs, busy, presentation, meeting, onCreateMeeting, onOpenPresentation, onNotice }: { obs: ObsSnapshot; busy: boolean; presentation: PresentationFile | null; meeting: Meeting | null; onCreateMeeting: () => void; onOpenPresentation: () => void; onNotice: (notice: Notice) => void }): JSX.Element {
  const [inputName, setInputName] = useState('VALE_NovaFonte')
  const [inputKind, setInputKind] = useState('')
  const [scene, setScene] = useState('')

  useEffect(() => {
    setScene((current) => current || obs.currentScene || obs.scenes[0] || '')
    setInputKind((current) => current || obs.inputKinds[0] || '')
  }, [obs.currentScene, obs.scenes, obs.inputKinds])

  async function action(task: () => Promise<ObsSnapshot>, success?: string): Promise<void> {
    try { await task(); if (success) onNotice({ tone: 'success', text: success }) } catch (reason) { onNotice({ tone: 'error', text: errorMessage(reason) }) }
  }
  async function openScreenShare(): Promise<void> {
    if (!meeting) return onCreateMeeting()
    try {
      const url = new URL(meeting.guestUrl)
      url.searchParams.set('screenshare', '')
      url.searchParams.set('autostart', '')
      await window.vale.meeting.open(url.toString())
      onNotice({ tone: 'info', text: 'O fluxo oficial do VDO.Ninja foi aberto no navegador. Selecione a tela/janela e marque o áudio quando o navegador oferecer essa opção.' })
    } catch (reason) { onNotice({ tone: 'error', text: errorMessage(reason) }) }
  }

  if (!obs.connection.connected) return <section className="empty-state prominent"><span className="large-glyph">◉</span><h2>Conecte o motor de mídia</h2><p>O VALE STREAM STUDIO controla um OBS Studio local pela porta de loopback protegida. Nada é enviado a um servidor VALE.</p><a className="button primary" href="#" onClick={(event) => { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-settings-link]')?.click() }}>Configurar conexão OBS</a><small>Instale o OBS Studio gratuito, ative WebSocket Server e defina uma senha. Não exponha essa porta à internet.</small></section>

  return <section className="production-layout">
    <div className="program-column">
      <article className="preview panel"><div className="panel-heading"><div><span className="eyebrow">SAÍDA DO PROGRAMA</span><h3>{obs.currentScene ?? 'Nenhuma cena selecionada'}</h3></div><span className={obs.streaming.active ? 'badge live-badge' : obs.recording.active ? 'badge record-badge' : 'badge'}>{obs.streaming.active ? 'AO VIVO' : obs.recording.active ? 'GRAVANDO' : 'EM ESPERA'}</span></div>
        <div className="preview-stage"><div className="preview-grid" /><div className="preview-message"><span>PRÉVIA DO OBS</span><b>A prévia é fornecida pelo OBS.</b><small>Use a janela do OBS para conferir o programa enquanto a integração não expõe um preview embutido seguro.</small></div></div>
        <div className="scene-strip">{obs.scenes.map((name) => <button key={name} className={name === obs.currentScene ? 'scene-card active' : 'scene-card'} onClick={() => void action(() => window.vale.obs.switchScene(name), `Cena “${name}” enviada ao programa pelo OBS.`)}>{name}</button>)}</div>
      </article>
      <div className="production-actions"><button className="button secondary" onClick={openScreenShare}>▣ Compartilhar tela e áudio</button><button className="button secondary" onClick={onOpenPresentation}>▤ Apresentar arquivo</button><button className="button secondary" onClick={onCreateMeeting}>◌ Copiar convite</button><button className="button secondary" disabled={!meeting} onClick={() => meeting && void window.vale.meeting.open(meeting.directorUrl)}>▢ Abrir chat/sala</button></div>
    </div>
    <aside className="control-column">
      <article className="panel compact"><div className="panel-heading"><h3>Gravação e live</h3><span className="subtle">Estado confirmado pelo OBS</span></div><div className="primary-controls"><button className={obs.recording.active ? 'button danger grow' : 'button record grow'} disabled={busy} onClick={() => void action(() => obs.recording.active ? window.vale.obs.stopRecord() : window.vale.obs.startRecord(), obs.recording.active ? 'Gravação encerrada pelo OBS.' : 'Gravação iniciada pelo OBS.')}>{obs.recording.active ? '■ Parar gravação' : '● Gravar'}</button><button className={obs.streaming.active ? 'button danger grow' : 'button primary grow'} disabled={busy} onClick={() => void action(() => obs.streaming.active ? window.vale.obs.stopStream() : window.vale.obs.startStream(), obs.streaming.active ? 'Live parada pelo OBS.' : 'OBS iniciou o envio RTMP. Confirme a publicação no painel da plataforma quando necessário.')}>{obs.streaming.active ? '■ Parar live' : '↗ Transmitir'}</button></div><p className="fine-print">Gravação e transmissão são saídas independentes. Uma chave e conta válidas são exigidas para a live.</p></article>
      <article className="panel compact"><div className="panel-heading"><div><span className="eyebrow">MIXER OBS</span><h3>Fontes ativas</h3></div></div><div className="mixer-list">{obs.inputs.length ? obs.inputs.map((input) => <div className="mixer-row" key={input.name}><div><b>{input.name}</b><small>{input.kind}</small></div><div className="meter"><i /></div><button className="icon-button" title={input.muted ? 'Ativar áudio' : 'Silenciar'} onClick={() => void action(() => window.vale.obs.setMute(input.name, !input.muted))}>{input.muted ? '🔇' : '🔊'}</button></div>) : <p className="fine-print">Nenhuma fonte foi retornada pelo OBS.</p>}</div></article>
      <article className="panel compact"><div className="panel-heading"><h3>Adicionar fonte OBS</h3></div><p className="fine-print">A lista vem da instalação local do OBS. A criação é executada pela API; erros de dispositivo retornam aqui, sem simulação.</p><select value={scene} onChange={(event) => setScene(event.target.value)}>{obs.scenes.map((item) => <option key={item}>{item}</option>)}</select><input value={inputName} maxLength={80} onChange={(event) => setInputName(event.target.value)} aria-label="Nome da fonte" /><select value={inputKind} onChange={(event) => setInputKind(event.target.value)}>{obs.inputKinds.map((item) => <option key={item}>{item}</option>)}</select><button className="button secondary full" disabled={!scene || !inputKind} onClick={() => void action(() => window.vale.obs.addInput({ sceneName: scene, inputName, inputKind, settings: {} }), 'Fonte criada no OBS. Ajuste o dispositivo nas propriedades da fonte se necessário.')}>Adicionar fonte vazia</button></article>
      {presentation && <article className="panel compact doc-ready"><b>▤ {presentation.filename}</b><small>{presentation.converted ? 'Convertida localmente para PDF' : 'PDF local carregado'}</small><button className="text-button" onClick={() => void window.vale.presentation.openPresenter().catch((reason) => onNotice({ tone: 'error', text: errorMessage(reason) }))}>Abrir janela para captura OBS →</button></article>}
    </aside>
  </section>
}

function Documents({ presentation, bytes, onOpen, onNotice }: { presentation: PresentationFile | null; bytes: Uint8Array | null; onOpen: () => void; onNotice: (notice: Notice) => void }): JSX.Element {
  return <section className="documents-layout"><div className="documents-intro"><span className="eyebrow accent">APRESENTADOR LOCAL</span><h2>PDF, PPT e PPTX sem enviar seu arquivo à nuvem.</h2><p>PDFs são renderizados localmente. PPT/PPTX são convertidos localmente com LibreOffice, quando instalado.</p><button className="button primary" onClick={onOpen}>▤ Abrir apresentação</button>{presentation && <button className="button secondary" onClick={() => void window.vale.presentation.openPresenter().catch((reason) => onNotice({ tone: 'error', text: errorMessage(reason) }))}>Abrir janela de apresentação</button>}</div>{presentation && bytes ? <><div className="document-meta"><b>{presentation.filename}</b><span>{presentation.converted ? 'PPT/PPTX convertido localmente' : 'PDF original local'}</span>{presentation.notice && <p>{presentation.notice}</p>}</div><PdfViewer bytes={bytes} filename={presentation.filename} /></> : <div className="empty-state"><span className="large-glyph">▤</span><h3>Nenhum documento aberto</h3><p>Importe um PDF, PPT ou PPTX do seu disco. Os originais não são alterados.</p></div>}</section>
}

function Destinations({ obs, onNotice }: { obs: ObsSnapshot; onNotice: (notice: Notice) => void }): JSX.Element {
  const [platform, setPlatform] = useState<'youtube' | 'facebook' | 'custom'>('youtube')
  const [server, setServer] = useState('')
  const [key, setKey] = useState('')
  const [configured, setConfigured] = useState<string>()
  async function configure(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try { const result = await window.vale.obs.configureDestination({ platform, server, key }); setConfigured(`${result.platform}: ${result.server}`); setKey(''); onNotice({ tone: 'success', text: 'Destino enviado ao OBS. A chave foi guardada usando a proteção de credenciais do sistema e não é exibida.' }) } catch (reason) { onNotice({ tone: 'error', text: errorMessage(reason) }) }
  }
  return <section className="destinations-layout"><article className="panel destination-form"><span className="eyebrow accent">RTMP/RTMPS DIRETO</span><h2>Configure um destino de cada vez</h2><p>Parte 1 suporta YouTube ou Facebook individualmente. Multistream simultâneo é planejado para a Parte 2, após pipeline local testado.</p><form onSubmit={configure}><label>Plataforma<select value={platform} onChange={(event) => setPlatform(event.target.value as typeof platform)}><option value="youtube">YouTube Live</option><option value="facebook">Facebook Live</option><option value="custom">RTMP personalizado</option></select></label><label>URL de ingestão RTMP/RTMPS<input required placeholder="rtmps://…" value={server} onChange={(event) => setServer(event.target.value)} /></label><label>Chave de transmissão<input required type="password" autoComplete="off" placeholder="Nunca é exibida nem registrada" value={key} onChange={(event) => setKey(event.target.value)} /></label><button className="button primary" disabled={!obs.connection.connected}>Salvar no OBS local</button></form>{configured && <p className="configured">✓ Configurado: {configured}</p>}</article><article className="panel platform-guide"><h3>Antes de iniciar</h3><ol><li>Crie uma live no painel oficial da plataforma.</li><li>Copie a URL e a chave de transmissão na conta habilitada.</li><li>Salve o destino acima e inicie a live pelo estúdio.</li><li>Confirme a publicação no painel da plataforma quando ele solicitar.</li></ol><div className="platform-links"><button onClick={() => void window.vale.app.openExternal('https://studio.youtube.com/')}>Abrir YouTube Studio</button><button onClick={() => void window.vale.app.openExternal('https://www.facebook.com/live/producer/')}>Abrir Facebook Live Producer</button></div><p className="fine-print">O aplicativo não cria permissões de conta, não contorna requisitos das plataformas e não confirma “ao vivo” até o OBS reportar a saída ativa.</p></article></section>
}

function Settings({ obs, system, onObs, onNotice }: { obs: ObsSnapshot; system: { obsExecutable?: string } | null; onObs: (value: ObsSnapshot) => void; onNotice: (notice: Notice) => void }): JSX.Element {
  const [host, setHost] = useState(obs.connection.host)
  const [port, setPort] = useState(String(obs.connection.port))
  const [password, setPassword] = useState('')
  async function connect(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try { onObs(await window.vale.obs.connect({ host, port: Number(port), password })); setPassword(''); onNotice({ tone: 'success', text: 'OBS conectado em loopback local com autenticação.' }) } catch (reason) { onNotice({ tone: 'error', text: errorMessage(reason) }) }
  }
  return <section className="settings-layout"><article className="panel connection-card"><span className="eyebrow accent">MOTOR DE MÍDIA LOCAL</span><h2>Conexão OBS WebSocket</h2><p>O VALE controla somente <code>127.0.0.1</code>/<code>localhost</code>. Não exponha o OBS WebSocket na internet.</p><div className={system?.obsExecutable ? 'dependency found' : 'dependency'}><span>{system?.obsExecutable ? '✓' : '!'}</span><div><b>{system?.obsExecutable ? 'OBS Studio localizado' : 'OBS Studio não localizado'}</b><small>{system?.obsExecutable ? system.obsExecutable : 'Instale o OBS gratuito e reinicie o aplicativo.'}</small></div>{!system?.obsExecutable && <button onClick={() => void window.vale.app.openExternal('https://obsproject.com/')}>Site oficial</button>}</div><form onSubmit={connect}><label>Host<input value={host} onChange={(event) => setHost(event.target.value)} /></label><label>Porta<input type="number" min="1" max="65535" value={port} onChange={(event) => setPort(event.target.value)} /></label><label>Senha do WebSocket<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="form-actions"><button className="button primary">Conectar OBS</button>{obs.connection.connected && <button type="button" className="button secondary" onClick={() => void window.vale.obs.disconnect().then(onObs).catch((reason) => onNotice({ tone: 'error', text: errorMessage(reason) }))}>Desconectar</button>}</div></form></article><article className="panel settings-notes"><h3>Configuração segura</h3><ul><li>Abra OBS → Ferramentas → WebSocket Server Settings.</li><li>Ative o servidor, mantenha uma senha e use a porta 4455 ou uma porta local escolhida.</li><li>Não compartilhe senha ou chave de live em captura de tela, logs ou repositório.</li><li>Crie uma coleção/cenas VALE no OBS sem apagar seu trabalho existente.</li></ul><p className="fine-print">O sistema de credenciais do Windows protege segredos persistidos. Se essa proteção estiver indisponível, a sessão funciona, mas a chave não é salva.</p></article></section>
}

function Help(): JSX.Element {
  return <section className="help-grid"><article className="panel"><span className="eyebrow accent">O QUE É REAL NESTA PARTE</span><h2>Parte 1 - base operacional</h2><ul className="feature-list"><li><b>OBS local:</b> conexão autenticada, cenas, fontes, mute, gravação e live com estado do OBS.</li><li><b>Apresentações:</b> PDF local e conversão PPT/PPTX por LibreOffice local.</li><li><b>Reuniões:</b> convite e diretor distintos por VDO.Ninja; chat e compartilhamento usam a interface oficial do provedor.</li><li><b>Destinos:</b> uma saída RTMP/RTMPS por vez configurada no OBS.</li></ul></article><article className="panel"><span className="eyebrow">LIMITES IMPORTANTES</span><h3>Não são promessas ocultas</h3><ul className="feature-list"><li>O VDO.Ninja é externo; disponibilidade e redes restritivas podem afetar a reunião.</li><li>Live precisa de conta habilitada, chave válida, internet e confirmação na plataforma.</li><li>Hardware, áudio do sistema e dispositivos só podem ser validados em Windows real.</li><li>Multistream YouTube + Facebook simultâneo é Parte 2, não um botão fictício.</li></ul></article><article className="panel"><h3>Roteiro de aceite manual</h3><ol><li>Conecte OBS, defina uma cena e fontes reais.</li><li>Grave dois minutos offline e reproduza o arquivo.</li><li>Abra PDF/PPTX e capture a janela do apresentador no OBS.</li><li>Crie uma sala, teste com convidado em outra rede e chat.</li><li>Faça live privada/não listada com uma conta habilitada.</li></ol></article></section>
}

function MeetingModal({ meeting, onClose, onNotice }: { meeting: Meeting; onClose: () => void; onNotice: (notice: Notice) => void }): JSX.Element {
  const [qr, setQr] = useState<string>()
  useEffect(() => { void QRCode.toDataURL(meeting.guestUrl, { margin: 1, width: 280, color: { dark: '#0b0e14', light: '#ffffff' } }).then(setQr).catch(() => undefined) }, [meeting.guestUrl])
  async function copy(value: string, message: string): Promise<void> { try { await navigator.clipboard.writeText(value); onNotice({ tone: 'success', text: message }) } catch { onNotice({ tone: 'error', text: 'Não foi possível acessar a área de transferência.' }) } }
  return <div className="modal-backdrop" role="presentation"><section className="meeting-modal" role="dialog" aria-modal="true" aria-label="Nova reunião"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow accent">SALA CRIADA</span><h2>Convide sua turma ou convidados</h2><p>Esta sala usa o VDO.Ninja, serviço externo gratuito. O link do convidado e o link de diretor são diferentes.</p><div className="meeting-content"><div><label>Link para convidados<div className="copy-field"><input readOnly value={meeting.guestUrl} /><button onClick={() => void copy(meeting.invitation, 'Convite copiado.')}>Copiar convite</button></div></label><label>Código forte da sala<div className="copy-field"><input readOnly value={meeting.roomId} /><button onClick={() => void copy(meeting.roomId, 'Código de sala copiado.')}>Copiar</button></div></label><div className="meeting-actions"><button className="button primary" onClick={() => void window.vale.meeting.open(meeting.directorUrl)}>Abrir como anfitrião</button><button className="button secondary" onClick={() => void window.vale.meeting.open(meeting.guestUrl)}>Testar convite</button></div></div>{qr && <figure className="qr"><img src={qr} alt="QR Code do convite" /><figcaption>Escaneie para entrar no celular</figcaption></figure>}</div><p className="provider-notice">{meeting.limitations}</p></section></div>
}

function Presenter(): JSX.Element {
  const [file, setFile] = useState<PresentationFile | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string>()
  useEffect(() => { void (async () => { try { const current = await window.vale.presentation.current(); if (!current) throw new Error('Nenhuma apresentação está aberta no estúdio.'); setFile(current); setBytes(await window.vale.presentation.read(current.path)) } catch (reason) { setError(errorMessage(reason)) } })() }, [])
  return <main className="presenter-shell">{error ? <div className="empty-state error-state"><h2>Apresentador indisponível</h2><p>{error}</p></div> : file && bytes ? <PdfViewer bytes={bytes} filename={file.filename} fullScreen /> : <div className="empty-state"><span className="large-glyph">▤</span><p>Carregando apresentação local…</p></div>}</main>
}
