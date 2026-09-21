import { app } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type {
  ActionResult,
  ApplyResult,
  OptimizationAction,
  OptimizationProfile,
  RestoreResult,
  ScanResult
} from '../shared/contracts'

const execFileAsync = promisify(execFile)

interface BackupItem {
  original: string
  backup: string
}

interface RegistryBackup {
  key: string
  name: string
  previous: string | null
  type: 'REG_DWORD'
}

interface BackupManifest {
  id: string
  createdAt: string
  files: BackupItem[]
  registry: RegistryBackup[]
  previousPowerScheme?: string | null
}

const ACTIONS: Record<string, OptimizationAction> = {
  'fivem-cache': {
    id: 'fivem-cache',
    title: 'Limpar cache do FiveM',
    category: 'FiveM',
    description: 'Move caches de servidores para uma quarentena restaurável sem tocar nos arquivos do jogo.',
    reversible: true,
    requiresRestart: false,
    risk: 'low'
  },
  'fivem-crashes': {
    id: 'fivem-crashes',
    title: 'Arquivar relatórios de falha',
    category: 'FiveM',
    description: 'Move dumps e relatórios antigos de travamento para a quarentena.',
    reversible: true,
    requiresRestart: false,
    risk: 'low'
  },
  'temp-old': {
    id: 'temp-old',
    title: 'Temporários antigos',
    category: 'Limpeza',
    description: 'Seleciona somente .tmp, .log e .dmp com mais de sete dias na pasta temporária do usuário.',
    reversible: true,
    requiresRestart: false,
    risk: 'low'
  },
  'game-mode': {
    id: 'game-mode',
    title: 'Ativar Modo de Jogo',
    category: 'Windows',
    description: 'Prioriza a experiência de jogos usando a configuração oficial do Windows.',
    reversible: true,
    requiresRestart: false,
    risk: 'low'
  },
  'game-dvr': {
    id: 'game-dvr',
    title: 'Desativar gravação em segundo plano',
    category: 'Latência',
    description: 'Desativa a captura Game DVR em segundo plano e salva o valor anterior.',
    reversible: true,
    requiresRestart: true,
    risk: 'medium'
  },
  'dns-flush': {
    id: 'dns-flush',
    title: 'Renovar cache DNS',
    category: 'Rede',
    description: 'Limpa apenas o cache DNS local. Não promete reduzir o ping da sua rota.',
    reversible: false,
    requiresRestart: false,
    risk: 'low'
  },
  'fivem-priority': {
    id: 'fivem-priority',
    title: 'Prioridade alta do FiveM',
    category: 'Latência',
    description: 'Define prioridade Alta somente durante a sessão atual, nunca Tempo Real.',
    reversible: false,
    requiresRestart: false,
    risk: 'medium'
  },
  'power-high': {
    id: 'power-high',
    title: 'Plano de alto desempenho',
    category: 'Windows',
    description: 'Ativa Alto Desempenho quando disponível e registra o plano anterior para restauração.',
    reversible: true,
    requiresRestart: false,
    risk: 'medium'
  }
}

const PROFILE_ACTIONS: Record<OptimizationProfile, string[]> = {
  safe: ['fivem-cache', 'fivem-crashes', 'game-mode'],
  balanced: ['fivem-cache', 'fivem-crashes', 'temp-old', 'game-mode', 'game-dvr', 'dns-flush'],
  competitive: [
    'fivem-cache',
    'fivem-crashes',
    'temp-old',
    'game-mode',
    'game-dvr',
    'dns-flush',
    'fivem-priority',
    'power-high'
  ],
  quality: ['fivem-cache', 'fivem-crashes', 'game-mode']
}

function dataRoot(): string {
  return path.join(app.getPath('userData'), 'optimizer')
}

function fivemDataRoot(): string {
  return path.join(process.env.LOCALAPPDATA || '', 'FiveM', 'FiveM.app', 'data')
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function walkFiles(root: string, filter: (file: string, stat: { mtimeMs: number }) => boolean): Promise<string[]> {
  if (!root || !(await exists(root))) return []
  const result: string[] = []
  const queue = [root]
  while (queue.length && result.length < 25_000) {
    const current = queue.shift()!
    try {
      const entries = await fs.readdir(current, { withFileTypes: true, encoding: 'utf8' })
      for (const entry of entries) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) queue.push(full)
        if (entry.isFile()) {
          try {
            const stat = await fs.stat(full)
            if (filter(full, stat)) result.push(full)
          } catch {
            // Arquivo em uso ou removido durante a varredura.
          }
        }
      }
    } catch {
      continue
    }
  }
  return result
}

