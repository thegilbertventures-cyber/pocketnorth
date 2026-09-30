// Persist only the user's intent, never Plaid URLs, tokens or credentials.
// A return URL is a wake-up signal; only the server can confirm authorization.
export function createBankFlow({storage,context,request,notify,updated,now=Date.now,schedule=setTimeout,cancel=clearTimeout,visible=()=>true}){
 const key='pn-bank-flow-v1';let timer=null,flight=null,generation=0,lastCheck=0;
 function read(){try{const p=JSON.parse(storage.getItem(key));return p&&p.scope===context()&&now()-p.started<6*3600000?p:null;}catch{return null;}}
 function save(p){try{storage.setItem(key,JSON.stringify(p));}catch{}}
 function clear(){try{storage.removeItem(key);}catch{}}
 function pause(){generation++;cancel(timer);timer=null;flight=null;lastCheck=0;}
 function plan(delay=15000){cancel(timer);timer=schedule(()=>{void resume();},delay);}
 async function resume(){
  const p=read();if(!p||!visible())return false;
  if(flight)return flight;
  if(now()-lastCheck<10000){plan();return true;}
  if((p.checks||0)>=60){notify('Authorization is still pending. Return to Plaid to finish, or start again in Accounts.');return true;}
  const ticket=generation,scope=p.scope,current=()=>ticket===generation&&scope===context()&&read()?.started===p.started&&read()?.session_id===p.session_id;
  lastCheck=now();p.checks=(p.checks||0)+1;save(p);
  flight=(async()=>{
   try{
    const r=await request(p.phase==='sync'?'sync':'link-finish',p.session_id?{session_id:p.session_id}:{});if(!current())return true;
    if(p.phase==='sync'){
     notify(r.message||'Bank sync complete');await updated(current);if(!current())return true;if(p.followups>0){p.followups--;save(p);plan(60000);}else clear();return true;
    }
    if(r.state==='waiting'){
     notify('Waiting for bank authorization. Updates will sync automatically when it finishes.');
     if(p.checks%12)plan();else notify('Still waiting for the bank. Finish in Plaid; we’ll check again when you return.');
    }else if(r.state==='connected'||r.state==='none'){
     // Another tab may already have finalized this actor's connection.
     p.phase='sync';p.checks=0;save(p);notify(r.message||'Checking bank updates…');
     await updated(current);if(current())plan(20000);
    }else throw Error('Unexpected bank response.');
   }catch(e){
    if(!current())return true;
    notify(p.phase==='sync'?'Bank connected; updates are delayed. Retrying automatically…':'Unable to check authorization yet. We’ll retry automatically.');
    if(p.checks%3)plan(20000);else notify('Bank updates are delayed. Return to Accounts to retry Sync.');
   }finally{if(ticket===generation)flight=null;}
   return true;
  })();return flight;
 }
 return {pending:()=>!!read(),begin(session_id){pause();save({scope:context(),session_id,started:now(),phase:'link',checks:0});notify('Complete authorization in Plaid. We’ll finish and sync automatically.');plan();},beginSync(){pause();save({scope:context(),started:now(),phase:'sync',checks:0,followups:2});notify('Bank update requested. Checking automatically…');plan(20000);},resume,pause,cancel(){pause();clear();notify('Automatic connection checks stopped.');}};
}
