const crypto=require('crypto');
const secret=()=>process.env.STRAVA_COOKIE_SECRET||process.env.STRAVA_CLIENT_SECRET;
const b64=s=>Buffer.from(s).toString('base64url'),unb=s=>Buffer.from(s,'base64url').toString('utf8');
const sign=p=>crypto.createHmac('sha256',secret()).update(p).digest('base64url');
function makeCookie(s){const p=b64(JSON.stringify(s));return `${p}.${sign(p)}`}
function readCookie(h=''){const c=h.split(';').map(x=>x.trim()).find(x=>x.startsWith('lt_strava='));if(!c)return null;const [p,s]=c.slice(10).split('.');if(!p||!s)return null;const e=sign(p);if(s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)))return null;try{return JSON.parse(unb(p))}catch{return null}}
function cookieHeader(s){return `lt_strava=${makeCookie(s)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000`}
async function refreshSession(s){
  if(s.access_token&&Number(s.expires_at||0)>Math.floor(Date.now()/1000)+120)return s;
  if(!s.refresh_token)throw new Error('STRAVA_RECONNECT_REQUIRED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.STRAVA_CLIENT_ID,client_secret:process.env.STRAVA_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:s.refresh_token}),signal:controller.signal});
    const d=await r.json();
    if(!r.ok)throw new Error(d.message||'STRAVA_REFRESH_FAILED');
    if(!d.access_token)throw new Error('STRAVA_REFRESH_INVALID');
    return{...s,access_token:d.access_token,refresh_token:d.refresh_token||s.refresh_token,expires_at:d.expires_at||s.expires_at};
  }finally{clearTimeout(timer)}
}
function typeMap(a){const t=String(a.sport_type||a.type||'').toLowerCase();if(t.includes('run'))return'Course';if(t.includes('ride')||t.includes('cycle'))return'Velo';if(t.includes('swim'))return'Natation';if(t.includes('walk')||t.includes('hike'))return'Marche';return'Autre'}
module.exports={readCookie,cookieHeader,refreshSession,typeMap};