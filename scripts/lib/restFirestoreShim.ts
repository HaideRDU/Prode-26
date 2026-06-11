import type { Firestore } from 'firebase-admin/firestore'
import { decodeFirestoreDoc, restGetDoc } from './firestoreRest.ts'

type DocSnap = {
  exists: boolean
  id: string
  data: () => Record<string, unknown>
}

type QuerySnap = {
  empty: boolean
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
}

async function getAccessToken(): Promise<string> {
  const { readFileSync } = await import('node:fs')
  const { homedir } = await import('node:os')
  const { join } = await import('node:path')
  const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
  const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
  const cfg = JSON.parse(
    readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'),
  ) as { tokens?: { refresh_token?: string } }
  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: cfg.tokens!.refresh_token!,
      grant_type: 'refresh_token',
    }),
  })
  const { access_token } = (await tokRes.json()) as { access_token: string }
  return access_token
}

async function restQueryCollection(projectId: string, collectionPath: string): Promise<QuerySnap> {
  const access_token = await getAccessToken()
  const parts = collectionPath.split('/').filter(Boolean)
  const collectionId = parts[parts.length - 1]!
  const parentParts = parts.slice(0, -1)
  const parent =
    parentParts.length === 0
      ? `projects/${projectId}/databases/(default)/documents`
      : `projects/${projectId}/databases/(default)/documents/${parentParts.join('/')}`

  const res = await fetch(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId, allDescendants: parentParts.length === 0 }],
      },
    }),
  })
  if (!res.ok) throw new Error(`runQuery ${collectionPath}: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, unknown> }
  }>
  const docs = rows
    .filter((r) => r.document)
    .map((r) => {
      const decoded = decodeFirestoreDoc(r.document!)
      const id = decoded.id
      return {
        id,
        data: () => {
          const { id: _id, ...rest } = decoded
          return rest
        },
      }
    })
  return { empty: docs.length === 0, docs }
}

function makeCollectionRef(projectId: string, collectionPath: string) {
  return {
    doc(id: string) {
      const docPath = `${collectionPath}/${id}`
      return {
        async get(): Promise<DocSnap> {
          const data = await restGetDoc(projectId, docPath)
          if (!data) return { exists: false, id, data: () => ({}) }
          const { id: _id, ...rest } = data
          return { exists: true, id, data: () => rest }
        },
        collection(sub: string) {
          return makeCollectionRef(projectId, `${docPath}/${sub}`)
        },
      }
    },
    where(field: string, _op: string, value: unknown) {
      return {
        limit(_n: number) {
          return {
            async get(): Promise<QuerySnap> {
              const all = await restQueryCollection(projectId, collectionPath)
              const filtered = all.docs.filter((d) => d.data()[field] === value)
              return { empty: filtered.length === 0, docs: filtered }
            },
          }
        },
      }
    },
    async get(): Promise<QuerySnap> {
      return restQueryCollection(projectId, collectionPath)
    },
  }
}

/** Shim mínimo de Firestore (solo lectura) para scripts locales con `firebase login`. */
export function createRestFirestoreShim(projectId: string): Firestore {
  return {
    collection(path: string) {
      return makeCollectionRef(projectId, path)
    },
  } as unknown as Firestore
}
