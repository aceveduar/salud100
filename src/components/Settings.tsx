import { useState, type FormEvent } from 'react'
import { KeyRound, Target, Trash2, UserRound, Users } from 'lucide-react'
import { Button } from './ui/button'
import { localDateInput, supabase, toMgdl, toUnit, type Unit } from '../lib/data'
import { addShare, ageFrom, removeShare, saveProfile, type Profile, type Shares } from '../lib/body'

const parse = (text: string) => text.trim() ? Number(text.replace(',', '.')) : null
const text = (value: number | null) => value == null ? '' : String(value)

export function ProfileCard({profile,onSaved,disabled=false}:{profile:Profile;onSaved:(p:Profile)=>void;disabled?:boolean}) {
  const [name,setName]=useState(profile.display_name)
  const [birth,setBirth]=useState(profile.birth_date||'')
  const [sex,setSex]=useState(profile.sex||'')
  const [height,setHeight]=useState(text(profile.height_cm))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const today=localDateInput().slice(0,10)
  const age=ageFrom(birth||null)
  async function submit(e:FormEvent) {
    e.preventDefault();setError('')
    const h=parse(height)
    if(h!=null&&!(Number.isFinite(h)&&h>50&&h<260)){setError('Escribe tu estatura en centímetros, por ejemplo 152.');return}
    if(birth&&(birth<'1900-01-01'||birth>today)){setError('Elige una fecha de nacimiento válida.');return}
    const next:Profile={...profile,display_name:name.trim().slice(0,80),birth_date:birth||null,sex:sex==='F'||sex==='M'?sex:null,height_cm:h}
    setBusy(true)
    try{await saveProfile(next);onSaved(next)}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar tus datos.')}finally{setBusy(false)}
  }
  return <section className="card settings-card profile-card"><span className="heading-icon"><UserRound size={22}/></span><h2>Mis datos</h2><p>Los mismos datos que configuraste en tu báscula. Aquí sirven para mostrar tu edad y calcular tu IMC.</p>
    <form className="profile-form" onSubmit={submit}><fieldset disabled={busy||disabled}>
      <label className="wide">Nombre<input type="text" autoComplete="name" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Fecha de nacimiento<input type="date" min="1900-01-01" max={today} value={birth} onChange={e=>setBirth(e.target.value)}/>{age!=null&&age>=0&&<small>{age} años</small>}</label>
      <label>Sexo<select value={sex} onChange={e=>setSex(e.target.value)}><option value="">Sin indicar</option><option value="F">Mujer</option><option value="M">Hombre</option></select></label>
      <label>Estatura (cm)<input type="text" inputMode="decimal" autoComplete="off" placeholder="152" value={height} onChange={e=>setHeight(e.target.value)}/></label>
    </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<Button type="submit" variant="outline" disabled={busy||disabled}>{busy?'Guardando…':'Guardar mis datos'}</Button></form>
  </section>
}

