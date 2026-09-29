import {totals} from './core.js';

export function scopeAccountIds(accounts,connections,settings={},selected=''){
  const active=accounts.filter(a=>!connections.some(b=>b.item_id===a.bank_item_id&&b.status==='sandbox_archived'));
  if(selected)return active.filter(a=>a.id===selected).map(a=>a.id);
  const excluded=new Set(Array.isArray(settings.excludedAccountIds)?settings.excludedAccountIds:[]);
  return active.filter(a=>!excluded.has(a.id)).map(a=>a.id);
}
export function scopedTransactions(rows,ids){const allowed=new Set(ids);return rows.filter(t=>allowed.has(t.account_id));}
export function spendingSnapshot(rows,categories,budgets,month,today=new Date().toISOString().slice(0,10)){
  const [year,m]=month.split('-').map(Number),days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const state=month<today.slice(0,7)?'past':month===today.slice(0,7)?'current':'future';
  const elapsed=state==='past'?days:state==='current'?Number(today.slice(8,10)):0;
  const active=rows.filter(t=>t.date.startsWith(month)&&t.date<=today&&!t.excluded&&!t.pending&&!t.removed);
  const sums=totals(active),latest=active.map(t=>t.date).sort().at(-1)||null;
  const list=categories.map(c=>{
    const transactions=active.filter(t=>t.category_id===c.id&&t.kind==='expense');
    const dates=[...new Set(transactions.filter(t=>t.amount_cents<0).map(t=>Number(t.date.slice(8,10))))].sort((a,b)=>a-b);
    const actual=sums.by[c.id]||0,target=budgets.find(b=>b.category_id===c.id&&b.month===month)?.amount_cents||0;
    // Sparse activity (e.g. a single rent payment) must not be extrapolated.
    const paceEligible=state==='current'&&elapsed>=7&&dates.length>=3&&dates[0]<=7&&dates.at(-1)>=elapsed-7;
    const projected=paceEligible?Math.max(actual,Math.round(actual/elapsed*days)):null;
    const basis=Math.max(0,actual,projected||0),proposed=!c.archived&&c.system_key!=='review'&&basis>0&&(target===0||basis>target+1000)?Math.ceil(basis/1000)*1000:null;
    return {id:c.id,name:c.name,actual_cents:actual,target_cents:target,projected_cents:projected,proposed_target_cents:proposed,remaining_cents:target-actual};
  });
  return {month,period:state,elapsed_days:elapsed,days_in_month:days,latest_imported_date:latest,income_cents:sums.income,spending_cents:sums.spend,unresolved_outgoing_cents:sums.unresolved,review_count:active.filter(t=>!t.reviewed||t.kind==='unresolved').length,categories:list};
}
export function budgetSuggestions(snapshot){
  return snapshot.categories.filter(c=>c.proposed_target_cents!=null).sort((a,b)=>(b.proposed_target_cents-b.target_cents)-(a.proposed_target_cents-a.target_cents)).slice(0,3);
}
