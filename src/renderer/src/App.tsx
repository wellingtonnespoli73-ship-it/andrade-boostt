import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Gauge,
  Gamepad2,
  HardDrive,
  History,
  Home,
  Info,
  KeyRound,
  MemoryStick,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  XCircle,
  Zap
} from 'lucide-react'
import type {
  ActionResult,
  ApplyResult,
  LicenseStatus,
  OptimizationProfile,
  ScanResult,
  SystemSnapshot
} from '../../shared/contracts'

type View = 'home' | 'optimization' | 'fivem' | 'cleanup' | 'history' | 'settings'

const profiles: Array<{ id: OptimizationProfile; name: string; description: string; icon: typeof ShieldCheck }> = [
  { id: 'safe', name: 'Seguro', description: 'Mudanças mínimas e reversíveis', icon: ShieldCheck },
  { id: 'balanced', name: 'Equilibrado', description: 'Desempenho para o dia a dia', icon: Gauge },
  { id: 'competitive', name: 'Competitivo', description: 'Menos tarefas em segundo plano', icon: Zap },
  { id: 'quality', name: 'Qualidade', description: 'Preserva recursos visuais', icon: Sparkles }
]

const nav: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'optimization', label: 'Otimização', icon: Gauge },
  { id: 'fivem', label: 'FiveM / GTA V', icon: Gamepad2 },
  { id: 'cleanup', label: 'Limpeza', icon: Trash2 },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'settings', label: 'Configurações', icon: Settings }
]

function formatBytes(bytes = 0): string {
  if (!bytes) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`
}

function formatUptime(seconds = 0): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}min`
}

