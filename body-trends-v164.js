/* Body tracking uses the same dated canonical measurements as the Companion. */
(()=>{
 const esc=escapeHtml,fmt=v=>Number(v).toFixed(1).replace('.',',');
 const old=renderEvolution;
 renderEvolution=async function(checkins,workouts,cardio){
  const html=await old(checkins,workouts,cardio),body=FluiditeBodyData.summary(checkins);
  if(!Object.keys(body.metrics).length)return html;
  const labels=[['weightKg','Poids','kg'],['fatPercent','Taux de masse grasse','%'],['fatMassKg','Masse grasse','kg'],['muscleMassKg','Masse musculaire','kg'],['fatFreeMassKg','Masse maigre','kg'],['hydrationKg','Eau corporelle','kg'],['boneMassKg','Masse osseuse','kg']];
  const cards=labels.map(([key,label,unit])=>{const m=body.metrics[key];return `<article><span>${label}</span><strong>${m?fmt(m.value)+' '+unit:'—'}</strong><small>${m?esc(`${m.source} · ${displayDate(m.date)}${m.ageDays>7?' · à actualiser':''}`):'Non fournie par Withings'}</small></article>`;});
  const weights=checkins.filter(r=>r.weight!=null&&daysAgo(r.date)>=0&&daysAgo(r.date)<30);
  const avg=rows=>rows.length?rows.reduce((s,r)=>s+Number(r.weight),0)/rows.length:null;
  const recent=weights.filter(r=>daysAgo(r.date)<7),first=weights.filter(r=>daysAgo(r.date)>=23),mean=avg(recent),before=avg(first);
  cards.push(`<article><span>Poids moyen · 7 jours</span><strong>${mean===null?'—':fmt(mean)+' kg'}</strong><small>${recent.length} jour(s) mesuré(s)</small></article>`);
  cards.push(`<article><span>Tendance du poids · 30 jours</span><strong>${recent.length>=2&&first.length>=2?fmt(mean-before)+' kg':'—'}</strong><small>Écart entre les moyennes des semaines de début et de fin ; au moins deux pesées par semaine.</small></article>`);
  return `<section class="card body-trends-v164"><div class="card-kicker">ÉVOLUTION · CORPS</div><h3>Ta dynamique, pas une pesée isolée</h3><p class="subtle">${body.automatic?'Poids et composition corporelle alimentés par Withings, sans saisie manuelle.':'Mesures corporelles enregistrées.'} Chaque valeur garde sa date. ${weights.length} jour(s) de pesée sur 30 jours.</p><div class="body-trend-grid">${cards.join('')}</div><p class="subtle">Les estimations de composition corporelle sont croisées avec tes performances et ton ressenti par le Compagnon.</p></section>`+html;
 };
})();
