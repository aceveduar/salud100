export function authErrorMessage(error: { code?: string; status?: number } | null | undefined) {
  if (error?.code === 'otp_expired' || error?.code === 'access_denied') return 'Este enlace ya fue usado o venció. Solicita un enlace nuevo y abre solo el correo más reciente.'
  if (error?.status === 429 || error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit') return 'Se alcanzó el límite de correos de acceso. Espera antes de solicitar otro enlace. Si continúa, es necesario revisar el servicio de correo de la app.'
  if (error?.code === 'email_address_not_authorized') return 'El servicio de correo aún no permite enviar a esta dirección. Es necesario configurar el correo de la app.'
  return 'No pudimos completar el acceso. Revisa tu conexión y solicita un enlace nuevo.'
}

export function readAuthRedirectError() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const params = hash.has('error') || hash.has('error_code') ? hash : query
  if (!params.has('error') && !params.has('error_code')) return ''
  return authErrorMessage({code: params.get('error_code') || params.get('error') || undefined})
}
