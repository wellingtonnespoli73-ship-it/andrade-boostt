export type OptimizationProfile = 'safe' | 'balanced' | 'competitive' | 'quality'

export type RiskLevel = 'low' | 'medium'

export interface SystemSnapshot {
  platform: string
  windowsVersion: string
  cpuModel: string
  cpuUsage: number
  cpuCores: number
  memoryUsed: number
  memoryTotal: number
  memoryPercent: number
  gpuModel: string
  diskFree: number
  diskTotal: number
  diskPercent: number
  uptimeSeconds: number
  fiveMRunning: boolean
  collectedAt: string
}

export interface OptimizationAction {
  id: string
  title: string
  category: 'Windows' | 'FiveM' | 'Rede' | 'Latência' | 'Limpeza'
  description: string
  reversible: boolean
  requiresRestart: boolean
  risk: RiskLevel
  estimatedBytes?: number
}

export interface ScanResult {
  actions: OptimizationAction[]
  reclaimableBytes: number
  warnings: string[]
  scannedAt: string
}

export interface ActionResult {
  id: string
  title: string
  status: 'success' | 'skipped' | 'failed'
  message: string
}

export interface ApplyResult {
  backupId: string | null
  results: ActionResult[]
  appliedAt: string
}

export interface RestoreResult {
  backupId: string | null
  restoredFiles: number
  restoredSettings: number
  warnings: string[]
}

export interface LicenseStatus {
  state: 'development' | 'inactive' | 'active' | 'expired' | 'blocked'
  plan?: string
  expiresAt?: string | null
  message: string
}

export interface AndradeBoostApi {
  getSystemSnapshot(): Promise<SystemSnapshot>
  scan(profile: OptimizationProfile): Promise<ScanResult>
  apply(profile: OptimizationProfile, actionIds: string[]): Promise<ApplyResult>
  restoreLatest(): Promise<RestoreResult>
  getLicenseStatus(): Promise<LicenseStatus>
  activateLicense(key: string): Promise<LicenseStatus>
  openDataFolder(): Promise<void>
}
