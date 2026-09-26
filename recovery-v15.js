/* Fluidité V15 — isolated recovery advisor. No mutations of confirmed Garmin records. */
(()=>{
 const num=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
 const median=xs=>{xs=xs.filter(x=>x!==null).sort((a,b)=>a-b);return xs.length?xs.length%2?xs[(xs.length-1)/2]:(xs[xs.length/2-1]+xs[xs.length/2])/2:null};
 function assess(today,history,checkin,activities){
  if(!today?.confirmed)return {level:'unknown',reasons:['Importe et confirme ta capsule Garmin pour commencer.']};
  const v=today.values||{};const prev=history.filter(x=>x.confirmed&&x.date<today.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,28);
  const rhr=median(prev.map(x=>num(x.values?.restingHeartRate))),hrv=median(prev.map(x=>num(x.values?.hrvMs)));
  const rhrCount=prev.filter(x=>num(x.values?.restingHeartRate)!==null).length,hrvCount=prev.filter(x=>num(x.values?.hrvMs)!==null).length;
  const reasons=[],signals=[];const energy=num(checkin?.energy),recovery=num(checkin?.recovery);
  if(rhrCount>=7&&num(v.restingHeartRate)!==null&&num(v.restingHeartRate)>=rhr+5)signals.push('FC au repos supérieure à ta médiane récente');
  if(hrvCount>=7&&num(v.hrvMs)!==null&&num(v.hrvMs)<hrv*.85)signals.push('VFC inférieure à ta médiane récente');
  if(num(v.sleepHours)!==null&&num(v.sleepHours)<6)signals.push('Sommeil inférieur à 6 h');
  if(num(v.stressAverage)!==null&&num(v.stressAverage)>=50)signals.push('Stress physiologique élevé');
  if(energy!==null&&energy<=2)signals.push('Énergie ressentie basse');
  if(recovery!==null&&recovery<=2)signals.push('Récupération ressentie basse');
  const prior=(activities||[]).filter(a=>a.date<today.date&&a.date>=new Date(new Date(today.date+'T12:00:00').getTime()-3*86400000).toISOString().slice(0,10));
  if(prior.length>=3)reasons.push('Plusieurs activités sur les trois jours précédents : vérifie ta fatigue musculaire.');
  if(rhrCount<7||hrvCount<7)reasons.push('Historique encore insuffisant pour interpréter complètement tes tendances FC/VFC.');
  if(energy===null||recovery===null)reasons.push('Ajoute ton ressenti pour affiner la proposition.');
  reasons.unshift(...signals);
  const level=signals.length>=3?'recover':signals.length>=2?'adapt':signals.length===1?'caution':(rhrCount<7||hrvCount<7||energy===null||recovery===null)?'unknown':'usual';
  return {level,reasons:reasons.length?reasons:['Aucun signal de prudence détecté dans les données disponibles.'],baseline:{rhr:rhrCount>=7?rhr:null,hrv:hrvCount>=7?hrv:null},signals:signals.length};
 }
 const labels={recover:['Récupération conseillée','Privilégie une récupération active ou du repos.'],adapt:['Séance à adapter','Réduis l’intensité et ajuste selon ton ressenti.'],caution:['Un signal à surveiller','Évalue ton ressenti avant une séance intense.'],usual:['Séance habituelle envisageable','Les indicateurs disponibles ne signalent pas de difficulté particulière.'],unknown:['À confirmer','Il manque des données pour donner un feu vert fiable.']};
 const old=renderToday;
 renderToday=async function(...args){
  const html=await old(...args);try{
   const [health,checkins,cardio,workouts]=await Promise.all([LTDB.all('health'),LTDB.all('checkins'),LTDB.all('cardio'),LTDB.all('workouts')]);
   const date=todayKey(),today=health.find(x=>x.date===date),checkin=checkins.find(x=>x.date===date),result=assess(today,health,checkin,[...cardio,...workouts]);
   const [heading,advice]=labels[result.level];const esc=typeof escapeHtml==='function'?escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const panel=`<section class="card recovery-v15" data-recovery-level="${result.level}"><div class="card-kicker">COMPAGNON · RÉCUPÉRATION V15</div><h3>${heading}</h3><p>${advice} Ce conseil ne remplace pas ton jugement.</p><ul>${result.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${result.baseline.rhr!==null||result.baseline.hrv!==null?`<small>Médianes personnelles : FC repos ${result.baseline.rhr??'—'} bpm · VFC ${result.baseline.hrv??'—'} ms.</small>`:''}<div class="card-actions"><button class="action secondary compact" data-open="checkin">Mon ressenti</button>${!today?'<button class="action secondary compact" data-garmin-import>Importer Garmin</button>':''}</div></section>`;
   return panel+html;
  }catch(e){console.warn('Recovery V15 unavailable',e);return html;}
 };
 window.FluiditeRecoveryV15={assess};
})();
