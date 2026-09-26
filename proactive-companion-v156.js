/* Fluidité V15.6 — proactive, quiet and read-only daily companion */
(()=>{
 const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function choose(date,health,checkins,cardio,workouts){
  const today=health.find(x=>x.date===date&&x.confirmed);
  const check=checkins.find(x=>x.date===date);
  const activity=[...cardio,...workouts].filter(x=>x.date>=shift(date,-2)&&x.date<=date);
  if(today&&window.FluiditeRecoveryV15?.assess){
   const r=window.FluiditeRecoveryV15.assess(today,health,check,activity);
   if(r.level==='recover')return {key:'recover',title:'Aujourd’hui, récupère',message:'Plusieurs signaux invitent à alléger ta journée. Repos ou mouvement doux : choisis selon ton ressenti.',action:'checkin',label:'Mon ressenti'};
   if(r.level==='adapt')return {key:'adapt',title:'Ajuste plutôt que forcer',message:'Tes indicateurs suggèrent de réduire l’intensité. Une séance plus courte peut suffire aujourd’hui.',action:'training',label:'Voir Entraînement'};
  }
  if(!check)return {key:'checkin',title:'Comment te sens-tu ?',message:'Quelques secondes pour renseigner ton ressenti : cela rend les conseils du jour plus pertinents.',action:'checkin',label:'Mon ressenti'};
  if(!today)return {key:'garmin',title:'Ta capsule est-elle prête ?',message:'Importe et confirme ta capsule Garmin pour compléter les recommandations du jour.',action:'garmin',label:'Importer Garmin'};
  const past=[...cardio,...workouts].filter(x=>x.date>=shift(date,-6)&&x.date<=date);
  if(past.length>=5)return {key:'balance',title:'Pense à l’équilibre',message:'Tu as enregistré plusieurs séances cette semaine. Préserve aussi du temps pour récupérer.',action:'training',label:'Mes séances'};
  return null;
 }
 const old=renderToday;
 renderToday=async function(...args){
  const html=await old(...args);
  try{
   const [health,checkins,cardio,workouts]=await Promise.all(['health','checkins','cardio','workouts'].map(k=>LTDB.all(k)));
   const tip=choose(todayKey(),health,checkins,cardio,workouts);
   if(!tip)return html;
   const action=tip.action==='garmin'?'data-garmin-import':tip.action==='training'?'data-route-card="training"':'data-open="checkin"';
   const panel=`<section class="card proactive-v156"><div class="card-kicker">COMPAGNON · UNE ATTENTION POUR TOI</div><h3>${esc(tip.title)}</h3><p>${esc(tip.message)}</p><button class="action secondary compact" ${action}>${esc(tip.label)}</button><small>Une seule suggestion prioritaire. Aucune notification ni modification automatique.</small></section>`;
   return panel+html;
  }catch(e){console.warn('V15.6 proactive companion unavailable',e);return html;}
 };
 window.FluiditeProactiveV156={choose};
})();