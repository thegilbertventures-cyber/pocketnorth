export async function runCategoryBatches(ids,{request,shouldStop=()=>false,onProgress=()=>{}}){
  let processed=0,checked=0,suggested=0;
  const unique=[...new Set(ids)];
  onProgress({processed,checked,suggested,total:unique.length});
  for(let i=0;i<unique.length;i+=40){
    if(shouldStop())break;
    let result;
    try{result=await request(unique.slice(i,i+40))}catch(error){return {processed,checked,suggested,total:unique.length,error:error.message,stopped:false}}
    processed+=Math.min(40,unique.length-i);checked+=result.checked||0;suggested+=result.suggested||0;
    onProgress({processed,checked,suggested,total:unique.length});
  }
  return {processed,checked,suggested,total:unique.length,stopped:processed<unique.length};
}
