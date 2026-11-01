/* Canonical Withings projection. Raw historical/manual records remain untouched. */
(function(root){
 'use strict';
 const fields={weightKg:'weight',fatPercent:'fatPercent',fatMassKg:'fatMassKg',fatFreeMassKg:'fatFreeMassKg',muscleMassKg:'muscleMassKg',hydrationKg:'hydrationKg',boneMassKg:'boneMassKg'};
 const number=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 function localDay(iso){const d=new Date(iso);return Number.isFinite(d.getTime())?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:null;}
 function project(checkins,events){
  const measures=events.filter(e=>e.type==='withings-measurement').map(e=>({...e,measuredAt:e.measuredAt||e.values?.measuredAt||(e.timestamp?new Date(Number(e.timestamp)*1000).toISOString():e.date?e.date+'T12:00:00':null)})).filter(e=>e.measuredAt&&localDay(e.measuredAt)&&new Date(e.measuredAt)<=new Date()).sort((a,b)=>new Date(a.measuredAt)-new Date(b.measuredAt));
  const firstWeight=measures.find(e=>number(e.values?.weightKg)>0);
  const start=firstWeight?localDay(firstWeight.measuredAt):null;
  const days=new Map(checkins.map(c=>{const row={...c};
   // Older imports stored composition only inside withingsBody.
   if(c.withingsBody)for(const [key,target] of Object.entries(fields)){const value=number(c.withingsBody[key]);if(value!==null&&value>0){row[target]=value;if(key==='weightKg')row.weightSource='withings';}}
   if(start&&c.date>=start&&number(c.withingsBody?.weightKg)===null){delete row.weight;delete row.weightSource;}
   return [c.date,row];
  }));
  for(const e of measures){const date=localDay(e.measuredAt),row=days.get(date)||{id:date,date},body={...(row.withingsBody||{}),fieldDates:{...(row.withingsBody?.fieldDates||{})}};
   for(const [key,target] of Object.entries(fields)){const value=number(e.values?.[key]);if(value===null||value<=0)continue;row[target]=value;body[key]=value;body.fieldDates[key]=e.measuredAt;if(key==='weightKg')row.weightSource='withings';}
   if(Object.keys(body.fieldDates).length){body.measuredAt=e.measuredAt;row.withingsBody=body;days.set(date,row);}
  }
  return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
 }
 function summary(rows,today=localDay(new Date().toISOString())){
  const metrics={};
  for(const [key,target] of Object.entries(fields)){
   const samples=rows.filter(r=>r.date<=today&&number(r[target])!==null).sort((a,b)=>a.date.localeCompare(b.date));
   const latest=samples.at(-1);if(!latest)continue;
   const measuredAt=latest.withingsBody?.fieldDates?.[key]||latest.withingsBody?.measuredAt||latest.date;
   metrics[key]={value:number(latest[target]),date:localDay(measuredAt)||latest.date,measuredAt,source:latest.withingsBody?.[key]!=null?'Withings':'Manuel',ageDays:Math.round((new Date(today+'T12:00:00')-new Date((localDay(measuredAt)||latest.date)+'T12:00:00'))/86400000)};
  }
  return {automatic:rows.some(r=>r.weightSource==='withings'),metrics};
 }
 const api={project,summary,localDay,fields};root.FluiditeBodyData=api;
 if(typeof module!=='undefined')module.exports=api;
 if(typeof LTDB==='undefined')return;
 const all=LTDB.all.bind(LTDB),get=LTDB.get.bind(LTDB);let cache=null,revision=0;
 api.invalidate=()=>{revision++;cache=null;};
 async function read(){if(!cache){const current=revision;const promise=Promise.all([all('checkins'),all('events')]).then(([c,e])=>project(c,e));cache=promise;promise.catch(()=>{if(revision===current)cache=null;});}return (await cache).map(r=>({...r,withingsBody:r.withingsBody?{...r.withingsBody,fieldDates:{...r.withingsBody.fieldDates}}:undefined}));}
 LTDB.all=store=>store==='checkins'?read():all(store);
 LTDB.get=async(store,id)=>store==='checkins'?(await read()).find(r=>r.id===id):get(store,id);
 for(const key of ['put','del','restore','restoreSnapshot']){const original=LTDB[key].bind(LTDB);LTDB[key]=async(...args)=>{const out=await original(...args);if(key==='restore'||key==='restoreSnapshot'||['checkins','events'].includes(args[0])){revision++;cache=null;}return out;};}
})(typeof window!=='undefined'?window:globalThis);
