import os from 'node:os'
import { createHash } from 'node:crypto'
import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { LicenseStatus } from '../shared/contracts'

interface StoredLicense {
  key: string
  token?: string
  plan?: string
  expiresAt?: string | null
  state: LicenseStatus['state']
}

function licenseFile(): string {
  return path.join(app.getPath('userData'), 'license.json')
}

function deviceId(): string {
  return createHash('sha256')
    .update(`${os.hostname()}|${os.platform()}|${os.arch()}|andrade-boost-v1`)
    .digest('hex')
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (process.env.AB_REQUIRE_LICENSE !== 'true') {
    return { state: 'development', message: 'Modo de desenvolvimento ativo' }
  }

  try {
    const stored = JSON.parse(await fs.readFile(licenseFile(), 'utf8')) as StoredLicense
    if (stored.expiresAt && new Date(stored.expiresAt).getTime() < Date.now()) {
      return { state: 'expired', plan: stored.plan, expiresAt: stored.expiresAt, message: 'Licença expirada' }
    }
    return {
      state: stored.state,
      plan: stored.plan,
      expiresAt: stored.expiresAt,
      message: stored.state === 'active' ? 'Licença ativa' : 'Licença inválida'
    }
  } catch {
    return { state: 'inactive', message: 'Insira sua chave de licença' }
  }
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  const normalized = key.trim().toUpperCase()
  if (!normalized) return { state: 'inactive', message: 'Digite uma chave válida' }

  const apiUrl = process.env.ANDRADE_BOOST_API_URL
  if (!apiUrl) {
    return { state: 'inactive', message: 'Servidor de licenças ainda não configurado' }
  }

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/licenses/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: normalized, deviceId: deviceId(), appVersion: app.getVersion() })
    })
    const data = (await response.json()) as StoredLicense & { message?: string }
    if (!response.ok || data.state !== 'active') {
      return { state: data.state || 'inactive', message: data.message || 'Chave recusada pelo servidor' }
    }
    await fs.mkdir(path.dirname(licenseFile()), { recursive: true })
    await fs.writeFile(licenseFile(), JSON.stringify({ ...data, key: normalized }, null, 2), { mode: 0o600 })
    return {
      state: 'active',
      plan: data.plan,
      expiresAt: data.expiresAt,
      message: data.message || 'Licença ativada'
    }
  } catch {
    return { state: 'inactive', message: 'Não foi possível acessar o servidor de licenças' }
  }
}
