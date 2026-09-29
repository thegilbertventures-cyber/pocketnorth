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
    passwordSetup: type === 'invite' || type === 'recovery' || url.searchParams.has('recovery'),
    errorMessage: error ? 'This email link has expired or has already been used. If you accepted an invitation but have not chosen a password, select Forgot password below and request a new link. Otherwise ask the project owner for a new invitation.' : '',
  };
}
