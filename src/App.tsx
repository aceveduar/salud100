import { AuthScreen } from './components/AuthScreen'
import { BodyForm } from './components/Body'
import { TimeAndNote, measuredAt } from './components/FormParts'
import { EntryList, Trend, byDate, dateLabel, timeLabel, withinDays, type Entry, type Point } from './components/Records'
import { Report } from './components/Report'
import { GoalsCard, PasswordCard, PasswordForm, ProfileCard, ShareCard } from './components/Settings'
import { authErrorMessage, readAuthRedirectError } from './lib/auth-feedback'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Activity, ArrowDownToLine, ArrowRight, Check, ChevronRight, Clock3, Coffee, Droplet, Eye, FileText, Heart, History, LayoutDashboard, Leaf, LogOut, Plus, Settings2, ShieldCheck, Smartphone, Weight, WifiOff, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Button } from './components/ui/button'
import { deleteReading, exportCsv, fastingFrom, listReadings, localDateInput, momentLabel, moments, saveReading, readingValue, supabase, toUnit, type Moment, type Reading, type Unit } from './lib/data'
import { clearCache, flush, loadCache, overlay, pendingOps, saveCache } from './lib/offline'
import { ageFrom, bodyFields, bodyValue, deleteBody, emptyProfile, getProfile, isBody, listBody, listShares, type Body, type BodyField, type Profile, type Shares } from './lib/body'

type Page = 'home' | 'history' | 'settings' | 'report'
type Kind = 'glucose' | 'pressure' | 'body'
const errorText = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback
const signed = (v: number, unit: string) => `${v>0?'+':v<0?'−':''}${Math.abs(v)} ${unit}`
const noShares: Shares = { viewers: [], owners: [] }