export function GoalsCard({profile,unit,onSaved,disabled=false}:{profile:Profile;unit:Unit;onSaved:(p:Profile)=>void;disabled?:boolean}) {
  const [gmin,setGmin]=useState(profile.glucose_min==null?'':String(toUnit(profile.glucose_min,unit)))
  const [gmax,setGmax]=useState(profile.glucose_max==null?'':String(toUnit(profile.glucose_max,unit)))
  const [sys,setSys]=useState(text(profile.systolic_max))
  const [dia,setDia]=useState(text(profile.diastolic_max))
  const [weight,setWeight]=useState(text(profile.weight_goal_kg))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function submit(e:FormEvent) {
    e.preventDefault();setError('')
    const [a,b,s,d,w]=[gmin,gmax,sys,dia,weight].map(parse)
    const glucoseMax=unit==='mmol/L'?55:1000
    if([a,b].some(v=>v!=null&&!(Number.isFinite(v)&&v>0&&v<glucoseMax))||a!=null&&b!=null&&a>=b){setError(`Escribe la meta de glucosa en ${unit}; el mínimo debe ser menor que el máximo.`);return}
    if([s,d].some(v=>v!=null&&!(Number.isInteger(v)&&v>20&&v<300))||s!=null&&d!=null&&d>=s){setError('Escribe la presión como números enteros; la sistólica debe ser mayor que la diastólica.');return}
    if(w!=null&&!(Number.isFinite(w)&&w>0&&w<500)){setError('Escribe la meta de peso en kg.');return}
    const next:Profile={...profile,glucose_min:a==null?null:Math.round(toMgdl(a,unit)*10)/10,glucose_max:b==null?null:Math.round(toMgdl(b,unit)*10)/10,systolic_max:s,diastolic_max:d,weight_goal_kg:w}
    setBusy(true)
    try{await saveProfile(next);onSaved(next)}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar tus metas.')}finally{setBusy(false)}
  }
  const field=(label:string,value:string,set:(v:string)=>void,placeholder:string)=><label>{label}<input type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={value} onChange={e=>set(e.target.value)}/></label>
  return <section className="card settings-card"><span className="heading-icon"><Target size={22}/></span><h2>Mis metas</h2><p>Escribe solo las metas que te indicó tu médico. Aparecen en las gráficas como una franja o línea de referencia; la app no las interpreta.</p>
    <form className="profile-form" onSubmit={submit}><fieldset disabled={busy||disabled}>
      {field(`Glucosa mínima (${unit})`,gmin,setGmin,unit==='mmol/L'?'4.4':'80')}{field(`Glucosa máxima (${unit})`,gmax,setGmax,unit==='mmol/L'?'7.2':'130')}
      {field('Sistólica máxima (mmHg)',sys,setSys,'130')}{field('Diastólica máxima (mmHg)',dia,setDia,'80')}
      <label className="wide">Meta de peso (kg)<input type="text" inputMode="decimal" autoComplete="off" placeholder="—" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
    </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<Button type="submit" variant="outline" disabled={busy||disabled}>{busy?'Guardando…':'Guardar mis metas'}</Button></form>
  </section>
}

export function ShareCard({shares,onChanged}:{shares:Shares;onChanged:(message:string)=>void}) {
  const [email,setEmail]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function run(action:()=>Promise<void>,message:string) {setBusy(true);setError('');try{await action();onChanged(message);setEmail('')}catch(e){setError(e instanceof Error?e.message:'No se pudo completar.')}finally{setBusy(false)}}
  return <section className="card settings-card"><span className="heading-icon"><Users size={22}/></span><h2>Compartir con mi familia</h2><p>La persona entra con su propia cuenta y puede <strong>ver</strong> tus registros, sin cambiarlos. Puedes quitarle el acceso cuando quieras.</p>
    <form className="share-form" onSubmit={e=>{e.preventDefault();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))void run(()=>addShare(email),'Acceso compartido.');else setError('Escribe un correo válido.')}}><label>Correo de tu familiar<input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><Button type="submit" variant="outline" disabled={busy}>Compartir</Button></form>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {shares.viewers.length>0&&<ul className="share-list">{shares.viewers.map(v=><li key={v}><span>{v}</span><Button variant="ghost" size="icon" aria-label={`Quitar acceso a ${v}`} disabled={busy} onClick={()=>void run(()=>removeShare(v),'Acceso retirado.')}><Trash2 size={16}/></Button></li>)}</ul>}
  </section>
}

export function PasswordForm({onDone}:{onDone:()=>void}) {
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function submit(e:FormEvent) {
    e.preventDefault();setError('')
    if(password.length<8){setError('Usa al menos 8 caracteres.');return}
    if(password!==confirm){setError('Las contraseñas no coinciden.');return}
    setBusy(true)
    try{const {error}=await supabase!.auth.updateUser({password});if(error)setError(error.code==='same_password'?'Elige una contraseña distinta a la actual.':error.code==='weak_password'?'Esa contraseña es muy débil; usa una más larga.':'No se pudo cambiar la contraseña. Intenta de nuevo.');else{setPassword('');setConfirm('');onDone()}}
    catch{setError('No pudimos conectar. Revisa tu conexión.')}finally{setBusy(false)}
  }
  return <form className="profile-form" onSubmit={submit}><fieldset disabled={busy}>
    <label>Nueva contraseña<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Repite la contraseña<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
  </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<Button type="submit" variant="outline" disabled={busy}>{busy?'Guardando…':'Cambiar contraseña'}</Button></form>
}

export function PasswordCard({onDone}:{onDone:()=>void}) {
  return <section className="card settings-card"><span className="heading-icon"><KeyRound size={22}/></span><h2>Mi contraseña</h2><p>Cámbiala cuando quieras. La próxima vez entra con la nueva.</p><PasswordForm onDone={onDone}/></section>
}
