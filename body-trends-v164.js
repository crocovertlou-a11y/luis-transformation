/* Fluidité V16.4 — Withings body trends, observational only */
(()=>{
 const num=v=>v==null||v===''?null:(Number.isFinite(+v)?+v:null);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const signed=(v,unit)=>`${v>0?'+':''}${v.toFixed(1).replace('.',',')} ${unit}`;
 function daily(checkins){return checkins.filter(x=>x.date&&num(x.weight)!=null).sort((a,b)=>a.date.localeCompare(b.date));}
 function avgBetween(rows,field,a,b){const vals=rows.filter(x=>x.date>=a&&x.date<=b).map(x=>num(field(x))).filter(v=>v!=null);return mean(vals)}
 function trendData(today,checkins){
   const rows=daily(checkins); if(!rows.length)return null;
   const latest=rows.at(-1),start7=shift(today,-6),start30=shift(today,-29);
   const avg7=avgBetween(rows,x=>x.weight,start7,today);
   const recent7=avgBetween(rows,x=>x.weight,shift(today,-6),today);
   const first7=avgBetween(rows,x=>x.weight,start30,shift(start30,6));
   const w30=recent7!=null&&first7!=null?recent7-first7:null;
   const bodyRows=rows.filter(x=>x.withingsBody);
   const latestBody=bodyRows.at(-1)?.withingsBody||null;
   const bodyDelta=(key)=>{const br=bodyRows.filter(x=>x.date>=start30&&num(x.withingsBody?.[key])!=null);if(br.length<2)return null;return num(br.at(-1).withingsBody[key])-num(br[0].withingsBody[key])};
   return {latest,avg7,w30,latestBody,fat30:bodyDelta('fatPercent'),muscle30:bodyDelta('muscleMassKg'),count30:rows.filter(x=>x.date>=start30).length};
 }
 const old=renderEvolution;
 renderEvolution=async function(checkins,workouts,cardio){
   const html=await old(checkins,workouts,cardio);try{
     const d=trendData(todayKey(),checkins);if(!d)return html;
     const cards=[
       ['Dernier poids',`${num(d.latest.weight).toFixed(1).replace('.',',')} kg`,d.latest.weightSource==='withings'?'Withings · dernière pesée synchronisée':`Mesure du ${d.latest.date}`],
       ['Moyenne 7 jours',d.avg7!=null?`${d.avg7.toFixed(1).replace('.',',')} kg`:'—','Lisse les variations quotidiennes'],
       ['Tendance 30 jours',d.w30!=null?signed(d.w30,'kg'):'—',d.w30!=null?'Écart entre les moyennes du début et de la fin de période':'Pas encore assez de pesées comparables']
     ];
     if(d.latestBody?.fatPercent!=null)cards.push(['Masse grasse',`${num(d.latestBody.fatPercent).toFixed(1).replace('.',',')} %`,d.fat30!=null?`30 j : ${signed(d.fat30,'pt')}`:'Dernière mesure Withings']);
     if(d.latestBody?.muscleMassKg!=null)cards.push(['Masse musculaire',`${num(d.latestBody.muscleMassKg).toFixed(1).replace('.',',')} kg`,d.muscle30!=null?`30 j : ${signed(d.muscle30,'kg')}`:'Dernière mesure Withings']);
     const panel=`<section class="card body-trends-v164"><div class="card-kicker">ÉVOLUTION · CORPS</div><h3>Ta dynamique, pas une pesée isolée</h3><p class="subtle">Fluidité privilégie les moyennes et tendances. ${d.count30} pesée${d.count30>1?'s':''} disponible${d.count30>1?'s':''} sur 30 jours.</p><div class="body-trend-grid">${cards.map(x=>`<article><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('')}</div></section>`;
     return panel+html;
   }catch(e){console.warn('V16.4 body trends unavailable',e);return html}
 };
 window.FluiditeBodyTrendsV164={trendData};
})();
