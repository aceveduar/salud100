import { Clock3, Plus } from 'lucide-react'
import { localDateInput } from '../lib/data'

// Date/time toggle and optional note shared by every capture form.
export function TimeAndNote({editing,customTime,setCustomTime,date,setDate,note,setNote,busy}:{editing:boolean;customTime:boolean;setCustomTime:(v:boolean)=>void;date:string;setDate:(v:string)=>void;note:string;setNote:(v:string)=>void;busy:boolean}) {
  return <>
    <div className="time-row"><Clock3 size={17}/><div><strong>{customTime?'Fecha y hora personalizadas':'Fecha y hora automáticas'}</strong><span>{customTime?'La medición se guardará con la fecha elegida.':'Se registran al guardar tu medición.'}</span></div><button type="button" disabled={busy} onClick={()=>{setCustomTime(editing?true:!customTime);if(!customTime)setDate(localDateInput())}}>{customTime&&!editing?'Usar ahora':'Cambiar'}</button></div>
    {customTime&&<label className="date-field">Fecha y hora de la medición<input aria-label="Fecha y hora de la medición" type="datetime-local" required value={date} max={localDateInput()} onChange={e=>setDate(e.target.value)} disabled={busy}/></label>}
    <details className="note-details" open={note?true:undefined}><summary><Plus size={15}/>Añadir una nota <span>(opcional)</span></summary><textarea aria-label="Nota" placeholder="Algo que quieras recordar…" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></details>
  </>
}

export function measuredAt(customTime:boolean,date:string) {
  const measured=customTime?new Date(date):new Date()
  return Number.isFinite(measured.getTime())&&measured.getTime()<=Date.now()+60000?measured:null
}
