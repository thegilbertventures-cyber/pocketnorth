// Mobile-only UI; server verification, not a client flag, grants AAL2 access.
export const isMobile=()=>!!window.AndroidVault||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export const biometricAvailable=()=>window.AndroidPasskeys?AndroidPasskeys.isAvailable():!window.AndroidVault&&isMobile()&&!!window.PublicKeyCredential;
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function serialize(c){return {id:c.id,rawId:b64(c.rawId),type:c.type,authenticatorAttachment:c.authenticatorAttachment,clientExtensionResults:c.getClientExtensionResults(),response:Object.fromEntries(['clientDataJSON','attestationObject','authenticatorData','signature','userHandle'].filter(k=>c.response[k]).map(k=>[k,b64(c.response[k])]).concat(c.response.getTransports?[['transports',c.response.getTransports()]]:[]))}}
let active=null;
window.addEventListener('pocketnorth-credential',e=>{if(!active||e.detail.id!==active.id)return;const a=active;active=null;clearTimeout(a.timeout);e.detail.error?a.reject(Error(e.detail.error)):a.resolve(JSON.parse(e.detail.credential))});
async function ceremony(type,options){
 if(!biometricAvailable())throw Error('Biometric verification requires PocketNorth 2.2 on Android 14+, or a supported mobile browser.');
 if(type==='create')options.authenticatorSelection={...options.authenticatorSelection,authenticatorAttachment:'platform',residentKey:'required',requireResidentKey:true,userVerification:'required'};else options.userVerification='required';
 if(window.AndroidPasskeys)return new Promise((resolve,reject)=>{if(active)return reject(Error('Finish the current phone verification first.'));const id=crypto.randomUUID();active={id,resolve,reject,timeout:setTimeout(()=>{active=null;reject(Error('Phone verification timed out. Try again.'))},180000)};AndroidPasskeys.request(id,type,JSON.stringify(options))});
 const publicKey={...options,challenge:bytes(options.challenge)};
 if(type==='create'){publicKey.user={...options.user,id:bytes(options.user.id)};publicKey.excludeCredentials=(options.excludeCredentials||[]).map(x=>({...x,id:bytes(x.id)}))}else publicKey.allowCredentials=(options.allowCredentials||[]).map(x=>({...x,id:bytes(x.id)}));
 const credential=await navigator.credentials[type==='create'?'create':'get']({publicKey});if(!credential)throw Error('Verification was canceled.');return serialize(credential);
}
export async function biometricFactor(client,config,factorId=null){
 const current=await client.auth.getSession();if(current.error)throw current.error;if(!current.data.session)throw Error('Enter your email and password first.');
 const headers={apikey:config.supabaseKey,Authorization:'Bearer '+current.data.session.access_token,'Content-Type':'application/json'};
 async function post(path,body){const r=await fetch(config.supabaseUrl+'/auth/v1'+path,{method:'POST',headers,body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.msg||j.message||j.error_description||'Phone verification is not available. Use your authenticator or try again.');return j}
 let created=false;
 if(!factorId){const aal=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aal.error)throw aal.error;if(aal.data.currentLevel!=='aal2')throw Error('Verify your existing authenticator once before adding this phone.');const enrolled=await client.auth.mfa.enroll({factorType:'webauthn',friendlyName:'PocketNorth mobile '+new Date().toISOString().slice(0,10)});if(enrolled.error)throw enrolled.error;factorId=enrolled.data.id;created=true;}
 try{const challenge=await post('/factors/'+factorId+'/challenge',{}),type=challenge.webauthn.type;
 const options=challenge.webauthn.credential_options.publicKey;
 if(type==='create'){options.user.name=options.user.name||current.data.session.user.email||'PocketNorth user';options.user.displayName=options.user.displayName||'PocketNorth';}
 const credential=await ceremony(type,options);
 const result=await post('/factors/'+factorId+'/verify',{challenge_id:challenge.id,webauthn:{type,credential_response:credential}});
 const saved=await client.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});if(saved.error)throw saved.error;
 }catch(e){if(created)await client.auth.mfa.unenroll({factorId}).catch(()=>{});throw e}
}
