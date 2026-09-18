import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'msedge'})
try {
  const page=await browser.newPage()
  page.setDefaultTimeout(90000)
  const base=process.argv[2] || 'http://localhost:4173'
  await page.goto(base+'/#error=access_denied&error_code=otp_expired',{timeout:90000})
  await page.getByText('Este enlace ya fue usado o venció.',{exact:false}).waitFor()
  await page.route('**/auth/v1/otp**',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({code:'over_email_send_rate_limit',msg:'email rate limit exceeded'})}))
  await page.getByLabel('Correo electrónico').fill('test@example.com')
  await page.getByRole('button',{name:'Prefiero un enlace por correo'}).click()
  await page.getByRole('button',{name:'Recibir enlace de acceso'}).click()
  await page.getByText('Se alcanzó el límite de correos de acceso.',{exact:false}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Recibir enlace de acceso'}).isEnabled(),true)
  console.log('Expired-link and rate-limit UI checks passed. No emails sent.')
}finally{await browser.close()}
