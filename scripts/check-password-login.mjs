import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'msedge' })
const base = process.argv[2] || 'http://localhost:4173'
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(90000)
    let state = 'invalid_credentials'
    let logins = 0, emails = 0
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
    const expires = Math.floor(Date.now()/1000)+3600
    const jwt = [ {alg:'HS256',typ:'JWT'}, {sub:user.id,exp:expires,iat:expires-3600,role:'authenticated'} ].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')+'.test-signature'
    await page.route('https://*.supabase.co/**', async route => {
      const url = new URL(route.request().url())
      const reply = (status, body) => route.fulfill({ status, headers:{'x-supabase-api-version':'2024-01-01'}, contentType:'application/json', body:JSON.stringify(body) })
      if(url.pathname.endsWith('/otp')) { emails++; return reply(500,{}) }
      if(url.pathname.endsWith('/token')) {
        logins++
        assert.equal(url.searchParams.get('grant_type'),'password')
        assert.deepEqual(route.request().postDataJSON(),{email:'test@example.com',password:'Test password! 123',gotrue_meta_security:{}})
        if(state!=='success') { const status=state==='over_request_rate_limit'?429:400; return reply(status,{code:status,error_code:state,msg:state}) }
        return reply(200,{access_token:jwt,refresh_token:'mock-refresh-token',token_type:'bearer',expires_in:3600,expires_at:expires,user})
      }
      if(url.pathname.endsWith('/user')) return reply(200,user)
      if(url.pathname.endsWith('/logout')) return route.fulfill({status:204})
      if(url.pathname.includes('/rest/v1/readings')) return reply(200,[])
      return reply(500,{message:'Unexpected test request'})
    })
    await page.goto(base,{timeout:90000})
    await page.getByLabel('Correo electrónico').fill('test@example.com')
    const password = page.getByLabel('Contraseña',{exact:true})
    await password.fill('Test password! 123')
    assert.equal(await password.getAttribute('type'),'password')
    await page.getByRole('button',{name:'Mostrar contraseña',exact:true}).click()
    assert.equal(await password.getAttribute('type'),'text')
    await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).click()
    for (const [code, message] of [['invalid_credentials','El correo o la contraseña no son correctos.'],['email_not_confirmed','Tu cuenta aún no está confirmada.'],['over_request_rate_limit','Demasiados intentos de acceso.']]) {
      state=code
      await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
      await page.getByRole('status').filter({hasText:message}).waitFor()
    }
    state='success'
    await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
    await page.getByRole('heading',{name:'Tu glucosa, a tu ritmo.'}).waitFor()
    await page.reload()
    await page.getByRole('heading',{name:'Tu glucosa, a tu ritmo.'}).waitFor()
    assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('Test password! 123'))),false)
    await page.getByRole('button',{name:'Ajustes',exact:true}).click()
    await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click()
    await page.getByRole('button',{name:'Iniciar sesión',exact:true}).waitFor()
    assert.equal(logins,4)
    assert.equal(emails,0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    await context.close()
    console.log(`Password login checks passed at ${width}px: errors, session, reload, logout; no emails sent. Supabase responses mocked.`)
  }
} finally { await browser.close() }