export default function App() {
  const [session,setSession] = useState<Session|null>(null)
  const [authReady,setAuthReady] = useState(!supabase)
  const [authError,setAuthError] = useState(readAuthRedirectError)
  const [recovery,setRecovery] = useState(false)
  const [page,setPage] = useState<Page>('home')
  const [readings,setReadings] = useState<Reading[]>([])
  const [body,setBody] = useState<Body[]>([])
  const [profile,setProfile] = useState<Profile>(emptyProfile)
  const [shares,setShares] = useState<Shares>(noShares)
  const [viewing,setViewing] = useState<string|null>(null)
  const [loading,setLoading] = useState(true)
  const [loadError,setLoadError] = useState('')
  const [bodyError,setBodyError] = useState('')
  const [pending,setPending] = useState(0)
  const [cached,setCached] = useState(false)
  const [notice,setNotice] = useState('')
  const [online,setOnline] = useState(navigator.onLine)
  const [editing,setEditing] = useState<Entry|null>(null)
  const [removing,setRemoving] = useState<Entry|null>(null)
  const [deleting,setDeleting] = useState(false)
  const [deleteError,setDeleteError] = useState('')
  const [unit,setUnit] = useState<Unit>(()=>localStorage.getItem('salud100.unit')==='mmol/L'?'mmol/L':'mg/dL')
  const [kind,setKind] = useState<Kind>('glucose')
  const [metric,setMetric] = useState<BodyField>('weight_kg')
  const [historyKind,setHistoryKind] = useState('all')
  const [filter,setFilter] = useState('all')
  const [period,setPeriod] = useState('all')
  const [chartDays,setChartDays] = useState(7)
  const mainRef = useRef<HTMLElement>(null)
  const userId = session?.user.id
  const subject = viewing ?? userId
  const readOnly = !!viewing
  useEffect(()=>{
    if(!supabase) return
    supabase.auth.getSession().then(({data,error})=>{if(error)setAuthError(authErrorMessage(error));setSession(data.session);setAuthReady(true)}).catch(()=>{setAuthError(authErrorMessage(null));setAuthReady(true)})
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event,s)=>{setSession(s);setAuthReady(true);if(event==='PASSWORD_RECOVERY')setRecovery(true);if(!s){setReadings([]);setBody([]);setProfile(emptyProfile);setShares(noShares);setViewing(null)}})
    return ()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{ const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return ()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)} },[])
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5500);return ()=>clearTimeout(timer)},[notice])
  // Body data loads independently so glucose and pressure keep working if the body tables are unavailable.
  async function refresh() {
    setLoading(true);setLoadError('');setBodyError('');setCached(false)
    void refreshShares()
    if(supabase&&userId&&navigator.onLine) await flush(userId).catch(()=>{})
    const [r,b,p] = await Promise.allSettled([listReadings(subject),listBody(subject),getProfile(subject)])
    // Without connection, show the last copy saved on this phone plus anything still waiting to upload.
    const own = <T extends {id:string}>(items: T[], table: 'readings'|'body_measurements') => supabase&&userId&&subject===userId ? overlay(items,table,userId) : items
    const cache = supabase&&subject&&r.status==='rejected' ? loadCache(subject) : null
    if(cache){setReadings(own(cache.readings,'readings').sort(byDate));setBody(own(cache.body,'body_measurements').sort(byDate));setProfile(cache.profile);setCached(true)}
    else {
      if(r.status==='fulfilled') setReadings(own(r.value,'readings').sort(byDate)); else setLoadError(errorText(r.reason,'No pudimos cargar tus datos.'))
      if(b.status==='fulfilled') setBody(own(b.value,'body_measurements').sort(byDate)); else setBodyError(errorText(b.reason,'No pudimos cargar tus pesajes.'))
      if(p.status==='fulfilled') setProfile(p.value); else if(b.status==='fulfilled') setBodyError(errorText(p.reason,'No pudimos cargar tus datos personales.'))
      if(supabase&&subject&&r.status==='fulfilled'&&b.status==='fulfilled'&&p.status==='fulfilled') saveCache(subject,{readings:r.value,body:b.value,profile:p.value})
    }
    setPending(userId?pendingOps(userId).length:0)
    setLoading(false)
  }
  async function refreshShares() {if(!supabase||!session)return;try{setShares(await listShares(session.user.id,session.user.email||''))}catch{setShares(noShares)}}
  useEffect(()=>{if(authReady && (!supabase || session)) void refresh()},[authReady,userId,viewing,online])
  const navigate = (next: Page) => {setPage(next);window.scrollTo({top:0,behavior:'smooth'})}
  const age = ageFrom(profile.birth_date)
  const viewingName = shares.owners.find(o=>o.id===viewing)?.name
  const selectedUnit = kind==='pressure' ? 'mmHg' : unit
  const selectedReadings = readings.filter(r => kind==='pressure' ? r.unit==='mmHg' : r.unit!=='mmHg')
  const latest = selectedReadings[0]
  const week = selectedReadings.filter(r=>withinDays(r,7) && r.unit===selectedUnit)
  const average = week.length ? (week.reduce((sum,r)=>sum+r.value,0)/week.length).toFixed(selectedUnit==='mmol/L'?1:0)+(kind==='pressure'?'/'+(week.reduce((sum,r)=>sum+(r.diastolic||0),0)/week.length).toFixed(0):'') : '—'
  const weekBody = body.filter(b=>withinDays(b,7)), monthBody = body.filter(b=>withinDays(b,30))
  const change30 = monthBody.length>=2 ? Math.round((monthBody[0].weight_kg-monthBody.at(-1)!.weight_kg)*10)/10 : null
  const metricField = bodyFields.find(f=>f.key===metric)!
  const chartUnit = kind==='body' ? metricField.unit||'IMC' : selectedUnit
  // Body charts add a 7-day rolling average so day-to-day swings read calmer.
  const rolling = (b: Body) => {const t=Date.parse(b.measured_at);const vals=body.filter(x=>x[metric]!=null&&Date.parse(x.measured_at)<=t&&Date.parse(x.measured_at)>t-7*86400000).map(x=>x[metric]!);return Math.round(vals.reduce((a,c)=>a+c,0)/vals.length*10)/10}
  const chartPoints: Point[] = kind==='body'
    ? body.filter(b=>b[metric]!=null&&withinDays(b,chartDays)).map(b=>({id:b.id,value:b[metric]!,lower:rolling(b),measured_at:b.measured_at}))
    : readings.filter(r=>r.unit===selectedUnit&&withinDays(r,chartDays)).map(r=>({id:r.id,value:r.value,lower:r.diastolic,measured_at:r.measured_at}))
  const gMin = profile.glucose_min==null?null:toUnit(profile.glucose_min,unit), gMax = profile.glucose_max==null?null:toUnit(profile.glucose_max,unit)
  const chartBand: [number,number]|null = kind==='glucose'&&gMin!=null&&gMax!=null ? [gMin,gMax] : null
  const chartGuides = (kind==='glucose'&&!chartBand ? [gMin,gMax] : kind==='pressure' ? [profile.systolic_max,profile.diastolic_max] : kind==='body'&&metric==='weight_kg' ? [profile.weight_goal_kg] : []).filter((v):v is number=>v!=null)
  const lastGlucose = readings.find(r=>r.unit!=='mmHg'), lastPressure = readings.find(r=>r.unit==='mmHg'), lastBody = body[0]
  const tiles = [
    {id:'glucose',label:'Glucosa',icon:Droplet,value:lastGlucose?readingValue(lastGlucose):'—',unit:lastGlucose?.unit||unit,date:lastGlucose?.measured_at},
    {id:'pressure',label:'Presión arterial',icon:Heart,value:lastPressure?readingValue(lastPressure):'—',unit:'mmHg',date:lastPressure?.measured_at},
    {id:'body',label:'Peso y composición',icon:Weight,value:lastBody?String(lastBody.weight_kg):'—',unit:'kg',date:lastBody?.measured_at},
  ] as const
  const inPeriod = (e: Entry) => period==='all'||withinDays(e,Number(period))
  const visibleReadings = historyKind==='body' ? [] : readings.filter(r=>(historyKind==='all'||(historyKind==='pressure'?r.unit==='mmHg':r.unit!=='mmHg')) && (filter==='all'||r.unit!=='mmHg'&&(filter==='unknown'?r.moment===null:r.moment===filter)) && inPeriod(r))
  const visibleBody = (historyKind==='all'||historyKind==='body') && filter==='all' ? body.filter(inPeriod) : []
  const visible = [...visibleReadings,...visibleBody].sort(byDate)
  const queuedNotice = 'Guardado en este teléfono. Se subirá a tu cuenta al volver la conexión.'
  const afterWrite = (queued: boolean, message: string) => {setNotice(queued?queuedNotice:message);if(userId)setPending(pendingOps(userId).length)}
  function saved(reading: Reading, queued = false) {setReadings(prev=>[reading,...prev.filter(r=>r.id!==reading.id)].sort(byDate));setEditing(null);afterWrite(queued,'Medición guardada. Un pequeño paso para cuidarte.')}
  function savedBody(entry: Body, queued = false) {setBody(prev=>[entry,...prev.filter(b=>b.id!==entry.id)].sort(byDate));setEditing(null);afterWrite(queued,'Pesaje guardado. Un pequeño paso para cuidarte.')}
  async function remove() {if(!removing)return;setDeleting(true);setDeleteError('');try{let queued:boolean;if(isBody(removing)){queued=await deleteBody(removing.id);setBody(prev=>prev.filter(b=>b.id!==removing.id))}else{queued=await deleteReading(removing.id);setReadings(prev=>prev.filter(r=>r.id!==removing.id))}afterWrite(queued,isBody(removing)?'Pesaje eliminado.':'Medición eliminada.');setRemoving(null)}catch(e){setDeleteError(errorText(e,'No se pudo eliminar.'))}finally{setDeleting(false)}}
  const startDelete = (e: Entry) => {setDeleteError('');setRemoving(e)}
  const listActions = readOnly ? {readOnly:true} : {onEdit:setEditing,onDelete:startDelete}
  if(!authReady) return <div className="loading-screen"><Droplet/> Preparando tu espacio…</div>
  if(supabase && !session) return <AuthScreen initialError={authError} />
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('home')}}><span className="brand-icon"><Droplet size={24} fill="currentColor"/></span>salud<span className="brand-number">100</span><span className="brand-dot">.</span></a><div className="sidebar-caption">TU ESPACIO DE BIENESTAR</div>
      <nav aria-label="Navegación principal">{([{id:'home',label:'Mi resumen',icon:LayoutDashboard},{id:'history',label:'Mis mediciones',icon:History},{id:'settings',label:'Ajustes',icon:Settings2}] as const).map(item=><button key={item.id} className={'nav-item '+(page===item.id?'active':'')} aria-current={page===item.id?'page':undefined} onClick={()=>navigate(item.id)}><item.icon size={20}/><span>{item.label}</span>{page===item.id&&<span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="care-card"><span className="care-icon"><Heart size={20}/></span><h3>Cada registro cuenta.</h3><p>Pequeños hábitos, más tranquilidad en tu día.</p><span className="care-leaf"><Leaf size={68}/></span></div><div className="profile"><div className="avatar">{(profile.display_name||session?.user.email||'T')[0].toUpperCase()}</div><div><strong>{profile.display_name||'Mi espacio personal'}</strong><small>{age!=null&&age>=0?`${age} años · `:''}{readOnly?'Solo lectura':supabase?'Cuenta conectada':'Guardado en este dispositivo'}</small></div><ShieldCheck size={18}/></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">Mi bienestar <ChevronRight size={14}/><strong>{({home:'Resumen',history:'Mediciones',settings:'Ajustes',report:'Resumen médico'} as const)[page]}</strong></span><span className="topbar-right"><span className="status-dot"/>{supabase?'Cuenta personal':'Modo local'}<span className="tiny-avatar"><Heart size={16}/></span></span></header>
    <main ref={mainRef}>
      {!online&&<div className="info-banner"><WifiOff size={18}/>{supabase?'Sin conexión. Puedes seguir registrando; lo subiremos a tu cuenta al volver la señal.':'Sin conexión. Puedes seguir guardando en este dispositivo.'}</div>}
      {cached&&online&&<div className="info-banner"><WifiOff size={18}/>No pudimos conectar con tu cuenta. Mostramos lo último guardado en este teléfono.<Button variant="outline" onClick={refresh}>Reintentar</Button></div>}
      {pending>0&&<div className="info-banner pending-banner"><Clock3 size={18}/>{pending===1?'1 registro espera':`${pending} registros esperan`} conexión para subirse a tu cuenta.</div>}
      {shares.owners.length>0&&<div className="viewing-bar no-print"><Eye size={18}/><label>Ver registros de<select value={viewing??''} onChange={e=>{setViewing(e.target.value||null);setKind('glucose')}}><option value="">Mis registros</option>{shares.owners.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>{readOnly&&<span>Solo lectura: puedes ver, no cambiar.</span>}</div>}
      {loadError&&<div className="error-banner" role="alert">{loadError}<Button variant="outline" onClick={refresh}>Reintentar</Button></div>}
      {page==='home'&&<>
        <div className="page-heading"><div><div className="eyebrow"><span/> UN DÍA A LA VEZ</div><h1>{readOnly?<>Registros de {viewingName}</>:profile.display_name?<>Hola, {profile.display_name.split(' ')[0]}</>:'Tu salud, a tu ritmo'}<span>.</span></h1><p>Llevar tu registro es una forma de cuidarte. Hagámoslo fácil.</p></div><div className="today"><Clock3 size={16}/>{new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</div></div>
        <div className="kind-tiles" role="group" aria-label="Tipo de medición">{tiles.map(t=><button type="button" key={t.id} aria-pressed={kind===t.id} className={'kind-tile '+(kind===t.id?'selected':'')} onClick={()=>setKind(t.id)}><span className="kind-tile-top"><t.icon size={15}/>{t.label}</span><strong>{t.value}<small>{t.unit}</small></strong><span className="kind-tile-date">{t.date?dateLabel(t.date):'Sin registros'}</span></button>)}</div>
        <div className="dashboard-grid"><section className="card entry-card">{readOnly
          ?<div className="readonly-note"><span className="heading-icon"><Eye size={22}/></span><h2>Solo lectura</h2><p>Estás viendo los registros que {viewingName} comparte contigo. Solo esa persona puede agregarlos o cambiarlos.</p><Button variant="outline" onClick={()=>navigate('report')}><FileText size={17}/>Ver resumen para el médico</Button></div>
          :<><div className="section-heading"><div className="heading-icon">{kind==='body'?<Weight size={22}/>:<Plus size={22}/>}</div><div><h2>{kind==='body'?'Nuevo pesaje':'Nueva medición'}</h2><p>{kind==='body'?'Copia lo que marcó tu báscula.':'Un momento para ti.'}</p></div><span className="small-tag">REGISTRO RÁPIDO</span></div>
          {kind==='body'?(bodyError?<div className="form-error" role="alert">{bodyError}<Button variant="outline" onClick={refresh}>Reintentar</Button></div>:<BodyForm profile={profile} existing={body} disabled={loading} onSaved={savedBody}/>):<ReadingForm key={kind} unit={selectedUnit} existing={readings} disabled={loading||!!loadError} onSaved={saved}/>}</>}</section>
          <div className="summary-stack">{kind==='body'?<LatestBody latest={body[0]} previous={body[1]}/>:<section className="latest-card"><div className="latest-top"><span><span className="live-dot"/> Última medición</span><Droplet size={23}/></div><div className={"latest-value "+(kind==='pressure'?'pressure-value':'')}>{latest?readingValue(latest):'—'}<span>{latest?.unit||selectedUnit}</span></div>{latest?<><span className="fasting-badge">{latest.unit==='mmHg'?<Heart size={14}/>:<Coffee size={14}/ >}{latest.unit==='mmHg'?`Sistólica / diastólica${latest.pulse?` · Pulso ${latest.pulse} lpm`:''}`:momentLabel(latest.moment)}</span><div className="latest-bottom"><Clock3 size={15}/>{dateLabel(latest.measured_at)} · {timeLabel(latest.measured_at)}</div></>:<><p className="latest-empty">Aquí comienza tu registro.</p><div className="latest-bottom">Tu primera medición aparecerá aquí.</div></>}<div className="decor-ring ring-one"/><div className="decor-ring ring-two"/></section>}
          <section className="card weekly-card"><div className="weekly-title"><span className="soft-icon"><Activity size={19}/></span><span>{kind==='body'?'Tendencia':'Esta semana'}</span><span className="muted">{kind==='body'?`${weekBody.length} ${weekBody.length===1?'pesaje':'pesajes'} en 7 días`:'Últimos 7 días'}</span></div>{kind==='body'
            ?<div className="weekly-stats"><div><strong>{weekBody.length?(weekBody.reduce((sum,b)=>sum+b.weight_kg,0)/weekBody.length).toFixed(1):'—'}<small>kg</small></strong><span>promedio de 7 días</span></div><div><strong>{change30==null?'—':signed(change30,'kg')}</strong><span>cambio en 30 días</span></div></div>
            :<div className="weekly-stats"><div><strong>{week.length}</strong><span>mediciones en {selectedUnit}</span></div><div><strong>{average}<small>{selectedUnit}</small></strong><span>promedio registrado</span></div></div>}</section>
          <div className="gentle-note"><span><Leaf size={23}/></span><p>Lo importante es la constancia.<br/><strong>Tu próximo registro también cuenta.</strong></p></div></div>
        </div>
        <section className="card chart-card"><div className="section-line"><div><h2>Tu recorrido</h2><p>{kind==='body'?`${metricField.label} a lo largo del tiempo`:'Tus mediciones a lo largo del tiempo'} · {chartUnit}</p></div><div className="segmented compact">{[7,30].map(n=><button key={n} className={chartDays===n?'selected':''} onClick={()=>setChartDays(n)}>{n} días</button>)}</div></div>
          {kind==='body'&&<div className="segmented metric-switch" aria-label="Dato a graficar">{bodyFields.map(f=><button type="button" key={f.key} aria-pressed={metric===f.key} className={metric===f.key?'selected':''} onClick={()=>setMetric(f.key)}>{f.short}</button>)}</div>}
          <Trend points={chartPoints} unit={chartUnit} decimals={kind==='body'||selectedUnit==='mmol/L'?1:0} band={chartBand} guides={chartGuides} {...(kind==='body'?{lowerLabel:'Promedio de 7 días',legend:'Cada pesaje (verde) · Promedio de 7 días (azul, discontinua)'}:{})}/></section>
        <section className="card history-card"><div className="section-line"><div><h2>Últimos registros</h2><p>Cada medición, en su lugar.</p></div><Button variant="ghost" onClick={()=>navigate('history')}>Ver historial <ArrowRight size={16}/></Button></div><EntryList entries={[...readings,...body].sort(byDate).slice(0,5)} loading={loading} {...listActions}/></section>
      </>}
      {page==='history'&&<><div className="page-heading"><div><div className="eyebrow">TU HISTORIA, PASO A PASO</div><h1>{readOnly?`Mediciones de ${viewingName}`:'Mis mediciones'}<span>.</span></h1><p>Consulta, corrige o lleva tus registros contigo.</p></div><div className="heading-actions"><Button onClick={()=>navigate('report')}><FileText size={17}/>Resumen para el médico</Button><Button variant="outline" disabled={!visible.length} onClick={()=>exportCsv(visibleReadings,visibleBody)}><ArrowDownToLine size={17}/>Exportar CSV</Button></div></div>{bodyError&&<div className="error-banner" role="alert">{bodyError}<Button variant="outline" onClick={refresh}>Reintentar</Button></div>}<section className="card history-card"><div className="history-filters"><label>Tipo<select value={historyKind} onChange={e=>{setHistoryKind(e.target.value);setFilter("all")}}><option value="all">Todas las mediciones</option><option value="glucose">Glucosa</option><option value="pressure">Presión arterial</option><option value="body">Peso y composición</option></select></label><label>Momento<select disabled={historyKind==="pressure"||historyKind==="body"} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option>{moments.map(m=><option key={m.label} value={m.value??'unknown'}>{m.label}</option>)}</select></label><label>Periodo<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">Todo el historial</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option></select></label><span>{visible.length} registros</span></div><EntryList entries={visible} loading={loading} {...listActions}/></section></>}
      {page==='report'&&<Report readings={readings} body={body} profile={profile} unit={unit} onBack={()=>navigate('history')}/>}
      {page==='settings'&&<><div className="page-heading"><div><div className="eyebrow">A TU MANERA</div><h1>Tu espacio<span>.</span></h1><p>Los pequeños detalles que hacen todo más fácil.</p></div></div>{readOnly&&<div className="info-banner"><Eye size={18}/>Para editar tus propios datos y metas, elige “Mis registros” arriba.</div>}<div className="settings-grid">
        {!readOnly&&<><ProfileCard key={'p'+JSON.stringify(profile)} profile={profile} disabled={loading||!!bodyError} onSaved={p=>{setProfile(p);setNotice('Tus datos se guardaron.')}}/><GoalsCard key={'g'+unit+JSON.stringify(profile)} profile={profile} unit={unit} disabled={loading||!!bodyError} onSaved={p=>{setProfile(p);setNotice('Tus metas se guardaron.')}}/></>}
        <section className="card settings-card"><span className="heading-icon"><Droplet size={22}/></span><h2>Unidad de tu glucómetro</h2><p>Elige la unidad que aparece en tu dispositivo. Los registros anteriores conservan su unidad original.</p><label>Unidad de nuevas mediciones<select value={unit} onChange={e=>{try{localStorage.setItem('salud100.unit',e.target.value);setUnit(e.target.value as Unit);setNotice('Unidad actualizada.')}catch{setNotice('No pudimos guardar la preferencia.')}}}><option>mg/dL</option><option>mmol/L</option></select></label></section>
        <section className="card settings-card"><span className="heading-icon"><ShieldCheck size={22}/></span><h2>Tus datos</h2><p>{supabase?'Tus mediciones se guardan en tu cuenta personal. Necesitas conexión para consultarlas y modificarlas.':'Tus mediciones se guardan solo en este navegador. Exporta una copia para conservarlas: borrar los datos del navegador también borra este registro.'}</p><Button onClick={()=>navigate('report')}><FileText size={17}/>Resumen para el médico</Button><Button variant="outline" onClick={()=>exportCsv(readings,body)} disabled={!readings.length&&!body.length}><ArrowDownToLine size={17}/>Exportar mis mediciones</Button>{supabase&&<Button variant="ghost" onClick={async()=>{if(pending){setNotice('Tienes registros sin subir. Conéctate a internet antes de cerrar sesión para no perderlos.');return}const {error}=await supabase!.auth.signOut();if(error)setNotice('No se pudo cerrar sesión. Intenta de nuevo.');else if(userId)clearCache(userId)}}><LogOut size={17}/>Cerrar sesión</Button>}</section>
        {supabase&&!readOnly&&<ShareCard shares={shares} onChanged={m=>{setNotice(m);void refreshShares()}}/>}
        {supabase&&<PasswordCard onDone={()=>setNotice('Contraseña actualizada.')}/>}
        <section className="card settings-card install-card"><span className="heading-icon"><Smartphone size={22}/></span><h2>Siempre a la mano</h2><p>Agrega Salud100 a la pantalla de inicio de tu celular.</p><div className="install-steps"><p><strong>En iPhone</strong>Abre en Safari → Compartir → Agregar a pantalla de inicio.</p><p><strong>En Android</strong>Abre el menú de Chrome → Instalar app o Agregar a pantalla de inicio.</p></div></section></div></>}
      <footer><span><Droplet size={14}/>salud100 · Hecho para cuidarte</span><span>Un registro personal, sin interpretaciones médicas.</span></footer>
    </main></div>
    {notice&&<div className="toast" role="status"><Check size={19}/>{notice}<button aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}
    {recovery&&<Modal title="Crea tu nueva contraseña" onClose={()=>setRecovery(false)}><p className="delete-copy">Abriste el enlace para recuperar tu acceso. Escribe una contraseña nueva.</p><PasswordForm onDone={()=>{setRecovery(false);setNotice('Contraseña actualizada.')}}/></Modal>}
    {editing&&<Modal title={isBody(editing)?'Editar pesaje':'Editar medición'} onClose={()=>setEditing(null)}>{isBody(editing)?<BodyForm profile={profile} entry={editing} existing={body} onSaved={savedBody}/>:<ReadingForm unit={editing.unit} reading={editing} existing={readings} onSaved={saved}/>}</Modal>}
    {removing&&<Modal title={isBody(removing)?'¿Eliminar este pesaje?':'¿Eliminar esta medición?'} onClose={()=>{if(!deleting)setRemoving(null)}}><p className="delete-copy">Se eliminará el registro de <strong>{isBody(removing)?`${removing.weight_kg} kg`:`${readingValue(removing)} ${removing.unit}`}</strong> del {dateLabel(removing.measured_at)} a las {timeLabel(removing.measured_at)}. Esta acción no se puede deshacer.</p>{deleteError&&<p role="alert" className="form-error">{deleteError}</p>}<div className="modal-actions"><Button variant="outline" disabled={deleting} onClick={()=>setRemoving(null)}>Conservar</Button><Button variant="destructive" disabled={deleting} onClick={remove}>{deleting?'Eliminando…':isBody(removing)?'Eliminar pesaje':'Eliminar medición'}</Button></div></Modal>}
  </div>
}

function LatestBody({latest,previous}:{latest?:Body;previous?:Body}) {
  const delta=latest&&previous?Math.round((latest.weight_kg-previous.weight_kg)*10)/10:null
  return <section className="latest-card body-latest"><div className="latest-top"><span><span className="live-dot"/> Último pesaje</span><Weight size={23}/></div><div className="latest-value">{latest?latest.weight_kg:'—'}<span>kg</span></div>{latest?<><span className="fasting-badge"><Activity size={14}/>{delta==null?'Primer pesaje registrado':delta===0?'Sin cambio desde el pesaje anterior':`${signed(delta,'kg')} desde el pesaje anterior`}</span><dl className="body-mini">{bodyFields.slice(1).map(f=><div key={f.key}><dt>{f.short}</dt><dd>{bodyValue(latest[f.key],f.unit)}</dd></div>)}</dl><div className="latest-bottom"><Clock3 size={15}/>{dateLabel(latest.measured_at)} · {timeLabel(latest.measured_at)}</div></>:<><p className="latest-empty">Aquí comienza tu registro de peso.</p><div className="latest-bottom">El primer pesaje aparecerá aquí.</div></>}<div className="decor-ring ring-one"/><div className="decor-ring ring-two"/></section>
}

function ReadingForm({unit,reading,existing=[],onSaved,disabled=false}:{unit:Reading['unit'];reading?:Reading;existing?:Reading[];onSaved:(r:Reading,queued:boolean)=>void;disabled?:boolean}) {
  const pressure=unit==='mmHg'
  const [diastolic,setDiastolic]=useState(reading?.diastolic?String(reading.diastolic):'')
  const [pulse,setPulse]=useState(reading?.pulse?String(reading.pulse):'')
  const [value,setValue]=useState(reading?String(reading.value):'')
  const [moment,setMoment]=useState<Moment|null>(reading?.moment??null)
  const [note,setNote]=useState(reading?.note||'')
  const [customTime,setCustomTime]=useState(!!reading)
  const [date,setDate]=useState(localDateInput(reading?new Date(reading.measured_at):new Date()))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [duplicate,setDuplicate]=useState('')
  const inputRef=useRef<HTMLInputElement>(null)
  const inFlight=useRef(false)
  const edit=(set:(v:string)=>void)=>(e:React.ChangeEvent<HTMLInputElement>)=>{setDuplicate('');set(e.target.value)}
  async function submit(e:FormEvent) {e.preventDefault();if(inFlight.current)return;setError('');const parsed=Number(value.replace(',','.'));if(!value.trim()||!Number.isFinite(parsed)||parsed<=0||parsed>=10000){setError('Escribe un valor numérico mayor que 0 y menor que 10000.');inputRef.current?.focus();return}const lower=Number(diastolic);if(pressure&&(!Number.isInteger(parsed)||!diastolic.trim()||!Number.isInteger(lower)||lower<=0||lower>=parsed)){setError('Escribe sistólica y diastólica como números enteros mayores que 0. La sistólica debe ser mayor que la diastólica.');return}const beats=pulse.trim()?Number(pulse):null;if(pressure&&beats!=null&&!(Number.isInteger(beats)&&beats>20&&beats<300)){setError('Escribe el pulso como número entero (latidos por minuto) o déjalo vacío.');return}const measured=measuredAt(customTime,date);if(!measured){setError('Elige una fecha y hora válida que no esté en el futuro.');return}
    const same=existing.find(r=>r.id!==reading?.id&&r.unit===unit&&r.value===parsed&&(!pressure||r.diastolic===lower)&&Math.abs(Date.parse(r.measured_at)-measured.getTime())<20*60000)
    if(same&&!duplicate){setDuplicate(`Ya hay una medición de ${readingValue(same)} ${unit} a la misma hora. Revisa el historial o vuelve a pulsar para guardarla de todos modos.`);return}
    const item:Reading={id:reading?.id||crypto.randomUUID(),value:parsed,unit,diastolic:pressure?lower:null,pulse:pressure?beats:null,moment:pressure?null:moment,fasting:pressure?null:fastingFrom(moment),note:note.trim(),measured_at:measured.toISOString()};inFlight.current=true;setBusy(true);try{const queued=await saveReading(item);setDuplicate('');onSaved(item,queued);if(!reading){setValue('');setDiastolic('');setPulse('');setMoment(null);setNote('');setCustomTime(false);setDate(localDateInput())}}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar. Revisa el espacio disponible en tu navegador.')}finally{setBusy(false);inFlight.current=false}}
  return <form onSubmit={submit} className="reading-form"><label className="field-label" htmlFor={reading?'edit-glucose':'glucose'}>{pressure?'Sistólica (mmHg)':'¿Qué valor marcó tu glucómetro?'}</label><div className={'glucose-input '+(value?'has-value':'')}>{pressure?<Heart size={25}/>:<Droplet size={25}/>}<input ref={inputRef} id={reading?'edit-glucose':'glucose'} aria-describedby="glucose-hint" type="text" inputMode={pressure?"numeric":"decimal"} autoComplete="off" placeholder="000" value={value} onChange={edit(setValue)} disabled={busy||disabled}/><span>{unit}</span></div>{pressure&&<><label className="field-label" htmlFor={reading?'edit-diastolic':'diastolic'}>Diastólica (mmHg)</label><div className="glucose-input"><Heart size={25}/><input id={reading?'edit-diastolic':'diastolic'} type="text" inputMode="numeric" autoComplete="off" placeholder="000" value={diastolic} onChange={edit(setDiastolic)} disabled={busy||disabled}/><span>mmHg</span></div><div className="body-grid single"><label className="body-field"><span>Pulso (opcional)</span><span className="body-input"><input aria-label="Pulso" type="text" inputMode="numeric" autoComplete="off" placeholder="—" value={pulse} onChange={e=>setPulse(e.target.value)} disabled={busy||disabled}/><small aria-hidden="true">lpm</small></span></label></div></>}<p id="glucose-hint" className="input-hint">Escribe el número tal como aparece en tu dispositivo.</p>
    {!pressure&&<fieldset disabled={busy||disabled}><legend>¿En qué momento?</legend><div className="moment-options">{moments.map(option=><button type="button" key={option.label} aria-pressed={moment===option.value} className={moment===option.value?'selected':''} onClick={()=>setMoment(option.value)}>{option.value==='fasting'&&<Coffee size={15}/>}{option.label}</button>)}</div></fieldset>}
    <TimeAndNote editing={!!reading} customTime={customTime} setCustomTime={v=>{setDuplicate('');setCustomTime(v)}} date={date} setDate={v=>{setDuplicate('');setDate(v)}} note={note} setNote={setNote} busy={busy}/>
    {error&&<p className="form-error" role="alert">{error}</p>}{duplicate&&!error&&<p className="form-warning" role="alert">{duplicate}</p>}<Button type="submit" className="save-button" disabled={busy||disabled}>{busy?'Guardando…':duplicate?'Guardar de todos modos':reading?'Guardar cambios':'Guardar medición'}{!busy&&<ArrowRight size={19}/>}</Button><div className="save-caption"><ShieldCheck size={13}/>{supabase?'En tu cuenta personal':'Guardado en este dispositivo'}</div>
  </form>
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[]);return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e=>{e.preventDefault();onClose()}}><div className="modal-heading"><h2 id="modal-title">{title}</h2><Button variant="ghost" size="icon" aria-label="Cerrar ventana" onClick={onClose}><X size={20}/></Button></div>{children}</dialog>}
