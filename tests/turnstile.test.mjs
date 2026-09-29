import test from 'node:test';
import assert from 'node:assert/strict';
import {captchaEnabled,createCaptcha,submitAuth,loadTurnstile} from '../turnstile.js';

function harness(){
  let handlers,resetCount=0,removed=0;
  const api={render:(_,options)=>{handlers=options;return 'widget';},reset:()=>resetCount++,remove:()=>removed++};
  const captcha=createCaptcha({enabled:true,siteKey:'public-key',load:async()=>api});
  return {captcha,handlers:()=>handlers,resetCount:()=>resetCount,removed:()=>removed};
}
test('staged hostname configuration preserves existing app logins',()=>{
  const config={turnstileSiteKey:'public-key',turnstileHosts:['app.pocketnorthus.com']};
  assert.equal(captchaEnabled(config,'app.pocketnorthus.com'),true);
  assert.equal(captchaEnabled(config,'thegilbertventures-cyber.github.io'),false);
  assert.equal(captchaEnabled(config,'app.pocketnorthus.com.evil.test'),false);
  assert.equal(createCaptcha({enabled:false}).getToken(),undefined);
});
test('missing, expired and failed verification never permit an auth call',async()=>{
  const h=harness();await h.captcha.mount({},()=>{});
  let calls=0;const client={auth:{signInWithPassword:async()=>calls++}};
  await assert.rejects(submitAuth({client,captcha:h.captcha}),/Complete the browser verification/);
  h.handlers().callback('one');assert.equal(h.captcha.getToken(),'one');
  h.handlers()['expired-callback']();assert.throws(()=>h.captcha.getToken());
  h.handlers().callback('two');h.handlers()['error-callback']();assert.throws(()=>h.captcha.getToken());
  assert.equal(calls,0);
});
test('all auth routes pass tokens to Supabase and discard them after each attempt',async()=>{
  for(const mode of ['signin','reset','signup']){
    const h=harness();await h.captcha.mount({},()=>{});h.handlers().callback('token');
    let args;const record=async(...a)=>{args=a;return {error:{message:'Rejected'}};};
    const client={auth:{signInWithPassword:record,signUp:record,resetPasswordForEmail:record}};
    await submitAuth({client,mode,email:'sample@example.test',password:'sample',redirectTo:'https://app.example.test/',captcha:h.captcha});
    assert.equal(mode==='reset'?args[1].captchaToken:args[0].options.captchaToken,'token');
    if(mode==='reset')assert.equal(args[1].redirectTo,'https://app.example.test/?recovery=1');
    assert.equal(h.resetCount(),1);assert.throws(()=>h.captcha.getToken());
  }
});
test('network errors consume the token; remount invalidates old callbacks',async()=>{
  const h=harness();await h.captcha.mount({},()=>{});const old=h.handlers();old.callback('token');
  await assert.rejects(submitAuth({client:{auth:{signInWithPassword:async()=>{throw Error('offline');}}},captcha:h.captcha}),/offline/);
  assert.equal(h.resetCount(),1);
  await h.captcha.mount({},()=>{});old.callback('stale');assert.throws(()=>h.captcha.getToken());
  assert.equal(h.removed(),1);
});
test('navigation away during script load does not mount a stale widget',async()=>{
  let resolve,renders=0;
  const captcha=createCaptcha({enabled:true,load:()=>new Promise(r=>resolve=r)});
  const promise=captcha.mount({},()=>{});captcha.clear();
  resolve({render:()=>renders++});await promise;assert.equal(renders,0);
});
test('script failures remain blocked and a retry can recover',async()=>{
  let attempts=0,options;const status=[];
  const captcha=createCaptcha({enabled:true,load:async()=>{if(!attempts++)throw Error('offline');return {render:(_,o)=>{options=o;return 'id';}};}});
  await captcha.mount({},s=>status.push(s));assert.equal(status.at(-1),'offline');assert.throws(()=>captcha.getToken());
  await captcha.mount({},()=>{});options.callback('fresh');assert.equal(captcha.getToken(),'fresh');
});

test('async loader uses the supported onload callback without calling ready',async()=>{
 const win={};let script;
 const doc={createElement:()=>({remove(){}}),head:{append:s=>{script=s;win.turnstile={ready:()=>{throw Error('ready must not be used for async script');}};win.pocketnorthTurnstileReady();}}};
 assert.equal(await loadTurnstile(win,doc),win.turnstile);
 assert.match(script.src,/onload=pocketnorthTurnstileReady/);
});
