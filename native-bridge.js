// Android 2.4 uses a caller-URL-checked prompt transport. No Java objects are
// exposed to third-party frames, including Turnstile's challenge frame.
(() => {
  if(window.top!==window||!navigator.userAgent.includes('PocketNorth/2.4'))return;
  function call(method,...args){
    const raw=window.prompt('PocketNorthNative',JSON.stringify({method,args}));
    if(raw===null)throw Error('Native access denied.');
    const result=JSON.parse(raw);
    if(result.error)throw Error(result.error);
    return result.value;
  }
  try{if(call('version')!=='2.4')return;}catch{return;}
  window.AndroidVault=Object.fromEntries(['isAvailable','isEnabled','isLocked','getItem','setItem','removeItem','enable','disable','lock'].map(name=>[name,(...args)=>call('vault.'+name,...args)]));
  window.AndroidDeviceFactor=Object.fromEntries(['isAvailable','factor','remove','request'].map(name=>[name,(...args)=>call('device.'+name,...args)]));
  window.AndroidFiles=Object.fromEntries(['openExternal','save'].map(name=>[name,(...args)=>call('files.'+name,...args)]));
})();
