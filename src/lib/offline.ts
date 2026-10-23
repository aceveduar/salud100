import { supabase, type Reading } from './data'
import type { Body, Profile } from './body'

// Account mode: writes made without connection wait here and upload when it returns.
type Op = { table: 'readings' | 'body_measurements'; action: 'save' | 'delete'; id: string; user_id: string; row?: Reading | Body }
type Cache = { readings: Reading[]; body: Body[]; profile: Profile }
const queueKey = 'salud100.pending.v1'
const cacheKey = (userId: string) => `salud100.cache.${userId}`
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback } }
export const isNetworkError = (error: { code?: string; message?: string } | null) => !!error && !error.code && /fetch|network|load failed/i.test(error.message || '')
export const pendingOps = (userId?: string) => read<Op[]>(queueKey, []).filter(op => !userId || op.user_id === userId)
export async function currentUserId() { return (await supabase!.auth.getSession()).data.session?.user.id }

export function enqueue(op: Op) {
  // A later write to the same record replaces earlier ones; a delete of a never-uploaded record just cancels it.
  const others = read<Op[]>(queueKey, []).filter(o => o.id !== op.id)
  localStorage.setItem(queueKey, JSON.stringify([...others, op]))
}

// Returns true when the write was queued instead of reaching the server.
export async function write(table: Op['table'], action: Op['action'], id: string, row?: Reading | Body) {
  const userId = await currentUserId()
  if (!userId) throw new Error('Inicia sesión para guardar tu medición.')
  const op: Op = { table, action, id, user_id: userId, row }
  if (!navigator.onLine) { enqueue(op); return true }
  const { error } = action === 'save' ? await supabase!.from(table).upsert({ ...row, user_id: userId }) : await supabase!.from(table).delete().eq('id', id)
  if (isNetworkError(error)) { enqueue(op); return true }
  if (error) throw new Error(action === 'save' ? 'No se pudo guardar. Conservamos lo que escribiste; revisa los datos y vuelve a intentar.' : 'No se pudo eliminar. Intenta de nuevo.')
  localStorage.setItem(queueKey, JSON.stringify(read<Op[]>(queueKey, []).filter(o => o.id !== id)))
  return false
}

export async function flush(userId: string) {
  for (const op of pendingOps(userId)) {
    const query = op.action === 'save' ? supabase!.from(op.table).upsert({ ...op.row, user_id: op.user_id }) : supabase!.from(op.table).delete().eq('id', op.id)
    const { error } = await query
    if (error && isNetworkError(error)) break
    // Rejected rows (validation or permissions) are dropped so they don't block the rest of the queue.
    const done = JSON.stringify(op)
    localStorage.setItem(queueKey, JSON.stringify(read<Op[]>(queueKey, []).filter(o => JSON.stringify(o) !== done)))
  }
  return pendingOps(userId).length
}

export function overlay<T extends { id: string }>(items: T[], table: Op['table'], userId: string) {
  let result = items
  for (const op of pendingOps(userId).filter(o => o.table === table)) result = op.action === 'save' ? [op.row as unknown as T, ...result.filter(i => i.id !== op.id)] : result.filter(i => i.id !== op.id)
  return result
}

export const saveCache = (userId: string, data: Cache) => { try { localStorage.setItem(cacheKey(userId), JSON.stringify(data)) } catch { /* cache is best effort */ } }
export const loadCache = (userId: string) => read<Cache | null>(cacheKey(userId), null)
export const clearCache = (userId: string) => localStorage.removeItem(cacheKey(userId))
