# PocketNorth

Personal budgeting app backed by Supabase. GitHub Pages publishes the root of the main branch.

The root HTML, CSS, JavaScript, and public configuration are the live web app. Android loads the same HTTPS site. Financial records and private bank tokens are never stored here.

PocketNorth_Developer_Source.zip contains the full modular source, Android project, database migrations, Edge Function, deployment instructions, and local tests. Source changes should also update this archive when appropriate. The hosted schema is already applied; do not blindly reapply initial migrations.

Plaid and optional AI require server secrets and end-to-end checks before use.
