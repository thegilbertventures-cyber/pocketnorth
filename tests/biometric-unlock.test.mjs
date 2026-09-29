import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const lines=readFileSync(new URL('../app.js',import.meta.url),'utf8').split('\n');
const app={},view={};let enabled=true,locks=0;
const bridge={isEnabled:()=>enabled,lock:()=>locks++};
const c=vm.createContext({captcha:{clear:()=>{}},useCaptcha:false,window:{AndroidVault:bridge},AndroidVault:bridge,config:{supabaseUrl:'https://example.test',supabaseKey:'public',idleMinutes:15},authMode:'signin',esc:x=>x,$:s=>s==='#app'?app:view,session:{user:{email:'test@example.test'}},demo:false,planningAction:async()=>false});
for(const name of ['vaultEnabled','renderAuth','renderSecurity','action'])vm.runInContext(lines.find(l=>l.startsWith((name==='vaultEnabled'?'const ':name==='action'?'async function ':'function ')+name)),c);
vm.runInContext('renderAuth()',c);assert.ok(!app.innerHTML.includes('data-action="mobile-login"'));assert.match(app.innerHTML,/Registered biometric sign-in remains available after signing out/);
vm.runInContext('renderSecurity()',c);assert.match(view.innerHTML,/data-action="vault-lock"/);assert.ok(!view.innerHTML.includes('data-action="mobile-enroll"'));
await vm.runInContext("action('vault-lock')",c);assert.equal(locks,1);
c.session=null;await assert.rejects(vm.runInContext("action('vault-lock')",c),/Sign in and enable/);assert.equal(locks,1);

enabled=false;vm.runInContext('renderSecurity()',c);assert.ok(!view.innerHTML.includes('data-action="vault-lock"'));
console.log('Signed-out UI, supported lock action, and unsupported MFA guards passed.');

c.config.inviteOnly=true;c.authMode="signup";vm.runInContext("renderAuth()",c);assert.ok(!app.innerHTML.includes('data-auth="signup"'));assert.match(app.innerHTML,/invite-only/);

