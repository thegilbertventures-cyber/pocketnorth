import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeAccountIds,scopedTransactions,spendingSnapshot,budgetSuggestions} from '../spending.js';
import {spendingChart} from '../dashboard.js';
const accounts=[{id:'a'},{id:'b'},{id:'new'},{id:'old',bank_item_id:'sandbox'}],connections=[{item_id:'sandbox',status:'sandbox_archived'}];
const categories=[{id:'food',name:'Food'},{id:'rent',name:'Rent'},{id:'review',name:'Needs review',system_key:'review'}];
const row=(date,amount=-10000,extra={})=>({id:date,date:'2026-09-'+date,amount_cents:amount,category_id:'food',account_id:'a',kind:'expense',reviewed:true,...extra});
test('account preferences default include, exclude saved choices, allow individual override and empty selection',()=>{
 assert.deepEqual(scopeAccountIds(accounts,connections),['a','b','new']);
 assert.deepEqual(scopeAccountIds(accounts,connections,{excludedAccountIds:['b']}),['a','new']);
 assert.deepEqual(scopeAccountIds(accounts,connections,{excludedAccountIds:['b']},'b'),['b']);
 assert.deepEqual(scopeAccountIds(accounts,connections,{},'foreign'),[]);
 assert.deepEqual(scopeAccountIds(accounts,connections,{excludedAccountIds:['a','b','new']}),[]);
 assert.equal(scopedTransactions([row('01'),row('02',-900,{account_id:'b'})],['a']).length,1);
});
test('current pace projections use calendar days and exclude pending, duplicates, removed and transfers',()=>{
 const rows=[row('01'),row('10'),row('15'),row('16',-999,{pending:true}),row('16',-999,{excluded:true}),row('16',-999,{removed:true}),row('16',-999,{kind:'transfer'}),row('01',-150000,{category_id:'rent'})];
 const s=spendingSnapshot(rows,categories,[{month:'2026-09',category_id:'food',amount_cents:20000}],'2026-09','2026-09-15');
 assert.equal(s.spending_cents,180000);assert.equal(s.categories[0].projected_cents,60000);
 assert.equal(s.categories[1].projected_cents,null);assert.equal(s.categories[0].proposed_target_cents,60000);
 assert.equal(budgetSuggestions(s).find(c=>c.id==='food').target_cents,20000);
});
test('sparse/stale/early/future data never produces misleading pace projections',()=>{
 for(const today of ['2026-09-03','2026-09-29','2026-08-30','2026-10-01']){
  const s=spendingSnapshot([row('01'),row('02'),row('03')],categories,[],'2026-09',today);
  assert.equal(s.categories[0].projected_cents,null);
 }
});
test('refunds reduce categories; pie handles zero and single-category data and escapes labels',()=>{
 const s=spendingSnapshot([row('01'),row('02',2500)],categories,[],'2026-09','2026-09-29');
 assert.equal(s.spending_cents,7500);assert.match(spendingChart(s,'Checking'),/100.0%/);assert.match(spendingChart(s,'Checking'),/<circle cx="110"/);
 s.categories[0].name='<img src=x onerror=alert(1)>';assert.ok(!spendingChart(s,'Checking').includes('<img'));
 assert.match(spendingChart(spendingSnapshot([],categories,[],'2026-09'),'None'),/No categorized spending/);
});
