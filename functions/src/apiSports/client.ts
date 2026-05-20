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

  const res = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': apiKey,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiSportsError(`API-Sports HTTP ${res.status}: ${body.slice(0, 200)}`, res.status)
  }

  const json = (await res.json()) as ApiSportsListResponse<T>
  if (json.errors && (Array.isArray(json.errors) ? json.errors.length > 0 : Object.keys(json.errors).length > 0)) {
    const detail = Array.isArray(json.errors) ? json.errors.join(', ') : JSON.stringify(json.errors)
    throw new ApiSportsError(`API-Sports error: ${detail}`)
  }
  return json
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
