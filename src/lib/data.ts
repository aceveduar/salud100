import { createClient } from '@supabase/supabase-js'
import type { Body } from './body'
import { write } from './offline'
export type Unit = 'mg/dL' | 'mmol/L'
export type Moment = 'fasting' | 'before_meal' | 'after_meal' | 'bedtime' | 'other'
// `fasting` is kept in sync with `moment` for records written before moments existed.
export type Reading = { id: string; value: number; unit: Unit | 'mmHg'; diastolic?: number | null; pulse?: number | null; measured_at: string; moment: Moment | null; fasting: boolean | null; note: string }
export const moments: { value: Moment | null; label: string }[] = [
  { value: 'fasting', label: 'En ayunas' }, { value: 'before_meal', label: 'Antes de comer' }, { value: 'after_meal', label: '2 h después de comer' },
  { value: 'bedtime', label: 'Antes de dormir' }, { value: 'other', label: 'Otro momento' }, { value: null, label: 'Sin indicar' },
]
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
const storageKey = 'salud100.readings.v1'
const isMoment = (m: unknown) => m == null || moments.some(x => x.value === m)
const normalize = (r: Reading): Reading => ({ ...r, pulse: r.pulse ?? null, moment: r.unit === 'mmHg' ? null : r.moment ?? (r.fasting === true ? 'fasting' : r.fasting === false ? 'other' : null) })
export const fastingFrom = (moment: Moment | null) => moment == null ? null : moment === 'fasting'
export function readLocal(): Reading[] {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('No pudimos leer tus registros. No se han sobrescrito los datos guardados.') }
  if (!Array.isArray(parsed) || !parsed.every(r => r && typeof r.id === 'string' && typeof r.value === 'number' && Number.isFinite(r.value) && r.value > 0 && (['mg/dL','mmol/L'].includes(r.unit) && r.diastolic == null && r.pulse == null && isMoment(r.moment) || r.unit === 'mmHg' && Number.isInteger(r.value) && Number.isInteger(r.diastolic) && r.diastolic > 0 && r.diastolic < r.value && r.value < 10000 && r.fasting === null && (r.pulse == null || Number.isInteger(r.pulse) && r.pulse > 20 && r.pulse < 300)) && Number.isFinite(Date.parse(r.measured_at)) && [true,false,null].includes(r.fasting) && typeof r.note === 'string')) throw new Error('No pudimos leer tus registros. No se han sobrescrito los datos guardados.')
  return parsed.map(normalize)
}
// With Supabase, RLS also returns records shared with this account, so always filter by the person being viewed.
export async function listReadings(userId?: string): Promise<Reading[]> {
  if (!supabase) return readLocal()
  const result: Reading[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('readings').select('id,value,unit,diastolic,pulse,measured_at,moment,fasting,note').eq('user_id',userId!).order('measured_at',{ascending:false}).order('id').range(from,from+999)
    if(error) throw new Error('No pudimos cargar tus mediciones. Revisa tu conexión e intenta de nuevo.')
    result.push(...(data as Reading[]).map(normalize))
    if(data.length < 1000) return result
  }
}
export async function saveReading(reading: Reading) {
  if (!supabase) { const items = readLocal(); localStorage.setItem(storageKey, JSON.stringify([reading,...items.filter(r => r.id !== reading.id)])); return false }
  return write('readings', 'save', reading.id, reading)
}
export async function deleteReading(id: string) {
  if(!supabase) { localStorage.setItem(storageKey,JSON.stringify(readLocal().filter(r=>r.id!==id))); return false }
  return write('readings', 'delete', id)
}
export function localDateInput(date = new Date()) { return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16) }
export function momentLabel(value: Moment | null) { return moments.find(m => m.value === value)!.label }
export const toUnit = (mgdl: number, unit: Unit) => unit === 'mmol/L' ? Math.round(mgdl / 18.016 * 10) / 10 : Math.round(mgdl)
export const toMgdl = (value: number, unit: Reading['unit']) => unit === 'mmol/L' ? value * 18.016 : value
export function exportCsv(readings: Reading[], body: Body[] = []) {
  const escape = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"','""') + '"'
  const optional = (value: number | null | undefined) => value == null ? '' : String(value)
  const entries = [...readings, ...body].sort((a,b)=>Date.parse(b.measured_at)-Date.parse(a.measured_at))
  const rows = [['Fecha y hora local','Fecha y hora UTC','Tipo','Glucosa','Sistólica','Diastólica','Unidad','Pulso (lpm)','Momento','Peso (kg)','IMC','Grasa (%)','Agua (%)','Músculo (%)','Masa ósea (kg)','Nota'],...entries.map(r=>'weight_kg' in r
    ? [new Date(r.measured_at).toLocaleString('es-MX'),r.measured_at,'Peso y composición','','','','kg','','',String(r.weight_kg),optional(r.bmi),optional(r.body_fat_pct),optional(r.water_pct),optional(r.muscle_pct),optional(r.bone_mass_kg),r.note]
    : [new Date(r.measured_at).toLocaleString('es-MX'),r.measured_at,r.unit==='mmHg'?'Presión arterial':'Glucosa',r.unit==='mmHg'?'':String(r.value),r.unit==='mmHg'?String(r.value):'',r.unit==='mmHg'?String(r.diastolic):'',r.unit,optional(r.pulse),r.unit==='mmHg'?'':momentLabel(r.moment),'','','','','','',r.note])]
  const blob = new Blob(['﻿'+rows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`salud100-${localDateInput().slice(0,10)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export function readingValue(reading: Reading) { return reading.unit === 'mmHg' ? `${reading.value}/${reading.diastolic}` : String(reading.value) }
