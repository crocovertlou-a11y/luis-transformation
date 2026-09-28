const crypto=require('crypto');
const secret=()=>process.env.WITHINGS_COOKIE_SECRET||process.env.WITHINGS_CLIENT_SECRET;
const b64=s=>Buffer.from(s).toString('base64url'),unb=s=>Buffer.from(s,'base64url').toString('utf8');
const sign=p=>crypto.createHmac('sha256',secret()).update(p).digest('base64url');
function cookieHeader(s){const p=b64(JSON.stringify(s)),v=`${p}.${sign(p)}`;return `lt_withings=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000`}
function readCookie(h=''){const c=h.split(';').map(x=>x.trim()).find(x=>x.startsWith('lt_withings='));if(!c)return null;const [p,s]=c.slice(12).split('.');if(!p||!s)return null;const e=sign(p);if(s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)))return null;try{return JSON.parse(unb(p))}catch{return null}}
async function tokenRequest(params){const r=await fetch('https://wbsapi.withings.net/v2/oauth2',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});const d=await r.json();if(!r.ok||d.status!==0)throw new Error(`WITHINGS_TOKEN_${d.status??r.status}`);return d.body}
async function refreshSession(s){if(s.access_token&&Number(s.expires_at||0)>Math.floor(Date.now()/1000)+120)return s;if(!s.refresh_token)throw new Error('WITHINGS_RECONNECT_REQUIRED');const d=await tokenRequest({action:'requesttoken',grant_type:'refresh_token',client_id:process.env.WITHINGS_CLIENT_ID,client_secret:process.env.WITHINGS_CLIENT_SECRET,refresh_token:s.refresh_token});return{...s,access_token:d.access_token,refresh_token:d.refresh_token||s.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||10800),userid:d.userid||s.userid}}
module.exports={cookieHeader,readCookie,tokenRequest,refreshSession};
