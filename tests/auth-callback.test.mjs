import test from 'node:test';
import assert from 'node:assert/strict';
import {readAuthCallback} from '../auth-callback.js';
import {readFileSync} from 'node:fs';

test('dashboard invitation and recovery callbacks select implicit SDK handling',()=>{
  for(const type of ['invite','recovery']) {
    const callback=readAuthCallback(`https://app.pocketnorthus.com/#access_token=example&refresh_token=example&type=${type}`);
    assert.equal(callback.flowType,'implicit');assert.equal(callback.passwordSetup,true);
  }
});
test('ordinary sign-in and code-based reset keep PKCE handling',()=>{
  assert.equal(readAuthCallback('https://app.pocketnorthus.com/').flowType,'pkce');
  const r=readAuthCallback('https://app.pocketnorthus.com/?recovery=1&code=example');
  assert.equal(r.flowType,'pkce');assert.equal(r.passwordSetup,true);
});
test('used invitation error is actionable and does not echo untrusted URL text',()=>{
  const r=readAuthCallback('https://app.pocketnorthus.com/#error=access_denied&error_code=otp_expired&error_description=untrusted');
  assert.match(r.errorMessage,/Forgot password/);assert.ok(!r.errorMessage.includes('untrusted'));
});
test('invitation session is accepted by the actual bundled Supabase SDK',async()=>{
  const payload={sub:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600,aal:'aal1'};
  const access=[{alg:'HS256',typ:'JWT'},payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test';
  const href=`https://app.pocketnorthus.com/#access_token=${access}&refresh_token=test&expires_in=3600&token_type=bearer&type=invite`;
  const location=new URL(href);
  globalThis.window={location,history:{replaceState(){}},addEventListener(){},removeEventListener(){}};
  globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
  const {createClient}=await import('../supabase.js');
  const broadcast=globalThis.BroadcastChannel;globalThis.BroadcastChannel=undefined;
  const storage=new Map();
  const client=createClient('https://example.supabase.co','test-public-key',{global:{fetch:async()=>new Response(JSON.stringify({id:payload.sub,email:'invite@example.test'}),{headers:{'content-type':'application/json'}})},auth:{flowType:readAuthCallback(href).flowType,detectSessionInUrl:true,autoRefreshToken:false,persistSession:true,storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}});
  const {data,error}=await client.auth.getSession();
  assert.equal(error,null);assert.equal(data.session?.user.id,payload.sub);
  assert.equal(data.session?.access_token,access);
  await new Promise(resolve=>setTimeout(resolve,10));client.auth.stopAutoRefresh();globalThis.BroadcastChannel=broadcast;delete globalThis.window;delete globalThis.document;
});
test('auth gate still enforces MFA before budget data loads',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.ok(app.indexOf("if(level.currentLevel!=='aal2')return showMfa()") < app.indexOf('await load();subscribe();'));
  assert.ok(app.includes('const r=await client.auth.getSession();check(r);'));
});
