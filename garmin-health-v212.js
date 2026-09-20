/* Fluidité V2.12 — capsule Garmin confirmée. Aucun accès direct au connecteur depuis l'app. */
(()=>{
  const SCHEMA='fluidite-garmin-capsule-v1';
  let pending=null;
  const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  const first=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&x!=='');
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const median=xs=>{const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
  const fmt=(v,d=0)=>v==null?'—':Number(v).toFixed(d).replace('.',',');
  const durationLabel=s=>{s=Math.max(0,Math.round(n(s)||0));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`};
  function normalizeActivity(a,index){
    const type=String(first(a.activity_type,a.activityType,a.type,'Activité'));
    const start=String(first(a.start_time_local,a.startTimeLocal,a.start_time,a.startTime,a.date,''));
    const durationSeconds=n(first(a.duration_seconds,a.duration_s,a.durationInSeconds,a.duration));
    const distanceKm=n(first(a.distance_km,a.distanceKm,a.distance!=null&&Number(a.distance)>500?Number(a.distance)/1000:a.distance));
    const heart=a.heart_rate||a.heartRate||{};
    const cardioLike=/run|running|course|walk|marche|hike|randonn|cycle|cycling|bike|vélo|swim|natation|cardio|rowing|rameur/i.test(type);
    return {activityId:String(first(a.activity_id,a.activityId,a.id,`${start||'activity'}-${index}`)),date:start.slice(0,10)||localDate(),type,name:String(first(a.name,a.activity_name,type)),device:String(first(a.device?.name,a.device,'')),durationSeconds,distanceKm,calories:n(a.calories),heartRateAvg:n(first(a.heart_rate_avg,a.averageHeartRate,heart.avg,heart.average)),heartRateMax:n(first(a.heart_rate_max,a.maximumHeartRate,heart.max,heart.maximum)),cadenceAvg:n(first(a.cadence_avg,a.averageCadence,a.cadence)),elevationGain:n(first(a.elevation_gain,a.totalAscent,a.ascent)),speedAvg:n(first(a.speed_avg,a.averageSpeed)),paceAvg:first(a.pace_avg,a.averagePace,null),cardioLike,details:a.details||a.fit_metrics||null};
  }

  function normalize(payload){
    if(!payload||typeof payload!=='object')throw new Error('Capsule JSON invalide');
    if(payload.structuredContent)payload=payload.structuredContent;
    const data=payload.data||payload.health||payload;
    const daily=data.daily||payload.daily||data;
    const sleep=data.sleep||payload.sleep||{};
    const hrv=data.hrv||payload.hrv||{};
    const stress=data.stress||payload.stress||{};
    const spo2=data.spo2||payload.spo2||{};
    const bp=data.blood_pressure||data.bloodPressure||payload.blood_pressure||payload.bloodPressure||{};
    const body=data.bodyComposition||data.body_composition||payload.bodyComposition||{};
    const heart=daily.heart_rate||daily.heartRate||{};
    const battery=daily.body_battery||daily.bodyBattery||{};
    const calories=daily.calories||{};
    const intensity=daily.intensity_duration_s||daily.intensityDuration||{};
    const values={
      restingHeartRate:n(first(data.restingHeartRate,daily.restingHeartRate,heart.resting)),
      averageHeartRate:n(first(data.averageHeartRate,daily.averageHeartRate,heart.avg)),
      minimumHeartRate:n(first(data.minimumHeartRate,heart.min)),
      maximumHeartRate:n(first(data.maximumHeartRate,heart.max)),
      hrvMs:n(first(data.hrvMs,hrv.last_night_avg,hrv.lastNightAvg,hrv.average,hrv.value)),
      sleepHours:n(first(data.sleepHours,sleep.duration_hours,sleep.durationHours,sleep.duration_s!=null?sleep.duration_s/3600:null)),
      sleepScore:n(first(data.sleepScore,sleep.score)),
      stressAverage:n(first(data.stressAverage,daily.stress_avg,stress.average,stress.avg)),
      stressMaximum:n(first(data.stressMaximum,daily.stress_max,stress.maximum,stress.max)),
      bodyBatteryCharged:n(first(data.bodyBatteryCharged,battery.charged)),
      bodyBatteryDrained:n(first(data.bodyBatteryDrained,battery.drained)),
      steps:n(first(data.steps,daily.steps)),
      distanceKm:n(first(data.distanceKm,daily.distance_km)),
      activeMinutes:n(first(data.activeMinutes,daily.active_time_min)),
      floorsClimbed:n(first(data.floorsClimbed,daily.floors_climbed)),
      activeCalories:n(first(data.activeCalories,calories.active)),
      totalCalories:n(first(data.totalCalories,calories.total)),
      moderateMinutes:n(first(data.moderateMinutes,intensity.moderate!=null?intensity.moderate/60:null)),
      vigorousMinutes:n(first(data.vigorousMinutes,intensity.vigorous!=null?intensity.vigorous/60:null)),
      weightKg:n(first(data.weightKg,body.weight_kg,body.weight)),
      bodyFatPercent:n(first(data.bodyFatPercent,body.body_fat_percent,body.bodyFatPercent)),
      muscleMassKg:n(first(data.muscleMassKg,body.muscle_mass_kg,body.muscleMassKg)),
      bodyWaterPercent:n(first(data.bodyWaterPercent,body.body_water_percent,body.bodyWaterPercent)),
      respirationRate:n(first(data.respirationRate,data.respiration_rate)),
      spo2Average:n(first(data.spo2Average,spo2.average,spo2.avg,spo2.sleep_average)),
      spo2Minimum:n(first(data.spo2Minimum,spo2.minimum,spo2.min,spo2.sleep_minimum)),
      bloodPressureSystolic:n(first(data.bloodPressureSystolic,bp.systolic,bp.latest?.systolic)),
      bloodPressureDiastolic:n(first(data.bloodPressureDiastolic,bp.diastolic,bp.latest?.diastolic)),
      bloodPressurePulse:n(first(data.bloodPressurePulse,bp.pulse,bp.latest?.pulse))
    };
    const activities=(payload.activities||data.activities||[]).map(normalizeActivity);
    if(!Object.values(values).some(v=>v!=null)&&!activities.length)throw new Error('Aucune donnée Garmin reconnue dans cette capsule');
    return {schema:SCHEMA,date:String(first(payload.date,daily.calendar_date,data.date,localDate())).slice(0,10),fetchedAt:first(payload.fetchedAt,payload.fetched_at,new Date().toISOString()),source:'Garmin via Fitness AI Connector',values,activities};
  }

  function input(name,label,value,step='1',suffix=''){
    return `<div class="field"><label>${label}${suffix?` (${suffix})`:''}</label><input name="${name}" type="number" step="${step}" value="${value??''}" placeholder="—"></div>`;
  }
  function section(title,rows){return `<section class="garmin-preview-section"><h3>${title}</h3><div class="garmin-preview-grid">${rows}</div></section>`}
  function openImport(){
    pending=null;
    showSheet(`<div class="card-kicker">GARMIN · IMPORT VOLONTAIRE</div><h2>Importer ma capsule santé</h2><p class="subtle">Dans ChatGPT, demande « Prépare ma capsule Garmin Fluidité du jour », puis colle le JSON ou importe le fichier reçu.</p><div class="garmin-import-tabs"><label>Coller le JSON</label><label>Choisir un fichier<input id="garminCapsuleFile" type="file" accept=".json,application/json" hidden></label></div><textarea id="garminCapsuleText" class="garmin-capsule-text" placeholder='{"schema":"fluidite-garmin-capsule-v1", ...}'></textarea><div class="garmin-confirm-note"><b>Contrôle utilisateur obligatoire.</b> Rien n’est enregistré avant l’écran de vérification.</div><button class="action" id="garminParseCapsule" type="button">Prévisualiser les données</button>`);
    $('#garminParseCapsule')?.addEventListener('click',()=>parseText($('#garminCapsuleText')?.value));
    $('#garminCapsuleFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{parseText(await f.text())}catch(err){toast(err.message||'Fichier illisible')}});
  }
  function parseText(raw){try{pending=normalize(JSON.parse(String(raw||'').trim()));openPreview()}catch(err){toast(err.message||'Capsule invalide')}}
  function openPreview(){
    const v=pending.values;
    const activities=pending.activities||[];
    showSheet(`<div class="card-kicker">GARMIN · PRÉVISUALISATION</div><h2>Vérifie avant d’enregistrer</h2><form id="garminConfirmForm">${dateField('date',pending.date,'Date Garmin')}
      ${section('Récupération',input('restingHeartRate','Fréquence cardiaque au repos',v.restingHeartRate,'1','bpm')+input('hrvMs','HRV nocturne',v.hrvMs,'0.1','ms')+input('sleepHours','Sommeil',v.sleepHours,'0.05','h')+input('sleepScore','Score de sommeil',v.sleepScore))}
      ${section('Stress physiologique',input('stressAverage','Stress Garmin moyen',v.stressAverage)+input('stressMaximum','Stress Garmin maximal',v.stressMaximum)+input('bodyBatteryCharged','Body Battery chargé',v.bodyBatteryCharged)+input('bodyBatteryDrained','Body Battery consommé',v.bodyBatteryDrained))}
      ${section('Activité quotidienne',input('steps','Pas',v.steps)+input('distanceKm','Distance',v.distanceKm,'0.01','km')+input('activeMinutes','Temps actif',v.activeMinutes,'0.1','min')+input('floorsClimbed','Étages montés',v.floorsClimbed)+input('activeCalories','Calories actives',v.activeCalories)+input('totalCalories','Calories totales',v.totalCalories)+input('moderateMinutes','Minutes modérées',v.moderateMinutes,'0.1','min')+input('vigorousMinutes','Minutes soutenues',v.vigorousMinutes,'0.1','min'))}
      ${section('Corps et respiration',input('weightKg','Poids',v.weightKg,'0.1','kg')+input('bodyFatPercent','Masse grasse',v.bodyFatPercent,'0.1','%')+input('muscleMassKg','Masse musculaire',v.muscleMassKg,'0.1','kg')+input('bodyWaterPercent','Eau corporelle',v.bodyWaterPercent,'0.1','%')+input('respirationRate','Respiration',v.respirationRate,'0.1','/min')+input('spo2Average','SpO₂ moyenne',v.spo2Average,'0.1','%')+input('spo2Minimum','SpO₂ minimale',v.spo2Minimum,'0.1','%'))}
      ${section('Mesures facultatives',input('bloodPressureSystolic','Tension systolique',v.bloodPressureSystolic,'1','mmHg')+input('bloodPressureDiastolic','Tension diastolique',v.bloodPressureDiastolic,'1','mmHg')+input('bloodPressurePulse','Pouls lors de la mesure',v.bloodPressurePulse,'1','bpm'))}
      ${activities.length?`<section class="garmin-preview-section"><h3>Activités Garmin détectées</h3><div class="garmin-activity-preview">${activities.map((a,i)=>`<label><input type="checkbox" name="activityIndex" value="${i}" ${a.cardioLike?'checked':''}><span><strong>${escapeHtml(a.name||a.type)}</strong><small>${displayDate(a.date)}${a.device?` · ${escapeHtml(a.device)}`:''}${a.distanceKm!=null?` · ${fmt(a.distanceKm,2)} km`:''}${a.durationSeconds!=null?` · ${durationLabel(a.durationSeconds)}`:''}</small></span></label>`).join('')}</div><p class="subtle">Les activités cardio sont présélectionnées. Les autres restent conservées dans la capsule santé mais ne sont pas transformées automatiquement en séance Force.</p></section>`:''}
      <div class="garmin-confirm-note"><b>Important :</b> le stress Garmin est physiologique. Il restera distinct de ton stress mental. Le sommeil et le poids ne préremplissent le point du jour que si tu n’as pas déjà renseigné ces valeurs.</div>
      <button class="action" type="submit">Confirmer ces données Garmin</button><button class="action secondary" type="button" id="garminBackImport">Corriger la capsule</button></form>`);
    $('#garminConfirmForm')?.addEventListener('submit',confirmCapsule);
    $('#garminBackImport')?.addEventListener('click',openImport);
  }
  async function readinessFor(date,values){
    const history=(await LTDB.all('health')).filter(x=>x.confirmed&&x.date<date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,28);
    const rhrBase=history.length>=4?median(history.map(x=>n(x.values?.restingHeartRate))):null;
    const hrvBase=history.length>=4?median(history.map(x=>n(x.values?.hrvMs))):null;
    const signals=[];
    if(rhrBase!=null&&values.restingHeartRate!=null&&values.restingHeartRate-rhrBase>=5)signals.push('FC au repos au-dessus de ta tendance');
    if(hrvBase!=null&&values.hrvMs!=null&&values.hrvMs<hrvBase*.85)signals.push('HRV sous ta tendance');
    if(values.sleepHours!=null&&values.sleepHours<6)signals.push('sommeil court');
    if(values.stressAverage!=null&&values.stressAverage>=50)signals.push('stress physiologique élevé');
    const status=signals.length>=3?'recover':signals.length>=2?'watch':history.length>=4?'normal':'insufficient';
    return {status,signals,baseline:{restingHeartRate:rhrBase,hrvMs:hrvBase,days:history.length},rule:'au moins deux signaux convergents; jamais une mesure isolée'};
  }
  async function confirmCapsule(e){
    e.preventDefault();const f=new FormData(e.currentTarget),values={...pending.values};
    Object.keys(values).forEach(k=>{if(f.has(k))values[k]=n(f.get(k))});
    const date=String(f.get('date')||pending.date),readiness=await readinessFor(date,values),now=new Date().toISOString();
    const row={id:date,date,source:pending.source,fetchedAt:pending.fetchedAt,confirmed:true,confirmedAt:now,original:pending.values,values,activities:pending.activities||[],readiness};
    await LTDB.put('health',row);
    const previous=await LTDB.get('checkins',date)||{id:date,date};
    const checkin={...previous,id:date,date,sleep:previous.sleep??values.sleepHours??null,weight:previous.weight??values.weightKg??null,garminHealth:{source:row.source,confirmedAt:now,values,readiness},source:previous.source||'garmin-confirmed',updatedAt:now};
    await LTDB.put('checkins',checkin);
    for(const rawIndex of f.getAll('activityIndex')){
      const a=pending.activities?.[Number(rawIndex)];if(!a)continue;
      const id=`garmin-${a.activityId}`;
      await LTDB.put('cardio',{id,date:a.date||date,type:a.type,name:a.name,distance:a.distanceKm,durationSeconds:a.durationSeconds,durationLabel:a.durationSeconds!=null?durationLabel(a.durationSeconds):null,heartRateAvg:a.heartRateAvg,heartRateMax:a.heartRateMax,cadenceAvg:a.cadenceAvg,elevationGain:a.elevationGain,calories:a.calories,speedAvg:a.speedAvg,paceAvg:a.paceAvg,device:a.device,garminActivityId:a.activityId,garminDetails:a.details,source:'garmin-capsule',importSource:'Garmin',createdAt:now});
    }
    $('#sheet').close();toast('Données Garmin confirmées');render();
  }
  function metric(label,value,unit=''){return `<div class="garmin-health-metric"><span>${label}</span><strong>${value==null?'—':value}${unit}</strong><small>confirmé</small></div>`}
  function statusText(r){if(!r||r.status==='insufficient')return 'Référence personnelle en construction';if(r.status==='recover')return 'Plusieurs signaux invitent à récupérer';if(r.status==='watch')return 'Plusieurs signaux sont à surveiller';return 'Signaux proches de ta tendance'}
  async function todayCard(){
    const row=await LTDB.get('health',todayKey());
    if(!row)return `<section class="garmin-health-card garmin-health-empty"><div><div class="card-kicker">GARMIN · BASIC ACTIF</div><h2>Préremplir ma journée</h2><p>Importe la capsule préparée dans ChatGPT. Tu vérifieras chaque valeur avant son enregistrement.</p></div><button class="garmin-health-action" data-garmin-import>Importer</button></section>`;
    const v=row.values||{};return `<section class="garmin-health-card"><div class="garmin-health-head"><div><div class="card-kicker">SANTÉ · AUJOURD’HUI</div><h2>Données Garmin confirmées</h2><p>${displayDate(row.date)} · ${escapeHtml(row.source||'Garmin')}</p></div><span class="garmin-source-pill">Garmin ✓</span></div><div class="garmin-health-grid">${metric('FC repos',fmt(v.restingHeartRate),' bpm')}${metric('HRV',fmt(v.hrvMs),' ms')}${metric('Sommeil',fmt(v.sleepHours,1),' h')}${metric('Stress physio.',fmt(v.stressAverage))}</div><div class="garmin-health-foot"><div class="garmin-readiness"><b>${escapeHtml(statusText(row.readiness))}</b><br>${row.readiness?.signals?.length?escapeHtml(row.readiness.signals.join(' · ')):`${row.readiness?.baseline?.days||0} jour(s) de référence`}</div><button class="garmin-health-action" data-garmin-details>Détails</button></div></section>`;
  }
  async function openDetails(){
    const rows=(await LTDB.all('health')).filter(x=>x.confirmed).sort((a,b)=>b.date.localeCompare(a.date));
    const latest=rows[0];if(!latest)return openImport();const v=latest.values||{};
    showSheet(`<div class="card-kicker">SANTÉ · GARMIN</div><h2>Historique confirmé</h2><p class="subtle">Fluidité conserve uniquement les capsules que tu as vérifiées.</p><div class="garmin-history-list">${rows.slice(0,30).map(x=>`<div class="garmin-history-row"><div><strong>${displayDate(x.date)}</strong><span>FC repos ${fmt(x.values?.restingHeartRate)} bpm · HRV ${fmt(x.values?.hrvMs)} ms</span><small>Sommeil ${fmt(x.values?.sleepHours,1)} h · Stress physio. ${fmt(x.values?.stressAverage)}</small></div><div><b>${escapeHtml(statusText(x.readiness))}</b><button class="text-action" type="button" data-garmin-delete="${escapeHtml(x.date)}">Supprimer</button></div></div>`).join('')}</div><button class="action" type="button" id="garminImportAnother">Importer une capsule</button>`);
    $('#garminImportAnother')?.addEventListener('click',openImport);
    document.querySelectorAll('[data-garmin-delete]').forEach(b=>b.addEventListener('click',async()=>{const date=b.dataset.garminDelete;if(!confirm(`Supprimer les données Garmin du ${displayDate(date)} ?`))return;await LTDB.del('health',date);const check=await LTDB.get('checkins',date);if(check?.garminHealth){delete check.garminHealth;await LTDB.put('checkins',check)}toast('Données Garmin supprimées');await openDetails();render()}));
  }
  async function injectCheckin(){
    const form=$('#checkinForm');if(!form)return;const row=await LTDB.get('health',form.elements.date?.value||todayKey());if(!row)return;const v=row.values||{},box=document.createElement('div');box.className='garmin-prefill';box.innerHTML=`<strong>Garmin confirmé</strong><span>Sommeil ${fmt(v.sleepHours,1)} h · FC repos ${fmt(v.restingHeartRate)} bpm · HRV ${fmt(v.hrvMs)} ms · stress physiologique ${fmt(v.stressAverage)}. Le curseur Stress ci-dessous correspond à ton ressenti mental.</span>`;form.insertBefore(box,form.children[1]||null);
  }
  const baseRenderToday=renderToday;
  renderToday=async function(...args){return `${await todayCard()}${await baseRenderToday(...args)}`};
  const baseRenderProfile=renderProfile;
  renderProfile=async function(...args){const html=await baseRenderProfile(...args);return `${html}<div class="card"><div class="card-kicker">Garmin</div><h3>Capsules santé confirmées</h3><p class="subtle">Import volontaire depuis ChatGPT. Fluidité n’accède jamais directement à ton compte Garmin.</p><div class="card-actions"><button class="action" data-garmin-import>Importer une capsule</button><button class="action secondary" data-garmin-details>Voir l’historique</button></div></div>`};
  const baseOpenSheet=openSheet;
  openSheet=function(kind){const out=baseOpenSheet(kind);if(kind==='checkin')setTimeout(injectCheckin,0);return out};
  document.addEventListener('click',e=>{if(e.target.closest('[data-garmin-import]')){e.preventDefault();openImport()}if(e.target.closest('[data-garmin-details]')){e.preventDefault();openDetails()}},true);
  window.FluiditeGarmin={schema:SCHEMA,normalize,readinessFor,openImport};
})();
