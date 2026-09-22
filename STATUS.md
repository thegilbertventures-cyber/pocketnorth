# PocketNorth deployment status

- Live site: https://thegilbertventures-cyber.github.io/pocketnorth/
- Repository: https://github.com/thegilbertventures-cyber/pocketnorth
- Supabase project: nsnvijabnzqqcxbuwdlk (PocketNorth).
- Database setup applied; all 10 tables have RLS enabled. Privileged implementations are in pocketnorth_private.
- Security Advisor: 0 errors, 0 warnings after rerun.
- Signup and email confirmation enabled; TOTP enabled; secure email/password changes enabled; password minimum 12 characters. Access token expiry configured to 600 seconds.
- Website and allowed auth callback URLs configured.
- pocketnorth-api deployed with explicit verified-user JWT and AAL2 checks.
- SITE_URL, TOKEN_ENCRYPTION_KEY and PLAID_ENV=sandbox configured as server secrets.
- Live negative tests: API rejects unauthenticated requests; anonymous transactions and bank-token table access denied.
- Android APK v2 built and signature verified; signing certificate matches original Our Budget APK. Loads the live HTTPS site. Not tested on a physical device.

Remaining: user must enter PLAID_CLIENT_ID and PLAID_SECRET (Sandbox) in Supabase Edge Function secrets; then test Link, sync, and disconnect. Actual ICCU access requires production credentials/approval. Optional AI needs OPENAI_API_KEY and OPENAI_MODEL. Production email service/SMTP is not configured; Supabase default email restrictions apply. Full signup/MFA/recovery and cross-device tests still require a user account.

Export a JSON backup from the original Our Budget app before installing the upgrade. Then import that v1 backup into the new cloud account; old local records are not uploaded automatically.
