const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

const projectRoot = path.resolve(__dirname, '..')

const snapshot = {
  platform: 'win32',
  windowsVersion: 'Windows 11 Pro',
  cpuModel: 'AMD Ryzen 5 5600',
  cpuUsage: 12,
  cpuCores: 12,
  memoryUsed: 6.7 * 1024 ** 3,
  memoryTotal: 16 * 1024 ** 3,
  memoryPercent: 42,
  gpuModel: 'NVIDIA GeForce RTX 4060',
  diskFree: 684 * 1024 ** 3,
  diskTotal: 1024 * 1024 ** 3,
  diskPercent: 33,
  uptimeSeconds: 5040,
  fiveMRunning: false,
  collectedAt: new Date().toISOString()
}

app.whenReady().then(async () => {
  ipcMain.handle('system:snapshot', async () => snapshot)
  ipcMain.handle('optimizer:scan', async () => ({
    actions: [],
    reclaimableBytes: 0,
    warnings: [],
    scannedAt: new Date().toISOString()
  }))
  ipcMain.handle('optimizer:apply', async () => ({
    backupId: null,
    results: [],
    appliedAt: new Date().toISOString()
  }))
  ipcMain.handle('optimizer:restore-latest', async () => ({
    backupId: null,
    restoredFiles: 0,
    restoredSettings: 0,
    warnings: []
  }))
  ipcMain.handle('license:status', async () => ({
    state: 'development',
    message: 'Modo de desenvolvimento ativo'
  }))
  ipcMain.handle('license:activate', async () => ({
    state: 'development',
    message: 'Modo de desenvolvimento ativo'
  }))
  ipcMain.handle('app:open-data-folder', async () => undefined)

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: '#05080d',
    webPreferences: {
      preload: path.join(projectRoot, 'out/preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  await win.loadFile(path.join(projectRoot, 'out/renderer/index.html'))
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const image = await win.webContents.capturePage()
  const outputDir = path.join(projectRoot, 'preview')
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, 'andrade-boost-v0.3.png'), image.toPNG())
  app.quit()
})
