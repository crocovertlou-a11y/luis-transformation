/* Read-only Garmin Personal API proxy. Endpoints MUST be populated from Garmin's authenticated API reference.
   Security: never export the API key. Set GARMIN_PERSONAL_API_KEY, GARMIN_PERSONAL_HEALTH_URL,
   GARMIN_PERSONAL_ACTIVITY_URL (optional), and FLUIDITE_GARMIN_SYNC_CODE in Netlify environment.
   URL variables must be full HTTPS URLs on apis.garmin.com. No caller-provided URLs. */
import { timingSafeEqual } from 'node:crypto';
const out=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
function equals(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)}
function checkedUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='apis.garmin.com'||u.username||u.password||u.port)throw Error('Destination Garmin non autorisée');return u.href}
async function get(url,key){const r=await fetch(checkedUrl(url),{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw Error(`Garmin HTTP ${r.status}`);const ct=r.headers.get('content-type')||'';if(!ct.includes('json'))throw Error('La réponse Garmin ne contient pas de JSON');return r.json()}
export async function handler(event){
 if(event.httpMethod!=='POST')return out(405,{error:'Méthode non autorisée'});
 const secret=process.env.FLUIDITE_GARMIN_SYNC_CODE;
 if(!secret||secret.length<16)return out(503,{error:'Configurer FLUIDITE_GARMIN_SYNC_CODE (16 caractères minimum) sur Netlify.'});
 if(!equals(event.headers?.['x-fluidite-sync-code'],secret))return out(401,{error:'Code de synchronisation incorrect.'});
 const key=process.env.GARMIN_PERSONAL_API_KEY,health=process.env.GARMIN_PERSONAL_HEALTH_URL,activities=process.env.GARMIN_PERSONAL_ACTIVITY_URL;
 if(!key||!health)return out(503,{error:'Connecteur non configuré : ajouter la clé et les URL officielles de Garmin Personal dans Netlify.'});
 try{
   const [h,a]=await Promise.all([get(health,key),activities?get(activities,key):Promise.resolve(null)]);
   // Garmin Personal's actual response schemas must be checked against the authorized API documentation.
   // Never fabricate field mappings. Validate by existing Fluidité normalization on the client.
   const data=h?.data??h;
   const payload={schema:'fluidite-garmin-capsule-v1',source:'Garmin Personal API',date:data?.date||data?.calendarDate||null,data,activities:Array.isArray(a)?a:(a?.activities||[])};
   return out(200,payload);
 }catch(e){return out(502,{error:`Synchronisation Garmin impossible : ${String(e.message||e)}`})}
}
