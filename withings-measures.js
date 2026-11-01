const {readCookie,cookieHeader,refreshSession}=require('./withings-lib');
const TYPES={1:'weightKg',5:'fatFreeMassKg',6:'fatPercent',8:'fatMassKg',76:'muscleMassKg',77:'hydrationKg',88:'boneMassKg'};
exports.handler=async function(event){
 let session;
 const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(session?{'Set-Cookie':cookieHeader(session)}:{})},body:JSON.stringify(body)});
 try{
  session=readCookie(event.headers?.cookie||event.headers?.Cookie||'');
  if(!session)return reply(401,{error:'WITHINGS_NOT_CONNECTED'});
  session=await refreshSession(session);
  const requested=Number(event.queryStringParameters?.days||365),days=Number.isFinite(requested)?Math.max(1,Math.min(365,requested)):365;
  const end=Math.floor(Date.now()/1000),groups=new Map(),offsets=new Set();let offset=null;
  for(let page=0;page<100;page++){
   const params={action:'getmeas',startdate:String(end-days*86400),enddate:String(end),category:'1',meastypes:Object.keys(TYPES).join(',')};
   if(offset!==null)params.offset=String(offset);
   const response=await fetch('https://wbsapi.withings.net/measure',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
   const data=await response.json();
   if(!response.ok||Number(data.status)!==0)throw new Error(`WITHINGS_MEASURE_${data.status??response.status}`);
   if(!Array.isArray(data.body?.measuregrps))throw new Error('WITHINGS_INVALID_RESPONSE');
   for(const group of data.body.measuregrps){
    const timestamp=Number(group.date),values={};
    if(group.grpid==null||!Number.isFinite(timestamp)||!Number.isFinite(new Date(timestamp*1000).getTime()))continue;
    for(const measure of group.measures||[]){
     if(measure.value==null)continue;
     const value=Number(measure.value)*Math.pow(10,Number(measure.unit??0));
     if(TYPES[measure.type]&&Number.isFinite(value))values[TYPES[measure.type]]=value;
    }
    if(Object.keys(values).length)groups.set(String(group.grpid),{id:String(group.grpid),date:new Date(timestamp*1000).toISOString(),timestamp,category:group.category,values});
   }
   if(!Number(data.body.more))return reply(200,{source:'Withings',days,groups:[...groups.values()].sort((a,b)=>a.timestamp-b.timestamp)});
   offset=data.body.offset;
   if(offset==null||offsets.has(String(offset)))throw new Error('WITHINGS_PAGINATION_ERROR');
   offsets.add(String(offset));
  }
  throw new Error('WITHINGS_TOO_MANY_PAGES');
 }catch(error){return reply(502,{error:error.message||'WITHINGS_ERROR'});}
};
