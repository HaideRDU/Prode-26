import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import { isAllowedAmericasTimeZone } from './data/americasTimezones'

/** Guarda o actualiza el perfil público del usuario en Firestore (users/{uid}). */
export async function syncUserProfile(user: User): Promise<void> {
  if (!db) return
  await setDoc(
    doc(db, 'users', user.uid),
    {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function getStoredUsername(user: User): Promise<string | null> {
  if (!db) return null
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  if (!snapshot.exists()) return null
  const username = snapshot.data().username
  if (typeof username !== 'string') return null
  const cleanUsername = username.trim().toLowerCase()
  return cleanUsername ? cleanUsername : null
}

export async function saveUsername(user: User, username: string): Promise<void> {
  if (!db) return
  const normalized = username.trim().toLowerCase()
  await setDoc(
    doc(db, 'users', user.uid),
    {
      username: normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function getStoredTimeZone(user: User): Promise<string | null> {
  if (!db) return null
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  if (!snapshot.exists()) return null
  const timeZone = snapshot.data().timeZone
  if (typeof timeZone !== 'string') return null
  const clean = timeZone.trim()
  return clean && isAllowedAmericasTimeZone(clean) ? clean : null
}

export async function saveTimeZone(user: User, timeZone: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  const clean = timeZone.trim()
  if (!isAllowedAmericasTimeZone(clean)) {
    throw new Error('Zona horaria no válida.')
  }
  await setDoc(
    doc(db, 'users', user.uid),
    {
      timeZone: clean,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
