import { useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from './ui/button'
import { EntryList, Trend, byDate, dateLabel, withinDays, type Entry } from './Records'
import { moments, toMgdl, toUnit, type Reading, type Unit } from '../lib/data'
import { ageFrom, bodyFields, bodyValue, type Body, type Profile } from '../lib/body'

const stats = (values: number[]) => values.length ? { n: values.length, avg: values.reduce((a, b) => a + b, 0) / values.length, min: Math.min(...values), max: Math.max(...values) } : null
const fixed = (v: number, d: number) => v.toFixed(d)
// Share of readings within the goal the person entered; descriptive, not a clinical judgement.
const share = (hits: number, n: number) => n ? `${Math.round(hits / n * 100)}% (${hits} de ${n})` : '—'

export function Report({readings,body,profile,unit,onBack}:{readings:Reading[];body:Body[];profile:Profile;unit:Unit;onBack:()=>void}) {
  const [days,setDays]=useState(30)
  const inRange=(e:Entry)=>days===0||withinDays(e,days)
  const d=unit==='mmol/L'?1:0
  const glucose=readings.filter(r=>r.unit!=='mmHg'&&inRange(r)).map(r=>({...r,value:toUnit(toMgdl(r.value,r.unit),unit)}))
  const pressure=readings.filter(r=>r.unit==='mmHg'&&inRange(r))
  const weights=body.filter(inRange).sort(byDate)
  const entries=[...readings.filter(inRange),...weights].sort(byDate)
  const age=ageFrom(profile.birth_date)
  const glucoseBand:[number,number]|null=profile.glucose_min!=null&&profile.glucose_max!=null?[toUnit(profile.glucose_min,unit),toUnit(profile.glucose_max,unit)]:null
  const inBand=(vals:number[])=>glucoseBand?share(vals.filter(v=>v>=glucoseBand[0]&&v<=glucoseBand[1]).length,vals.length):''
  const glucoseRows=[{label:'Todas',vals:glucose.map(g=>g.value)},...moments.map(m=>({label:m.label,vals:glucose.filter(g=>g.moment===m.value).map(g=>g.value)}))].map(r=>({...r,s:stats(r.vals)})).filter(r=>r.s)
  const sys=stats(pressure.map(p=>p.value)),dia=stats(pressure.map(p=>p.diastolic!)),pulse=stats(pressure.flatMap(p=>p.pulse?[p.pulse]:[]))
  const pressureGoal=profile.systolic_max!=null||profile.diastolic_max!=null
  const pressureInGoal=share(pressure.filter(p=>(profile.systolic_max==null||p.value<=profile.systolic_max)&&(profile.diastolic_max==null||p.diastolic!<=profile.diastolic_max)).length,pressure.length)
  const first=entries.at(-1),last=entries[0]
  return <div className="report">
    <div className="page-heading no-print"><div><div className="eyebrow">PARA TU CONSULTA</div><h1>Resumen para el médico<span>.</span></h1><p>Elige el periodo y guárdalo como PDF o imprímelo.</p></div><div className="report-actions"><Button variant="ghost" onClick={onBack}><ArrowLeft size={17}/>Volver</Button><select aria-label="Periodo del resumen" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option><option value={0}>Todo el historial</option></select><Button onClick={()=>window.print()}><Printer size={17}/>Imprimir o guardar PDF</Button></div></div>
    <section className="card report-sheet">
      <header className="report-head"><div><h2>{profile.display_name||'Registro personal'}</h2><p>{[age!=null&&age>=0?`${age} años`:'',profile.sex==='F'?'Mujer':profile.sex==='M'?'Hombre':'',profile.height_cm?`${profile.height_cm} cm`:''].filter(Boolean).join(' · ')||'Sin datos personales'}</p></div><div><strong>{first&&last?`${dateLabel(first.measured_at)} – ${dateLabel(last.measured_at)}`:'Sin registros en el periodo'}</strong><p>Generado el {dateLabel(new Date().toISOString())} con Salud100. Valores tal como se registraron; sin interpretación médica.</p></div></header>
      <h3>Glucosa <small>{unit}{glucose.some(g=>g.unit!==unit)?' · valores convertidos':''}</small></h3>
      {glucoseRows.length?<><table className="report-table"><thead><tr><th>Momento</th><th>Mediciones</th><th>Promedio</th><th>Mínimo</th><th>Máximo</th>{glucoseBand&&<th>Dentro de la meta</th>}</tr></thead><tbody>{glucoseRows.map(r=><tr key={r.label}><td>{r.label}</td><td>{r.s!.n}</td><td>{fixed(r.s!.avg,d)}</td><td>{fixed(r.s!.min,d)}</td><td>{fixed(r.s!.max,d)}</td>{glucoseBand&&<td>{inBand(r.vals)}</td>}</tr>)}</tbody></table>{glucoseBand&&<p className="report-note">Meta indicada: {glucoseBand[0]}–{glucoseBand[1]} {unit}. “Dentro de la meta” cuenta las mediciones en ese rango.</p>}<Trend points={glucose.map(g=>({id:g.id,value:g.value,measured_at:g.measured_at}))} unit={unit} decimals={d} band={glucoseBand}/></>:<p className="report-note">Sin mediciones en el periodo.</p>}
      <h3>Presión arterial <small>mmHg</small></h3>
      {sys&&dia?<><table className="report-table"><thead><tr><th></th><th>Mediciones</th><th>Promedio</th><th>Mínimo</th><th>Máximo</th></tr></thead><tbody><tr><td>Sistólica</td><td>{sys.n}</td><td>{fixed(sys.avg,0)}</td><td>{sys.min}</td><td>{sys.max}</td></tr><tr><td>Diastólica</td><td>{dia.n}</td><td>{fixed(dia.avg,0)}</td><td>{dia.min}</td><td>{dia.max}</td></tr>{pulse&&<tr><td>Pulso (lpm)</td><td>{pulse.n}</td><td>{fixed(pulse.avg,0)}</td><td>{pulse.min}</td><td>{pulse.max}</td></tr>}</tbody></table>{pressureGoal&&<p className="report-note">Meta indicada: hasta {profile.systolic_max??'—'}/{profile.diastolic_max??'—'} mmHg · Dentro de la meta: <strong>{pressureInGoal}</strong></p>}<Trend points={pressure.map(p=>({id:p.id,value:p.value,lower:p.diastolic,measured_at:p.measured_at}))} unit="mmHg" decimals={0} guides={[profile.systolic_max,profile.diastolic_max].filter((v):v is number=>v!=null)}/></>:<p className="report-note">Sin mediciones en el periodo.</p>}
      <h3>Peso y composición</h3>
      {weights.length?<><table className="report-table"><thead><tr><th></th><th>Primero</th><th>Último</th><th>Cambio</th></tr></thead><tbody>{bodyFields.map(f=>{const vals=weights.filter(w=>w[f.key]!=null);if(!vals.length)return null;const a=vals.at(-1)![f.key]!,b=vals[0][f.key]!;const change=Math.round((b-a)*10)/10;return <tr key={f.key}><td>{f.label}</td><td>{bodyValue(a,f.unit)}</td><td>{bodyValue(b,f.unit)}</td><td>{vals.length<2?'—':`${change>0?'+':change<0?'−':''}${bodyValue(Math.abs(change)||0,f.unit)}`}</td></tr>})}</tbody></table>{profile.weight_goal_kg&&<p className="report-note">Meta de peso indicada: {profile.weight_goal_kg} kg</p>}<Trend points={weights.map(w=>({id:w.id,value:w.weight_kg,measured_at:w.measured_at}))} unit="kg" decimals={1} guides={profile.weight_goal_kg?[profile.weight_goal_kg]:[]}/></>:<p className="report-note">Sin pesajes en el periodo.</p>}
      <h3>Todos los registros <small>{entries.length}</small></h3>
      <EntryList entries={entries} loading={false} readOnly/>
    </section>
  </div>
}
