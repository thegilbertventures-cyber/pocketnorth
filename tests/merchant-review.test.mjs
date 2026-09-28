import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantReviewUpdates,applyMerchantReviews} from '../merchant-review.js';
const row=(id,extra={})=>({id,description:'Example Store',amount_cents:-4500,kind:'unresolved',reviewed:false,updated_at:'revision-1',...extra});
const choice={category_id:'groceries',kind:'expense',note:'only this row',excluded:false};
test('matches normalized merchants across dates and accounts; preserves other fields',()=>{
 const rows=[row('selected'),row('other',{description:'  EXAMPLE   STORE ',account_id:'another',date:'2025-01-01',note:'keep me'}),row('different',{description:'Example Store Outlet'})];
 const changes=merchantReviewUpdates(rows,rows[0],choice,[]);
 assert.deepEqual(changes,[{id:'other',revision:'revision-1',patch:{category_id:'groceries',kind:'expense',reviewed:true,manual_category:true}}]);
 assert.equal(rows[1].note,'keep me');assert.equal(rows[1].reviewed,false);
});
test('leaves reviewed, excluded, removed, pending, refunds and duplicates untouched',()=>{
 const rows=[row('selected'),row('reviewed',{reviewed:true,kind:'expense'}),row('excluded',{excluded:true}),row('removed',{removed:true}),row('pending',{pending:true}),row('refund',{amount_cents:100}),row('duplicate',{review_reason:'Possible duplicate. Different IDs are retained for review.'})];
 assert.equal(merchantReviewUpdates(rows,rows[0],choice,[]).length,0);
 assert.equal(merchantReviewUpdates([row('selected'),row('other')],row('selected'),{...choice,kind:'unresolved'},[]).length,0);
 assert.equal(merchantReviewUpdates([row('selected'),row('other')],row('selected'),{...choice,excluded:true},[]).length,0);
});
test('gas station threshold stays strictly above $30',()=>{
 const rows=[row('selected',{description:'Chevron'}),...[-2999,-3000,-3001].map((amount_cents,i)=>row(String(i),{description:'Chevron',amount_cents}))];
 const result=merchantReviewUpdates(rows,rows[0],choice,[{id:'fuel',system_key:'fuel'},{id:'gas',system_key:'gas_station'}]);
 assert.deepEqual(result.map(t=>t.patch.category_id),['gas','gas','fuel']);
});
test('persists only the planned fields with concurrency revisions and reports failures',async()=>{
 const updates=merchantReviewUpdates([row('selected'),row('ok'),row('conflict')],row('selected'),choice,[]),calls=[];
 const result=await applyMerchantReviews(updates,async(...args)=>{calls.push(args);if(args[1]==='conflict')throw Error('Changed on another device');});
 assert.deepEqual(result,{saved:1,failed:1});
 assert.deepEqual(calls[0],['transactions','ok',updates[0].patch,'revision-1']);
});
