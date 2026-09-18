import { chromium } from '@playwright/test'
if (!process.argv[2]) throw new Error('Provide the email address authorized for this diagnostic.')
const browser = await chromium.launch({channel:'msedge'})
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(90000)
  page.on('pageerror',e=>console.log('Page error:',e.message))
  await page.goto('https://salud100.netlify.app/',{timeout:90000})
  console.log('Page:',await page.title(),new URL(page.url()).origin)
  await page.getByLabel('Correo electrónico').fill(process.argv[2])
  const responsePromise=page.waitForResponse(r=>r.url().includes('/auth/v1/otp'))
  await page.getByRole('button',{name:'Recibir enlace de acceso'}).click()
  const response=await responsePromise
  console.log('OTP status:',response.status(),'redirect:',new URL(response.url()).searchParams.get('redirect_to'))
  if(!response.ok()){const body=await response.json();console.log('Auth error:',body.code,body.msg??body.message)}
  console.log('UI:',await page.getByRole('status').innerText())
  await page.goto('https://salud100.netlify.app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await page.getByLabel('Correo electrónico').waitFor()
  console.log('Expired-link feedback visible:',await page.getByText(/caduc|venc|expir|inválid/i).count())
} finally {await browser.close()}