function MetricCard({ icon: Icon, label, value, detail, accent }: { icon: typeof Cpu; label: string; value: string; detail: string; accent: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon" style={{ color: accent }}><Icon size={21} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      <div className="sparkline" style={{ color: accent }}><i /><i /><i /><i /><i /><i /></div>
    </article>
  )
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [profile, setProfile] = useState<OptimizationProfile>('safe')
  const [system, setSystem] = useState<SystemSnapshot | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<ActionResult[]>([])
  const [notice, setNotice] = useState('Pronto para analisar seu PC')
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [licenseKey, setLicenseKey] = useState('')

  useEffect(() => {
    const refresh = () => window.andradeBoost.getSystemSnapshot().then(setSystem).catch(() => undefined)
    refresh()
    window.andradeBoost.getLicenseStatus().then(setLicense).catch(() => undefined)
    const timer = window.setInterval(refresh, 2500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setScan(null)
    setSelected([])
    setNotice(`Perfil ${profiles.find((item) => item.id === profile)?.name} selecionado`)
  }, [profile])

  const successCount = history.filter((item) => item.status === 'success').length
  const actionCount = scan?.actions.length || 0
  const sectionTitle = nav.find((item) => item.id === view)?.label || 'Início'

  const statusLabel = useMemo(() => {
    if (busy) return 'Processando com segurança'
    if (scan) return `${selected.length} de ${actionCount} ações selecionadas`
    return notice
  }, [busy, scan, selected.length, actionCount, notice])

  async function runScan() {
    setBusy(true)
    setNotice('Analisando arquivos e configurações…')
    try {
      const result = await window.andradeBoost.scan(profile)
      setScan(result)
      setSelected(result.actions.map((action) => action.id))
      setNotice(`Análise concluída: ${formatBytes(result.reclaimableBytes)} identificados`)
    } finally {
      setBusy(false)
    }
  }

  async function applySelected() {
    if (!selected.length) return
    if (!window.confirm('Aplicar somente as ações selecionadas? Um backup será criado quando houver algo reversível.')) return
    setBusy(true)
    try {
      const result: ApplyResult = await window.andradeBoost.apply(profile, selected)
      setHistory((current) => [...result.results, ...current])
      const completed = result.results.filter((item) => item.status === 'success').length
      setNotice(`${completed} ação(ões) concluída(s). ${result.backupId ? 'Backup criado.' : ''}`)
      await runScan()
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    setBusy(true)
    try {
      const result = await window.andradeBoost.restoreLatest()
      setNotice(result.backupId ? `${result.restoredFiles} arquivos e ${result.restoredSettings} ajustes restaurados` : result.warnings[0])
    } finally {
      setBusy(false)
    }
  }

  async function activate() {
    setBusy(true)
    try {
      setLicense(await window.andradeBoost.activateLicense(licenseKey))
    } finally {
      setBusy(false)
    }
  }

  function toggleAction(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><b>ANDRADE</b><strong>BOOST</strong><small>PERFORMANCE SEGURA</small></div></div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={20} /><span>{label}</span></button>
          ))}
        </nav>
        <div className="license-card">
          <KeyRound size={19} />
          <div><b>{license?.state === 'active' ? 'Licença ativa' : license?.state === 'development' ? 'Modo desenvolvimento' : 'Licença necessária'}</b><span>{license?.plan || 'Andrade Boost v0.3'}</span></div>
        </div>
        <div className="sidebar-foot"><span>v0.3.0</span><i /> <span>Windows 10/11</span></div>
      </aside>

      <main>
        <header className="topbar">
          <div className="search"><Search size={18} /><span>Buscar função, perfil ou ferramenta…</span></div>
          <div className="system-state"><i className={busy ? 'pulse' : ''} /><span>{statusLabel}</span></div>
        </header>

        <div className="content">
          <div className="page-title"><span>{sectionTitle.toUpperCase()}</span><h1>{view === 'home' ? <>DESEMPENHO <em>REAL</em></> : sectionTitle}</h1><p>Ajustes claros, mensuráveis e reversíveis para jogar com estabilidade.</p></div>

          {(view === 'home' || view === 'optimization') && (
            <>
              <section className="hero-panel">
                <div className="hero-copy"><small>ANDRADE BOOST ENGINE</small><h2>Seu PC, pronto para o próximo RP.</h2><p>Analise primeiro. Revise cada ação. Aplique somente o que fizer sentido.</p><div className="hero-badges"><span><ShieldCheck size={15} /> Backup automático</span><span><Activity size={15} /> Dados reais</span><span><RotateCcw size={15} /> Restaurável</span></div></div>
                <div className="boost-orb"><div className="orb-ring"><div className="orb-center"><b>A</b><span>{busy ? 'ANALISANDO' : 'OTIMIZAR'}</span></div></div></div>
                <button className="primary-button" onClick={runScan} disabled={busy}><Zap size={20} />{scan ? 'ANALISAR NOVAMENTE' : 'ANALISAR AGORA'}<ChevronRight size={18} /></button>
              </section>

              <section className="metrics-grid">
                <MetricCard icon={Cpu} label="CPU" value={`${system?.cpuUsage ?? 0}%`} detail={`${system?.cpuCores ?? 0} threads lógicas`} accent="#42e5a4" />
                <MetricCard icon={MemoryStick} label="MEMÓRIA" value={`${system?.memoryPercent ?? 0}%`} detail={`${formatBytes(system?.memoryUsed)} de ${formatBytes(system?.memoryTotal)}`} accent="#9b73ff" />
                <MetricCard icon={HardDrive} label="DISCO" value={`${system?.diskPercent ?? 0}%`} detail={`${formatBytes(system?.diskFree)} livres`} accent="#28c9ff" />
                <MetricCard icon={Gamepad2} label="FIVEM" value={system?.fiveMRunning ? 'ABERTO' : 'FECHADO'} detail={system?.fiveMRunning ? 'Sessão detectada' : 'Seguro para limpar cache'} accent="#278cff" />
              </section>

              <section className="section-block">
                <div className="section-heading"><div><span>PERFIS</span><h3>Escolha o seu objetivo</h3></div><small>Nenhum perfil usa prioridade Tempo Real.</small></div>
                <div className="profiles-grid">
                  {profiles.map(({ id, name, description, icon: Icon }) => (
                    <button key={id} className={`profile-card ${profile === id ? 'selected' : ''}`} onClick={() => setProfile(id)}><Icon size={22} /><div><b>{name}</b><span>{description}</span></div>{profile === id && <CheckCircle2 size={18} />}</button>
                  ))}
                </div>
              </section>
            </>
          )}

          {(view === 'home' || view === 'optimization' || view === 'fivem' || view === 'cleanup') && (
            <section className="section-block action-section">
              <div className="section-heading"><div><span>PLANO DE AÇÃO</span><h3>{scan ? `${scan.actions.length} ações encontradas` : 'Faça uma análise para começar'}</h3></div>{scan && <b className="reclaim">{formatBytes(scan.reclaimableBytes)} recuperáveis</b>}</div>
              {!scan ? (
                <div className="empty-state"><ShieldCheck size={34} /><b>Nada será alterado sem sua confirmação</b><span>A análise apenas verifica pastas e configurações conhecidas.</span><button onClick={runScan}>Iniciar análise</button></div>
              ) : (
                <>
                  <div className="action-list">
                    {scan.actions
                      .filter((action) => view === 'fivem' ? action.category === 'FiveM' : view === 'cleanup' ? action.category === 'Limpeza' || action.category === 'FiveM' : true)
                      .map((action) => (
                        <button key={action.id} className={`action-row ${selected.includes(action.id) ? 'checked' : ''}`} onClick={() => toggleAction(action.id)}>
                          <span className="checkbox">{selected.includes(action.id) && <CheckCircle2 size={18} />}</span>
                          <div><b>{action.title}</b><p>{action.description}</p><small>{action.category} · {action.reversible ? 'Reversível' : 'Ação instantânea'}{action.requiresRestart ? ' · Reinício recomendado' : ''}</small></div>
                          <strong>{action.estimatedBytes !== undefined ? formatBytes(action.estimatedBytes) : action.risk === 'low' ? 'Seguro' : 'Avançado'}</strong>
                        </button>
                      ))}
                  </div>
                  <div className="apply-bar"><div><Info size={17} /><span>{scan.warnings[0]}</span></div><button className="secondary-button" onClick={restore} disabled={busy}><RotateCcw size={17} /> Restaurar</button><button className="primary-button compact" onClick={applySelected} disabled={busy || !selected.length}><Zap size={17} /> Aplicar selecionadas</button></div>
                </>
              )}
            </section>
          )}

          {view === 'history' && (
            <section className="section-block">
              <div className="section-heading"><div><span>SESSÃO ATUAL</span><h3>{successCount} ações concluídas</h3></div><button className="secondary-button" onClick={restore}><RotateCcw size={17} /> Restaurar último backup</button></div>
              <div className="history-list">
                {!history.length && <div className="empty-state"><History size={34} /><b>Nenhuma alteração nesta sessão</b><span>As ações executadas aparecerão aqui.</span></div>}
                {history.map((item, index) => <div className="history-row" key={`${item.id}-${index}`}>{item.status === 'success' ? <CheckCircle2 /> : item.status === 'failed' ? <XCircle /> : <Info />}<div><b>{item.title}</b><span>{item.message}</span></div><small>{item.status}</small></div>)}
              </div>
            </section>
          )}

          {view === 'settings' && (
            <div className="settings-grid">
              <section className="section-block"><div className="section-heading"><div><span>LICENÇA</span><h3>Ativação comercial</h3></div></div><p className="muted">A chave é validada pela API e o identificador do dispositivo é enviado somente como hash.</p><div className="license-form"><input value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="AB-XXXX-XXXX-XXXX" /><button onClick={activate} disabled={busy}>Ativar</button></div><div className={`license-status ${license?.state}`}><ShieldCheck /><div><b>{license?.message || 'Carregando…'}</b><span>{license?.expiresAt ? `Expira em ${new Date(license.expiresAt).toLocaleDateString('pt-BR')}` : 'Sem dados de vencimento'}</span></div></div></section>
              <section className="section-block"><div className="section-heading"><div><span>SISTEMA</span><h3>Informações detectadas</h3></div></div><dl className="system-info"><div><dt>Windows</dt><dd>{system?.windowsVersion}</dd></div><div><dt>Processador</dt><dd>{system?.cpuModel}</dd></div><div><dt>Placa de vídeo</dt><dd>{system?.gpuModel}</dd></div><div><dt>Tempo ligado</dt><dd>{formatUptime(system?.uptimeSeconds)}</dd></div></dl><button className="secondary-button full" onClick={() => window.andradeBoost.openDataFolder()}><HardDrive size={17} /> Abrir pasta de backups e auditoria</button></section>
              <section className="section-block safety-note"><ShieldCheck size={28} /><div><h3>Compromisso de segurança</h3><p>O Andrade Boost não apaga Prefetch, não usa prioridade Tempo Real, não promete “zero input lag” e não desativa serviços essenciais.</p></div></section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
