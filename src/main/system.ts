import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SystemSnapshot } from '../shared/contracts'

const execFileAsync = promisify(execFile)

interface CpuTimes {
  idle: number
  total: number
}

let previousCpu = readCpuTimes()

function readCpuTimes(): CpuTimes {
  return os.cpus().reduce(
    (acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
      acc.idle += cpu.times.idle
      acc.total += total
      return acc
    },
    { idle: 0, total: 0 }
  )
}

function cpuPercent(): number {
  const current = readCpuTimes()
  const idleDelta = current.idle - previousCpu.idle
  const totalDelta = current.total - previousCpu.total
  previousCpu = current
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
}

async function powershell(script: string): Promise<string> {
  if (process.platform !== 'win32') return ''
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 8_000 }
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

function parseDisk(raw: string): { free: number; total: number } {
  const [free, used] = raw.split('|').map((value) => Number(value) || 0)
  return { free, total: free + used }
}

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const totalMemory = os.totalmem()
  const usedMemory = totalMemory - os.freemem()
  const [gpu, diskRaw, windowsVersion, fiveMRaw] = await Promise.all([
    powershell("(Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name)"),
    powershell("$d=Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':')); \"$($d.Free)|$($d.Used)\""),
    powershell("(Get-CimInstance Win32_OperatingSystem).Caption + ' ' + (Get-CimInstance Win32_OperatingSystem).Version"),
    powershell("if (Get-Process -Name FiveM* -ErrorAction SilentlyContinue) { 'true' } else { 'false' }")
  ])
  const disk = parseDisk(diskRaw)

  return {
    platform: process.platform,
    windowsVersion: windowsVersion || `${os.type()} ${os.release()}`,
    cpuModel: os.cpus()[0]?.model || 'CPU não identificada',
    cpuUsage: cpuPercent(),
    cpuCores: os.cpus().length,
    memoryUsed: usedMemory,
    memoryTotal: totalMemory,
    memoryPercent: Math.round((usedMemory / totalMemory) * 100),
    gpuModel: gpu || 'GPU será identificada no Windows',
    diskFree: disk.free,
    diskTotal: disk.total,
    diskPercent: disk.total ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0,
    uptimeSeconds: os.uptime(),
    fiveMRunning: fiveMRaw === 'true',
    collectedAt: new Date().toISOString()
  }
}
