import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { getSystemSnapshot } from './system'
import { apply, restoreLatest, scan } from './optimizer'
import { activateLicense, getLicenseStatus } from './license'
import type { OptimizationProfile } from '../shared/contracts'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1060,
    minHeight: 700,
    backgroundColor: '#05080d',
    title: 'Andrade Boost',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('system:snapshot', getSystemSnapshot)
  ipcMain.handle('optimizer:scan', (_event, profile: OptimizationProfile) => scan(profile))
  ipcMain.handle(
    'optimizer:apply',
    (_event, payload: { profile: OptimizationProfile; actionIds: string[] }) => apply(payload.profile, payload.actionIds)
  )
  ipcMain.handle('optimizer:restore-latest', restoreLatest)
  ipcMain.handle('license:status', getLicenseStatus)
  ipcMain.handle('license:activate', (_event, key: string) => activateLicense(key))
  ipcMain.handle('app:open-data-folder', () => shell.openPath(app.getPath('userData')))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
