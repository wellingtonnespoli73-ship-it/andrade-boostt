import { contextBridge, ipcRenderer } from 'electron'
import type { AndradeBoostApi, OptimizationProfile } from '../shared/contracts'

const api: AndradeBoostApi = {
  getSystemSnapshot: () => ipcRenderer.invoke('system:snapshot'),
  scan: (profile: OptimizationProfile) => ipcRenderer.invoke('optimizer:scan', profile),
  apply: (profile: OptimizationProfile, actionIds: string[]) =>
    ipcRenderer.invoke('optimizer:apply', { profile, actionIds }),
  restoreLatest: () => ipcRenderer.invoke('optimizer:restore-latest'),
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder')
}

contextBridge.exposeInMainWorld('andradeBoost', api)
