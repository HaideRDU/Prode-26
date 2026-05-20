import { API_SPORTS_BASE } from './constants'
import type { ApiSportsListResponse } from './types'

export class ApiSportsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiSportsError'
  }
}

const MAX_RETRIES = 4
const RETRY_BASE_MS = 3000

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function apiSportsGet<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ApiSportsListResponse<T>> {
  const url = new URL(path.startsWith('http') ? path : `${API_SPORTS_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }

  let lastErr: ApiSportsError | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * attempt)

    const res = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': apiKey,
      },
    })

    const body = await res.text().catch(() => '')

    if (!res.ok) {
      lastErr = new ApiSportsError(`API-Sports HTTP ${res.status}: ${body.slice(0, 200)}`, res.status)
      if (res.status === 429 && attempt < MAX_RETRIES - 1) continue
      throw lastErr
    }

    const json = JSON.parse(body) as ApiSportsListResponse<T>
    if (json.errors && (Array.isArray(json.errors) ? json.errors.length > 0 : Object.keys(json.errors).length > 0)) {
      const detail = Array.isArray(json.errors) ? json.errors.join(', ') : JSON.stringify(json.errors)
      const rateLimited =
        typeof json.errors === 'object' &&
        !Array.isArray(json.errors) &&
        'rateLimit' in json.errors
      lastErr = new ApiSportsError(`API-Sports error: ${detail}`)
      if (rateLimited && attempt < MAX_RETRIES - 1) continue
      throw lastErr
    }
    return json
  }
  throw lastErr ?? new ApiSportsError('API-Sports request failed')
}

export async function fetchAllPages<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T[]> {
  const out: T[] = []
  let page = 1
  let total = 1
  while (page <= total) {
    const json = await apiSportsGet<T>(apiKey, path, { ...params, page })
    out.push(...(json.response ?? []))
    total = json.paging?.total ?? 1
    page += 1
  }
  return out
}
