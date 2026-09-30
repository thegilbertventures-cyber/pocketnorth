export const dashboardDestinations={income:{tab:'transactions',filter:'income'},spending:{tab:'transactions',filter:'expense'},budget:{tab:'budget',filter:''},net:{tab:'transactions',filter:''}};
export function matchesTransactionView(t,filter=''){
 if(t.removed)return false;
 if(filter==='pending')return t.pending&&!t.excluded;
 if(t.pending)return false;
 if(filter==='excluded')return !!t.excluded;
 if(t.excluded)return false;
 if(filter==='review')return !t.reviewed||t.kind==='unresolved';
 if(['income','expense','savings','transfer'].includes(filter))return t.kind===filter;
 return true;
}
