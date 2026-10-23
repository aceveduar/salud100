import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck, Weight } from 'lucide-react'
import { Button } from './ui/button'
import { TimeAndNote, measuredAt } from './FormParts'
import { localDateInput, supabase } from '../lib/data'
import { bmiFrom, bodyFields, saveBody, type Body, type BodyField, type Profile } from '../lib/body'

const parse = (text: string) => text.trim() ? Number(text.replace(',', '.')) : null

export function BodyForm({profile,entry,existing=[],onSaved,disabled=false}:{profile:Profile;entry?:Body;existing?:Body[];onSaved:(b:Body,queued:boolean)=>void;disabled?:boolean}) {
  const initial=()=>Object.fromEntries(bodyFields.map(f=>[f.key,entry?.[f.key]==null?'':String(entry[f.key])])) as Record<BodyField,string>
  const [values,setValues]=useState(initial)
  const [note,setNote]=useState(entry?.note||'')
  const [customTime,setCustomTime]=useState(!!entry)
  const [date,setDate]=useState(localDateInput(entry?new Date(entry.measured_at):new Date()))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [duplicate,setDuplicate]=useState('')
  const weightRef=useRef<HTMLInputElement>(null)
  const inFlight=useRef(false)
  const id=(name:string)=>(entry?'edit-':'')+name
  const weight=parse(values.weight_kg)
  const computed=weight&&weight>0&&weight<500?bmiFrom(weight,profile.height_cm):null
  const scaleBmi=parse(values.bmi)
  async function submit(e:FormEvent) {
    e.preventDefault();if(inFlight.current)return;setError('')
    const parsed={} as Record<BodyField,number|null>
    for(const f of bodyFields){
      const v=parse(values[f.key])
      if(f.key==='weight_kg'&&v==null||v!=null&&!(Number.isFinite(v)&&v>0&&v<f.max)){setError(f.key==='weight_kg'?'Escribe tu peso en kg: un número mayor que 0 y menor que 500.':`${f.label}: escribe un número mayor que 0 y menor que ${f.max}, o déjalo vacío.`);if(f.key==='weight_kg')weightRef.current?.focus();return}
      parsed[f.key]=v
    }
    const measured=measuredAt(customTime,date)
    if(!measured){setError('Elige una fecha y hora válida que no esté en el futuro.');return}
    const same=existing.find(b=>b.id!==entry?.id&&b.weight_kg===parsed.weight_kg&&Math.abs(Date.parse(b.measured_at)-measured.getTime())<20*60000)
    if(same&&!duplicate){setDuplicate(`Ya hay un pesaje de ${same.weight_kg} kg a la misma hora. Revisa el historial o vuelve a pulsar para guardarlo de todos modos.`);return}
    const item:Body={...parsed,weight_kg:parsed.weight_kg!,bmi:parsed.bmi??bmiFrom(parsed.weight_kg!,profile.height_cm),id:entry?.id||crypto.randomUUID(),note:note.trim(),measured_at:measured.toISOString()}
    inFlight.current=true;setBusy(true)
    try{const queued=await saveBody(item);setDuplicate('');onSaved(item,queued);if(!entry){setValues(Object.fromEntries(bodyFields.map(f=>[f.key,''])) as Record<BodyField,string>);setNote('');setCustomTime(false);setDate(localDateInput())}}
    catch(e){setError(e instanceof Error?e.message:'No pudimos guardar. Revisa el espacio disponible en tu navegador.')}
    finally{setBusy(false);inFlight.current=false}
  }
  const set=(key:BodyField)=>(e:React.ChangeEvent<HTMLInputElement>)=>{setDuplicate('');setValues(v=>({...v,[key]:e.target.value}))}
  return <form onSubmit={submit} className="reading-form">
    <label className="field-label" htmlFor={id('weight')}>¿Cuánto marcó tu báscula?</label>
    <div className={'glucose-input '+(values.weight_kg?'has-value':'')}><Weight size={25}/><input ref={weightRef} id={id('weight')} type="text" inputMode="decimal" autoComplete="off" placeholder="00.0" value={values.weight_kg} onChange={set('weight_kg')} disabled={busy||disabled}/><span>kg</span></div>
    <div className="body-grid">{bodyFields.slice(1).map(f=><label key={f.key} className="body-field"><span>{f.label}</span><span className="body-input"><input aria-label={f.label} type="text" inputMode="decimal" autoComplete="off" placeholder="—" value={values[f.key]} onChange={set(f.key)} disabled={busy||disabled}/><small aria-hidden="true">{f.unit}</small></span></label>)}</div>
    <p className="input-hint body-hint">Copia los números tal como aparecen en tu báscula; solo el peso es obligatorio. Lo que la báscula llama “densidad ósea” es la masa ósea en kg.{computed!=null&&(scaleBmi==null?` Si dejas el IMC vacío, lo calculamos con tu estatura (${profile.height_cm} cm): ${computed}.`:Math.abs(scaleBmi-computed)>0.5?` Con tu estatura registrada (${profile.height_cm} cm) el IMC sería ${computed}; revisa la estatura configurada en la báscula o en Ajustes.`:'')}</p>
    <TimeAndNote editing={!!entry} customTime={customTime} setCustomTime={setCustomTime} date={date} setDate={setDate} note={note} setNote={setNote} busy={busy}/>
    {error&&<p className="form-error" role="alert">{error}</p>}{duplicate&&!error&&<p className="form-warning" role="alert">{duplicate}</p>}<Button type="submit" className="save-button" disabled={busy||disabled}>{busy?'Guardando…':duplicate?'Guardar de todos modos':entry?'Guardar cambios':'Guardar pesaje'}{!busy&&<ArrowRight size={19}/>}</Button><div className="save-caption"><ShieldCheck size={13}/>{supabase?'En tu cuenta personal':'Guardado en este dispositivo'}</div>
  </form>
}
