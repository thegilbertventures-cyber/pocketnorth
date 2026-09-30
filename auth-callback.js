// Invitations sent by the dashboard return an implicit session, even when
// password-reset requests initiated by the app use PKCE. Let the SDK validate
// the returned session using the matching protocol.
export function readAuthCallback(href) {
  const url = new URL(href), hash = new URLSearchParams(url.hash.slice(1));
  const type = hash.get('type');
  const implicit = hash.has('access_token') && hash.has('refresh_token');
  const error = hash.get('error') || url.searchParams.get('error');
  return {
    flowType: implicit ? 'implicit' : 'pkce',
    tokenHash: ['recovery','invite'].includes(type) ? hash.get('token_hash') : null,
    tokenType: type,
    passwordSetup: (['invite','recovery'].includes(type) && (implicit || !!hash.get('token_hash'))) || (url.searchParams.has('recovery') && !!url.searchParams.get('code')),
    errorMessage: error ? 'This email link has expired or has already been used. If you accepted an invitation but have not chosen a password, select Forgot password below and request a new link. Otherwise ask the project owner for a new invitation.' : '',
  };
}

export async function verifyEmailLink(client, callback) {
  if (!callback.tokenHash || !['recovery','invite'].includes(callback.tokenType)) throw Error('Invalid email link. Request a new email.');
  const result = await client.auth.verifyOtp({token_hash:callback.tokenHash,type:callback.tokenType});
  if (result.error) throw Error('This email link has expired or has already been used. Request a new password-reset email and use its newest link.');
  if (!result.data.session) throw Error('No verified session was returned. Request a new email.');
  return result.data.session;
}

// UI flow state only; session validation and MFA still gate all private data.
export function createPasswordSetupState(storage,now=()=>Date.now()) {
  const key='pn-password-setup-v2',ttl=30*60*1000;
  storage.removeItem('pn-password-setup'); // Retire the old unbounded user-id marker.
  const clear=()=>{storage.removeItem(key);storage.removeItem('pn-password-setup')};
  const pending=user=>{
    try {const value=JSON.parse(storage.getItem(key));if(value?.user===user&&Number.isFinite(value.started)&&now()>=value.started&&now()-value.started<ttl)return true;}catch{}
    clear();return false;
  };
  return {pending,clear,begin(user){if(!pending(user))storage.setItem(key,JSON.stringify({user,started:now()}))}};
}
