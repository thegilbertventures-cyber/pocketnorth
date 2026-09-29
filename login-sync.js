// One automatic attempt per verified sign-in/app opening. Token refresh and
// ordinary focus events reuse the attempt; reset invalidates stale callbacks.
export function createLoginSync(){
  let generation=0,attempted=null,inFlight=null;
  return {
    reset(){generation++;attempted=null;inFlight=null;},
    start(user,hasBanks,run,notify){
      if(!user||!hasBanks||attempted===user)return inFlight||Promise.resolve();
      attempted=user;const ticket=generation;
      const current=()=>generation===ticket;
      notify('Syncing bank accounts…');
      inFlight=(async()=>{
        try{await run(current);if(current())notify('Bank sync complete');}
        catch{if(current())notify('Bank sync incomplete — retry in Accounts');}
        finally{if(current())inFlight=null;}
      })();
      return inFlight;
    }
  };
}
