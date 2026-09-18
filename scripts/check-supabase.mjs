import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split(/\r?\n/).map(line => {const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]}))
for (const path of ['/auth/v1/settings','/rest/v1/readings?select=id&limit=0']) {
  const response = await fetch(env.VITE_SUPABASE_URL+path,{headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(20000)})
  const body = await response.json()
  console.log(path, response.status, path.includes('settings') ? {emailEnabled:body.external?.email,signupDisabled:body.disable_signup,error:body.msg??body.message} : body)
}
