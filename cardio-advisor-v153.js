/* Fluidité V15.3: independent Cardio companion; no data mutations. */
(()=>{
const num=v=>v==null||v===''?null:Number.isFinite(+v)?+v:null;
const esc=s=>typeof escapeHtml==='function'?escapeHtml(s):String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shift=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const isRun=a=>/run|course|jog/i.test(String(a.type||a.activity_type||a.name||''));
function advise(date,health,checkin,cardio,workouts){
 const today=health.find(x=>x.date===date&&x.confirmed);
 if(!today)return {level:'unknown',title:'Import Garmin à confirmer',message:'Confirme ta capsule du jour pour personnaliser le conseil Cardio.',details:[]};
 const r=window.FluiditeRecoveryV15.assess(today,health,checkin,[...cardio,...workouts]);
 const runs=cardio.filter(x=>x.date>=shift(date,-6)&&x.date<=date&&isRun(x));
 const km=runs.reduce((s,a)=>s+(num(a.distanceKm??a.distance_km??a.distance)||0),0);
 const details=[`${runs.length} sortie(s) enregistrée(s) sur 7 jours · ${km.toFixed(1).replace('.',',')} km`,...r.reasons.slice(0,2)];
 if(r.level==='recover')return {level:'recover',title:'Cardio : récupération',message:'Repos ou marche douce selon ton ressenti. Évite le fractionné.',details};
 if(['adapt','caution'].includes(r.level))return {level:'adapt',title:'Cardio : adapter la séance',message:'Privilégie une sortie facile et écourte-la si la fatigue apparaît.',details};
 if(r.level==='unknown')return {level:'unknown',title:'Cardio : récupération à préciser',message:'Une sortie facile peut être envisagée selon ton ressenti. Pas de séance intense suggérée avec des données incomplètes.',details};
 return {level:'usual',title:'Cardio : séance prévue envisageable',message:'Pas de signal de prudence identifié dans les données disponibles. Reste attentif à tes sensations.',details};
}
const original=renderTraining;
renderTraining=async function(...args){
 const html=await original(...args);
 try{
 const [health,checkins,cardio,workouts]=await Promise.all(['health','checkins','cardio','workouts'].map(s=>LTDB.all(s)));
 const date=todayKey(),r=advise(date,health,checkins.find(x=>x.date===date)||null,cardio,workouts);
 const panel=`<section class="card cardio-advisor-v153" data-cardio-recovery="${r.level}"><div class="card-kicker">COMPAGNON · CARDIO V15.3</div><h3>${esc(r.title)}</h3><p>${esc(r.message)}</p><ul>${r.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="subtle">Conseil indicatif : tu gardes le choix. Seules les activités enregistrées sont prises en compte.</p><div class="card-actions"><button class="action secondary compact" data-open="cardioHistory">Historique Cardio</button>${r.level==='unknown'?'<button class="action secondary compact" data-garmin-import>Importer Garmin</button>':''}</div></section>`;
 return html.replace('<div class="training-history-grid">',panel+'<div class="training-history-grid">');
 }catch(e){console.warn('V15.3 Cardio unavailable',e);return html}
};
window.FluiditeCardioV153={advise};
})();