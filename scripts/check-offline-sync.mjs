// Account-mode checks with mocked Supabase: offline queue + sync, cached data, family read-only view, sharing.
// Run against `npm.cmd run build` + `npm.cmd run preview -- --port 4173`.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'msedge' })
const base = process.argv[2] || 'http://localhost:4173'
const me = '00000000-0000-4000-8000-000000000001', owner = '00000000-0000-4000-8000-000000000002'
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(30000)
    const now = new Date().toISOString()
    const store = {
      readings: [{ id: 'r-owner', user_id: owner, value: 118, unit: 'mg/dL', diastolic: null, pulse: null, measured_at: now, moment: 'fasting', fasting: true, note: '' }],
      body_measurements: [], profiles: [{ user_id: owner, display_name: 'María Dolores' }],
      shares: [{ owner_id: owner, viewer_email: 'test@example.com', created_at: now }],
    }
    let failReads = false
    const user = { id: me, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: now }
    const expires = Math.floor(Date.now() / 1000) + 3600
    const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: me, email: user.email, exp: expires, iat: expires - 3600, role: 'authenticated' }].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.test-signature'
    await page.route('https://*.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url())
      const reply = (status, body) => route.fulfill({ status, headers: { 'x-supabase-api-version': '2024-01-01' }, contentType: 'application/json', body: JSON.stringify(body) })
      if (url.pathname.endsWith('/token')) return reply(200, { access_token: jwt, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expires, user })
      if (url.pathname.endsWith('/user')) return reply(200, user)
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
      const table = url.pathname.split('/rest/v1/')[1]
      if (!(table in store)) return reply(500, { message: 'Unexpected test request' })
      if (request.method() === 'GET') {
        if (failReads) return route.abort('failed')
        let rows = store[table]
        const eq = url.searchParams.get('user_id'), isIn = eq?.startsWith('in.')
        if (eq) rows = rows.filter(r => isIn ? eq.slice(4, -1).split(',').includes(r.user_id) : r.user_id === eq.slice(3))
        return reply(200, rows)
      }
      if (request.method() === 'POST') {
        const body = [request.postDataJSON()].flat()
        for (const row of body) store[table] = [...store[table].filter(r => !row.id || r.id !== row.id), { ...row, owner_id: row.owner_id ?? me }]
        return route.fulfill({ status: 201, body: '' })
      }
      if (request.method() === 'DELETE') { const id = url.searchParams.get('id')?.slice(3); store[table] = store[table].filter(r => r.id !== id); return route.fulfill({ status: 204 }) }
      return reply(500, { message: 'Unexpected method' })
    })
    await page.goto(base)
    await page.getByLabel('Correo electrónico').fill('test@example.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('Test password! 123')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await page.getByRole('heading', { name: 'Tu salud, a tu ritmo.' }).waitFor()

    // Offline: the reading is queued on the phone, then uploads by itself when the connection returns.
    await context.setOffline(true)
    await page.getByLabel('¿Qué valor marcó tu glucómetro?').fill('101')
    await page.getByRole('button', { name: 'Guardar medición', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Guardado en este teléfono' }).waitFor()
    await page.getByText('1 registro espera conexión').waitFor()
    assert.equal(store.readings.filter(r => r.user_id === me).length, 0)
    await context.setOffline(false)
    await page.getByText('1 registro espera conexión').waitFor({ state: 'detached' })
    const uploaded = store.readings.find(r => r.user_id === me)
    assert.equal(uploaded?.value, 101)

    // Account unreachable on reload: the last copy saved on this phone is shown.
    failReads = true
    await page.reload()
    await page.getByText('Mostramos lo último guardado en este teléfono').waitFor()
    await page.getByRole('button', { name: 'Editar medición de 101', exact: true }).waitFor()
    failReads = false

    // Family view: read-only, the owner's records only.
    await page.getByRole('button', { name: 'Reintentar' }).first().click()
    await page.getByLabel('Ver registros de').selectOption(owner)
    await page.getByRole('heading', { name: 'Registros de María Dolores.' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Guardar medición', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: /^Editar medición/ }).count(), 0)
    await page.getByText('Solo lectura: puedes ver, no cambiar.').waitFor()
    assert.equal(await page.locator('.table-value').filter({ hasText: '101' }).count(), 0)
    await page.locator('.table-value').filter({ hasText: '118' }).first().waitFor()

    // Sharing my own records with another email.
    await page.getByLabel('Ver registros de').selectOption('')
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
    await page.getByLabel('Correo de tu familiar').fill('Hija@Example.com')
    await page.getByRole('button', { name: 'Compartir', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Acceso compartido' }).waitFor()
    assert.ok(store.shares.some(s => s.owner_id === me && s.viewer_email === 'hija@example.com'))
    await page.getByRole('button', { name: 'Quitar acceso a hija@example.com' }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await context.close()
    console.log(`Account checks passed at ${width}px: offline queue and sync, cached data, family read-only view, sharing. Supabase responses mocked.`)
  }
} finally { await browser.close() }