async function candidateFiles(actionId: string): Promise<string[]> {
  if (actionId === 'fivem-cache') {
    const roots = ['cache', 'server-cache', 'server-cache-priv'].map((name) => path.join(fivemDataRoot(), name))
    const groups = await Promise.all(roots.map((root) => walkFiles(root, () => true)))
    return groups.flat()
  }
  if (actionId === 'fivem-crashes') {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    return walkFiles(path.join(process.env.LOCALAPPDATA || '', 'FiveM', 'FiveM.app', 'crashes'), (_file, stat) => stat.mtimeMs < cutoff)
  }
  if (actionId === 'temp-old') {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const extensions = new Set(['.tmp', '.log', '.dmp'])
    return walkFiles(os.tmpdir(), (file, stat) => extensions.has(path.extname(file).toLowerCase()) && stat.mtimeMs < cutoff)
  }
  return []
}

async function totalSize(files: string[]): Promise<number> {
  let size = 0
  for (const file of files) {
    try {
      size += (await fs.stat(file)).size
    } catch {
      // Ignora arquivos que desapareceram após a varredura.
    }
  }
  return size
}

async function run(file: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(file, args, { windowsHide: true, timeout: 12_000 })
  return stdout.trim()
}

async function queryRegistry(key: string, name: string): Promise<string | null> {
  try {
    const output = await run('reg.exe', ['query', key, '/v', name])
    const match = output.match(/REG_DWORD\s+(0x[0-9a-f]+)/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

async function setRegistry(manifest: BackupManifest, key: string, name: string, value: number): Promise<void> {
  manifest.registry.push({ key, name, previous: await queryRegistry(key, name), type: 'REG_DWORD' })
  await run('reg.exe', ['add', key, '/v', name, '/t', 'REG_DWORD', '/d', String(value), '/f'])
}

async function moveToBackup(files: string[], manifest: BackupManifest): Promise<number> {
  let moved = 0
  for (const original of files) {
    const root = path.parse(original).root
    const relative = path.relative(root, original).replaceAll(':', '_')
    const backup = path.join(dataRoot(), 'backups', manifest.id, 'files', relative)
    try {
      await fs.mkdir(path.dirname(backup), { recursive: true })
      try {
        await fs.rename(original, backup)
      } catch {
        await fs.copyFile(original, backup)
        await fs.unlink(original)
      }
      manifest.files.push({ original, backup })
      moved += 1
    } catch {
      // Arquivos bloqueados são deixados no lugar.
    }
  }
  return moved
}

async function persistManifest(manifest: BackupManifest): Promise<void> {
  const dir = path.join(dataRoot(), 'backups', manifest.id)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await fs.writeFile(path.join(dataRoot(), 'latest-backup.txt'), manifest.id)
}

async function audit(event: object): Promise<void> {
  await fs.mkdir(dataRoot(), { recursive: true })
  await fs.appendFile(path.join(dataRoot(), 'audit.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
}

export async function scan(profile: OptimizationProfile): Promise<ScanResult> {
  const ids = PROFILE_ACTIONS[profile]
  const actions: OptimizationAction[] = []
  let reclaimableBytes = 0
  for (const id of ids) {
    const action = { ...ACTIONS[id] }
    if (['fivem-cache', 'fivem-crashes', 'temp-old'].includes(id)) {
      const files = await candidateFiles(id)
      action.estimatedBytes = await totalSize(files)
      reclaimableBytes += action.estimatedBytes
    }
    actions.push(action)
  }

  const warnings = [
    'Feche o FiveM antes de aplicar limpezas.',
    'Resultados de FPS e ping dependem do hardware, servidor e rota; o aplicativo não inventa ganhos.'
  ]
  if (process.platform !== 'win32') warnings.push('As ações reais só são executadas no Windows 10/11.')
  await audit({ type: 'scan', profile, reclaimableBytes })
  return { actions, reclaimableBytes, warnings, scannedAt: new Date().toISOString() }
}

export async function apply(profile: OptimizationProfile, requestedIds: string[]): Promise<ApplyResult> {
  const allowed = new Set(PROFILE_ACTIONS[profile])
  const ids = [...new Set(requestedIds)].filter((id) => allowed.has(id))
  const manifest: BackupManifest = {
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    createdAt: new Date().toISOString(),
    files: [],
    registry: []
  }
  const results: ActionResult[] = []

  if (process.platform !== 'win32') {
    return {
      backupId: null,
      results: ids.map((id) => ({ id, title: ACTIONS[id].title, status: 'skipped', message: 'Disponível somente no Windows 10/11' })),
      appliedAt: new Date().toISOString()
    }
  }

  for (const id of ids) {
    const action = ACTIONS[id]
    try {
      if (['fivem-cache', 'fivem-crashes', 'temp-old'].includes(id)) {
        const files = await candidateFiles(id)
        const moved = await moveToBackup(files, manifest)
        results.push({ id, title: action.title, status: moved ? 'success' : 'skipped', message: moved ? `${moved} arquivo(s) movido(s) para a quarentena` : 'Nada seguro para limpar' })
      } else if (id === 'game-mode') {
        await setRegistry(manifest, 'HKCU\\Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 1)
        results.push({ id, title: action.title, status: 'success', message: 'Modo de Jogo ativado' })
      } else if (id === 'game-dvr') {
        await setRegistry(manifest, 'HKCU\\System\\GameConfigStore', 'GameDVR_Enabled', 0)
        results.push({ id, title: action.title, status: 'success', message: 'Gravação em segundo plano desativada' })
      } else if (id === 'dns-flush') {
        await run('ipconfig.exe', ['/flushdns'])
        results.push({ id, title: action.title, status: 'success', message: 'Cache DNS renovado' })
      } else if (id === 'fivem-priority') {
        const script = "Get-Process -Name FiveM* -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = 'High' }; if (Get-Process -Name FiveM* -ErrorAction SilentlyContinue) { 'ok' } else { 'not-running' }"
        const output = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
        results.push({ id, title: action.title, status: output.includes('ok') ? 'success' : 'skipped', message: output.includes('ok') ? 'Prioridade Alta aplicada nesta sessão' : 'FiveM não está aberto' })
      } else if (id === 'power-high') {
        const active = await run('powercfg.exe', ['/getactivescheme'])
        manifest.previousPowerScheme = active.match(/[0-9a-f-]{36}/i)?.[0] || null
        await run('powercfg.exe', ['/setactive', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'])
        results.push({ id, title: action.title, status: 'success', message: 'Plano Alto Desempenho ativado' })
      }
    } catch (error) {
      results.push({ id, title: action.title, status: 'failed', message: error instanceof Error ? error.message : 'Falha inesperada' })
    }
  }

  const hasBackup = manifest.files.length > 0 || manifest.registry.length > 0 || Boolean(manifest.previousPowerScheme)
  if (hasBackup) await persistManifest(manifest)
  await audit({ type: 'apply', profile, backupId: hasBackup ? manifest.id : null, results })
  return { backupId: hasBackup ? manifest.id : null, results, appliedAt: new Date().toISOString() }
}

export async function restoreLatest(): Promise<RestoreResult> {
  const warnings: string[] = []
  let backupId: string
  try {
    backupId = (await fs.readFile(path.join(dataRoot(), 'latest-backup.txt'), 'utf8')).trim()
  } catch {
    return { backupId: null, restoredFiles: 0, restoredSettings: 0, warnings: ['Nenhum backup disponível.'] }
  }

  const manifest = JSON.parse(
    await fs.readFile(path.join(dataRoot(), 'backups', backupId, 'manifest.json'), 'utf8')
  ) as BackupManifest
  let restoredFiles = 0
  let restoredSettings = 0

  for (const item of [...manifest.files].reverse()) {
    try {
      if (await exists(item.original)) {
        warnings.push(`Mantido o arquivo atual: ${item.original}`)
        continue
      }
      await fs.mkdir(path.dirname(item.original), { recursive: true })
      await fs.rename(item.backup, item.original)
      restoredFiles += 1
    } catch {
      warnings.push(`Não foi possível restaurar: ${item.original}`)
    }
  }

  for (const item of [...manifest.registry].reverse()) {
    try {
      if (item.previous === null) {
        await run('reg.exe', ['delete', item.key, '/v', item.name, '/f'])
      } else {
        await run('reg.exe', ['add', item.key, '/v', item.name, '/t', item.type, '/d', String(parseInt(item.previous, 16)), '/f'])
      }
      restoredSettings += 1
    } catch {
      warnings.push(`Não foi possível restaurar ${item.name}.`)
    }
  }

  if (manifest.previousPowerScheme) {
    try {
      await run('powercfg.exe', ['/setactive', manifest.previousPowerScheme])
      restoredSettings += 1
    } catch {
      warnings.push('Não foi possível restaurar o plano de energia anterior.')
    }
  }

  await audit({ type: 'restore', backupId, restoredFiles, restoredSettings, warnings })
  return { backupId, restoredFiles, restoredSettings, warnings }
}
