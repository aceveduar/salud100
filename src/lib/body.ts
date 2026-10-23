import { supabase } from './data'
import { write } from './offline'
export type BodyField = 'weight_kg' | 'bmi' | 'body_fat_pct' | 'water_pct' | 'muscle_pct' | 'bone_mass_kg'
export type Body = { id: string; measured_at: string; note: string } & { weight_kg: number } & Record<Exclude<BodyField,'weight_kg'>, number | null>
export type Goals = { glucose_min: number | null; glucose_max: number | null; systolic_max: number | null; diastolic_max: number | null; weight_goal_kg: number | null }
export type Profile = { display_name: string; birth_date: string | null; sex: 'F' | 'M' | null; height_cm: number | null } & Goals
// Same order the scale shows them, so values can be copied top to bottom.
export const bodyFields: { key: BodyField; label: string; short: string; unit: string; max: number }[] = [
  { key: 'weight_kg', label: 'Peso', short: 'Peso', unit: 'kg', max: 500 },
  { key: 'bmi', label: 'Índice de masa corporal (IMC)', short: 'IMC', unit: '', max: 100 },
  { key: 'body_fat_pct', label: 'Grasa corporal', short: 'Grasa', unit: '%', max: 100 },
  { key: 'water_pct', label: 'Agua', short: 'Agua', unit: '%', max: 100 },
  { key: 'muscle_pct', label: 'Músculo', short: 'Músculo', unit: '%', max: 100 },
  { key: 'bone_mass_kg', label: 'Masa ósea', short: 'Hueso', unit: 'kg', max: 20 },
]
export const emptyProfile: Profile = { display_name: '', birth_date: null, sex: null, height_cm: null, glucose_min: null, glucose_max: null, systolic_max: null, diastolic_max: null, weight_goal_kg: null }
const numericProfile = ['height_cm', 'glucose_min', 'glucose_max', 'systolic_max', 'diastolic_max', 'weight_goal_kg'] as const
const bodyKey = 'salud100.body.v1'
const profileKey = 'salud100.profile.v1'
const columns = 'id,measured_at,weight_kg,bmi,body_fat_pct,water_pct,muscle_pct,bone_mass_kg,note'
export const isBody = (entry: object): entry is Body => 'weight_kg' in entry
const inRange = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < max
export function readLocalBody(): Body[] {
  const raw = localStorage.getItem(bodyKey)
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('No pudimos leer tus pesajes. No se han sobrescrito los datos guardados.') }
  if (!Array.isArray(parsed) || !parsed.every(b => b && typeof b.id === 'string' && Number.isFinite(Date.parse(b.measured_at)) && typeof b.note === 'string' && bodyFields.every(f => f.key !== 'weight_kg' && b[f.key] === null || inRange(b[f.key], f.max)))) throw new Error('No pudimos leer tus pesajes. No se han sobrescrito los datos guardados.')
  return parsed
}
export async function listBody(userId?: string): Promise<Body[]> {
  if (!supabase) return readLocalBody()
  const result: Body[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('body_measurements').select(columns).eq('user_id',userId!).order('measured_at',{ascending:false}).order('id').range(from,from+999)
    if (error) throw new Error('No pudimos cargar tus pesajes. Si acabas de actualizar la app, aplica la migración 003 en Supabase.')
    result.push(...(data as Body[]).map(b => ({...b, ...Object.fromEntries(bodyFields.map(f => [f.key, b[f.key] == null ? null : Number(b[f.key])]))})))
    if (data.length < 1000) return result
  }
}
export async function saveBody(body: Body) {
  if (!supabase) { localStorage.setItem(bodyKey, JSON.stringify([body, ...readLocalBody().filter(b => b.id !== body.id)])); return false }
  return write('body_measurements', 'save', body.id, body)
}
export async function deleteBody(id: string) {
  if (!supabase) { localStorage.setItem(bodyKey, JSON.stringify(readLocalBody().filter(b => b.id !== id))); return false }
  return write('body_measurements', 'delete', id)
}
export async function getProfile(userId?: string): Promise<Profile> {
  if (!supabase) { try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem(profileKey) || '{}') } } catch { return emptyProfile } }
  const { data, error } = await supabase.from('profiles').select('display_name,birth_date,sex,'+numericProfile.join(',')).eq('user_id',userId!).maybeSingle()
  if (error) throw new Error('No pudimos cargar tus datos personales.')
  if (!data) return emptyProfile
  const row = data as unknown as Record<string, unknown>
  return { ...emptyProfile, ...row, ...Object.fromEntries(numericProfile.map(k => [k, row[k] == null ? null : Number(row[k])])) } as Profile
}
export async function saveProfile(profile: Profile) {
  if (!supabase) { localStorage.setItem(profileKey, JSON.stringify(profile)); return }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Inicia sesión para guardar tus datos.')
  const { error } = await supabase.from('profiles').upsert({ ...profile, user_id: user.id, updated_at: new Date().toISOString() })
  if (error) throw new Error('No se pudieron guardar tus datos. Revisa tu conexión y vuelve a intentar.')
}
export function ageFrom(birth: string | null, now = new Date()) {
  if (!birth) return null
  const [y, m, d] = birth.split('-').map(Number)
  return now.getFullYear() - y - (now.getMonth() + 1 < m || now.getMonth() + 1 === m && now.getDate() < d ? 1 : 0)
}
export const bmiFrom = (weight: number, heightCm: number | null) => heightCm ? Math.round(weight / (heightCm / 100) ** 2 * 10) / 10 : null
export const bodyValue = (value: number | null, unit: string) => value == null ? '—' : `${value}${unit ? (unit === '%' ? '' : ' ') + unit : ''}`

export type Shares = { viewers: string[]; owners: { id: string; name: string }[] }
// Owners grant read-only access to another account by email; viewers see who shared with them.
export async function listShares(myId: string, myEmail: string): Promise<Shares> {
  if (!supabase) return { viewers: [], owners: [] }
  const { data, error } = await supabase.from('shares').select('owner_id,viewer_email').order('created_at')
  if (error) throw new Error('No pudimos cargar con quién compartes tus registros.')
  const ownerIds = data.filter(s => s.owner_id !== myId && s.viewer_email === myEmail.toLowerCase()).map(s => s.owner_id as string)
  const names = new Map<string, string>()
  if (ownerIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('user_id,display_name').in('user_id', ownerIds)
    for (const p of profiles || []) names.set(p.user_id, p.display_name)
  }
  return { viewers: data.filter(s => s.owner_id === myId).map(s => s.viewer_email), owners: ownerIds.map(id => ({ id, name: names.get(id) || 'Familiar sin nombre' })) }
}
export async function addShare(email: string) {
  const { error } = await supabase!.from('shares').insert({ viewer_email: email.trim().toLowerCase() })
  if (error) throw new Error(error.code === '23505' ? 'Ya compartes tus registros con ese correo.' : 'No se pudo compartir. Revisa el correo y tu conexión.')
}
export async function removeShare(email: string) {
  const { error } = await supabase!.from('shares').delete().eq('viewer_email', email)
  if (error) throw new Error('No se pudo quitar el acceso. Intenta de nuevo.')
}
