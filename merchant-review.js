import {norm,classify} from './core.js';

// Use the same exact, case/whitespace-normalized merchant key as import rules.
export function merchantReviewUpdates(rows,selected,choice,categories){
  if(choice.kind==='unresolved'||choice.excluded)return [];
  const merchant=norm(selected.description);
  if(!merchant)return [];
  return rows.filter(t=>t.id!==selected.id&&norm(t.description)===merchant&&
    Math.sign(t.amount_cents)===Math.sign(selected.amount_cents)&&
    !t.excluded&&!t.removed&&!t.pending&&
    !/duplicate/i.test(t.review_reason||'')).map(t=>{
      let category_id=choice.category_id,kind=choice.kind;
      // The gas-station threshold takes precedence, just as it does on import.
      const gas=classify(t.description,t.amount_cents);
      if(gas.category==='Fuel'||gas.category==='Gas Station'){
        const category=categories.find(c=>!c.archived&&c.system_key===(gas.category==='Fuel'?'fuel':'gas_station'));
        if(!category)return null;
        category_id=category.id;kind='expense';
      }
      return {id:t.id,revision:t.updated_at,patch:{category_id,kind,reviewed:true,manual_category:true}};
    }).filter(Boolean);
}

export async function applyMerchantReviews(updates,update){
  let saved=0,failed=0;
  for(let i=0;i<updates.length;i+=4){
    const results=await Promise.allSettled(updates.slice(i,i+4).map(t=>update('transactions',t.id,t.patch,t.revision)));
    saved+=results.filter(r=>r.status==='fulfilled').length;
    failed+=results.filter(r=>r.status==='rejected').length;
  }
  return {saved,failed};
}
