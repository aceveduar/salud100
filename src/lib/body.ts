import { supabase } from './data'
export type BodyField = 'weight_kg' | 'bmi' | 'body_fat_pct' | 'water_pct' | 'muscle_pct' | 'bone_mass_kg'
export type Body = { id: string; measured_at: string; note: string } & { weight_kg: number } & Record<Exclude<BodyField,'weight_kg'>, number | null>
export type Profile = { display_name: string; birth_date: string | null; sex: 'F' | 'M' | null; height_cm: number | null }
// Same order the scale shows them, so values can be copied top to bottom.
export const bodyFields: { key: BodyField; label: string; short: string; unit: string; max: number }[] = [
  { key: 'weight_kg', label: 'Peso', short: 'Peso', unit: 'kg', max: 500 },
  { key: 'bmi', label: 'Índice de masa corporal (IMC)', short: 'IMC', unit: '', max: 100 },
  { key: 'body_fat_pct', label: 'Grasa corporal', short: 'Grasa', unit: '%', max: 100 },
  { key: 'water_pct', label: 'Agua', short: 'Agua', unit: '%', max: 100 },
  { key: 'muscle_pct', label: 'Músculo', short: 'Músculo', unit: '%', max: 100 },
  { key: 'bone_mass_kg', label: 'Masa ósea', short: 'Hueso', unit: 'kg', max: 20 },
]
export const emptyProfile: Profile = { display_name: '', birth_date: null, sex: null, height_cm: null }
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
export async function listBody(): Promise<Body[]> {
  if (!supabase) return readLocalBody()
  const result: Body[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('body_measurements').select(columns).order('measured_at',{ascending:false}).order('id').range(from,from+999)
    if (error) throw new Error('No pudimos cargar tus pesajes. Si acabas de actualizar la app, aplica la migración 003 en Supabase.')
    result.push(...(data as Body[]).map(b => ({...b, ...Object.fromEntries(bodyFields.map(f => [f.key, b[f.key] == null ? null : Number(b[f.key])]))})))
    if (data.length < 1000) return result
  }
}
export async function saveBody(body: Body) {
  if (!supabase) { localStorage.setItem(bodyKey, JSON.stringify([body, ...readLocalBody().filter(b => b.id !== body.id)])); return }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Inicia sesión para guardar tu pesaje.')
  const { error } = await supabase.from('body_measurements').upsert({ ...body, user_id: user.id })
  if (error) throw new Error('No se pudo guardar. Conservamos lo que escribiste; revisa tu conexión y vuelve a intentar.')
}
export async function deleteBody(id: string) {
  if (!supabase) { localStorage.setItem(bodyKey, JSON.stringify(readLocalBody().filter(b => b.id !== id))); return }
  const { error } = await supabase.from('body_measurements').delete().eq('id', id)
  if (error) throw new Error('No se pudo eliminar. Intenta de nuevo.')
}
export async function getProfile(): Promise<Profile> {
  if (!supabase) { try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem(profileKey) || '{}') } } catch { return emptyProfile } }
  const { data, error } = await supabase.from('profiles').select('display_name,birth_date,sex,height_cm').maybeSingle()
  if (error) throw new Error('No pudimos cargar tus datos personales.')
  return data ? { ...data, height_cm: data.height_cm == null ? null : Number(data.height_cm) } as Profile : emptyProfile
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
export const bodyDetail = (b: Body) => bodyFields.slice(1).filter(f => b[f.key] != null).map(f => `${f.short} ${bodyValue(b[f.key], f.unit)}`).join(' · ')
