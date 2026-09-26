/* Fluidité V15.5 — observational progress insights, no data mutations */
(()=>{
const n=v=>v==null||v===''?null:(Number.isFinite(+v)?+v:null);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shift=(date,days)=>{let d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function insights(today,checkins,workouts,cardio){
 const result=[];
 const dated=checkins.filter(x=>x.date&&x.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 for(const [key,label,unit,better] of [['weight','Poids','kg',null],['waist','Tour de taille','cm',-1]]){
  const rows=dated.filter(x=>n(x[key])!=null);
  if(rows.length>=2&&rows[0].date!==rows.at(-1).date){
   const delta=n(rows.at(-1)[key])-n(rows[0][key]);
   result.push({title:label,value:(delta>0?'+':'')+delta.toFixed(1).replace('.',',')+' '+unit,detail:`Entre le ${rows[0].date} et le ${rows.at(-1).date}. ${Math.abs(delta)<.05?'Mesure stable.':'Une variation ne suffit pas à conclure sur la composition corporelle.'}`});
  }
 }
 const recent=shift(today,-6),prior=shift(today,-13);
 for(const [rows,label] of [[workouts,'Force'],[cardio,'Cardio']]){
  const count=rows.filter(x=>x.date>=recent&&x.date<=today).length;
  const before=rows.filter(x=>x.date>=prior&&x.date<recent).length;
  result.push({title:`Régularité ${label}`,value:`${count} séance${count>1?'s':''}`,detail:before?`Sur 7 jours, contre ${before} les 7 jours précédents (séances enregistrées uniquement).`:'Sur les 7 derniers jours enregistrés.'});
 }
 const runs=cardio.filter(x=>/course|run|jog/i.test(String(x.type||x.name||''))&&n(x.distance)!=null&&n(x.durationSeconds??x.duration_s??x.duration)!=null);
 const comparable=runs.filter(x=>n(x.distance)>=4.5&&n(x.distance)<=5.5).sort((a,b)=>a.date.localeCompare(b.date));
 if(comparable.length>=2){
  const a=comparable[0],b=comparable.at(-1),secs=x=>n(x.durationSeconds??x.duration_s??x.duration)/n(x.distance);
  const diff=secs(b)-secs(a);
  result.push({title:'Allure sur sorties ~5 km',value:Math.abs(diff)<2?'Stable':diff<0?'Plus rapide':'Plus lente',detail:`Comparaison indicative entre le ${a.date} et le ${b.date} : ${Math.abs(diff).toFixed(0)} s/km d’écart. Terrain, effort et conditions peuvent varier.`});
 }
 return result;
}
const old=renderEvolution;
renderEvolution=async function(checkins,workouts,cardio){
 const html=await old(checkins,workouts,cardio);
 try{
  const cards=insights(todayKey(),checkins,workouts,cardio);
  const panel=`<section class="card progress-insights-v155"><div class="card-kicker">COMPAGNON · TES PROGRÈS</div><h3>Les progrès que tu ne vois pas toujours</h3><p class="subtle">Observations issues de tes données enregistrées, sans score ni conclusion médicale.</p><div class="progress-insights-grid">${cards.map(x=>`<article><strong>${esc(x.title)}</strong><b>${esc(x.value)}</b><small>${esc(x.detail)}</small></article>`).join('')}</div></section>`;
  return panel+html;
 }catch(e){console.warn('V15.5 insights unavailable',e);return html}
};
window.FluiditeInsightsV155={insights};
})();