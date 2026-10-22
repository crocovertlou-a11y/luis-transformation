/* Garmin Connect Personal API — read-only, server-side. Official endpoint paths: garmin/connect-personal-api-python. */
import { timingSafeEqual } from 'node:crypto';
const root='https://personal.connectapi.garmin.com';
const tokenUrl=root+'/personalapitoken-service/personal-api/personal-api-key/token';
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
const secure=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};
const isDay=x=>/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(x);
const numeric=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const first=(...x)=>x.find(v=>v!==undefined&&v!==null&&v!=='');
async function request(path,token){
 const url=root+path;
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!r.ok)throw Object.assign(new Error('Garmin HTTP '+r.status+' ('+path.split('?')[0]+')'),{stage:'data',upstreamStatus:r.status});
 return r.status===204?null:r.json();
}
async function auth(key){
 const r=await fetch(tokenUrl,{method:'POST',headers:{Authorization:'ApiKey '+key,Accept:'*/*'},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!r.ok){
  // Return only a constrained, sanitized API error code; never expose credentials or response bodies.
  let reason='';
  try {const body=await r.json();const code=body?.errorCode||body?.code||body?.error;
   if(typeof code==='string' && /^[a-zA-Z0-9_.-]{1,64}$/.test(code))reason=' ['+code+']';
  }catch{}
  throw Object.assign(new Error('Jeton Garmin HTTP '+r.status+reason),{stage:'token',upstreamStatus:r.status});
 }
 const obj=await r.json();const token=first(obj.access_token,obj.accessToken,obj.token);
 if(typeof token!=='string'||!token)throw new Error('Garmin : format du jeton non reconnu');return token;
}
function dailyObject(x){return Array.isArray(x)?(x[0]||{}):(x?.dailySummaries?.[0]||x?.dailySummary||x||{});}
function sleepObject(x){return x?.dailySleepDTO||x?.dailySleep||x||{};}
function batteryObject(x){return Array.isArray(x)?(x[0]||{}):x||{};}
function mapped(date,raw){
 const daily=dailyObject(raw.daily), sl=sleepObject(raw.sleep),hrv=raw.hrv?.hrvSummary||raw.hrv||{},hr=raw.hr||{},stress=dailyObject(raw.stress),battery=batteryObject(raw.battery),steps=dailyObject(raw.steps);
 const sleepSeconds=numeric(first(sl.sleepTimeSeconds,sl.sleepDurationSeconds,sl.durationInSeconds,sl.totalSleepSeconds));
 const bcharged=first(battery.charged,battery.bodyBatteryCharged,battery.chargedValue,daily.bodyBatteryChargedValue);
 const bdrained=first(battery.drained,battery.bodyBatteryDrained,battery.drainedValue,daily.bodyBatteryDrainedValue);
 const vals={restingHeartRate:first(daily.restingHeartRate,hr.restingHeartRate),averageHeartRate:first(daily.averageHeartRate,hr.averageHeartRate),minimumHeartRate:first(hr.minHeartRate,daily.minHeartRate),maximumHeartRate:first(hr.maxHeartRate,daily.maxHeartRate),hrvMs:first(hrv.lastNightAvg,hrv.lastNightAverage,hrv.weeklyAvg),sleepDurationSeconds:sleepSeconds,sleepScore:first(sl.sleepScores?.overall?.value,sl.sleepScore),stressAverage:first(daily.averageStressLevel,stress.averageStressLevel),stressMaximum:first(daily.maxStressLevel,stress.maxStressLevel),bodyBatteryCharged:bcharged,bodyBatteryDrained:bdrained,steps:first(daily.totalSteps,steps.totalSteps,steps.steps),distanceKm:numeric(daily.totalDistanceMeters)!=null?numeric(daily.totalDistanceMeters)/1000:null,floorsClimbed:first(daily.floorsAscended,daily.floorsClimbed),activeCalories:daily.activeKilocalories,totalCalories:daily.totalKilocalories,respirationRate:first(daily.avgWakingRespirationValue,daily.averageRespirationValue)};
 // Only include verified numeric fields; absent values must never be represented as zero.
 for(const [key,value] of Object.entries(vals)) vals[key]=numeric(value);
 const acts=Array.isArray(raw.activities)?raw.activities:raw.activities?.activities||[];
 const activities=acts.map(a=>({activityId:first(a.activityId,a.id),activityType:first(a.activityType?.typeKey,a.activityType,a.type),startTimeLocal:first(a.startTimeLocal,a.startTimeGMT),name:a.activityName,durationSeconds:first(a.duration,a.elapsedDuration),distanceKm:numeric(a.distance)!=null?numeric(a.distance)/1000:null,averageHeartRate:a.averageHR,maximumHeartRate:a.maxHR,averageCadence:a.averageRunningCadenceInStepsPerMinute,totalAscent:a.elevationGain,calories:a.calories}));
 if(!Object.values(vals).some(v=>v!=null)&&!activities.length)throw Error('Aucune mesure reconnue : vérifier le contenu des réponses Garmin');
 return {schema:'fluidite-garmin-capsule-v1',date,source:'Garmin Personal API',data:vals,activities,data_status:'partial',notes:['Données Garmin Personal en lecture seule ; vérifier les valeurs avant confirmation.']};
}
export async function handler(event){
 if(event.httpMethod!=='POST')return json(405,{error:'Méthode non autorisée'});
 const secret=process.env.FLUIDITE_GARMIN_SYNC_CODE;
 if(!secret||secret.length<16)return json(503,{error:'Configurer FLUIDITE_GARMIN_SYNC_CODE (16 caractères minimum) dans Netlify.'});
 if(!secure(event.headers?.['x-fluidite-sync-code']||event.headers?.['X-Fluidite-Sync-Code'],secret))return json(401,{error:'Code privé de synchronisation incorrect.'});
 const key=process.env.GARMIN_PERSONAL_API_KEY;
 if(!key)return json(503,{error:'GARMIN_PERSONAL_API_KEY manquant dans Netlify.'});
 let date;
 try{const body=JSON.parse(event.body||'{}');date=body.date||new Date().toISOString().slice(0,10);if(!isDay(date))return json(400,{error:'Date invalide'});}catch{return json(400,{error:'JSON invalide'});}
 try{
  const token=await auth(key);
  const enc=encodeURIComponent(date);
  const paths={daily:`/usersummary-service/v2/dailysummaries?startDate=${enc}&endDate=${enc}`,sleep:`/sleep-service/sleep/dailySleep?date=${enc}`,hrv:`/hrv-service/hrv/${enc}`,hr:`/wellness-service/wellness/dailyHeartRate?date=${enc}`,stress:`/usersummary-service/stats/stress/daily/${enc}/${enc}`,battery:`/wellness-service/wellness/bodyBattery/reports/daily?startDate=${enc}&endDate=${enc}`,steps:`/usersummary-service/stats/steps/daily/${enc}/${enc}`,activities:`/activitylist-service/activities/search/activities?start=0&limit=20&startDate=${enc}&endDate=${enc}`};
  const entries=await Promise.all(Object.entries(paths).map(async ([k,p])=>{try{return [k,await request(p,token),null]}catch(e){return [k,null,e.message]}}));
  const raw={},missing=[];for(const [k,v,err] of entries){raw[k]=v;if(err)missing.push(k+' : '+err)}
  const payload=mapped(date,raw);payload.missing=missing;
  return json(200,payload);
 }catch(e){
  // Structured metadata only: never log personal API keys, bearer tokens or Garmin response bodies.
  const stage=e?.stage==='token'?'token':e?.stage==='data'?'data':'processing';
  const upstreamStatus=Number.isInteger(e?.upstreamStatus)?e.upstreamStatus:null;
  const requestId=event.headers?.['x-nf-request-id']||null;
  console.error('[fluidite-garmin] sync_failed',JSON.stringify({stage,upstreamStatus,requestId}));
  return json(upstreamStatus===401?502:502,{error:'Synchronisation Garmin impossible : '+String(e.message||e),diagnostic:{stage,upstream_status:upstreamStatus,request_id:requestId},hint:stage==='token'&&upstreamStatus===401?'Garmin refuse la clé Personal API lors de la génération du jeton. Vérifier la valeur GARMIN_PERSONAL_API_KEY et les droits de la clé, sans la communiquer.':null});
 }
}
