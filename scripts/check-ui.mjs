import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
await mkdir('artifacts',{recursive:true})
const browser = await chromium.launch({channel:'msedge'})
try {
  for (const [name,width,height] of [['desktop',1440,1100],['mobile',390,844]]) {
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
    page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(120000); const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto('http://127.0.0.1:4173')
    await page.getByRole('button',{name:'Guardar medición',exact:true}).waitFor()
    await page.screenshot({path:`artifacts/${name}.png`,fullPage:true})
    for(const [value,fasting] of [['97','Sí, en ayunas'],['124','No']]) {
      await page.getByLabel('¿Qué valor marcó tu glucómetro?').fill(value)
      await page.getByRole('button',{name:fasting,exact:true}).click()
      await page.getByRole('button',{name:'Guardar medición',exact:true}).click()
      await page.getByRole('button',{name:`Editar medición de ${value}`}).waitFor()
    }
    await page.screenshot({path:`artifacts/${name}-with-data.png`,fullPage:true})
    if(errors.length)throw new Error(errors.join('\n'))
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error(`Overflow in ${name}`)
    await page.close()
  }
  console.log('Desktop and mobile: no runtime errors or horizontal overflow.')
} finally {await browser.close()}
