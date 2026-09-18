import { chromium } from '@playwright/test'
const browser = await chromium.launch({channel:'msedge'})
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(120000)
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://localhost:4173',{timeout:120000})
  await page.getByRole('heading',{name:'Qué bueno tenerte aquí.'}).waitFor()
  await page.getByRole('button',{name:'Iniciar sesión'}).waitFor()
  if(errors.length)throw new Error(errors.join('\n'))
  console.log('Supabase login screen verified; no email sent.')
} finally {await browser.close()}
