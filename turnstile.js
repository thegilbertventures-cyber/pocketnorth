// Client tokens are verified by Supabase Auth when CAPTCHA enforcement is enabled.
// Never store the Turnstile secret or verification tokens in browser storage.
let loading;
export function loadTurnstile(win=window,doc=document){
  if(win.turnstile)return Promise.resolve(win.turnstile);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const script=doc.createElement('script');
    const timer=setTimeout(()=>fail(),20000);
    function fail(){clearTimeout(timer);script.remove();loading=null;reject(Error('Verification could not load. Check your connection and retry.'));}
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.onerror=fail;
    script.onload=()=>{if(!win.turnstile)return fail();win.turnstile.ready(()=>{clearTimeout(timer);resolve(win.turnstile);});};
    doc.head.append(script);
  });
  return loading;
}

export function captchaEnabled(config,hostname){
  return !!config.turnstileSiteKey&&config.turnstileHosts?.includes(hostname)===true;
}

export function createCaptcha({enabled,siteKey,load=loadTurnstile}){
  let api,widget=null,token='',generation=0,notify=()=>{};
  function clear(){
    generation++;token='';
    if(api&&widget!==null){try{api.remove(widget);}catch{}}
    widget=null;notify=()=>{};
  }
  return {
    clear,
    async mount(container,status,action='signin'){
      clear();if(!enabled||!container)return;
      const mine=generation;
      notify=message=>{if(mine===generation)status(message);};
      notify('Checking your browser…');
      try{
        api=await load();
        if(mine!==generation||container.isConnected===false)return;
        const update=(value,message)=>{if(mine===generation){token=value;notify(message);}};
        widget=api.render(container,{
          sitekey:siteKey,action,theme:'auto',size:'flexible','response-field':false,
          callback:value=>update(value,'Browser verified.'),
          'expired-callback':()=>update('','Verification expired. Please complete it again.'),
          'error-callback':()=>{update('','Verification failed. Retry the browser check.');return true;},
          'timeout-callback':()=>update('','Verification timed out. Retry the browser check.'),
        });
      }catch(e){if(mine===generation)notify(e.message||'Verification could not load. Please retry.');}
    },
    getToken(){
      if(!enabled)return undefined;
      if(!token)throw Error('Complete the browser verification before continuing.');
      return token;
    },
    reset(){
      token='';
      if(enabled&&api&&widget!==null){notify('Checking your browser…');try{api.reset(widget);}catch{notify('Retry the browser check.');}}
    }
  };
}

export async function submitAuth({client,mode,email,password,redirectTo,captcha}){
  const captchaToken=captcha.getToken();
  try{
    if(mode==='signup')return await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,captchaToken}});
    if(mode==='reset')return await client.auth.resetPasswordForEmail(email,{redirectTo:redirectTo+'?recovery=1',captchaToken});
    return await client.auth.signInWithPassword({email,password,options:{captchaToken}});
  }finally{captcha.reset();}
}
