/* Fluidité V15.7 — weekly insights, observational and read-only. */
(()=>{
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null||v===''?null:(Number.isFinite(+v)?+v:null);
const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const avg=arr=>arr.reduce((s,x)=>s+x,0)/arr.length;
function summarize(date,health,checkins,workouts,cardio){
 const start=shift(date,-6),before=shift(date,-13);
 const range=xs=>xs.filter(x=>x.date>=start&&x.date<=date);
 const previous=xs=>xs.filter(x=>x.date>=before&&x.date<start);
 const force=range(workouts).length,card=range(cardio).length,priorForce=previous(workouts).length,priorCard=previous(cardio).length;
 const confirmed=range(health).filter(x=>x.confirmed), priorHealth=previous(health).filter(x=>x.confirmed);
 const sleep=confirmed.map(x=>num(x.values?.sleepHours)).filter(x=>x!==null);
 const hrv=confirmed.map(x=>num(x.values?.hrvMs)).filter(x=>x!==null);
 const priorHrv=priorHealth.map(x=>num(x.values?.hrvMs)).filter(x=>x!==null);
 const days=new Set([...range(workouts),...range(cardio)].map(x=>x.date)).size;
 const items=[{title:'Force',value:String(force),note:`${priorForce} séance(s) les 7 jours précédents`},{title:'Cardio',value:String(card),note:`${priorCard} séance(s) les 7 jours précédents`},{title:'Jours actifs',value:String(days)+'/7',note:'Séances enregistrées uniquement'}];
 if(sleep.length)items.push({title:'Sommeil moyen',value:avg(sleep).toFixed(1).replace('.',',')+' h',note:`${sleep.length} nuit(s) Garmin confirmée(s)`});
 if(hrv.length)items.push({title:'VFC moyenne',value:Math.round(avg(hrv))+' ms',note:priorHrv.length>=3&&hrv.length>=3?`Semaine précédente : ${Math.round(avg(priorHrv))} ms`:`${hrv.length} mesure(s) ; comparaison différée`});
 const measures=range(checkins).filter(x=>num(x.waist)!=null);
 if(measures.length>=2)items.push({title:'Tour de taille',value:(num(measures.at(-1).waist)-num(measures[0].waist)).toFixed(1).replace('.',',')+' cm',note:'Variation mesurée sur la période, non interprétée'});
 let message=confirmed.length<3?'Historique Garmin limité cette semaine : le bilan présente surtout les activités enregistrées.':force+card>=5?'Semaine bien remplie en activités enregistrées : vérifie que ta récupération suit le rythme.':force+card?'Tu as maintenu une activité cette semaine. Continue à ajuster selon tes sensations.':'Aucune séance enregistrée cette semaine. Les activités non importées ne sont pas prises en compte.';
 return {start,end:date,items,message,confirmed:confirmed.length};
}
const old=renderEvolution;
renderEvolution=async function(checkins,workouts,cardio){
 const html=await old(checkins,workouts,cardio);
 try{
 const health=await LTDB.all('health'),result=summarize(todayKey(),health,checkins,workouts,cardio);
 const cards=result.items.map(x=>`<article><span>${esc(x.title)}</span><strong>${esc(x.value)}</strong><small>${esc(x.note)}</small></article>`).join('');
 const panel=`<section class="card weekly-v157"><div class="card-kicker">FLUIDITÉ INSIGHTS · BILAN HEBDOMADAIRE</div><h3>Ta semaine en perspective</h3><p class="subtle">Du ${esc(result.start)} au ${esc(result.end)} · données confirmées ou enregistrées</p><div class="weekly-v157-grid">${cards}</div><p>${esc(result.message)}</p><small>Ce bilan est consultable à tout moment dans Évolution. Aucune notification, prédiction médicale ou modification de tes données.</small></section>`;
 return panel+html;
 }catch(e){console.warn('Weekly insights unavailable',e);return html}
};
window.FluiditeWeeklyV157={summarize};
})();