import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('src/lib/auth-feedback.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {authErrorMessage,readAuthRedirectError}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
assert.match(authErrorMessage({status:429}),/límite de correos/)
assert.match(authErrorMessage({code:'over_email_send_rate_limit'}),/límite de correos/)
globalThis.window={location:{hash:'#error=access_denied&error_code=otp_expired',search:''}}
assert.match(readAuthRedirectError(),/ya fue usado o venció/)
window.location={hash:'',search:'?error_code=otp_expired'}
assert.match(readAuthRedirectError(),/ya fue usado o venció/)
window.location={hash:'#access_token=not-logged',search:''}
assert.equal(readAuthRedirectError(),'')
assert.match(authErrorMessage(null),/No pudimos completar/)
console.log('6 auth feedback checks passed.')
