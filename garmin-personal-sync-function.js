/* Garmin Connect Personal API — read-only, server-side. Official endpoint paths: garmin/connect-personal-api-python. */
import { timingSafeEqual, createHmac } from 'node:crypto';
const root='https://personal.connectapi.garmin.com';
const tokenUrl=root+'/personalapitoken-service/personal-api/personal-api-key/token';
const json=(statusCode,body,cookie)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})},body:JSON.stringify(body)});
const COOKIE='fluidite_garmin_session';
function signature(secret){return createHmac('sha256',secret).update('fluidite-garmin-personal-session-v1').digest('hex')}
function cookieValid(event,secret){const raw=event.headers?.cookie||event.headers?.Cookie||'';const match=raw.match(/(?:^|;\s*)fluidite_garmin_session=([a-f0-9]{64})(?:;|$)/);return !!match&&secure(match[1],signature(secret))}
function sessionCookie(secret){return `${COOKIE}=${signature(secret)}; Path=/.netlify/functions/garmin-personal-sync-function; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`}

const secure=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};
const isDay=x=>/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(x);
const numeric=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const first=(...x)=>x.find(v=>v!==undefined&&v!==null&&v!=='');
async function request(path,token){
 const url=root+path;
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!r.ok)throw new Error('Garmin HTTP '+r.status+' ('+path.split('?')[0]+')');
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
  throw new Error('Jeton Garmin HTTP '+r.status+reason);
 }
 // Garmin Personal API may return a raw JWT instead of a JSON object.
 // Never include the response in errors or logs: it contains credentials.
 const payload=(await r.text()).trim();
 let token='';
 if(payload.startsWith('{') || payload.startsWith('\"')){
  let obj;
  try{obj=JSON.parse(payload)}catch{throw new Error('Garmin : réponse de jeton JSON invalide')}
  token=typeof obj==='string'?obj:first(obj?.access_token,obj?.accessToken,obj?.token);
 }else{
  token=payload;
 }
 if(typeof token!=='string'||!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(token)){
  throw new Error('Garmin : format du jeton non reconnu');
 }
 return token;
}
function dailyObject(x){return Array.isArray(x)?(x[0]||{}):(x?.dailySummaries?.[0]||x?.dailySummary||x||{});}
function sleepObject(x){return x?.dailySleepDTO||x?.dailySleep||x||{};}
function batteryObject(x){return Array.isArray(x)?(x[0]||{}):x||{};}
function mapped(date,raw){
 const daily=dailyObject(raw.daily), sl=sleepObject(raw.sleep),hrv=raw.hrv?.hrvSummary||raw.hrv||{},hr=raw.hr||{},stress=dailyObject(raw.stress),battery=batteryObject(raw.battery),steps=dailyObject(raw.steps);
 const sleepSeconds=numeric(first(sl.sleepTimeSeconds,sl.sleepDurationSeconds,sl.durationInSeconds,sl.totalSleepSeconds));
 const bcharged=first(battery.charged,battery.bodyBatteryCharged,battery.chargedValue,daily.bodyBatteryChargedValue);
 const bdrained=first(battery.drained,battery.bodyBatteryDrained,battery.drainedValue,daily.bodyBatteryDrainedValue);
 const vals={restingHeartRate:first(daily.restingHeartRate,hr.restingHeartRate),averageHeartRate:first(daily.averageHeartRate,hr.averageHeartRate),minimumHeartRate:first(hr.minHeartRate,daily.minHeartRate),maximumHeartRate:first(hr.maxHeartRate,daily.maxHeartRate),hrvMs:first(hrv.lastNightAvg,hrv.lastNightAverage,hrv.weeklyAvg),sleepDurationSeconds:sleepSeconds,sleepScore:first(sl.sleepScores?.overall?.value,sl.sleepScore),stressAverage:first(daily.averageStressLevel,stress.averageStressLevel),stressMaximum:first(daily.maxStressLevel,stress.maxStressLevel),bodyBatteryCharged:bcharged,bodyBatteryDrained:bdrained,steps:first(daily.totalSteps,steps.totalSteps,steps.steps),distanceKm:numeric(first(daily.totalDistanceMeters,daily.totalDistance,daily.distanceInMeters))!=null?numeric(first(daily.totalDistanceMeters,daily.totalDistance,daily.distanceInMeters))/1000:null,floorsClimbed:first(daily.floorsAscended,daily.floorsClimbed),activeCalories:first(daily.activeKilocalories,daily.activeCalories),totalCalories:first(daily.totalKilocalories,daily.totalCalories),activeMinutes:first(daily.activeTimeInSeconds!=null?Number(daily.activeTimeInSeconds)/60:null,daily.activeTimeMinutes),moderateMinutes:first(daily.moderateIntensityMinutes,daily.moderateIntensityDurationInSeconds!=null?Number(daily.moderateIntensityDurationInSeconds)/60:null),vigorousMinutes:first(daily.vigorousIntensityMinutes,daily.vigorousIntensityDurationInSeconds!=null?Number(daily.vigorousIntensityDurationInSeconds)/60:null),respirationRate:first(daily.avgWakingRespirationValue,daily.averageRespirationValue),spo2Average:first(daily.averageSpO2,daily.averageSpo2,daily.avgSpo2),spo2Minimum:first(daily.lowestSpO2,daily.lowestSpo2)};
 // Only include verified numeric fields; absent values must never be represented as zero.
 for(const [key,value] of Object.entries(vals)) vals[key]=numeric(value);
 const acts=Array.isArray(raw.activities)?raw.activities:raw.activities?.activities||[];
 const durationSeconds=a=>{
  // Garmin's activity list has multiple generations of duration field names.
  // Explicit millisecond fields are converted; second fields are preserved.
  const secondsFields=[a.durationInSeconds,a.elapsedDurationInSeconds,a.movingDurationInSeconds,a.timerTimeInSeconds,a.elapsedTimeInSeconds,a.movingTimeInSeconds,a.duration,a.elapsedDuration,a.movingDuration,a.elapsedTime,a.movingTime,a.timerTime,a.totalElapsedTime,a.totalTimerTime,a.summaryDTO?.duration,a.summaryDTO?.elapsedDuration,a.summaryDTO?.movingDuration];
  for(const v of secondsFields){const n=numeric(v);if(n!=null&&n>0&&n<=86400)return Math.round(n);}
  for(const v of [a.durationInMilliseconds,a.elapsedDurationInMilliseconds,a.movingDurationInMilliseconds,a.elapsedTimeMillis,a.movingTimeMillis,a.durationMillis,a.elapsedTimeInMilliseconds,a.elapsedDurationMillis]){const n=numeric(v);if(n!=null&&n>0&&n<=86400000)return Math.round(n/1000);}
  return null;
 };
 const km=v=>{const n=numeric(v);return n==null?null:Math.round((n/1000)*1000)/1000;};
 const activities=acts.filter(a=>String(first(a.startTimeLocal,a.startTimeGMT,a.startTime,'')).slice(0,10)===date).map(a=>({activityId:first(a.activityId,a.id),activityType:first(a.activityType?.typeKey,a.activityType,a.type),startTimeLocal:first(a.startTimeLocal,a.startTimeGMT),name:a.activityName,durationSeconds:durationSeconds(a),distanceKm:km(a.distance),averageHeartRate:first(a.averageHR,a.averageHeartRate),maximumHeartRate:first(a.maxHR,a.maxHeartRate),averageCadence:first(a.averageRunningCadenceInStepsPerMinute,a.averageBikingCadenceInRevPerMinute,a.averageCadence),totalAscent:first(a.elevationGain,a.totalAscent),calories:first(a.calories,a.activeKilocalories),averageSpeed:a.averageSpeed,device:a.deviceName}));
 if(!Object.values(vals).some(v=>v!=null)&&!activities.length)throw Error('Aucune mesure reconnue : vérifier le contenu des réponses Garmin');
 return {schema:'fluidite-garmin-capsule-v1',date,source:'Garmin Personal API',data:vals,activities,data_status:'partial',notes:['Données Garmin Personal en lecture seule ; vérifier les valeurs avant confirmation.']};
}
export async function handler(event){
 if(event.httpMethod!=='POST')return json(405,{error:'Méthode non autorisée'});
 const secret=process.env.FLUIDITE_GARMIN_SYNC_CODE;
 if(!secret||secret.length<16)return json(503,{error:'Configurer FLUIDITE_GARMIN_SYNC_CODE (16 caractères minimum) dans Netlify.'});
 const authorized=secure(event.headers?.['x-fluidite-sync-code']||event.headers?.['X-Fluidite-Sync-Code'],secret)||cookieValid(event,secret);
 if(!authorized)return json(401,{error:'Code privé requis pour cet appareil.',code:'SYNC_CODE_REQUIRED'});
 const key=process.env.GARMIN_PERSONAL_API_KEY;
 if(!key)return json(503,{error:'GARMIN_PERSONAL_API_KEY manquant dans Netlify.'});
 let date;
 try{const body=JSON.parse(event.body||'{}');date=body.date||new Date().toISOString().slice(0,10);if(!isDay(date))return json(400,{error:'Date invalide'});}catch{return json(400,{error:'JSON invalide'});}
 try{
  const token=await auth(key);
  const enc=encodeURIComponent(date);
  const paths={daily:`/usersummary-service/v2/dailysummaries?startDate=${enc}&endDate=${enc}`,sleep:`/sleep-service/sleep/dailySleep?date=${enc}`,hrv:`/hrv-service/hrv/${enc}`,hr:`/wellness-service/wellness/dailyHeartRate?date=${enc}`,stress:`/usersummary-service/stats/stress/daily/${enc}/${enc}`,battery:`/wellness-service/wellness/bodyBattery/reports/daily?startDate=${enc}&endDate=${enc}`,steps:`/usersummary-service/stats/steps/daily/${enc}/${enc}`,activities:`/activitylist-service/activities/search/activities?start=0&limit=50&startDate=${enc}&endDate=${enc}`};
  const entries=await Promise.all(Object.entries(paths).map(async ([k,p])=>{try{return [k,await request(p,token),null]}catch(e){return [k,null,e.message]}}));
  const raw={},missing=[];for(const [k,v,err] of entries){raw[k]=v;if(err)missing.push(k+' : '+err)}
  const payload=mapped(date,raw);payload.missing=missing;payload.fetchedAt=new Date().toISOString();
  return json(200,payload,sessionCookie(secret));
 }catch(e){return json(502,{error:'Synchronisation Garmin impossible : '+String(e.message||e)});}
}
