import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Droplet, Eye, EyeOff, Heart, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { supabase } from '../lib/data'
import { authErrorMessage } from '../lib/auth-feedback'

export function AuthScreen({ initialError }: { initialError: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useLink, setUseLink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(initialError)
  const submitting = useRef(false)
  useEffect(() => { if (initialError) setMessage(initialError) }, [initialError])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      if (useLink) {
        const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
        setMessage(error ? authErrorMessage(error) : 'Revisa tu correo y abre el enlace para entrar a tu espacio.')
      } else {
        const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
        if (error) {
          setMessage(error.code === 'invalid_credentials' ? 'El correo o la contraseña no son correctos.'
            : error.code === 'email_not_confirmed' ? 'Tu cuenta aún no está confirmada. Contacta a quien creó tu cuenta para activarla.'
            : error.status === 429 ? 'Demasiados intentos de acceso. Espera unos minutos e intenta de nuevo.'
            : 'No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.')
        } else setPassword('')
      }
    } catch {
      setMessage('No pudimos conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <div className="auth-screen">
    <div className="auth-art"><span className="brand-icon"><Droplet size={35} fill="currentColor" /></span><h1>Tu salud,<br />a tu ritmo.</h1><p>Un pequeño hábito.<br />Más tranquilidad todos los días.</p><Heart size={140} strokeWidth={.7} /></div>
    <section className="auth-form">
      <div className="eyebrow"><Sparkles size={16} /> TU ESPACIO PERSONAL</div>
      <h2>Qué bueno tenerte aquí.</h2>
      <p>{useLink ? 'Recibe un enlace de acceso en tu correo.' : 'Entra con tu correo y contraseña.'}</p>
      <form onSubmit={submit}>
        <label htmlFor="login-email">Correo electrónico</label>
        <input id="login-email" type="email" required autoComplete="username" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
        {!useLink && <div className="password-field">
          <label htmlFor="login-password">Contraseña</label>
          <div className="password-control">
            <input id="login-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
            <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
          </div>
        </div>}
        <Button disabled={busy} type="submit">{busy ? (useLink ? 'Enviando…' : 'Entrando…') : (useLink ? 'Recibir enlace de acceso' : 'Iniciar sesión')}<ArrowRight size={18} /></Button>
      </form>
      {message && <p role="status" aria-live="polite" className="auth-message">{message}</p>}
      <Button variant="ghost" disabled={busy} onClick={() => { setUseLink(!useLink); setPassword(''); setShowPassword(false); setMessage('') }}>{useLink ? 'Usar mi contraseña' : 'Prefiero un enlace por correo'}</Button>
      <small><ShieldCheck size={15} /> Tus mediciones, en tu cuenta personal.</small>
    </section>
  </div>
}
