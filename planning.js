// Transparent planning calculations. All monetary values are integer USD cents.
export const sources={usda:'https://www.fna.usda.gov/sites/default/files/resource-files/cnpp-costfood-3levels-july2026.pdf',bls:'https://www.bls.gov/news.release/cesan.nr0.htm',miles:'https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm1.cfm',debt:'https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/'};
export const householdGroups=[['adult','Adults 19–50',29675,36790,45885],['older','Adults 51+',28330,35048,42335],['one','Children age 1',16580,18670,22680],['two','Children ages 2–3',17380,20740,25260],['four','Children ages 4–5',17930,22190,26830],['six','Children ages 6–8',26280,30510,35700],['nine','Children ages 9–11',27160,35020,40820],['twelve','Children ages 12–13',29320,35735,43120],['teen','Children ages 14–18',29660,36415,43765]];
export const goalLabels={debt:'Pay off debt',buffer:'Build an emergency fund',home:'Save for a home',spending:'Spend more intentionally',retirement:'Prepare for retirement',other:'Another savings goal'};
export function freshProfile(categories=[]){const find=(names)=>categories.filter(c=>names.includes(c.name)).map(c=>c.id);return {version:1,completed:false,goals:[],household:{adult:1},foodPlan:1,foodAdjustment:0,monthlyIncome:null,essentialMonthly:null,liquidSavings:null,emergencyMonths:3,goalName:'',goalAmount:null,goalSaved:0,goalDate:'',monthlySaving:null,extraDebt:0,strategy:'avalanche',debts:[],vehicles:[],categoryMap:{groceries:find(['Groceries']),restaurants:find(['Restaurants & Dining','Coffee']),shopping:find(['Shopping']),fuel:categories.filter(c=>c.system_key==='fuel'||c.name==='Fuel').map(c=>c.id)}}}
export function groceries(p){let count=0,base=0;for(const [key,,...costs] of householdGroups){const n=Math.max(0,Number(p.household?.[key])||0);count+=n;base+=n*costs[p.foodPlan??1]}const factor=count===1?1.2:count===2?1.1:count===3?1.05:count===4?1:count<=6?.95:.9;return {count,base:Math.round(base*factor),target:Math.max(0,Math.round(base*factor)+(p.foodAdjustment||0)),factor}}
export function fuel(p){return (p.vehicles||[]).map(v=>({...v,monthlyMiles:v.annualMiles/12,monthlyCost:Math.round(v.annualMiles/12/v.mpg*v.priceCents)}))}
export const previousMonth=m=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-2,1)).toISOString().slice(0,7)};
export function categoryComparison(transactions,ids,month,today=new Date().toISOString().slice(0,10)){
 const prior=previousMonth(month),partial=month===today.slice(0,7),cutoff=partial?+today.slice(8):31;
 const valid=transactions.filter(t=>!t.pending&&!t.removed&&!t.excluded);
 const inPeriod=(t,m)=>t.date.slice(0,7)===m&&+t.date.slice(8)<=cutoff;
 const sum=m=>Math.max(0,-valid.filter(t=>inPeriod(t,m)&&t.kind==='expense'&&ids.includes(t.category_id)).reduce((a,t)=>a+t.amount_cents,0));
 const current=sum(month),previous=sum(prior),hasCurrent=valid.some(t=>inPeriod(t,month)),hasPrevious=valid.some(t=>inPeriod(t,prior));
 const txns=valid.filter(t=>inPeriod(t,month)&&t.kind==='expense'&&t.amount_cents<0&&ids.includes(t.category_id));
 return {current,previous,prior,partial,cutoff,hasCurrent,hasPrevious,delta:hasCurrent&&hasPrevious?current-previous:null,percent:hasCurrent&&hasPrevious&&previous>0?(current-previous)/previous*100:null,count:txns.length,average:txns.length?Math.round(txns.reduce((s,t)=>s-t.amount_cents,0)/txns.length):0};
}
export function payoff(debts,extra=0,strategy='avalanche'){
 const rows=debts.filter(d=>d.balance>0).map(d=>({...d,left:d.balance,interest:0,paidAt:null}));
 if(rows.some(d=>![d.balance,d.apr,d.minimum].every(Number.isFinite)||d.balance<0||d.apr<0||d.apr>100||d.minimum<=0)||!Number.isFinite(extra)||extra<0)throw Error('Enter valid balances, APRs, and minimum payments.');
 const order=(a,b)=>strategy==='snowball'?a.left-b.left||b.apr-a.apr:b.apr-a.apr||a.left-b.left;
 const first=[...rows].sort(order)[0],budget=rows.reduce((s,d)=>s+d.minimum,0)+extra,schedule=[];
 let totalInterest=0,totalPaid=0,months=0;
 while(rows.some(d=>d.left>0)&&months<600){months++;let remaining=budget;
  for(const d of rows.filter(d=>d.left>0)){const interest=Math.round(d.left*d.apr/1200);d.left+=interest;d.interest+=interest;totalInterest+=interest;const pay=Math.min(d.minimum,d.left);d.left-=pay;remaining-=pay;totalPaid+=pay;}
  for(const d of rows.filter(d=>d.left>0).sort(order)){const pay=Math.min(Math.max(0,remaining),d.left);d.left-=pay;remaining-=pay;totalPaid+=pay;}
  for(const d of rows)if(d.left===0&&!d.paidAt)d.paidAt=months;
  schedule.push({month:months,balance:rows.reduce((s,d)=>s+d.left,0),interest:totalInterest});
  if(totalInterest>1e12)break;
 }
 return {months,paidOff:rows.every(d=>d.left===0),interest:totalInterest,totalPaid,budget,first: first?.id,rows,schedule};
}
export function requiredPayment(balance,apr,months){if(!months)return null;const r=apr/1200;return Math.ceil(r?balance*r/(1-Math.pow(1+r,-months)):balance/months)}
export function savingsGoal(p,today=new Date().toISOString().slice(0,10)){
 if(!p.goalAmount||!p.goalDate)return null;const [y,m]=today.split('-').map(Number),[gy,gm]=p.goalDate.split('-').map(Number);const months=(gy-y)*12+gm-m;const gap=Math.max(0,p.goalAmount-(p.goalSaved||0));return {gap,months,needed:months>0?Math.ceil(gap/months):gap,onTrack:p.monthlySaving==null?null:(p.monthlySaving*months>=gap&&months>0)||gap===0};
}
export function recurring(transactions,month){const start=previousMonth(previousMonth(month));const groups=new Map();for(const t of transactions){if(t.date.slice(0,7)<start||t.date.slice(0,7)>month||t.kind!=='expense'||t.amount_cents>=0||t.excluded||t.pending||t.removed)continue;const key=t.description.toLowerCase().replace(/\d+/g,'').trim();const g=groups.get(key)||[];g.push(t);groups.set(key,g)}return [...groups.values()].filter(g=>new Set(g.map(t=>t.date.slice(0,7))).size>=2&&g.length<=4&&Math.max(...g.map(t=>-t.amount_cents))/Math.min(...g.map(t=>-t.amount_cents))<1.15).map(g=>({name:g[0].description,monthly:Math.round(-g.reduce((s,t)=>s+t.amount_cents,0)/g.length),count:g.length})).sort((a,b)=>b.monthly-a.monthly).slice(0,8)}
export function planningSummary(p,transactions,month,today){const comparison=Object.fromEntries(Object.entries(p.categoryMap).map(([k,ids])=>[k,categoryComparison(transactions,ids,month,today)]));const food=groceries(p),vehicles=fuel(p),goal=savingsGoal(p,today);return {comparison,food,fuelTarget:vehicles.reduce((s,v)=>s+v.monthlyCost,0),vehicles,goal,buffer:p.essentialMonthly>0&&p.liquidSavings!=null?{months:p.liquidSavings/p.essentialMonthly,gap:Math.max(0,p.essentialMonthly*p.emergencyMonths-p.liquidSavings)}:null,recurring:recurring(transactions,month)}}
