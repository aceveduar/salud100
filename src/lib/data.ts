import { createClient } from '@supabase/supabase-js'
export type Unit = 'mg/dL' | 'mmol/L'
export type Reading = { id: string; value: number; unit: Unit | 'mmHg'; diastolic?: number | null; measured_at: string; fasting: boolean | null; note: string }
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
const storageKey = 'salud100.readings.v1'
export function readLocal(): Reading[] {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('No pudimos leer tus registros. No se han sobrescrito los datos guardados.') }
  if (!Array.isArray(parsed) || !parsed.every(r => r && typeof r.id === 'string' && typeof r.value === 'number' && Number.isFinite(r.value) && r.value > 0 && (['mg/dL','mmol/L'].includes(r.unit) && r.diastolic == null || r.unit === 'mmHg' && Number.isInteger(r.value) && Number.isInteger(r.diastolic) && r.diastolic > 0 && r.diastolic < r.value && r.value < 10000 && r.fasting === null) && Number.isFinite(Date.parse(r.measured_at)) && [true,false,null].includes(r.fasting) && typeof r.note === 'string')) throw new Error('No pudimos leer tus registros. No se han sobrescrito los datos guardados.')
  return parsed
}
export async function listReadings(): Promise<Reading[]> {
  if (!supabase) return readLocal()
  const result: Reading[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('readings').select('id,value,unit,diastolic,measured_at,fasting,note').order('measured_at',{ascending:false}).order('id').range(from,from+999)
    if(error) throw new Error('No pudimos cargar tus mediciones. Revisa tu conexión e intenta de nuevo.')
    result.push(...data as Reading[])
    if(data.length < 1000) return result
  }
}
export async function saveReading(reading: Reading) {
  if (!supabase) { const items = readLocal(); localStorage.setItem(storageKey, JSON.stringify([reading,...items.filter(r => r.id !== reading.id)])); return }
  const {data:{user}} = await supabase.auth.getUser()
  if(!user) throw new Error('Inicia sesión para guardar tu medición.')
  const {error} = await supabase.from('readings').upsert({...reading,user_id:user.id})
  if(error) throw new Error('No se pudo guardar. Conservamos lo que escribiste; revisa tu conexión y vuelve a intentar.')
}
export async function deleteReading(id: string) {
  if(!supabase) { localStorage.setItem(storageKey,JSON.stringify(readLocal().filter(r=>r.id!==id))); return }
  const {error} = await supabase.from('readings').delete().eq('id',id)
  if(error) throw new Error('No se pudo eliminar. Intenta de nuevo.')
}
export function localDateInput(date = new Date()) { return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16) }
export function fastingLabel(value: boolean | null) { return value === true ? 'En ayunas' : value === false ? 'Sin ayuno' : 'Sin indicar' }
export function exportCsv(readings: Reading[]) {
  const escape = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"','""') + '"'
  const rows = [['Fecha y hora local','Fecha y hora UTC','Tipo','Glucosa','Sistólica','Diastólica','Unidad','Ayuno','Nota'],...readings.map(r=>[new Date(r.measured_at).toLocaleString('es-MX'),r.measured_at,r.unit==='mmHg'?'Presión arterial':'Glucosa',r.unit==='mmHg'?'':String(r.value),r.unit==='mmHg'?String(r.value):'',r.unit==='mmHg'?String(r.diastolic):'',r.unit,r.unit==='mmHg'?'':fastingLabel(r.fasting),r.note])]
  const blob = new Blob(['\uFEFF'+rows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`salud100-${localDateInput().slice(0,10)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export function readingValue(reading: Reading) { return reading.unit === 'mmHg' ? `${reading.value}/${reading.diastolic}` : String(reading.value) }
