import { useEffect, useRef, useState } from 'react'
import { Activity, Coffee, Droplet, Pencil, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { momentLabel, readingValue, type Reading } from '../lib/data'
import { bodyFields, bodyValue, isBody, type Body } from '../lib/body'

export type Entry = Reading | Body
export const dateLabel = (date: string) => new Date(date).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})
export const timeLabel = (date: string) => new Date(date).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})
export const byDate = (a: Entry, b: Entry) => Date.parse(b.measured_at)-Date.parse(a.measured_at)
export const withinDays = (e: Entry, days: number) => Date.parse(e.measured_at)>=Date.now()-days*86400000
export const entryName = (e: Entry) => isBody(e) ? `pesaje de ${e.weight_kg} kg` : `medición de ${readingValue(e)}`

const Chip = ({label,value}:{label:string;value:string}) => <span className="chip">{label} <b>{value}</b></span>

// A table on wide screens; on phones CSS turns each row into a card (date + actions, value, detail chips, note).
export function EntryList({entries,loading,onEdit,onDelete,readOnly=false}:{entries:Entry[];loading:boolean;onEdit?:(e:Entry)=>void;onDelete?:(e:Entry)=>void;readOnly?:boolean}) {
  if(loading)return <div className="empty-state">Cargando las mediciones…</div>
  if(!entries.length)return <div className="empty-state"><span className="empty-icon"><Droplet size={26}/></span><strong>Aquí se escribe tu historia</strong><p>Las mediciones aparecerán aquí cuando se guarden.<br/>Si elegiste filtros, prueba con otro periodo.</p></div>
  return <div className="table-wrap entry-list"><table><thead><tr><th>FECHA Y HORA</th><th>MEDICIÓN</th><th>DETALLE</th><th>NOTA</th>{!readOnly&&<th><span className="sr-only">Acciones</span></th>}</tr></thead><tbody>{entries.map(r=><tr key={r.id}>
    <td className="cell-date"><strong>{dateLabel(r.measured_at)}</strong><small>{timeLabel(r.measured_at)}</small></td>
    {isBody(r)
      ?<><td className="cell-value"><span className="table-value">{r.weight_kg}</span><span className="table-unit">kg</span><small>Peso y composición</small></td><td className="cell-detail">{bodyFields.slice(1).some(f=>r[f.key]!=null)?<span className="detail-chips">{bodyFields.slice(1).filter(f=>r[f.key]!=null).map(f=><Chip key={f.key} label={f.short} value={bodyValue(r[f.key],f.unit)}/>)}</span>:<span className="dash">—</span>}</td></>
      :<><td className="cell-value"><span className="table-value">{readingValue(r)}</span><span className="table-unit">{r.unit}</span><small>{r.unit==='mmHg'?'Presión arterial':'Glucosa'}</small></td><td className="cell-detail">{r.unit==='mmHg'?(r.pulse?<span className="detail-chips"><Chip label="Pulso" value={`${r.pulse} lpm`}/></span>:<span className="dash">—</span>):<span className={'reading-badge '+(r.moment==='fasting'?'fasting':'')}>{r.moment==='fasting'&&<Coffee size={13}/>} {momentLabel(r.moment)}</span>}</td></>}
    <td className={'note-cell'+(r.note?'':' empty')}>{r.note||'—'}</td>
    {!readOnly&&<td className="cell-actions"><div className="row-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${entryName(r)}`} onClick={()=>onEdit?.(r)}><Pencil size={16}/></Button><Button variant="ghost" size="icon" aria-label={`Eliminar ${entryName(r)}`} onClick={()=>onDelete?.(r)}><Trash2 size={16}/></Button></div></td>}
  </tr>)}</tbody></table></div>
}

export type Point = { id: string; value: number; lower?: number | null; measured_at: string }
// Draws in real pixels (viewBox = rendered width) so labels stay readable on phones.
export function Trend({points:raw,unit,decimals,lowerLabel='Diastólica',legend,band,guides=[]}:{points:Point[];unit:string;decimals:number;lowerLabel?:string;legend?:string;band?:[number,number]|null;guides?:number[]}) {
  const ref=useRef<HTMLDivElement>(null)
  const [width,setWidth]=useState(900)
  useEffect(()=>{const el=ref.current;if(!el)return;setWidth(el.clientWidth);const ro=new ResizeObserver(([e])=>setWidth(e.contentRect.width));ro.observe(el);return()=>ro.disconnect()},[raw.length>=2])
  if(raw.length<2)return <div className="chart-empty"><div className="chart-empty-lines"/><span className="empty-icon"><Activity size={25}/></span><strong>Un registro hoy, una historia mañana.</strong><p>Con al menos dos mediciones verás aquí tu recorrido.</p></div>
  const W=Math.max(280,width),left=46,right=W-14,top=22,bottom=168
  const sorted=[...raw].sort((a,b)=>Date.parse(a.measured_at)-Date.parse(b.measured_at))
  const paired=sorted.some(p=>p.lower!=null)
  const values=[...sorted.flatMap(p=>p.lower!=null?[p.value,p.lower]:[p.value]),...(band||[]),...guides]
  const lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.15,decimals?.5:5)
  const min=Math.max(0,lo-pad),max=hi+pad
  const y=(v:number)=>bottom-(v-min)/(max-min)*(bottom-top)
  const start=Date.parse(sorted[0].measured_at),end=Date.parse(sorted.at(-1)!.measured_at)
  const points=sorted.map(p=>({x:left+(Date.parse(p.measured_at)-start)/(end-start||1)*(right-left),y:y(p.value),p}))
  const lowerPoints=points.filter(q=>q.p.lower!=null).map(q=>({...q,y:y(q.p.lower!)}))
  const line=(ps:{x:number;y:number}[])=>ps.map((q,i)=>`${i?'L':'M'} ${q.x} ${q.y}`).join(' ')
  const path=line(points)
  return <div className="trend" ref={ref}>{(legend||paired||band||guides.length>0)&&<p className="pressure-legend">{legend||(paired?'Sistólica (verde) · Diastólica (azul, línea discontinua)':'')}{(band||guides.length>0)&&<span className="goal-legend">{legend||paired?' · ':''}Tu meta (franja o línea ámbar)</span>}</p>}
    <svg viewBox={`0 0 ${W} 200`} width="100%" role="img" aria-label={`Gráfica de ${raw.length} mediciones en ${unit}; valores disponibles en el historial`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#219782" stopOpacity=".15"/><stop offset="100%" stopColor="#219782" stopOpacity="0"/></linearGradient></defs>
      {band&&<rect x={left} width={right-left} y={y(band[1])} height={Math.max(1,y(band[0])-y(band[1]))} fill="#e9b949" opacity=".14"/>}
      {guides.map(g=><line key={g} x1={left} x2={right} y1={y(g)} y2={y(g)} stroke="#c9952b" strokeWidth="1.5" strokeDasharray="7 5"/>)}
      {[0,1,2].map(i=>{const v=max-i*(max-min)/2;return <g key={i}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#e9efed" strokeDasharray="4 5"/><text x="2" y={y(v)+4} fill="#6f7d77" fontSize="13">{v.toFixed(decimals)}</text></g>})}
      <path d={`${path} L ${points.at(-1)!.x} ${bottom} L ${left} ${bottom} Z`} fill="url(#chart-fill)"/><path d={path} fill="none" stroke="#168574" strokeWidth="3" strokeLinejoin="round"/>
      {points.map(q=><circle key={q.p.id} cx={q.x} cy={q.y} r="4.5" fill="#168574" stroke="white" strokeWidth="2"><title>{q.p.value} {unit} · {dateLabel(q.p.measured_at)} {timeLabel(q.p.measured_at)}</title></circle>)}
      {paired&&<><path d={line(lowerPoints)} fill="none" stroke="#416fa8" strokeWidth="3" strokeDasharray="6 4"/>{lowerPoints.map(q=><circle key={q.p.id} cx={q.x} cy={q.y} r="4" fill="#416fa8"><title>{lowerLabel}: {q.p.lower} {unit} · {dateLabel(q.p.measured_at)} {timeLabel(q.p.measured_at)}</title></circle>)}</>}
      <text x={left} y="194" fill="#6f7d77" fontSize="13">{dateLabel(sorted[0].measured_at)}</text><text x={right} y="194" textAnchor="end" fill="#6f7d77" fontSize="13">{dateLabel(sorted.at(-1)!.measured_at)}</text></svg></div>
}
