import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoginSync} from '../login-sync.js';
import {readFileSync} from 'node:fs';
test('one attempt per login, repeated focus coalesces and reset enables another login',async()=>{
 const sync=createLoginSync();let calls=0,resolve;const status=[];
 const run=async()=>{calls++;await new Promise(r=>resolve=r)};
 const first=sync.start('user',true,run,s=>status.push(s));
 const second=sync.start('user',true,run,s=>status.push(s));
 assert.equal(calls,1);assert.equal(first,second);resolve();await first;
 await sync.start('user',true,run,()=>{});assert.equal(calls,1);
 sync.reset();await sync.start('user',true,async()=>calls++,()=>{});assert.equal(calls,2);
 assert.deepEqual(status,['Syncing bank accounts…','Bank sync complete']);
});
test('no banks means no request; later linked banks can sync',async()=>{
 const sync=createLoginSync();let calls=0;
 await sync.start('user',false,async()=>calls++,()=>{});assert.equal(calls,0);
 await sync.start('user',true,async()=>calls++,()=>{});assert.equal(calls,1);
});
test('failure does not block dashboard or retry repeatedly on focus',async()=>{
 const sync=createLoginSync(),status=[];let calls=0;
 const run=async()=>{calls++;throw Error('Bank unavailable')};
 await sync.start('user',true,run,s=>status.push(s));await sync.start('user',true,run,()=>{});
 assert.equal(calls,1);assert.match(status.at(-1),/retry in Accounts/);
});
test('signout invalidates stale completion and refresh callbacks',async()=>{
 const sync=createLoginSync(),status=[];let release,isCurrent;
 const promise=sync.start('old',true,async current=>{isCurrent=current;await new Promise(r=>release=r)},s=>status.push(s));
 sync.reset();assert.equal(isCurrent(),false);release();await promise;
 assert.deepEqual(status,['Syncing bank accounts…']);
});
test('automatic sync is wired only after MFA and data load, with expected user guard',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const gate=source.split('\n').find(l=>l.startsWith('async function runAuthGate'));
 assert.ok(gate.indexOf("level.currentLevel!=='aal2'")<gate.indexOf('syncAfterLogin()'));
 assert.ok(gate.indexOf('await load()')<gate.indexOf('syncAfterLogin()'));
 assert.match(source,/api\('sync',\{\},user\)/);
 assert.match(source,/expectedUser&&s.user.id!==expectedUser/);
});
