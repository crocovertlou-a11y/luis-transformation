const $ = s => document.querySelector(s);
const state = { route:'home', homeView:'today', profile:null, online:navigator.onLine };
const todayKey = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

async function init(){
  await LTDB.open(); await LTDB.migrateLegacy();
  state.profile = await LTDB.get('profile','me') || {
    id:'me', firstName:'Luis', initials:'LS', goal:'Évoluer avec constance', nutritionEnabled:true,
    proteinTarget:170, createdAt:new Date().toISOString(), onboardingCompleted:true
  };
  await LTDB.put('profile',state.profile);
  $('#initials').textContent=state.profile.initials || initialsOf(state.profile.firstName);
  bindGlobal(); render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function initialsOf(name='Utilisateur'){ return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function bindGlobal(){
  document.querySelectorAll('.nav-item[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
  $('[data-action="quickAdd"]').addEventListener('click',quickAdd);
  $('#companionButton').addEventListener('click',()=>navigate('companion'));
  $('#identityButton').addEventListener('click',()=>navigate('profile'));
  addEventListener('online',()=>{state.online=true; toast('Connexion retrouvée · données conservées'); render();});
  addEventListener('offline',()=>{state.online=false; toast('Mode hors ligne · tes saisies restent disponibles'); render();});
  $('#sheet').addEventListener('click',e=>{ if(e.target===$('#sheet')) $('#sheet').close(); });
}
function navigate(route){ state.route=route; document.querySelectorAll('.nav-item[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===route)); render(); $('#main').focus(); }
async function render(){
  const main=$('#main'); let html='';
  if(!state.online) html+='<div class="offline-banner">Hors ligne · l’app reste utilisable et les données restent sur cet appareil.</div>';
  if(state.route==='home') html+=await renderHome();
  if(state.route==='training') html+=await renderTraining();
  if(state.route==='companion') html+=await renderCompanion();
  if(state.route==='profile') html+=await renderProfile();
  main.innerHTML=html; bindPage();
}
async function renderHome(){
  const checkins=await LTDB.all('checkins'); const today=checkins.find(x=>x.date===todayKey());
  const workouts=await LTDB.all('workouts'); const cardio=await LTDB.all('cardio'); const food=await LTDB.all('food');
  const todayWorkout=workouts.find(x=>x.date===todayKey());
  const todayCardio=cardio.filter(x=>x.date===todayKey()).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')); 
  const todayFood=food.filter(x=>x.date===todayKey());
  const protein=todayFood.reduce((s,x)=>s+(Number(x.protein)||0),0);
  const calories=todayFood.reduce((s,x)=>s+(Number(x.calories)||0),0);
  const view=state.homeView;
  return `
    <section class="hero home-hero"><div class="hello">Bonjour ${escapeHtml(state.profile.firstName)}.</div></section>
    <div class="segmented"><button data-home-view="today" class="${view==='today'?'active':''}">Aujourd’hui</button><button data-home-view="evolution" class="${view==='evolution'?'active':''}">Évolution</button></div>
    ${view==='today' ? renderToday(today,todayWorkout,todayCardio,protein,calories,todayFood.length) : await renderEvolution(checkins,workouts,cardio)}
  `;
}

function dateField(name='date',value=todayKey(),label='Date'){
  return `<div class="field date-field"><label>${label}</label><input name="${name}" type="date" value="${value||todayKey()}"></div>`;
}

function defaultForceEntries(){
  return [
    {name:'Développé couché',sets:4,targetReps:6,rest:'2 min'},
    {name:'Tractions',sets:4,targetReps:8,rest:'90 s'},
    {name:'Rowing',sets:3,targetReps:10,rest:'90 s'},
    {name:'Développé épaules',sets:3,targetReps:10,rest:'75 s'},
    {name:'Gainage',sets:3,targetReps:null,reps:'45 s',rest:'45 s'}
  ].map(e=>({...e,series:Array.from({length:e.sets},(_,i)=>({set:i+1,reps:e.targetReps,weight:null}))}));
}
function editableForceEntries(workout){
  const entries=(workout.exerciseEntries||[]).filter(e=>e&&e.name);
  return entries.length ? entries : defaultForceEntries();
}

function normalizedForceSeries(e){
  if((e.series||[]).length) return e.series;
  const count=Number(e.sets)||1;
  const defaultReps=typeof e.targetReps==='number'?e.targetReps:(typeof e.reps==='number'?e.reps:null);
  let legacyWeight=e.weight??null;
  if(legacyWeight==null && e.performance){
    const match=String(e.performance).match(/(\d+(?:[.,]\d+)?)\s*kg/i);
    if(match) legacyWeight=Number(match[1].replace(',','.'));
  }
  return Array.from({length:count},(_,i)=>({set:i+1,reps:defaultReps,weight:legacyWeight}));
}

function companionMark(cls='companion-mark'){
  return `<svg class="${cls} companion-logo" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M21 8.5C12.5 12.7 7.5 21.3 7.5 31.1c0 10.1 5.1 18.9 13.5 24.4"/>
    <path d="M43 8.5c8.5 4.2 13.5 12.8 13.5 22.6 0 10.1-5.1 18.9-13.5 24.4"/>
    <path d="M24.5 15.5C18.3 19.2 14.8 25 14.8 32c0 7 3.5 12.8 9.7 16.5"/>
    <path d="M39.5 15.5c6.2 3.7 9.7 9.5 9.7 16.5 0 7-3.5 12.8-9.7 16.5"/>
  </svg>`;
}
function mealTypeLabel(type){
  return ({breakfast:'Petit-déjeuner',lunch:'Déjeuner',dinner:'Dîner',snack:'Collation'})[type] || 'Repas';
}
let pendingNutritionMealType=null;
function mealTypeOptions(selected=''){
  return [
    ['breakfast','Petit-déjeuner'],
    ['lunch','Déjeuner'],
    ['dinner','Dîner'],
    ['snack','Collation']
  ].map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');
}
function displayDate(date){
  if(!date) return '';
  const d=new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('fr-CH',{day:'numeric',month:'short',year:'numeric'}).format(d);
}


function mealIcon(type){
  return ({breakfast:'☕',lunch:'🍴',snack:'🍎',dinner:'◒'})[type]||'•';
}
function mealSummary(rows){
  return rows.reduce((a,x)=>({
    calories:a.calories+(Number(x.calories)||0),
    protein:a.protein+(Number(x.protein)||0),
    carbs:a.carbs+(Number(x.carbs)||0),
    fat:a.fat+(Number(x.fat)||0)
  }),{calories:0,protein:0,carbs:0,fat:0});
}
function nutritionMealCard(type,rows){
  const sum=mealSummary(rows);
  const details=rows.length
    ? `<div class="meal-items">${rows.map(x=>`<button type="button" class="meal-item-row" data-edit-food="${x.id}"><span>${escapeHtml(x.description||'Aliment')}</span><small>${x.calories?Math.round(x.calories)+' kcal':''}${x.protein?` · ${Math.round(x.protein)} g prot.`:''}</small><b>›</b></button>`).join('')}</div>`
    : `<div class="meal-empty">Rien de saisi pour le moment.</div>`;
  return `<section class="nutrition-meal-card">
    <div class="nutrition-meal-head">
      <div class="nutrition-meal-title"><span class="nutrition-meal-icon">${mealIcon(type)}</span><div><strong>${mealTypeLabel(type)}</strong><small>${rows.length?`${Math.round(sum.calories)} kcal · ${Math.round(sum.protein)} g prot. · ${Math.round(sum.carbs)} g gluc. · ${Math.round(sum.fat)} g lip.`:'À compléter'}</small></div></div>
      <button type="button" class="nutrition-meal-add" data-meal-add="${type}">＋ Ajouter</button>
    </div>
    ${details}
  </section>`;
}
function nutritionEntry(x){
  return `<button class="nutrition-entry nutrition-entry-button" data-edit-food="${x.id}">
    <div>
      <strong>${mealTypeLabel(x.mealType)} · ${escapeHtml(x.description||'Repas')}</strong>
      <span>${[displayDate(x.date),x.protein?Math.round(x.protein)+' g protéines':'',x.calories?Math.round(x.calories)+' kcal':''].filter(Boolean).join(' · ')||'Repas enregistré'}</span>
    </div>
    <small>Source : ${x.source==='companion-ai'?'Compagnon IA':x.source==='open-food-facts'?'Open Food Facts':x.source==='companion'?'Compagnon':'Saisie manuelle'} · Modifier ›</small>
  </button>`;
}
function renderToday(today,todayWorkout,todayCardio,protein,calories,foodCount){
  const attention=today ? recoveryText(today) : null;
  const target=state.profile.proteinTarget||170;
  const remain=Math.max(0,target-protein);
  const checkinBlock=today
    ? `<div class="today-checkin clickable" data-open="checkin"><div>${companionMark("companion-mark-mini")}<span>Ressenti enregistré</span></div><strong>Modifier</strong></div>`
    : `<div class="companion-prompt clickable" data-open="checkin"><div class="companion-orbit">${companionMark("companion-mark-large")}</div><div><div class="card-kicker">Compagnon</div><h3>Comment vas-tu aujourd’hui ?</h3><p>Quelques gestes suffisent. J’utiliserai le reste en silence.</p></div></div>`;
  const cardioBlock=todayCardio.length?(()=>{
    const x=todayCardio[0];
    return `<div class="today-domain clickable" data-route-card="training"><div class="today-domain-top"><span class="domain-badge">Cardio</span><span>›</span></div><h3>${escapeHtml(x.type||'Cardio')}${x.distance?` · ${x.distance} km`:''}${x.durationLabel?` · ${x.durationLabel}`:''}</h3><p>${todayCardio.length>1?`${todayCardio.length} activités aujourd’hui. `:''}Ta saisie est dans ton journal d’entraînement.</p></div>`;
  })():'';
  const nutritionBlock=state.profile.nutritionEnabled?`<div class="today-domain nutrition-today clickable" data-open="nutritionHub"><div class="today-domain-top"><span class="domain-badge">Alimentation</span><span>›</span></div><h3>${foodCount?`${Math.round(protein)} / ${target} g de protéines`:'Commencer ma journée alimentaire'}</h3><p>${foodCount?`${Math.round(remain)} g restent sur ton repère${calories?` · ${Math.round(calories)} kcal saisies`:''}.`:'Ajouter un repas, voir mes saisies ou demander une idée au Compagnon.'}</p><div class="mini-progress"><i style="width:${Math.min(100,(protein/target)*100)}%"></i></div></div>`:'';
  return `
    ${attention?`<div class="companion-inline"><span class="fluidity-mini-static">${companionMark("companion-mark-mini")}</span><div><strong>${attention.title}</strong><p>${attention.text}</p></div></div>`:''}
    ${checkinBlock}
    <div class="section-title"><h2>Ta journée</h2><span class="status">${new Intl.DateTimeFormat('fr-CH',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span></div>
    <div class="today-flow">
      <div class="today-domain clickable" data-route-card="training"><div class="today-domain-top"><span class="domain-badge">Force</span><span>›</span></div><h3>${todayWorkout?'Séance enregistrée':'Une séance prête quand tu l’es'}</h3><p>${todayWorkout?'Je garde les séries et les charges pour préparer la suite.':'Tu peux simplement suivre la proposition, sans construire ta séance.'}</p></div>
      ${cardioBlock}
      ${nutritionBlock}
    </div>
  `;
}
function renderCheckinSummary(t){
  const rows=[];
  if(t.sleep!=null) rows.push(`<div><span>Sommeil</span><strong>${t.sleep} h</strong></div>`);
  if(t.energy!=null) rows.push(`<div><span>Énergie</span><strong>${t.energy}/5</strong></div>`);
  if(t.stress!=null) rows.push(`<div><span>Stress</span><strong>${t.stress}/5</strong></div>`);
  if(t.hunger!=null) rows.push(`<div><span>Faim</span><strong>${t.hunger}/5</strong></div>`);
  if(t.weight!=null) rows.push(`<div><span>Poids</span><strong>${t.weight} kg</strong></div>`);
  if(t.waist!=null) rows.push(`<div><span>Taille</span><strong>${t.waist} cm</strong></div>`);
  return `<div class="summary-lines">${rows.join('')}</div>`;
}
async function renderEvolution(checkins,workouts,cardio){
  const sorted=checkins.filter(x=>x.weight!=null||x.waist!=null).sort((a,b)=>a.date.localeCompare(b.date));
  const weightRows=sorted.filter(x=>x.weight!=null);
  const waistRows=sorted.filter(x=>x.waist!=null);
  const latestWeight=weightRows.length?Number(weightRows.at(-1).weight):null;
  const latestWaist=waistRows.length?Number(waistRows.at(-1).waist):null;
  const weightDelta=weightRows.length>1?+(latestWeight-Number(weightRows[0].weight)).toFixed(1):null;
  const waistDelta=waistRows.length>1?+(latestWaist-Number(waistRows[0].waist)).toFixed(1):null;
  const activities=workouts.filter(x=>daysAgo(x.date)<=30).length+cardio.filter(x=>daysAgo(x.date)<=30).length;
  const reading=sorted.length<2?'Je n’ai pas encore assez de recul pour lire une tendance fiable.':'Ton évolution reste cohérente avec ce que tu suis actuellement.';
  const photos=(await LTDB.all('photos')).sort((x,y)=>(y.date+y.createdAt).localeCompare(x.date+x.createdAt));
  const groups={}; photos.forEach(p=>(groups[p.date]??=[]).push(p));
  const gallery=Object.entries(groups).slice(0,12).map(([date,items])=>`<div class="photo-date-group"><div class="photo-date">${formatPhotoDate(date)}</div><div class="photo-thumbs">${items.map(p=>`<button class="photo-thumb" data-photo-view="${p.id}" aria-label="${escapeHtml(p.view||'Photo')} ${date}"><img src="${p.image}" alt="${escapeHtml(p.view||'Photo évolution')}"><span>${escapeHtml(p.view||'Photo')}</span></button>`).join('')}</div></div>`).join('');
  return `<div class="trend-hero"><div class="trend-mark"><svg viewBox="0 0 64 64"><path d="M13 44A23 23 0 0 1 45 12" class="fluidity-arc" style="stroke-width:6"/><path d="M51 19A23 23 0 0 1 20 52" class="fluidity-arc" style="stroke-width:6"/></svg><span class="initials" style="font-size:14px">${escapeHtml(state.profile.initials)}</span></div><div class="trend-copy">${reading}</div><p class="subtle">Le sens d’abord. Les graphiques seulement si tu veux creuser.</p></div>
  <div class="signals"><div class="signal"><strong>${latestWeight==null?'—':latestWeight.toFixed(1)+' kg'}</strong><span>Poids${weightDelta===null?'':` · ${signed(weightDelta)} kg`}</span></div><div class="signal"><strong>${latestWaist==null?'—':latestWaist.toFixed(1)+' cm'}</strong><span>Tour de taille${waistDelta===null?'':` · ${signed(waistDelta)} cm`}</span></div><div class="signal"><strong>${activities}</strong><span>Activités · 30 j</span></div></div>
  <div class="card photo-journal"><div class="card-kicker">Photos</div><div class="photo-title-row"><div><h3>Voir le changement</h3><p class="subtle">Même cadrage, même vue, une date. L’analyse IA viendra ensuite.</p></div><div class="photo-top-actions"><button class="action secondary compact" type="button" data-open="photoCompare">Comparer</button><button class="action compact" type="button" data-open="progressPhoto">Ajouter</button></div></div>${gallery||'<div class="empty">Tes photos d’évolution apparaîtront ici en petites vignettes, classées par date.</div>'}</div>
  <div class="card" style="margin-top:14px"><div class="card-kicker">Comprendre</div><h3>Pourquoi cette lecture ?</h3><p class="subtle">Les graphiques et l’historique détaillé restent au niveau suivant.</p><div class="card-actions"><button class="action secondary" data-open="details">Explorer les données</button></div></div>`;
}
function formatPhotoDate(d){try{return new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'))}catch{return d}}

async function renderTraining(){
  const workouts=(await LTDB.all('workouts')).sort((a,b)=>b.date.localeCompare(a.date));
  const cardio=(await LTDB.all('cardio')).sort((a,b)=>b.date.localeCompare(a.date));
  const suggestion=suggestWorkout(workouts);
  const lastForce=workouts[0], lastCardio=cardio[0];
  const forceCount30=workouts.filter(x=>daysAgo(x.date)<=30).length;
  const cardioCount30=cardio.filter(x=>daysAgo(x.date)<=30).length;
  return `<section class="hero"><div class="hello">Entraînement</div><div class="subtle">Une proposition simple, basée sur ton historique. Tu restes toujours libre de changer.</div></section>

  <div class="card training-v2-feature">
    <div class="card-kicker">${companionMark("choice-companion")} Suggestion du Compagnon</div>
    <div id="smartTrainingSuggestion">
      <div class="training-v2-head">
        <div>
          <h3>${escapeHtml(suggestion.title)}</h3>
          <p class="subtle">${escapeHtml(suggestion.subtitle)}</p>
        </div>
        <span class="pill">${escapeHtml(suggestion.goalLabel)}</span>
      </div>
      <div class="training-v2-reason">${escapeHtml(suggestion.reason)}</div>
      <div class="smart-fallback-note">Suggestion locale immédiate · le Compagnon peut l’affiner avec ton contexte récent.</div>
      <div class="card-actions">
        <button class="action" id="askSmartTraining" type="button">Affiner avec le Compagnon</button>
        <button class="action secondary" data-open="workoutIdeas">Choisir moi-même</button>
      </div>
    </div>
  </div>

  <div class="training-history-grid">
    <div class="card compact-history-card">
      <div class="card-kicker">Historique Force</div>
      <h3>${lastForce?escapeHtml(lastForce.name||'Séance Force'):'Aucune séance'}</h3>
      <p class="subtle">${lastForce?`${formatPhotoDate(lastForce.date)} · ${lastForce.durationLabel||''}`:`Commence à enregistrer tes séances pour personnaliser les propositions.`}</p>
      <div class="history-mini-stat"><strong>${forceCount30}</strong><span>séance${forceCount30>1?'s':''} · 30 j</span></div>
      <button class="action secondary compact full" data-open="forceHistory">Voir l’historique</button>
    </div>

    <div class="card compact-history-card">
      <div class="card-kicker">Historique Cardio</div>
      <h3>${lastCardio?escapeHtml(lastCardio.type||'Cardio'):'Aucune activité'}</h3>
      <p class="subtle">${lastCardio?`${formatPhotoDate(lastCardio.date)}${lastCardio.distance?` · ${lastCardio.distance} km`:''}${lastCardio.durationLabel?` · ${lastCardio.durationLabel}`:''}`:'Course, vélo, natation, marche…'}</p>
      <div class="history-mini-stat"><strong>${cardioCount30}</strong><span>activité${cardioCount30>1?'s':''} · 30 j</span></div>
      <div class="history-card-actions">
        <button class="action compact full" data-open="cardio">Ajouter manuellement</button>
        <button class="action secondary compact full" data-open="cardioImport">Importer un fichier</button>
        <button class="action secondary compact full strava-action" data-open="stravaHub">Strava</button>
        <button class="text-action history-link" data-open="cardioHistory">Voir / modifier l’historique</button>
      </div>
    </div>
  </div>`;
}


async function smartTrainingContext(){
  const [workouts,cardio,checkins,nutrition]=await Promise.all([LTDB.all('workouts'),LTDB.all('cardio'),LTDB.all('checkins'),LTDB.all('nutrition')]);
  const recent=(rows,days)=>rows.filter(x=>daysAgo(x.date)<=days).sort((a,b)=>b.date.localeCompare(a.date));
  return {
    date:todayKey(),
    force:recent(workouts,14).slice(0,12).map(w=>({date:w.date,name:w.name,duration:w.durationLabel||null,effort:w.effort??null,exercises:(w.exerciseEntries||[]).map(e=>({name:e.name,performance:e.performance||null}))})),
    cardio:recent(cardio,14).slice(0,15).map(c=>({date:c.date,type:c.type,name:c.name||null,distance:c.distance??null,duration:c.durationLabel||null,heartRateAvg:c.heartRateAvg??null,elevationGain:c.elevationGain??null,source:c.importSource||c.source||null})),
    recovery:recent(checkins,7).slice(0,7).map(c=>({date:c.date,sleep:c.sleep??null,stress:c.stress??null,energy:c.energy??null,hunger:c.hunger??null,weight:c.weight??null,waist:c.waist??null})),
    nutrition:recent(nutrition,3).slice(0,20).map(n=>({date:n.date,meal:n.meal||n.type||null,protein:n.protein??null,calories:n.calories??null})),
    constraints:{preferredDurationMin:40,primaryFocus:'force et recomposition corporelle',freedom:'L’utilisateur peut toujours changer la séance'}
  };
}
async function loadSmartTrainingSuggestion(){
  const box=$('#smartTrainingSuggestion'),btn=$('#askSmartTraining');
  if(btn){btn.disabled=true;btn.textContent='Le Compagnon réfléchit…'}
  try{
    const context=await smartTrainingContext();
    const r=await fetch('/.netlify/functions/training-ai-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context})});
    const data=await r.json();if(!r.ok)throw new Error(data.detail||data.error||'Analyse impossible');
    state.aiWorkout=data.workout;
    box.innerHTML=`<div class="training-v2-head"><div><h3>${escapeHtml(data.workout.title)}</h3><p class="subtle">${escapeHtml(data.workout.subtitle)}</p></div><span class="pill">${escapeHtml(data.workout.goalLabel||'Force')}</span></div><div class="training-v2-reason">${escapeHtml(data.reason)}</div>${data.contextNote?`<div class="smart-context-note">${escapeHtml(data.contextNote)}</div>`:''}<div class="card-actions"><button class="action" id="viewAIWorkout" type="button">Voir la séance</button><button class="action secondary" id="regenerateAIWorkout" type="button">Une autre proposition</button><button class="text-action" data-open="workoutIdeas">Choisir moi-même</button></div>`;
    $('#viewAIWorkout')?.addEventListener('click',()=>workoutDetailSheet(state.aiWorkout));
    $('#regenerateAIWorkout')?.addEventListener('click',loadSmartTrainingSuggestion);
    document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.open)));
  }catch(err){
    console.error(err);
    if(btn){btn.disabled=false;btn.textContent='Réessayer avec le Compagnon'}
    toast('Suggestion locale conservée');
  }
}
function workoutLibrary(){
  return [
    {id:'upper',title:'Haut du corps',subtitle:'~40 min · équilibré',goalLabel:'Mixte',tags:['upper','balanced'],plan:[
      {name:'Développé couché',sets:4,reps:6,rest:'2 min'},
      {name:'Tractions',sets:4,reps:8,rest:'90 s'},
      {name:'Rowing',sets:3,reps:10,rest:'90 s'},
      {name:'Développé épaules',sets:3,reps:10,rest:'75 s'},
      {name:'Gainage',sets:3,reps:'45 s',rest:'45 s'}
    ]},
    {id:'full',title:'Full body',subtitle:'~40 min · global',goalLabel:'Mixte',tags:['full'],plan:[
      {name:'Squat',sets:4,reps:6,rest:'2 min'},
      {name:'Développé couché',sets:3,reps:8,rest:'90 s'},
      {name:'Rowing',sets:3,reps:10,rest:'90 s'},
      {name:'Fentes',sets:3,reps:10,rest:'75 s'},
      {name:'Gainage',sets:3,reps:'45 s',rest:'45 s'}
    ]},
    {id:'lower',title:'Bas du corps',subtitle:'~40 min · jambes + gainage',goalLabel:'Force',tags:['lower'],plan:[
      {name:'Squat',sets:4,reps:6,rest:'2 min'},
      {name:'Fentes',sets:3,reps:10,rest:'90 s'},
      {name:'Soulevé de terre roumain',sets:3,reps:8,rest:'2 min'},
      {name:'Mollets',sets:3,reps:15,rest:'60 s'},
      {name:'Gainage',sets:3,reps:'45 s',rest:'45 s'}
    ]},
    {id:'push',title:'Push',subtitle:'~35 min · poussée',goalLabel:'Hypertrophie',tags:['upper','push'],plan:[
      {name:'Développé couché',sets:4,reps:8,rest:'90 s'},
      {name:'Développé incliné',sets:3,reps:10,rest:'90 s'},
      {name:'Développé épaules',sets:3,reps:10,rest:'75 s'},
      {name:'Élévations latérales',sets:3,reps:15,rest:'60 s'},
      {name:'Extensions triceps',sets:3,reps:12,rest:'60 s'}
    ]},
    {id:'pull',title:'Pull',subtitle:'~35 min · tirage',goalLabel:'Hypertrophie',tags:['upper','pull'],plan:[
      {name:'Tractions',sets:4,reps:8,rest:'90 s'},
      {name:'Rowing',sets:4,reps:10,rest:'90 s'},
      {name:'Tirage vertical',sets:3,reps:10,rest:'75 s'},
      {name:'Face pull',sets:3,reps:15,rest:'60 s'},
      {name:'Curl biceps',sets:3,reps:12,rest:'60 s'}
    ]},
    {id:'upper-push',title:'Haut orienté poussée',subtitle:'~40 min · pecs / épaules / triceps',goalLabel:'Hypertrophie',tags:['upper','push'],plan:[
      {name:'Développé couché',sets:4,reps:6,rest:'2 min'},
      {name:'Développé incliné',sets:3,reps:8,rest:'90 s'},
      {name:'Développé épaules',sets:3,reps:10,rest:'75 s'},
      {name:'Élévations latérales',sets:3,reps:15,rest:'60 s'},
      {name:'Extensions triceps',sets:3,reps:12,rest:'60 s'}
    ]},
    {id:'upper-pull',title:'Haut orienté tirage',subtitle:'~40 min · dos / biceps',goalLabel:'Hypertrophie',tags:['upper','pull'],plan:[
      {name:'Tractions',sets:4,reps:6,rest:'2 min'},
      {name:'Rowing',sets:4,reps:8,rest:'90 s'},
      {name:'Tirage horizontal',sets:3,reps:10,rest:'75 s'},
      {name:'Face pull',sets:3,reps:15,rest:'60 s'},
      {name:'Curl biceps',sets:3,reps:12,rest:'60 s'}
    ]},
    {id:'short',title:'Séance courte',subtitle:'~25 min · essentiel',goalLabel:'Efficace',tags:['short'],plan:[
      {name:'Développé couché',sets:3,reps:8,rest:'90 s'},
      {name:'Tractions',sets:3,reps:8,rest:'90 s'},
      {name:'Squat',sets:3,reps:8,rest:'90 s'},
      {name:'Gainage',sets:3,reps:'45 s',rest:'45 s'}
    ]}
  ];
}
function suggestWorkout(workouts){
  const lib=workoutLibrary();
  const recent=workouts.filter(x=>daysAgo(x.date)<=7).slice(0,4);
  const names=recent.map(x=>(x.name||'').toLowerCase());
  let target='upper';
  let reason='Je privilégie une séance polyvalente pour construire l’historique.';
  if(recent.length){
    const last=(recent[0]?.name||'').toLowerCase();
    if(/haut|push|pull/.test(last)){target='lower';reason='Ta dernière séance était orientée haut du corps, donc je varie la sollicitation.'}
    else if(/bas|jamb|lower/.test(last)){target='upper';reason='Ta dernière séance était orientée bas du corps, donc je rééquilibre avec le haut.'}
    else if(/full/.test(last)){target='upper';reason='Après un full body, je propose une séance plus ciblée.'}
  }
  if(recent.length>=3 && names.filter(n=>/haut|push|pull/.test(n)).length>=2){target='lower';reason='Tu as déjà beaucoup travaillé le haut du corps récemment.'}
  const pick=lib.find(x=>x.id===target)||lib[0];
  return {...pick,reason};
}
function workoutById(id){return workoutLibrary().find(x=>x.id===id)||workoutLibrary()[0]}

function exerciseJournal(workouts){
  const rows=[]; const seen=new Set();
  for(const w of workouts){
    const entries=(w.exerciseEntries||[]);
    for(const e of entries){ if(seen.has(e.name)) continue; seen.add(e.name); rows.push(`<div class="list-row"><div><strong>${escapeHtml(e.name)}</strong><div class="status">${escapeHtml(e.performance||'Dernière séance enregistrée')} · ${w.date}</div></div><span class="pill">Journal</span></div>`); if(rows.length>=8) return rows.join(''); }
  }
  return rows.join('');
}
async function companionSnapshot(){
  const [checkins,workouts,cardio,food]=await Promise.all(['checkins','workouts','cardio','food'].map(s=>LTDB.all(s)));
  const today=todayKey(), recent=checkins.filter(x=>daysAgo(x.date)<=7).sort((a,b)=>b.date.localeCompare(a.date));
  const latest=recent[0]; const todayFood=food.filter(x=>x.date===today);
  const protein=todayFood.reduce((s,x)=>s+(Number(x.protein)||0),0), calories=todayFood.reduce((s,x)=>s+(Number(x.calories)||0),0);
  const acts=[...workouts,...cardio].filter(x=>daysAgo(x.date)<=7).length;
  let headline='Je construis encore ton contexte.';
  if(latest){
    const bits=[];
    if(latest.energy<=2)bits.push('énergie basse');
    if(latest.stress>=4)bits.push('stress élevé');
    if(latest.sleep&&latest.sleep<6.5)bits.push('sommeil court');
    if(protein)bits.push(`${Math.round(protein)} g de protéines aujourd’hui`);
    if(acts)bits.push(`${acts} entraînement${acts>1?'s':''} sur 7 jours`);
    headline=bits.length?`Je vois ${bits.join(', ')}.`:'Tes signaux du moment sont plutôt stables.';
  }
  return {headline,context:{today,goal:state.profile.goal,proteinTarget:state.profile.proteinTarget||170,latestCheckin:latest||null,proteinToday:protein,caloriesToday:calories,activities7d:acts,recentCheckins:recent.slice(0,7)}};
}
async function renderCompanion(){
  const messages=await LTDB.all('events'),chat=messages.filter(x=>x.type==='CHAT').slice(-8),snap=await companionSnapshot();
  return `<section class="hero"><div class="companion-page-mark">${companionMark("companion-mark-large")}</div><div class="hello">Compagnon</div><div class="subtle">Je lis tes données utiles avant de te répondre.</div></section>
  <div class="card primary-card"><div class="attention">${companionMark("companion-mark-large")}<div><h3>${escapeHtml(snap.headline)}</h3><p>Je m’appuie sur ce que tu as réellement enregistré. Pas sur une supposition.</p></div></div></div>
  <div class="card chat" id="chat">${chat.length?chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${escapeHtml(x.text)}</div>`).join(''):'<div class="bubble companion">Demande-moi par exemple ce que je pense de ta journée ou ce que tu devrais privilégier demain.</div>'}</div><div class="chatbar"><input id="chatInput" placeholder="Écris une question…"><button id="sendChat">Envoyer</button></div>`;
}

async function renderProfile(){
  return `<section class="hero"><div class="profile-head"><svg class="big-logo" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><div class="hello" style="font-size:28px;margin:0">${escapeHtml(state.profile.firstName)}</div><div class="subtle">${escapeHtml(state.profile.goal||'Ton évolution')}</div></div></div></section>
  <div class="card"><div class="card-kicker">Ce que tu sais de moi</div><div class="list"><div class="list-row"><div><strong>Objectif actuel</strong><div class="status">${escapeHtml(state.profile.goal||'À définir')}</div></div><span class="pill">Confirmé</span></div><div class="list-row"><div><strong>Alimentation</strong><div class="status">${state.profile.nutritionEnabled?'Accompagnement actif':'Masquée'}</div></div><span class="pill">Choix</span></div></div></div>
  <div class="card"><div class="switch-row"><div><strong>Accompagnement alimentation</strong><div class="status">Masqué lorsqu’il est désactivé.</div></div><input id="nutritionToggle" class="toggle" type="checkbox" ${state.profile.nutritionEnabled?'checked':''}></div></div>
  <div class="card"><div class="card-kicker">Tes données</div><h3>Export / Import</h3><p class="subtle">Tes données restent récupérables.</p><div class="card-actions"><button class="action" id="exportBtn">Exporter JSON</button><label class="action secondary">Importer JSON<input id="importInput" type="file" accept="application/json" hidden></label></div></div><div class="version">Luis Transformation · Build 0.9.1.2</div>`;
}
function bindPage(){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>{state.homeView=b.dataset.homeView;render();}));
  document.querySelectorAll('[data-route-card]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.routeCard)));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openSheet(b.dataset.open)); document.querySelectorAll('[data-photo-view]').forEach(b=>b.onclick=()=>viewProgressPhoto(b.dataset.photoView));
  document.querySelectorAll('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.editActivity.split(':'); editActivitySheet(kind,id);}));
  $('#sendChat')?.addEventListener('click',sendChat); $('#chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  $('#nutritionToggle')?.addEventListener('change',async e=>{state.profile.nutritionEnabled=e.target.checked; await LTDB.put('profile',state.profile); toast(e.target.checked?'Alimentation activée':'Alimentation masquée'); render();});
  $('#exportBtn')?.addEventListener('click',exportData); $('#importInput')?.addEventListener('change',importData);
}
async function quickAdd(){ openSheet('quick'); }
function showSheet(html){ stopBarcodeCamera(); stopProgressCamera(); $('#sheetContent').innerHTML=`<button class="sheet-x" type="button" data-close aria-label="Fermer">×</button>${html}`; $('#sheet').showModal(); bindSheet(); updateAllRanges(); }
function slider(name,label,min,max,step,value,unit=''){ return `<div class="slider-line"><div class="slider-head"><label>${label}</label><output data-output="${name}">${value}${unit}</output></div><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-range-unit="${unit}"></div>`; }
function openSheet(kind){
  if(kind==='quick') return showSheet(`<h2>Donner quelque chose</h2><div class="sheet-grid"><button class="sheet-choice" data-sheet="checkin">◌<strong>Ressenti</strong></button><button class="sheet-choice" data-sheet="workout">◎<strong>Force</strong></button><button class="sheet-choice" data-sheet="cardio">⌁<strong>Cardio</strong></button>${state.profile.nutritionEnabled?'<button class="sheet-choice" data-sheet="nutritionHub">◒<strong>Alimentation</strong></button>':''}</div>`);
  if(kind==='checkin') {
    showSheet(`<h2>Comment vas-tu aujourd’hui ?</h2><form id="checkinForm">${dateField('date',todayKey())}${slider('sleep','Sommeil','0','12','0.25','7',' h')}${slider('energy','Énergie','1','5','1','3','/5')}${slider('stress','Stress','1','5','1','2','/5')}${slider('hunger','Faim','1','5','1','3','/5')}<div class="field"><label>Poids (kg)</label><input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal" placeholder="80.4"></div><div class="field"><label>Tour de taille (cm)</label><input name="waist" type="number" min="30" max="250" step="0.1" inputmode="decimal" placeholder="90.0"></div><button class="action" type="submit">Enregistrer</button></form>`);
    const form=$('#checkinForm'), date=todayKey();
    LTDB.get('checkins',date).then(existing=>{
      if(!existing || !form || !form.isConnected) return;
      ['sleep','energy','stress','hunger','weight','waist'].forEach(name=>{
        if(existing[name]!==null && existing[name]!==undefined && form.elements[name]){
          form.elements[name].value=existing[name];
          if(form.elements[name].type==='range') updateRange(form.elements[name]);
        }
      });
      const submit=form.querySelector('button[type="submit"]');
      if(submit) submit.textContent='Mettre à jour';
    }).catch(console.error);
    return;
  }
  if(kind==='workout') return showSheet(`<h2>Ta séance Force</h2><form id="workoutForm"><input type="hidden" name="name" value="Haut du corps">${dateField('date',todayKey())}${forceExerciseInput('Développé couché',4,6,'2 min')}${forceExerciseInput('Tractions',4,8,'90 s')}${forceExerciseInput('Rowing',3,10,'90 s')}${forceExerciseInput('Développé épaules',3,10,'75 s')}${forceExerciseInput('Gainage',3,'45 s','45 s')}<div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="40"></div>${slider('effort','Ressenti','1','5','1','3','/5')}<button class="action" type="submit">Terminer la séance</button></form>`);
  if(kind==='suggestedWorkout') return LTDB.all('workouts').then(ws=>workoutDetailSheet(suggestWorkout(ws)));
  if(kind==='workoutIdeas') return showSheet(`<h2>Choisir l’entraînement</h2><p class="subtle">Choisis librement le type de séance. La suggestion n’est qu’un point de départ.</p><div class="workout-choice-grid">${workoutLibrary().map(w=>`<button class="suggestion-card workout-choice-card" data-workout-choice="${w.id}"><div><strong>${escapeHtml(w.title)}</strong><span>${escapeHtml(w.subtitle)} · ${escapeHtml(w.goalLabel)}</span></div><span>›</span></button>`).join('')}</div>`);
  if(kind==='forceHistory') return LTDB.all('workouts').then(rows=>showSheet(`<h2>Historique Force</h2><div class="list">${rows.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<button class="list-row history-button" data-edit-activity="Force:${x.id}"><div><strong>${escapeHtml(x.name||'Séance Force')}</strong><div class="status">${formatPhotoDate(x.date)}${x.durationLabel?` · ${x.durationLabel}`:''}</div></div><span class="pill">Modifier</span></button>`).join('')||'<div class="empty">Aucune séance Force.</div>'}</div>`));
  if(kind==='stravaHub') return showSheet(`<h2>Strava</h2><p class="subtle">Connecte ton compte, puis récupère tes dernières activités quand tu le souhaites. Rien n’est enregistré automatiquement.</p><div class="strava-card"><div class="strava-mark">S</div><div><strong>Connexion Strava</strong><span>Lecture de tes activités uniquement</span></div></div><div class="strava-actions"><a class="action strava-connect" href="/.netlify/functions/strava-auth-start">Connecter Strava</a><button class="action secondary" id="fetchStravaActivities" type="button">Récupérer mes activités</button></div><div id="stravaStatus" class="strava-status"></div><div id="stravaActivities"></div>`);
  if(kind==='cardioImport') return showSheet(`<h2>Importer une activité</h2><p class="subtle">Choisis un fichier GPX, TCX ou FIT. Je lis les données puis tu vérifies avant l’enregistrement.</p><label class="import-drop-card"><span class="import-icon">↥</span><strong>Choisir un fichier</strong><span>GPX · TCX · FIT</span><input id="cardioImportInput" type="file" accept=".gpx,.tcx,.fit,application/gpx+xml,application/vnd.garmin.tcx+xml,application/octet-stream" hidden></label><div class="import-privacy">Analyse locale. Rien n’est enregistré sans ta confirmation.</div><div id="cardioImportStatus"></div>`);
  if(kind==='cardioHistory') return LTDB.all('cardio').then(rows=>showSheet(`<h2>Historique Cardio</h2><div class="list">${rows.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<button class="list-row history-button" data-edit-activity="Cardio:${x.id}"><div><strong>${escapeHtml(x.type||'Cardio')}</strong><div class="status">${formatPhotoDate(x.date)}${x.distance?` · ${x.distance} km`:''}${x.durationLabel?` · ${x.durationLabel}`:''}</div></div><span class="pill">Modifier</span></button>`).join('')||'<div class="empty">Aucune activité Cardio.</div>'}</div>`));
  if(kind==='cardio') return showSheet(`<h2>Ajouter une activité Cardio</h2><form id="cardioForm">${dateField('date',todayKey())}<div class="field"><label>Type</label><select name="type"><option>Course</option><option>Vélo</option><option>Natation</option><option>Marche</option><option>Autre</option></select></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" max="23" inputmode="numeric" value="0"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" inputmode="numeric" value="40"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" inputmode="numeric" value="0"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" inputmode="numeric"></div><div class="field"><label>Cadence moy.</label><input name="cadence" type="number" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>Dénivelé + (m)</label><input name="elevation" type="number" inputmode="numeric"></div><div class="field"><label>Calories (kcal)</label><input name="calories" type="number" inputmode="numeric"></div></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='nutritionHub') return nutritionHubSheet();
  if(kind==='nutritionMealAdd'){
    const type=pendingNutritionMealType||'lunch';
    return showSheet(`<h2>${mealTypeLabel(type)}</h2><p class="subtle">Comment veux-tu ajouter quelque chose à ce repas ?</p><div class="nutrition-actions meal-add-methods"><button class="sheet-choice" data-sheet="foodSearch">⌕<strong>Rechercher un aliment</strong><span>Nom, marque ou produit</span></button><button class="sheet-choice" data-sheet="barcode">▣<strong>Scanner un produit</strong><span>Code-barres</span></button><button class="sheet-choice" data-sheet="photoFood">◉<strong>Photo aliment / repas</strong><span>Le Compagnon analyse puis tu confirmes</span></button><button class="sheet-choice" data-sheet="food">＋<strong>Saisie manuelle</strong><span>Description + macros</span></button></div>`);
  }
  if(kind==='food') return showSheet(`<h2>Ajouter un repas</h2><form id="foodForm">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><div class="field"><label>Décris simplement</label><textarea name="description" rows="3" placeholder="Poulet, riz, légumes et un yaourt"></textarea></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1"></div><div class="field"><label>Calories</label><input name="calories" type="number"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1"></div></div><div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1"></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes classiques</label><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='foodSearch') return showSheet(`<h2>Rechercher un aliment</h2><p class="subtle">Recherche par nom ou marque. Choisis un résultat, indique la quantité et confirme avant l’enregistrement.</p><input type="hidden" id="foodSearchMealContext" value="${escapeHtml(pendingNutritionMealType||'')}"><form id="foodSearchForm"><div class="food-search-line"><input name="query" autocomplete="off" placeholder="Ex. skyr, poulet, Lidl High Protein…" required><button class="action compact" type="submit">Rechercher</button></div></form><div id="foodSearchStatus" class="ai-status"></div><div id="foodSearchResults"></div><div class="ai-note">Produits de marque : Open Food Facts. Aliments génériques : base nutritionnelle intégrée en complément.</div>`);
  if(kind==='barcode') return showSheet(`<h2>Scanner un produit</h2><p class="subtle">Cadre le code-barres avec l’appareil photo. Dès qu’il est reconnu, le produit est recherché.</p><div class="barcode-scanner"><video id="barcodeVideo" playsinline muted></video><div class="barcode-frame"><span></span></div><div id="barcodeScanStatus" class="ai-status">Appuie sur « Ouvrir la caméra ».</div></div><button class="action" type="button" id="startBarcodeCamera">Ouvrir la caméra</button><button class="text-action" type="button" id="toggleManualBarcode">Saisir le code manuellement</button><form id="barcodeForm" class="manual-barcode hidden">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><div class="field"><label>Code-barres</label><input name="barcode" inputmode="numeric" autocomplete="off" placeholder="7612345678901" required></div><button class="action secondary" type="submit" id="barcodeLookupBtn">Rechercher</button></form><div class="ai-note">Le scan est traité sur ton téléphone. Seul le numéro du code-barres est envoyé à Open Food Facts.</div>`);
  if(kind==='photoFood') return showSheet(`<h2>Photo aliment / repas</h2><p class="subtle">Prends une photo ou choisis-en une. Le Compagnon propose ce qu’il reconnaît, puis tu corriges ou confirmes.</p>${dateField('photoDate',todayKey())}<div class="field"><label>Moment</label><select id="photoMealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><div class="photo-actions"><label class="action photo-action">Prendre une photo<input id="foodPhotoInput" type="file" accept="image/*" capture="environment" hidden></label><label class="action secondary photo-action">Photothèque<input id="foodLibraryInput" type="file" accept="image/*" hidden></label></div><div id="foodPhotoPreview" class="photo-preview empty">Aucune photo sélectionnée.</div><div id="foodAIStatus" class="ai-status"></div>`);
  if(kind==='photoCompare') {
    LTDB.all('photos').then(photos=>{
      const dates=[...new Set(photos.map(p=>p.date))].sort().reverse();
      if(dates.length<2){
        showSheet(`<h2>Comparer deux dates</h2><div class="empty">Ajoute des photos sur au moins deux dates différentes pour lancer une comparaison.</div>`);
        return;
      }
      showSheet(`<h2>Comparer deux dates</h2><p class="subtle">Choisis deux moments de ton évolution.</p><div class="compare-date-grid"><div class="field"><label>Avant</label><select id="compareDateA">${dates.map((d,i)=>`<option value="${d}" ${i===1?'selected':''}>${formatPhotoDate(d)}</option>`).join('')}</select></div><div class="field"><label>Après</label><select id="compareDateB">${dates.map((d,i)=>`<option value="${d}" ${i===0?'selected':''}>${formatPhotoDate(d)}</option>`).join('')}</select></div></div><button class="action" id="launchPhotoCompare" type="button">Afficher la comparaison</button>`);
      $('#launchPhotoCompare')?.addEventListener('click',()=>renderPhotoComparison($('#compareDateA').value,$('#compareDateB').value));
    });
    return;
  }
  if(kind==='progressPhoto') {
    stopProgressCamera();
    return showSheet(`<h2>Photo d’évolution</h2><p class="subtle">Prends une photo ou choisis-en une, puis recadre-la avant de l’enregistrer.</p>${dateField('photoDate',todayKey())}<div class="field"><label>Vue</label><select id="progressPhotoView"><option>Face</option><option>Profil</option><option>Dos</option></select></div><div class="photo-source-actions"><button class="action" id="openProgressCamera" type="button">Prendre une photo</button><label class="action secondary">Photothèque<input id="progressLibraryInput" type="file" accept="image/*" hidden></label></div><div class="photo-guide-note">Conseil : même lumière, même distance et posture détendue pour rendre les comparaisons utiles.</div>`);
  }
  if(kind==='mealIdea') return mealIdeaSheet();
  if(kind==='details') return showSheet(`<h2>Données détaillées</h2><p class="subtle">Les graphiques restent volontairement derrière Évolution. Ce niveau sera enrichi sans changer l’écran principal.</p><button class="action secondary" data-close>Fermer</button>`);
}
async function nutritionHubSheet(){
  pendingNutritionMealType=null;
  const all=await LTDB.all('food');
  const food=all.filter(x=>x.date===todayKey()).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const total=mealSummary(food);
  const target=state.profile.proteinTarget||170;
  const proteinPct=Math.min(100,target?total.protein/target*100:0);
  const mealOrder=['breakfast','lunch','snack','dinner'];
  const byMeal=Object.fromEntries(mealOrder.map(type=>[type,food.filter(x=>x.mealType===type)]));
  return showSheet(`<div class="nutrition-page-head"><div><div class="card-kicker">Alimentation</div><h2>Aujourd’hui</h2></div><span class="nutrition-date">${new Intl.DateTimeFormat('fr-CH',{weekday:'short',day:'numeric',month:'short'}).format(new Date())}</span></div>
    <section class="nutrition-day-summary">
      <div class="nutrition-day-top"><strong>${Math.round(total.calories)} kcal</strong><span>Objectif protéines ${target} g</span></div>
      <div class="nutrition-day-macros"><div><b>${Math.round(total.protein)} g</b><span>Protéines</span></div><div><b>${Math.round(total.carbs)} g</b><span>Glucides</span></div><div><b>${Math.round(total.fat)} g</b><span>Lipides</span></div></div>
      <div class="nutrition-bar"><i style="width:${proteinPct}%"></i></div>
    </section>
    <div class="nutrition-meals">${mealOrder.map(type=>nutritionMealCard(type,byMeal[type])).join('')}</div>
    <div class="nutrition-legacy-actions"><button class="action secondary" data-sheet="foodSearch">Rechercher</button><button class="action secondary" data-sheet="barcode">Scanner</button><button class="action secondary" data-sheet="photoFood">Photo</button><button class="action secondary" data-sheet="food">Saisie manuelle</button></div>
    <p class="nutrition-safe-note">Tes fonctions actuelles restent disponibles. Recettes, copier depuis hier et calendrier arrivent dans les prochains blocs validés.</p>`);
}
async function editFoodSheet(id){
  const x=await LTDB.get('food',id); if(!x) return;
  showSheet(`<h2>Modifier le repas</h2><form id="foodEditForm">
    <input type="hidden" name="id" value="${x.id}">
    ${dateField('date',x.date||todayKey())}
    <div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(x.mealType||'')}</select></div>
    <div class="field"><label>Description</label><textarea name="description" rows="3">${escapeHtml(x.description||'')}</textarea></div>
    <div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1" value="${x.protein??''}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${x.calories??''}"></div></div>
    <div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1" value="${x.carbs??''}"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1" value="${x.fat??''}"></div></div>
    <div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1" value="${x.water??''}"></div>
    <div class="edit-actions"><button class="action" type="submit">Enregistrer les modifications</button><button class="action danger" type="button" id="deleteFood">Supprimer</button></div>
  </form>`);
}
async function updateFood(e){
  e.preventDefault(); const f=new FormData(e.currentTarget); const old=await LTDB.get('food',f.get('id')); if(!old)return;
  await LTDB.put('food',{...old,date:f.get('date')||old.date||todayKey(),mealType:f.get('mealType')||old.mealType||'lunch',description:f.get('description')||'Repas',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:num(f.get('water')),updatedAt:new Date().toISOString()});
  toast('Repas modifié'); await nutritionHubSheet(); render();
}
async function deleteFood(id){
  await LTDB.del('food',id); toast('Repas supprimé'); await nutritionHubSheet(); render();
}

let mealIdeaIndex=0;
async function mealIdeaSheet(){
  const food=await LTDB.all('food'); const protein=food.filter(x=>x.date===todayKey()).reduce((s,x)=>s+(Number(x.protein)||0),0); const target=state.profile.proteinTarget||170; const remain=Math.max(0,target-protein);
  const classics=food.filter(x=>x.classic).slice(-4).map(x=>x.description);
  const ideas=[
    ['Poulet citron, pommes de terre et courgettes','~30 min · riche en protéines'],
    ['Omelette méditerranéenne, salade et pain complet','~15 min · simple et rapide'],
    ['Saumon, riz et légumes rôtis','~25 min · complet'],
    ['Skyr salé, pommes de terre, œufs et crudités','~15 min · option légère']
  ];
  const [suggestion,meta]=ideas[mealIdeaIndex%ideas.length];
  return showSheet(`<h2>Une idée pour ce soir</h2><div class="recipe-card"><div class="card-kicker">Suggestion ${mealIdeaIndex+1}</div><h3>${suggestion}</h3><p class="status">${meta}</p><p>Je la choisis en tenant compte de ce que tu as renseigné aujourd’hui${remain?` et de ton repère protéines`:''}.</p>${classics.length?`<p class="status">Classiques connus : ${classics.map(escapeHtml).join(', ')}.</p>`:''}<div class="card-actions"><button class="action" data-close>Ça me tente</button><button class="action secondary" id="nextMealIdea">Autre idée</button></div></div>`);
}

function lastExercisePerformance(name,workouts){
  for(const w of workouts||[]){
    const e=(w.exerciseEntries||[]).find(x=>x.name===name);
    if(e)return e;
  }
  return null;
}
async function workoutDetailSheet(workout){
  const history=(await LTDB.all('workouts')).sort((a,b)=>b.date.localeCompare(a.date));
  const plan=workout.plan.map(x=>({...x,last:lastExercisePerformance(x.name,history)}));
  state.pendingWorkout={...workout,plan};
  showSheet(`<h2>${escapeHtml(workout.title)}</h2><p class="subtle">${escapeHtml(workout.subtitle)} · ${escapeHtml(workout.goalLabel)}</p><div class="workout-detail-list">${plan.map((x,i)=>`<div class="workout-detail-row"><div class="workout-detail-main"><strong>${escapeHtml(x.name)}</strong><span>${x.sets} séries × ${x.reps} · récup. ${x.rest}</span>${x.last?`<small>Dernière fois : ${escapeHtml(x.last.performance||'enregistrée')}</small>`:'<small>Pas encore d’historique sur cet exercice</small>'}</div><div class="workout-detail-actions"><button class="technique-btn" data-technique="${escapeHtml(x.name)}">Technique</button><button class="swap-exercise-btn" data-swap-exercise="${i}">Changer</button></div></div>`).join('')}</div><div class="card-actions"><button class="action" id="startChosenWorkout">Je fais cette séance</button><button class="action secondary" data-sheet="workoutIdeas">Changer d’entraînement</button></div>`);
}
function exerciseAlternatives(current){
  const pool=['Développé couché','Développé incliné','Pompes','Dips','Tractions','Rowing','Tirage horizontal','Tirage vertical','Développé épaules','Élévations latérales','Face pull','Curl biceps','Extensions triceps','Squat','Fentes','Soulevé de terre roumain','Presse à cuisses','Mollets','Gainage'];
  return pool.filter(x=>x!==current);
}
function swapExerciseSheet(index){
  const pending=state.pendingWorkout;if(!pending)return;
  const current=pending.plan[index];
  showSheet(`<h2>Remplacer ${escapeHtml(current.name)}</h2><div class="suggestion-list">${exerciseAlternatives(current.name).map(name=>`<button class="suggestion-card" data-exercise-replace="${index}|${escapeHtml(name)}"><strong>${escapeHtml(name)}</strong><span>Remplacer dans cette séance uniquement</span></button>`).join('')}</div>`);
}
function chosenWorkoutForm(){
  const w=state.pendingWorkout;if(!w)return;
  return showSheet(`<h2>${escapeHtml(w.title)}</h2><form id="workoutForm"><input type="hidden" name="name" value="${escapeHtml(w.title)}">${dateField('date',todayKey())}${w.plan.map((x,i)=>dynamicExerciseInput(x,i)).join('')}<div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="${parseInt(w.subtitle)||40}"></div>${slider('effort','Ressenti','1','5','1','3','/5')}<button class="action" type="submit">Terminer la séance</button></form>`);
}
function dynamicExerciseInput(x,idx){
  const rows=Array.from({length:x.sets},(_,s)=>`<div class="set-row"><span>S${s+1}</span><input name="reps_${idx}_${s}" type="number" inputmode="numeric" value="${typeof x.reps==='number'?x.reps:''}" placeholder="${x.reps}"><input name="weight_${idx}_${s}" type="number" step="0.5" inputmode="decimal" placeholder="kg"></div>`).join('');
  return `<div class="force-input"><div class="force-input-head"><div><strong>${escapeHtml(x.name)}</strong><span>${x.sets} séries × ${x.reps} · récup. ${x.rest}</span></div><button type="button" class="technique-btn" data-technique="${escapeHtml(x.name)}">Technique</button></div><div class="set-head"><span>Série</span><span>Reps</span><span>Charge</span></div>${rows}</div>`;
}
function forceExerciseInput(name,sets,reps,rest){
  const idx={'Développé couché':0,'Tractions':1,'Rowing':2,'Développé épaules':3,'Gainage':4}[name];
  const rows=Array.from({length:sets},(_,s)=>`<div class="set-row"><span>S${s+1}</span><input name="reps_${idx}_${s}" type="number" inputmode="numeric" value="${typeof reps==='number'?reps:''}" placeholder="${reps}"><input name="weight_${idx}_${s}" type="number" step="0.5" inputmode="decimal" placeholder="kg"></div>`).join('');
  return `<div class="force-input"><div class="force-input-head"><div><strong>${name}</strong><span>${sets} séries × ${reps} · récup. ${rest}</span></div><button type="button" class="technique-btn" data-technique="${name}">Technique</button></div><div class="set-head"><span>Série</span><span>Reps</span><span>Charge</span></div>${rows}</div>`;
}
async function editActivitySheet(kind,id){
  const store=kind==='Force'?'workouts':'cardio'; const x=await LTDB.get(store,id); if(!x)return;
  if(kind==='Cardio'){
    const total=x.durationSeconds||0, h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
    return showSheet(`<h2>Modifier Cardio</h2><form id="activityEditForm"><input type="hidden" name="kind" value="Cardio"><input type="hidden" name="id" value="${id}">
      ${dateField('date',x.date||todayKey())}
      <div class="field"><label>Type</label><select name="type">${['Course','Vélo','Natation','Marche','Autre'].map(v=>`<option ${x.type===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal" value="${x.distance??''}"></div>
      <div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" value="${h}"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" value="${m}"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" value="${s}"></div></div>
      <div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" value="${x.heartRateAvg??''}"></div><div class="field"><label>Cadence moyenne (ppm)</label><input name="cadence" type="number" value="${x.cadenceAvg??''}"></div></div>
      <div class="range-row"><div class="field"><label>Dénivelé +</label><input name="elevation" type="number" value="${x.elevationGain??''}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${x.calories??''}"></div></div>
      <div class="edit-actions"><button class="action" type="submit">Enregistrer</button><button class="action danger" type="button" id="deleteActivity">Supprimer</button></div></form>`);
  }
  const entries=editableForceEntries(x);
  return showSheet(`<h2>Modifier la séance Force</h2><form id="activityEditForm"><input type="hidden" name="kind" value="Force"><input type="hidden" name="id" value="${id}">
    ${dateField('date',x.date||todayKey())}
    <div class="edit-force-list">${entries.map((e,i)=>{
      const series=normalizedForceSeries(e);
      return `<div class="edit-force-exercise"><div class="force-input-head"><div><strong>${escapeHtml(e.name)}</strong><span>${e.rest?`Récup. ${escapeHtml(String(e.rest))}`:''}</span></div></div><div class="set-head"><span>Série</span><span>Reps</span><span>Charge</span></div>${series.map((s,j)=>`<div class="set-row"><span>S${j+1}</span><input name="editreps_${i}_${j}" type="number" inputmode="numeric" value="${s.reps??''}" placeholder="reps"><input name="editweight_${i}_${j}" type="number" step="0.5" inputmode="decimal" value="${s.weight??''}" placeholder="kg"></div>`).join('')}</div>`;
    }).join('')}</div>
    <div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" value="${Math.round((x.durationSeconds||0)/60)||40}"></div>
    <div class="edit-actions"><button class="action" type="submit">Enregistrer</button><button class="action danger" type="button" id="deleteActivity">Supprimer</button></div></form>`);
}
async function updateActivity(e){
  e.preventDefault(); const f=new FormData(e.currentTarget), kind=f.get('kind'), id=f.get('id'), store=kind==='Force'?'workouts':'cardio', old=await LTDB.get(store,id); if(!old)return;
  const date=f.get('date')||old.date||todayKey();
  if(kind==='Cardio'){
    const seconds=(num(f.get('hours'))||0)*3600+(num(f.get('minutes'))||0)*60+(num(f.get('seconds'))||0);
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    const label=h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
    await LTDB.put(store,{...old,date,type:f.get('type'),distance:num(f.get('distance')),durationSeconds:seconds,durationLabel:label,heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),updatedAt:new Date().toISOString()});
  } else {
    const entries=editableForceEntries(old).map((e,i)=>{
      const base=normalizedForceSeries(e);
      const series=base.map((s,j)=>({...s,set:j+1,reps:num(f.get(`editreps_${i}_${j}`))??s.reps,weight:num(f.get(`editweight_${i}_${j}`))}));
      const weights=series.map(v=>v.weight).filter(v=>v!=null);
      return {...e,sets:series.length,series,weight:weights.length?weights[weights.length-1]:e.weight,performance:series.map(v=>`${v.reps??'—'}×${v.weight??'—'}kg`).join(' · ')};
    });
    const mins=num(f.get('durationMin'))||40;
    await LTDB.put(store,{...old,date,exerciseEntries:entries,durationSeconds:mins*60,durationLabel:`${mins}:00`,updatedAt:new Date().toISOString()});
  }
  $('#sheet').close(); toast('Saisie modifiée'); render();
}
async function deleteActivity(kind,id){const store=kind==='Force'?'workouts':'cardio'; await LTDB.del(store,id); $('#sheet').close(); toast('Saisie supprimée'); render();}

function showTechnique(name){
  showSheet(`<h2>${escapeHtml(name)}</h2><div class="technique-visual"><div class="companion-page-mark">${companionMark("companion-mark-large")}</div><p><strong>Technique</strong></p><p class="subtle">Le raccourci vidéo reste dans la séance pour le moment où tu en as besoin. Le catalogue vidéo validé sera branché ici.</p></div><button class="action secondary" data-close>Revenir à la séance</button>`);
}

function bindSheet(){
  document.querySelectorAll('[data-sheet]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.sheet)));
  document.querySelectorAll('[data-meal-add]').forEach(b=>b.addEventListener('click',()=>{pendingNutritionMealType=b.dataset.mealAdd;openSheet('nutritionMealAdd')}));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{stopBarcodeCamera();stopProgressCamera();$('#sheet').close()}));
  document.querySelectorAll('[data-workout-choice]').forEach(b=>b.addEventListener('click',()=>workoutDetailSheet(workoutById(b.dataset.workoutChoice))));
  document.querySelectorAll('[data-swap-exercise]').forEach(b=>b.addEventListener('click',()=>swapExerciseSheet(Number(b.dataset.swapExercise))));
  document.querySelectorAll('[data-exercise-replace]').forEach(b=>b.addEventListener('click',()=>{const [idx,name]=b.dataset.exerciseReplace.split('|');const i=Number(idx);if(state.pendingWorkout){state.pendingWorkout.plan[i]={...state.pendingWorkout.plan[i],name};workoutDetailSheet(state.pendingWorkout)}}));
  $('#startChosenWorkout')?.addEventListener('click',chosenWorkoutForm);
  document.querySelectorAll('[data-pick-workout]').forEach(b=>b.addEventListener('click',()=>{openSheet('workout'); setTimeout(()=>{const f=$('#workoutForm'); if(f) f.elements.name.value=b.dataset.pickWorkout;},0)}));
  document.querySelectorAll('input[type="range"]').forEach(r=>r.addEventListener('input',()=>updateRange(r)));
  $('#checkinForm')?.addEventListener('submit',saveCheckin); $('#workoutForm')?.addEventListener('submit',saveWorkout); $('#cardioForm')?.addEventListener('submit',saveCardio); $('#cardioImportInput')?.addEventListener('change',handleCardioImport); $('#cardioImportConfirmForm')?.addEventListener('submit',saveImportedCardio); $('#fetchStravaActivities')?.addEventListener('click',fetchStravaActivities); $('#askSmartTraining')?.addEventListener('click',loadSmartTrainingSuggestion); $('#stravaConfirmForm')?.addEventListener('submit',saveStravaCardio); $('#foodForm')?.addEventListener('submit',saveFood); $('#foodSearchForm')?.addEventListener('submit',searchFoods); $('#foodSearchConfirmForm')?.addEventListener('submit',saveSearchedFood); $('#barcodeForm')?.addEventListener('submit',lookupBarcode); $('#startBarcodeCamera')?.addEventListener('click',startBarcodeCamera); $('#toggleManualBarcode')?.addEventListener('click',()=>$('#barcodeForm')?.classList.toggle('hidden')); $('#barcodeConfirmForm')?.addEventListener('submit',saveBarcodeFood); $('#aiFoodConfirmForm')?.addEventListener('submit',saveAIFood);
  $('#foodPhotoInput')?.addEventListener('change',previewFoodPhoto);
  $('#foodLibraryInput')?.addEventListener('change',previewFoodPhoto);
  $('#openProgressCamera')?.addEventListener('click',openProgressCamera); $('#progressLibraryInput')?.addEventListener('click',rememberProgressPhotoMeta); $('#progressLibraryInput')?.addEventListener('change',prepareProgressPhoto);
  $('#barcodeGrams')?.addEventListener('input',updateBarcodePortion);
  $('#nextMealIdea')?.addEventListener('click',()=>{mealIdeaIndex++; mealIdeaSheet();});
  document.querySelectorAll('[data-technique]').forEach(b=>b.addEventListener('click',()=>showTechnique(b.dataset.technique)));
  document.querySelectorAll('[data-edit-food]').forEach(b=>b.addEventListener('click',()=>editFoodSheet(b.dataset.editFood)));
  document.querySelectorAll('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.editActivity.split(':'); editActivitySheet(kind,id);}));
  $('#foodEditForm')?.addEventListener('submit',updateFood);
  $('#activityEditForm')?.addEventListener('submit',updateActivity);
  $('#deleteFood')?.addEventListener('click',()=>{const id=$('#foodEditForm')?.elements.id.value;if(id)deleteFood(id);});
  $('#deleteActivity')?.addEventListener('click',()=>{const f=$('#activityEditForm');if(f)deleteActivity(f.elements.kind.value,f.elements.id.value);});
}
function updateAllRanges(){ document.querySelectorAll('input[type="range"]').forEach(updateRange); }
function updateRange(r){ const out=document.querySelector(`[data-output="${r.name}"]`); if(out) out.value=`${r.value}${r.dataset.rangeUnit||''}`; }
async function saveCheckin(e){e.preventDefault(); const f=new FormData(e.currentTarget); const date=f.get('date')||todayKey(); const row={id:date,date,sleep:num(f.get('sleep')),energy:num(f.get('energy')),stress:num(f.get('stress')),hunger:num(f.get('hunger')),weight:num(f.get('weight')),waist:num(f.get('waist')),source:'manual',updatedAt:new Date().toISOString()}; await LTDB.put('checkins',row); $('#sheet').close(); toast('Point du jour enregistré'); render();}
async function saveWorkout(e){
  e.preventDefault(); const f=new FormData(e.currentTarget);
  const pending=state.pendingWorkout||workoutById('upper');
  const specs=pending.plan.map(x=>[x.name,x.sets,x.reps,x.rest]);
  const exerciseEntries=specs.map((sp,i)=>{
    const series=Array.from({length:sp[1]},(_,s)=>({set:s+1,reps:num(f.get(`reps_${i}_${s}`))||sp[2],weight:num(f.get(`weight_${i}_${s}`))}));
    const weights=series.map(x=>x.weight).filter(x=>x!=null);
    return {name:sp[0],sets:sp[1],targetReps:sp[2],rest:sp[3],series,weight:weights.length?weights[weights.length-1]:null,performance:series.map(x=>`${x.reps}×${x.weight??'—'}kg`).join(' · ')};
  });
  const date=f.get('date')||todayKey(),mins=num(f.get('durationMin'))||40;
  await LTDB.put('workouts',{id:uid(),date,name:f.get('name')||pending.title,durationSeconds:mins*60,durationLabel:`${mins}:00`,effort:num(f.get('effort')),exerciseEntries,source:'manual',createdAt:new Date().toISOString()});
  state.pendingWorkout=null; $('#sheet').close();toast('Séance enregistrée');render();
}



async function fetchStravaActivities(){
  const status=$('#stravaStatus'),box=$('#stravaActivities');if(status)status.textContent='Connexion à Strava…';
  try{
    const r=await fetch('/.netlify/functions/strava-activities',{credentials:'include'}),data=await r.json();
    if(r.status===401){if(status)status.textContent='Strava n’est pas encore connecté.';return}
    if(!r.ok)throw new Error(data.detail||data.error||'Strava indisponible');
    const existing=await LTDB.all('cardio'),imported=new Set(existing.map(x=>String(x.stravaId||'')).filter(Boolean));
    if(status)status.textContent=`${data.activities.length} activité${data.activities.length>1?'s':''} récente${data.activities.length>1?'s':''}.`;
    box.innerHTML=`<div class="strava-list">${data.activities.map(a=>`<button class="strava-activity-row" data-strava-id="${a.id}" ${imported.has(String(a.id))?'disabled':''}><div><strong>${escapeHtml(a.name||a.type||'Activité')}</strong><span>${formatPhotoDate(a.date)} · ${a.distance?Number(a.distance).toFixed(2)+' km · ':''}${formatDuration(a.durationSeconds||0)}</span></div><span class="pill">${imported.has(String(a.id))?'Déjà importée':'Prévisualiser'}</span></button>`).join('')||'<div class="empty">Aucune activité récente.</div>'}</div>`;
    document.querySelectorAll('[data-strava-id]').forEach(b=>b.addEventListener('click',()=>previewStravaActivity(b.dataset.stravaId)));
  }catch(err){console.error(err);if(status)status.textContent=`Impossible de récupérer Strava : ${err.message}`}
}
function formatDuration(sec){sec=Math.max(0,Math.round(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
async function previewStravaActivity(id){
  showSheet(`<h2>Chargement Strava</h2><div class="import-reading">Je récupère le détail de l’activité…</div>`);
  try{const r=await fetch(`/.netlify/functions/strava-activity-detail?id=${encodeURIComponent(id)}`,{credentials:'include'}),d=await r.json();if(!r.ok)throw new Error(d.detail||d.error||'Activité indisponible');showStravaConfirm(d)}
  catch(err){showSheet(`<h2>Strava</h2><div class="ai-error">${escapeHtml(err.message||'Import impossible')}</div><button class="action secondary" data-sheet="stravaHub">Retour</button>`)}
}
function showStravaConfirm(d){
  const p=durationParts(d.durationSeconds||0);
  showSheet(`<h2>Confirmer l’activité Strava</h2><p class="subtle">Vérifie les données avant l’enregistrement dans Luis Transformation.</p><form id="stravaConfirmForm"><input type="hidden" name="stravaId" value="${escapeHtml(String(d.id||''))}">${dateField('date',d.date||todayKey())}<div class="field"><label>Type</label><select name="type">${['Course','Vélo','Natation','Marche','Autre'].map(x=>`<option ${d.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Nom</label><input name="name" value="${escapeHtml(d.name||'Activité Strava')}"></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" value="${d.distance!=null?Number(d.distance).toFixed(2):''}"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" value="${p.h}"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" value="${p.m}"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" value="${p.s}"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" value="${d.heartRateAvg!=null?Math.round(d.heartRateAvg):''}"></div><div class="field"><label>Cadence moyenne (ppm)</label><input name="cadence" type="number" value="${d.cadenceAvg!=null?Math.round(d.cadenceAvg):''}"></div></div><div class="range-row"><div class="field"><label>Dénivelé +</label><input name="elevation" type="number" value="${d.elevationGain!=null?Math.round(d.elevationGain):''}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${d.calories!=null?Math.round(d.calories):''}"></div></div><div class="import-source-pill">Source : Strava · confirmation utilisateur requise</div><button class="action" type="submit">Confirmer et enregistrer</button></form>`);
}
async function saveStravaCardio(e){
  e.preventDefault();const f=new FormData(e.currentTarget),existing=await LTDB.all('cardio'),stravaId=String(f.get('stravaId')||'');
  if(existing.some(x=>String(x.stravaId||'')===stravaId)){toast('Cette activité est déjà importée');return}
  const seconds=(num(f.get('hours'))||0)*3600+(num(f.get('minutes'))||0)*60+(num(f.get('seconds'))||0);
  await LTDB.put('cardio',{id:uid(),stravaId,date:f.get('date')||todayKey(),type:f.get('type')||'Autre',name:f.get('name')||'Activité Strava',distance:num(f.get('distance')),durationSeconds:seconds,durationLabel:formatDuration(seconds),heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),source:'strava',importSource:'Strava',createdAt:new Date().toISOString()});
  $('#sheet').close();toast('Activité Strava enregistrée');render();
}
function importCardioDate(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return todayKey();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function cardioTypeFromText(v=''){v=String(v).toLowerCase();if(/run|course|jog/.test(v))return'Course';if(/bike|cycling|vélo|velo/.test(v))return'Vélo';if(/swim|natation/.test(v))return'Natation';if(/walk|hike|marche/.test(v))return'Marche';return'Autre'}
function normalizeRunCadence(value,type){
 const n=Number(value);if(!Number.isFinite(n))return null;
 return (type==='Course'||type==='Marche')&&n>0&&n<130?n*2:n;
}
function xmlEls(root,name){return[...root.getElementsByTagName('*')].filter(x=>x.localName===name)}
function xmlVal(root,name){return xmlEls(root,name)[0]?.textContent?.trim()||''}
function parseGPX(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('GPX illisible');
 const pts=xmlEls(doc,'trkpt');if(!pts.length)throw new Error('Aucun point GPS trouvé');
 let dist=0,up=0,prev=null,lastAlt=null,hr=0,hrn=0,cad=0,cadn=0;const times=[],rad=x=>x*Math.PI/180;
 for(const p of pts){const lat=+p.getAttribute('lat'),lon=+p.getAttribute('lon');if(Number.isFinite(lat)&&Number.isFinite(lon)){if(prev){const R=6371000,dla=rad(lat-prev.lat),dlo=rad(lon-prev.lon),a=Math.sin(dla/2)**2+Math.cos(rad(prev.lat))*Math.cos(rad(lat))*Math.sin(dlo/2)**2;dist+=2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}prev={lat,lon}}
 const alt=+xmlVal(p,'ele');if(Number.isFinite(alt)){if(lastAlt!=null&&alt>lastAlt)up+=alt-lastAlt;lastAlt=alt}
 const t=xmlVal(p,'time');if(t){const d=new Date(t);if(!Number.isNaN(d.getTime()))times.push(d)}
 const h=+((xmlEls(p,'hr')[0]||{}).textContent);if(Number.isFinite(h)){hr+=h;hrn++}
 const cnode=[...p.getElementsByTagName('*')].find(x=>/cad|cadence/i.test(x.localName)),c=+(cnode?.textContent);if(Number.isFinite(c)){cad+=c;cadn++}}
 const type=cardioTypeFromText(xmlVal(doc,'type')||xmlVal(doc,'name')),rawCad=cadn?cad/cadn:null;
 return{type,date:importCardioDate(times[0]),distance:dist/1000,durationSeconds:times.length>1?(times.at(-1)-times[0])/1000:0,elevationGain:up||null,heartRateAvg:hrn?hr/hrn:null,cadenceAvg:normalizeRunCadence(rawCad,type),calories:null,importSource:'GPX'};
}
function parseTCX(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('TCX illisible');
 const act=xmlEls(doc,'Activity')[0];if(!act)throw new Error('Aucune activité TCX');
 const laps=xmlEls(act,'Lap');let sec=0,dist=0,cal=0,up=0,lastAlt=null,hr=0,hrw=0,cad=0,cadw=0;
 for(const lap of laps){const s=+xmlVal(lap,'TotalTimeSeconds')||0;sec+=s;dist+=+xmlVal(lap,'DistanceMeters')||0;cal+=+xmlVal(lap,'Calories')||0;
 const hb=xmlEls(lap,'AverageHeartRateBpm')[0],h=+(hb?xmlVal(hb,'Value')||hb.textContent:NaN);if(Number.isFinite(h)){hr+=h*(s||1);hrw+=s||1}
 const c=+xmlVal(lap,'Cadence');if(Number.isFinite(c)){cad+=c*(s||1);cadw+=s||1}}
 for(const p of xmlEls(act,'Trackpoint')){const a=+xmlVal(p,'AltitudeMeters');if(Number.isFinite(a)){if(lastAlt!=null&&a>lastAlt)up+=a-lastAlt;lastAlt=a}}
 const type=cardioTypeFromText(act.getAttribute('Sport')),rawCad=cadw?cad/cadw:null;
 return{type,date:importCardioDate(xmlVal(act,'Id')),distance:dist/1000,durationSeconds:sec,elevationGain:up||null,heartRateAvg:hrw?hr/hrw:null,cadenceAvg:normalizeRunCadence(rawCad,type),calories:cal||null,importSource:'TCX'};
}
function parseFIT(buf){
 const v=new DataView(buf);if(v.byteLength<14||String.fromCharCode(v.getUint8(8),v.getUint8(9),v.getUint8(10),v.getUint8(11))!=='.FIT')throw new Error('FIT invalide');
 const header=v.getUint8(0),end=Math.min(v.byteLength,header+v.getUint32(4,true)),defs={};let o=header,out={type:'Autre',date:todayKey(),distance:null,durationSeconds:null,elevationGain:null,heartRateAvg:null,cadenceAvg:null,calories:null,importSource:'FIT'};
 const read=(off,size,little)=>size===1?v.getUint8(off):size===2?v.getUint16(off,little):size===4?v.getUint32(off,little):null;
 while(o<end){const h=v.getUint8(o++),compressed=h&0x80;if(compressed){const d=defs[(h>>5)&3];if(!d)break;const vals={};for(const f of d.fields){vals[f.n]=read(o,f.s,d.l);o+=f.s}if(d.g===18)out=fitSession(vals,out);continue}
 const def=h&0x40,local=h&15;if(def){o++;const l=v.getUint8(o++)===0,g=v.getUint16(o,l);o+=2;const n=v.getUint8(o++),fields=[];for(let i=0;i<n;i++)fields.push({n:v.getUint8(o++),s:v.getUint8(o++),b:v.getUint8(o++)});if(h&0x20){const dn=v.getUint8(o++);o+=dn*3}defs[local]={g,l,fields}}
 else{const d=defs[local];if(!d)throw new Error('FIT non pris en charge');const vals={};for(const f of d.fields){vals[f.n]=read(o,f.s,d.l);o+=f.s}if(d.g===18)out=fitSession(vals,out)}}
 if(!out.distance&&!out.durationSeconds)throw new Error('Résumé FIT non lisible');return out;
}
function fitSession(v,o){const sports={1:'Course',2:'Vélo',5:'Natation',11:'Marche'},epoch=Date.UTC(1989,11,31)/1000;if(v[253]!=null)o.date=importCardioDate(new Date((v[253]+epoch)*1000));if(v[5]!=null)o.type=sports[v[5]]||o.type;if(v[7]!=null)o.durationSeconds=v[7]/1000;if(v[9]!=null)o.distance=v[9]/100000;if(v[11]!=null)o.calories=v[11];if(v[16]!=null)o.heartRateAvg=v[16];if(v[18]!=null)o.cadenceAvg=normalizeRunCadence(v[18],o.type);if(v[22]!=null)o.elevationGain=v[22];return o}
function durationParts(total){total=Math.max(0,Math.round(+total||0));return{h:Math.floor(total/3600),m:Math.floor((total%3600)/60),s:total%60}}
async function handleCardioImport(e){
 const file=e.target.files?.[0];if(!file)return;const status=$('#cardioImportStatus');if(status)status.innerHTML='<div class="import-reading">Lecture du fichier…</div>';
 try{const ext=(file.name.split('.').pop()||'').toLowerCase();let d;if(ext==='gpx')d=parseGPX(await file.text());else if(ext==='tcx')d=parseTCX(await file.text());else if(ext==='fit')d=parseFIT(await file.arrayBuffer());else throw new Error('Format non pris en charge');showCardioImportConfirm(d,file.name)}
 catch(err){console.error(err);if(status)status.innerHTML=`<div class="ai-error">${escapeHtml(err.message||'Import impossible')}</div><button class="action secondary" data-sheet="cardio">Ajouter manuellement</button>`;bindSheet()}
}
function showCardioImportConfirm(d,fileName){
 const p=durationParts(d.durationSeconds);showSheet(`<h2>Vérifier l’activité</h2><p class="subtle">Données lues dans <strong>${escapeHtml(fileName)}</strong>. Tu peux tout corriger avant de confirmer.</p><form id="cardioImportConfirmForm"><input type="hidden" name="importSource" value="${escapeHtml(d.importSource||'Fichier')}">${dateField('date',d.date||todayKey())}<div class="field"><label>Type</label><select name="type">${['Course','Vélo','Natation','Marche','Autre'].map(x=>`<option ${d.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" value="${d.distance!=null?(+d.distance).toFixed(2):''}"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" value="${p.h}"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" value="${p.m}"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" value="${p.s}"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" value="${d.heartRateAvg!=null?Math.round(d.heartRateAvg):''}"></div><div class="field"><label>Cadence moyenne (ppm)</label><input name="cadence" type="number" value="${d.cadenceAvg!=null?Math.round(d.cadenceAvg):''}"></div></div><div class="range-row"><div class="field"><label>Dénivelé +</label><input name="elevation" type="number" value="${d.elevationGain!=null?Math.round(d.elevationGain):''}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${d.calories!=null?Math.round(d.calories):''}"></div></div><div class="import-source-pill">Source : ${escapeHtml(d.importSource||'Fichier')} · validation utilisateur</div><button class="action" type="submit">Confirmer et enregistrer</button></form>`);
}
async function saveImportedCardio(e){
 e.preventDefault();const f=new FormData(e.currentTarget),seconds=(num(f.get('hours'))||0)*3600+(num(f.get('minutes'))||0)*60+(num(f.get('seconds'))||0),h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60,label=h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
 await LTDB.put('cardio',{id:uid(),date:f.get('date')||todayKey(),type:f.get('type'),distance:num(f.get('distance')),durationSeconds:seconds,durationLabel:label,heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),source:'import',importSource:f.get('importSource')||'Fichier',createdAt:new Date().toISOString()});
 $('#sheet').close();toast('Activité importée');render();
}
async function saveCardio(e){e.preventDefault(); const f=new FormData(e.currentTarget); const date=f.get('date')||todayKey(); const seconds=(num(f.get('hours'))||0)*3600+(num(f.get('minutes'))||0)*60+(num(f.get('seconds'))||0); const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60; const label=h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`; await LTDB.put('cardio',{id:uid(),date,type:f.get('type'),distance:num(f.get('distance')),durationSeconds:seconds,durationLabel:label,heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),source:'manual',createdAt:new Date().toISOString()}); $('#sheet').close(); toast('Activité Cardio enregistrée'); render();}
async function saveFood(e){e.preventDefault(); const f=new FormData(e.currentTarget); const date=f.get('date')||todayKey(); await LTDB.put('food',{id:uid(),date,dateTime:new Date().toISOString(),mealType:f.get('mealType')||'lunch',description:f.get('description')||'Repas',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:num(f.get('water')),classic:f.get('classic')==='on',source:'companion',confidence:'user',createdAt:new Date().toISOString()}); toast('Repas enregistré · visible dans Alimentation'); if(date===todayKey()) await nutritionHubSheet(); else $('#sheet').close(); render();}

let pendingFoodImageData=null;

let barcodeStream=null,barcodeScanning=false,barcodeZXingControls=null,barcodeZXingReader=null;
function stopBarcodeCamera(){
  barcodeScanning=false;
  try{barcodeZXingControls?.stop?.()}catch(e){}
  barcodeZXingControls=null;
  try{barcodeZXingReader?.reset?.()}catch(e){}
  barcodeZXingReader=null;
  if(barcodeStream){barcodeStream.getTracks().forEach(t=>t.stop());barcodeStream=null}
  const v=$('#barcodeVideo');if(v){try{v.pause()}catch(e){}v.srcObject=null}
}
function loadZXing(){
  if(window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
  if(window.__zxingLoading) return window.__zxingLoading;
  window.__zxingLoading=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-zxing]');
    if(existing){existing.addEventListener('load',()=>resolve(window.ZXingBrowser),{once:true});existing.addEventListener('error',reject,{once:true});return}
    const script=document.createElement('script');script.dataset.zxing='1';script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';script.async=true;
    script.onload=()=>window.ZXingBrowser?resolve(window.ZXingBrowser):reject(new Error('ZXING_NOT_READY'));
    script.onerror=()=>reject(new Error('ZXING_LOAD_FAILED'));document.head.appendChild(script);
  }).finally(()=>{window.__zxingLoading=null});
  return window.__zxingLoading;
}
async function barcodeFound(raw){
  raw=String(raw||'').replace(/\D/g,''); if(!raw||!barcodeScanning)return;
  barcodeScanning=false; stopBarcodeCamera();
  const status=$('#barcodeScanStatus');if(status)status.textContent=`Code détecté : ${raw} · recherche…`;
  await lookupBarcodeCode(raw,todayKey(),$('#barcodeForm [name="mealType"]')?.value||'lunch');
}
async function startBarcodeCamera(){
 const status=$('#barcodeScanStatus'),video=$('#barcodeVideo');
 if(!video)return;
 if(!navigator.mediaDevices?.getUserMedia){if(status)status.textContent='Caméra indisponible ici. Utilise la saisie manuelle.';$('#barcodeForm')?.classList.remove('hidden');return}
 try{
  stopBarcodeCamera(); barcodeScanning=true;
  if('BarcodeDetector' in window){
    barcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=barcodeStream;await video.play();if(status)status.textContent='Cadre le code-barres…';scanBarcodeFrame();return;
  }
  if(status)status.textContent='Ouverture de la caméra…';
  const ZX=await loadZXing();
  if(!barcodeScanning)return;
  barcodeZXingReader=new ZX.BrowserMultiFormatReader();
  barcodeZXingControls=await barcodeZXingReader.decodeFromConstraints({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false},video,(result,error)=>{
    if(result&&barcodeScanning) barcodeFound(result.getText?result.getText():result.text);
  });
  if(status)status.textContent='Cadre le code-barres…';
 }catch(err){
  console.error(err);stopBarcodeCamera();
  if(status)status.textContent='Impossible d’ouvrir le scanner. Autorise la caméra ou utilise la saisie manuelle.';
  $('#barcodeForm')?.classList.remove('hidden');
 }
}
async function scanBarcodeFrame(){
 if(!barcodeScanning)return;const video=$('#barcodeVideo');if(!video||video.readyState<2){requestAnimationFrame(scanBarcodeFrame);return}
 try{
  const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
  const codes=await detector.detect(video);const raw=codes?.[0]?.rawValue;
  if(raw){await barcodeFound(raw);return}
 }catch(err){console.warn('BarcodeDetector',err)}
 if(barcodeScanning)setTimeout(scanBarcodeFrame,180);
}

async function searchFoods(e){
  state.foodSearchMealContext=$('#foodSearchMealContext')?.value||'';
  e.preventDefault();const q=String(new FormData(e.currentTarget).get('query')||'').trim(),status=$('#foodSearchStatus'),box=$('#foodSearchResults');
  if(q.length<2)return;
  if(status)status.textContent='Recherche…';if(box)box.innerHTML='';
  try{
    const r=await fetch(`/.netlify/functions/food-search?q=${encodeURIComponent(q)}`),data=await r.json();
    if(!r.ok)throw new Error(data.detail||data.error||'Recherche impossible');
    if(status)status.textContent=`${data.results.length} résultat${data.results.length>1?'s':''}`;
    box.innerHTML=`<div class="food-result-list">${data.results.map((x,i)=>`<button class="food-result-row" data-food-result="${i}" type="button">${x.image?`<img src="${escapeHtml(x.image)}" alt="">`:'<span class="food-result-placeholder">◒</span>'}<div><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.brand||x.sourceLabel||'Aliment')} · ${Math.round(Number(x.per100?.calories)||0)} kcal · ${Number(x.per100?.protein||0).toFixed(1)} g prot. / 100 g</span></div><b>›</b></button>`).join('')||'<div class="empty">Aucun résultat. Tu peux utiliser la saisie manuelle ou la photo.</div>'}</div>`;
    state.foodSearchResults=data.results;
    document.querySelectorAll('[data-food-result]').forEach(b=>b.addEventListener('click',()=>showFoodSearchConfirm(data.results[Number(b.dataset.foodResult)])));
  }catch(err){console.error(err);if(status)status.textContent='Recherche indisponible. La saisie manuelle reste disponible.'}
}
function showFoodSearchConfirm(x){
  const grams=Number(x.servingGrams)||100,p=x.per100||{};
  showSheet(`<h2>Confirmer l’aliment</h2><div class="identified-product">${x.image?`<img src="${escapeHtml(x.image)}" alt="">`:''}<div><div class="card-kicker">${escapeHtml(x.sourceLabel||'Base alimentaire')}</div><h3>${escapeHtml(x.name||'Aliment')}</h3><p>${escapeHtml(x.brand||'')}${x.quantity?` · ${escapeHtml(x.quantity)}`:''}</p></div></div><form id="foodSearchConfirmForm"><input type="hidden" name="source" value="${escapeHtml(x.source||'food-search')}"><input type="hidden" name="sourceId" value="${escapeHtml(String(x.id||''))}"><input type="hidden" name="pCalories" value="${p.calories??0}"><input type="hidden" name="pProtein" value="${p.protein??0}"><input type="hidden" name="pCarbs" value="${p.carbs??0}"><input type="hidden" name="pFat" value="${p.fat??0}">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(state.foodSearchMealContext||'lunch')}</select></div><div class="field"><label>Aliment</label><input name="description" value="${escapeHtml([x.name,x.brand].filter(Boolean).join(' · '))}"></div><div class="field"><label>Quantité consommée (g)</label><input id="foodSearchGrams" name="grams" type="number" min="1" step="1" value="${grams}"></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input id="foodSearchProtein" name="protein" type="number" step="0.1" value="${macroForPortion(p.protein,grams)}"></div><div class="field"><label>Calories</label><input id="foodSearchCalories" name="calories" type="number" value="${Math.round(macroForPortion(p.calories,grams))}"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input id="foodSearchCarbs" name="carbs" type="number" step="0.1" value="${macroForPortion(p.carbs,grams)}"></div><div class="field"><label>Lipides (g)</label><input id="foodSearchFat" name="fat" type="number" step="0.1" value="${macroForPortion(p.fat,grams)}"></div></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes classiques</label><div class="confidence-box"><strong>Source : ${escapeHtml(x.sourceLabel||'Base alimentaire')}</strong><span>Valeurs calculées pour la quantité indiquée. Tu peux tout corriger.</span></div><button class="action" type="submit">Confirmer et enregistrer</button></form>`);
  $('#foodSearchGrams')?.addEventListener('input',updateFoodSearchPortion);
}
function updateFoodSearchPortion(){
 const f=$('#foodSearchConfirmForm');if(!f)return;const g=Number(f.elements.grams.value)||0;
 const set=(id,v,round=false)=>{const el=$(id);if(el)el.value=round?Math.round(macroForPortion(v,g)):macroForPortion(v,g)};
 set('#foodSearchCalories',f.elements.pCalories.value,true);set('#foodSearchProtein',f.elements.pProtein.value);set('#foodSearchCarbs',f.elements.pCarbs.value);set('#foodSearchFat',f.elements.pFat.value);
}
async function saveSearchedFood(e){
 e.preventDefault();const f=new FormData(e.currentTarget);
 await LTDB.put('food',{id:uid(),date:f.get('date')||todayKey(),dateTime:new Date().toISOString(),mealType:f.get('mealType')||'lunch',description:f.get('description')||'Aliment',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:null,classic:f.get('classic')==='on',source:f.get('source')||'food-search',sourceId:f.get('sourceId')||'',createdAt:new Date().toISOString()});
 toast('Aliment enregistré');state.foodSearchMealContext='';pendingNutritionMealType=null;await nutritionHubSheet();render();
}
async function lookupBarcodeCode(code,date=todayKey(),mealType='lunch'){
 try{const response=await fetch(`/api/product?code=${encodeURIComponent(code)}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'LOOKUP_FAILED');showBarcodeConfirmation(data,date,mealType)}
 catch(err){console.error(err);toast(err.message==='PRODUCT_NOT_FOUND'?'Produit non trouvé':'Recherche produit impossible');const form=$('#barcodeForm');if(form){form.classList.remove('hidden');form.elements.barcode.value=code}const status=$('#barcodeScanStatus');if(status)status.textContent='Vérifie ou saisis le code manuellement.'}
}
async function lookupBarcode(e){
 e.preventDefault();const f=new FormData(e.currentTarget),code=String(f.get('barcode')||'').replace(/\D/g,'');const button=$('#barcodeLookupBtn');
 if(button){button.disabled=true;button.textContent='Recherche…'}await lookupBarcodeCode(code,f.get('date')||todayKey(),f.get('mealType')||'lunch');if(button){button.disabled=false;button.textContent='Rechercher'}
}
function macroForPortion(value,grams){const n=Number(value);return Number.isFinite(n)?Math.round((n*grams/100)*10)/10:0}
function showBarcodeConfirmation(data,date,mealType){
  const grams=Number(data.servingGrams)||100;
  const p=data.per100||{};
  showSheet(`<h2>Confirmer le produit</h2>
    <div class="identified-product">${data.image?`<img src="${escapeHtml(data.image)}" alt="">`:''}<div><div class="card-kicker">Trouvé par code-barres</div><h3>${escapeHtml(data.name||'Produit')}</h3><p>${escapeHtml(data.brands||'')}${data.quantity?` · ${escapeHtml(data.quantity)}`:''}</p></div></div>
    <form id="barcodeConfirmForm">
      <input type="hidden" name="barcode" value="${escapeHtml(data.code||'')}">
      <input type="hidden" name="date" value="${escapeHtml(date)}">
      <input type="hidden" name="mealType" value="${escapeHtml(mealType)}">
      <input type="hidden" name="pCalories" value="${p.calories??0}"><input type="hidden" name="pProtein" value="${p.protein??0}"><input type="hidden" name="pCarbs" value="${p.carbs??0}"><input type="hidden" name="pFat" value="${p.fat??0}">
      <div class="field"><label>Produit</label><input name="description" value="${escapeHtml(data.name||'Produit')}"></div>
      <div class="field"><label>Quantité consommée (g)</label><input id="barcodeGrams" name="grams" type="number" step="1" min="1" value="${grams}"></div>
      <div class="range-row"><div class="field"><label>Protéines (g)</label><input id="barcodeProtein" name="protein" type="number" step="0.1" value="${macroForPortion(p.protein,grams)}"></div><div class="field"><label>Calories</label><input id="barcodeCalories" name="calories" type="number" step="1" value="${Math.round(macroForPortion(p.calories,grams))}"></div></div>
      <div class="range-row"><div class="field"><label>Glucides (g)</label><input id="barcodeCarbs" name="carbs" type="number" step="0.1" value="${macroForPortion(p.carbs,grams)}"></div><div class="field"><label>Lipides (g)</label><input id="barcodeFat" name="fat" type="number" step="0.1" value="${macroForPortion(p.fat,grams)}"></div></div>
      <div class="confidence-box"><strong>Source : Open Food Facts</strong><span>Valeurs produit pour la quantité indiquée. Tu peux les corriger.</span></div>
      <button class="action" type="submit">Confirmer et enregistrer</button>
    </form>`);
}
function updateBarcodePortion(){
  const f=$('#barcodeConfirmForm'); if(!f)return;
  const grams=Number(f.elements.grams.value)||0;
  const set=(id,per100,round=false)=>{const el=$(id);if(el)el.value=round?Math.round(macroForPortion(per100,grams)):macroForPortion(per100,grams)};
  set('#barcodeCalories',f.elements.pCalories.value,true);
  set('#barcodeProtein',f.elements.pProtein.value);
  set('#barcodeCarbs',f.elements.pCarbs.value);
  set('#barcodeFat',f.elements.pFat.value);
}
async function saveBarcodeFood(e){
  e.preventDefault(); const f=new FormData(e.currentTarget);
  await LTDB.put('food',{id:uid(),date:f.get('date')||todayKey(),dateTime:new Date().toISOString(),mealType:f.get('mealType')||'lunch',description:f.get('description')||'Produit',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:null,classic:false,source:'open-food-facts',confidence:'database',barcode:f.get('barcode')||'',createdAt:new Date().toISOString()});
  toast('Produit enregistré'); await nutritionHubSheet(); render();
}

async function fileToNutritionImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      try{
        const max=1280, scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale));
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        const data=canvas.toDataURL('image/jpeg',0.78);
        URL.revokeObjectURL(url); resolve(data);
      }catch(err){URL.revokeObjectURL(url);reject(err)}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('IMAGE_READ_FAILED'))};
    img.src=url;
  });
}
async function previewFoodPhoto(e){
  const file=e.target.files?.[0]; if(!file)return;
  const box=$('#foodPhotoPreview'), status=$('#foodAIStatus');
  try{
    pendingFoodImageData=await fileToNutritionImage(file);
    box.className='photo-preview';
    box.innerHTML=`<img src="${pendingFoodImageData}" alt="Photo à analyser"><button class="action" type="button" id="analyzeFoodPhoto">Analyser avec le Compagnon</button>`;
    if(status)status.textContent='La photo n’est envoyée à l’IA qu’après avoir appuyé sur Analyser.';
    $('#analyzeFoodPhoto')?.addEventListener('click',analyzeFoodPhoto);
  }catch(err){console.error(err);toast('Photo illisible')}
}
async function analyzeFoodPhoto(){
  if(!pendingFoodImageData)return;
  const button=$('#analyzeFoodPhoto'), status=$('#foodAIStatus');
  if(button){button.disabled=true;button.textContent='Analyse en cours…';}
  if(status)status.textContent='Le Compagnon examine la photo…';
  try{
    const response=await fetch('/.netlify/functions/analyze-food-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:pendingFoodImageData})});
    const raw=await response.text();
    let data={};
    try{data=raw?JSON.parse(raw):{};}catch(_){data={error:'NON_JSON_RESPONSE',detail:raw.slice(0,240)};}
    if(!response.ok){
      const err=new Error(data.error||`HTTP_${response.status}`);
      err.status=response.status; err.detail=data.detail||data.message||'';
      throw err;
    }
    const date=$('#photoDate')?.value||todayKey(), mealType=$('#photoMealType')?.value||'lunch';
    showAIConfirmation(data,date,mealType);
  }catch(err){
    console.error('Nutrition AI diagnostic',err);
    const code=err.message||'AI_FAILED';
    const detail=String(err.detail||'').trim();
    const http=err.status?`HTTP ${err.status} · `:'';
    const labels={AI_NOT_CONFIGURED:'GEMINI_API_KEY absente dans Netlify.',INVALID_IMAGE:'Format d’image refusé.',IMAGE_TOO_LARGE:'Image trop volumineuse.',AI_SERVICE_ERROR:'Gemini a refusé la requête.',AI_INVALID_RESPONSE:'Gemini a répondu dans un format inattendu.',AI_ANALYSIS_FAILED:'Erreur interne de la fonction Netlify.',NON_JSON_RESPONSE:'La fonction Netlify n’a pas renvoyé de JSON.'};
    const message=labels[code]||`Erreur IA : ${code}`;
    if(status)status.textContent=`Diagnostic : ${http}${message}${detail?` — ${detail}`:''}`;
    toast(`${http}${message}`);
    if(button){button.disabled=false;button.textContent='Analyser avec le Compagnon';}
  }
}
function showAIConfirmation(data,date,mealType){
  const confidence=Math.round((Number(data.confidence)||0)*100);
  const t=data.totals||{};
  showSheet(`<h2>Voilà ce que j’ai compris</h2>
    <div class="ai-result-head"><div>${companionMark("companion-mark-large")}</div><div><div class="card-kicker">${data.kind==='meal'?'Repas détecté':'Aliment détecté'}</div><h3>${escapeHtml(data.name||'Analyse')}</h3><p>Confiance : ${confidence}%</p></div></div>
    <div class="detected-items">${(data.items||[]).map(i=>`<div><strong>${escapeHtml(i.name)}</strong><span>≈ ${Math.round(Number(i.estimated_grams)||0)} g · ${Math.round(Number(i.calories)||0)} kcal · ${Math.round((Number(i.protein)||0)*10)/10} g prot.</span></div>`).join('')||'<div class="empty">Aucun élément détaillé.</div>'}</div>
    <form id="aiFoodConfirmForm">
      <input type="hidden" name="date" value="${escapeHtml(date)}"><input type="hidden" name="mealType" value="${escapeHtml(mealType)}"><input type="hidden" name="confidence" value="${Number(data.confidence)||0}">
      <div class="field"><label>Nom / description</label><input name="description" value="${escapeHtml(data.name||'Repas analysé')}"></div>
      <div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1" value="${Math.round((Number(t.protein)||0)*10)/10}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${Math.round(Number(t.calories)||0)}"></div></div>
      <div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1" value="${Math.round((Number(t.carbs)||0)*10)/10}"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1" value="${Math.round((Number(t.fat)||0)*10)/10}"></div></div>
      <div class="confidence-box"><strong>Source : Compagnon IA · estimation</strong><span>${escapeHtml(data.notes||'Vérifie les portions avant de confirmer.')}</span></div>
      <button class="action" type="submit">Confirmer et enregistrer</button>
    </form>`);
}
async function saveAIFood(e){
  e.preventDefault(); const f=new FormData(e.currentTarget);
  await LTDB.put('food',{id:uid(),date:f.get('date')||todayKey(),dateTime:new Date().toISOString(),mealType:f.get('mealType')||'lunch',description:f.get('description')||'Repas analysé',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:null,classic:false,source:'companion-ai',confidence:num(f.get('confidence')),createdAt:new Date().toISOString()});
  pendingFoodImageData=null; toast('Analyse confirmée et enregistrée'); await nutritionHubSheet(); render();
}


function fileToProgressDataURL(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('FILE_READ_FAILED'));r.readAsDataURL(file);
  });
}
let progressCrop={src:null,img:null,scale:1,x:0,y:0,date:null,view:null};
let progressCameraStream=null;
let pendingProgressPhotoMeta={date:null,view:null};

function rememberProgressPhotoMeta(){
  pendingProgressPhotoMeta={
    date:$('#sheetContent [name="photoDate"]')?.value||todayKey(),
    view:$('#progressPhotoView')?.value||'Face'
  };
}
function stopProgressCamera(){
  if(progressCameraStream){progressCameraStream.getTracks().forEach(t=>t.stop());progressCameraStream=null}
}
async function openProgressCamera(){
  rememberProgressPhotoMeta();
  if(!navigator.mediaDevices?.getUserMedia){toast('Caméra non disponible');return}
  try{
    stopProgressCamera();
    showSheet(`<h2>Prendre la photo</h2><div class="progress-live-camera"><video id="progressCameraVideo" playsinline muted autoplay></video><div class="body-guide"></div></div><div class="camera-help">Place-toi dans le cadre puis déclenche.</div><button class="action sticky-photo-action" id="captureProgressPhoto" type="button">Prendre la photo</button>`);
    const video=$('#progressCameraVideo');
    progressCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    video.srcObject=progressCameraStream;await video.play();
    $('#captureProgressPhoto')?.addEventListener('click',captureProgressPhoto);
  }catch(err){
    console.error(err);stopProgressCamera();toast('Impossible d’ouvrir la caméra. Vérifie son autorisation.');
    openSheet('progressPhoto');
  }
}
function captureProgressPhoto(){
  const video=$('#progressCameraVideo');if(!video||video.videoWidth<1){toast('La caméra n’est pas prête');return}
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);const data=canvas.toDataURL('image/jpeg',0.9);
  stopProgressCamera();loadProgressPhotoData(data,pendingProgressPhotoMeta.date||todayKey(),pendingProgressPhotoMeta.view||'Face');
}
async function prepareProgressPhoto(e){
  const input=e.currentTarget||e.target,file=input?.files?.[0];if(!file)return;
  rememberProgressPhotoMeta();
  try{
    const data=await fileToProgressDataURL(file);
    loadProgressPhotoData(data,pendingProgressPhotoMeta.date||todayKey(),pendingProgressPhotoMeta.view||'Face');
    try{input.value=''}catch{}
  }catch(err){console.error(err);toast('Impossible de charger cette photo')}
}
function loadProgressPhotoData(data,date,view){
  const img=new Image();
  img.onload=()=>{progressCrop={src:data,img,scale:1,x:0,y:0,date,view};showProgressCrop()};
  img.onerror=()=>toast('Impossible de lire cette photo');
  img.src=data;
}
function showProgressCrop(){
  const date=progressCrop.date||todayKey(),view=progressCrop.view||'Face';
  showSheet(`<h2>Recadrer</h2><p class="subtle">Glisse la photo dans le cadre et utilise le zoom.</p><div class="crop-stage" id="cropStage"><img id="cropImage" src="${progressCrop.src}" draggable="false"><div class="crop-guide"><i></i><i></i><i></i></div></div><div class="crop-control-card"><div class="slider-head"><label>Zoom</label><output id="cropZoomValue">100 %</output></div><input id="cropZoom" type="range" min="1" max="3" step="0.01" value="1"><div class="crop-reset-row"><button class="action secondary compact" id="resetCrop" type="button">Recentrer</button><span>${formatPhotoDate(date)} · ${escapeHtml(view)}</span></div></div><div class="sticky-photo-footer"><button class="action" id="saveProgressPhoto" type="button">Enregistrer la photo</button></div>`);
  progressCrop.scale=1;progressCrop.x=0;progressCrop.y=0;applyCropTransform();

  const zoom=$('#cropZoom');
  zoom?.addEventListener('input',e=>{
    progressCrop.scale=Number(e.target.value);
    const out=$('#cropZoomValue');if(out)out.textContent=`${Math.round(progressCrop.scale*100)} %`;
    applyCropTransform();
  });
  $('#resetCrop')?.addEventListener('click',()=>{progressCrop.scale=1;progressCrop.x=0;progressCrop.y=0;if(zoom)zoom.value='1';const out=$('#cropZoomValue');if(out)out.textContent='100 %';applyCropTransform()});
  $('#saveProgressPhoto')?.addEventListener('click',()=>saveProgressPhoto(date,view));

  const stage=$('#cropStage');
  let active=false,sx=0,sy=0,ox=0,oy=0;
  const begin=(x,y)=>{active=true;sx=x;sy=y;ox=progressCrop.x;oy=progressCrop.y};
  const move=(x,y)=>{if(!active)return;progressCrop.x=ox+(x-sx);progressCrop.y=oy+(y-sy);applyCropTransform()};
  const finish=()=>{active=false};
  stage?.addEventListener('pointerdown',e=>{begin(e.clientX,e.clientY);stage.setPointerCapture?.(e.pointerId);e.preventDefault()});
  stage?.addEventListener('pointermove',e=>{move(e.clientX,e.clientY);if(active)e.preventDefault()});
  stage?.addEventListener('pointerup',finish);stage?.addEventListener('pointercancel',finish);
  stage?.addEventListener('touchstart',e=>{const t=e.touches[0];if(t)begin(t.clientX,t.clientY);e.preventDefault()},{passive:false});
  stage?.addEventListener('touchmove',e=>{const t=e.touches[0];if(t)move(t.clientX,t.clientY);e.preventDefault()},{passive:false});
  stage?.addEventListener('touchend',finish,{passive:false});
}
function applyCropTransform(){
  const im=$('#cropImage');if(im)im.style.transform=`translate3d(${progressCrop.x}px,${progressCrop.y}px,0) scale(${progressCrop.scale})`;
}
async function saveProgressPhoto(date,view){
  const img=progressCrop.img,stage=$('#cropStage');if(!img||!stage){toast('Photo non prête');return}
  const button=$('#saveProgressPhoto');if(button){button.disabled=true;button.textContent='Enregistrement…'}
  try{
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=960;const c=canvas.getContext('2d');
    const rect=stage.getBoundingClientRect();
    const base=Math.max(720/img.naturalWidth,960/img.naturalHeight);
    const scale=base*progressCrop.scale,dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    const dx=(720-dw)/2+(progressCrop.x/Math.max(1,rect.width))*720;
    const dy=(960-dh)/2+(progressCrop.y/Math.max(1,rect.height))*960;
    c.drawImage(img,dx,dy,dw,dh);
    const image=canvas.toDataURL('image/jpeg',0.76);
    await LTDB.put('photos',{id:uid(),date,view,image,createdAt:new Date().toISOString()});
    $('#sheet').close();toast('Photo enregistrée');render();
  }catch(err){
    console.error(err);toast('Impossible d’enregistrer la photo');
    if(button){button.disabled=false;button.textContent='Enregistrer la photo'}
  }
}

async function renderPhotoComparison(dateA,dateB){
  if(!dateA||!dateB||dateA===dateB){toast('Choisis deux dates différentes');return}
  const [photos,checkins]=await Promise.all([LTDB.all('photos'),LTDB.all('checkins')]);
  const a=photos.filter(p=>p.date===dateA),b=photos.filter(p=>p.date===dateB);
  const views=['Face','Profil','Dos'];
  const available=views.filter(v=>a.some(p=>p.view===v)||b.some(p=>p.view===v));
  let currentView=available[0]||'Face';
  const metricFor=date=>{
    const exact=checkins.find(x=>x.date===date);
    if(exact)return {weight:exact.weight??null,waist:exact.waist??null,date:exact.date};
    const before=checkins.filter(x=>x.date<=date&&(x.weight||x.waist)).sort((x,y)=>y.date.localeCompare(x.date))[0];
    return before?{weight:before.weight??null,waist:before.waist??null,date:before.date}:null;
  };
  const metricA=metricFor(dateA),metricB=metricFor(dateB);
  showSheet(`<h2>Comparaison</h2><div class="compare-head"><strong>${formatPhotoDate(dateA)}</strong><span>→</span><strong>${formatPhotoDate(dateB)}</strong></div><div class="compare-view-tabs">${available.map((v,i)=>`<button class="${i===0?'active':''}" data-compare-view="${v}">${v}</button>`).join('')}</div><div id="photoCompareStage"></div><div class="compare-ai-zone"><button class="action" id="analyzePhotoEvolution" type="button">${companionMark("choice-companion")}Analyser avec le Compagnon</button><div id="photoEvolutionAnalysis"></div></div><p class="compare-note">L’IA décrit les changements visibles et utilise uniquement les mesures réellement enregistrées.</p>`);
  const draw=view=>{
    currentView=view;
    document.querySelectorAll('[data-compare-view]').forEach(x=>x.classList.toggle('active',x.dataset.compareView===view));
    const pa=a.find(p=>p.view===view),pb=b.find(p=>p.view===view);
    $('#photoCompareStage').innerHTML=`<div class="photo-compare-pair"><div class="compare-photo">${pa?`<img src="${pa.image}">`:'<div class="compare-missing">Pas de photo<br>${view}</div>'}<span>Avant</span></div><div class="compare-photo">${pb?`<img src="${pb.image}">`:'<div class="compare-missing">Pas de photo<br>${view}</div>'}<span>Après</span></div></div>`;
    const btn=$('#analyzePhotoEvolution');if(btn){btn.disabled=!(pa&&pb);btn.innerHTML=pa&&pb?`${companionMark("choice-companion")}Analyser avec le Compagnon`:'Deux photos de la même vue requises'}
    if($('#photoEvolutionAnalysis'))$('#photoEvolutionAnalysis').innerHTML='';
  };
  document.querySelectorAll('[data-compare-view]').forEach(x=>x.addEventListener('click',()=>draw(x.dataset.compareView)));
  $('#analyzePhotoEvolution')?.addEventListener('click',async()=>{
    const pa=a.find(p=>p.view===currentView),pb=b.find(p=>p.view===currentView);if(!pa||!pb)return;
    const btn=$('#analyzePhotoEvolution'),result=$('#photoEvolutionAnalysis');btn.disabled=true;btn.textContent='Analyse en cours…';
    result.innerHTML='<div class="ai-working">Le Compagnon compare les deux photos…</div>';
    try{
      const r=await fetch('/.netlify/functions/compare-photos-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({view:currentView,before:{date:dateA,image:pa.image,metrics:metricA},after:{date:dateB,image:pb.image,metrics:metricB}})});
      const data=await r.json();if(!r.ok)throw new Error(data.detail||data.error||'Analyse impossible');
      result.innerHTML=`<div class="ai-evolution-card"><div class="card-kicker">Lecture du Compagnon</div><div class="ai-evolution-text">${escapeHtml(data.analysis||'Pas de lecture utile.').replace(/\n/g,'<br>')}</div></div>`;
    }catch(err){result.innerHTML=`<div class="ai-error">Analyse impossible : ${escapeHtml(err.message||'erreur inconnue')}</div>`}
    finally{btn.disabled=false;btn.innerHTML=`${companionMark("choice-companion")}Analyser avec le Compagnon`;}
  });
  draw(currentView);
}
async function viewProgressPhoto(id){
  const p=await LTDB.get('photos',id);if(!p)return;
  showSheet(`<h2>${escapeHtml(p.view||'Photo')} · ${formatPhotoDate(p.date)}</h2><img class="progress-photo-large" src="${p.image}" alt="Photo évolution"><div class="edit-actions"><button class="action danger" type="button" id="deleteProgressPhoto">Supprimer</button></div>`);
  $('#deleteProgressPhoto')?.addEventListener('click',async()=>{await LTDB.del('photos',id);$('#sheet').close();toast('Photo supprimée');render()});
}
async function sendChat(){
  const input=$('#chatInput'),text=input?.value.trim();if(!text)return;
  input.disabled=true;$('#sendChat').disabled=true;
  await LTDB.put('events',{id:uid(),type:'CHAT',role:'user',text,createdAt:new Date().toISOString()});
  const snap=await companionSnapshot(); let answer='';
  try{
    const r=await fetch('/.netlify/functions/companion-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,context:snap.context})});
    const data=await r.json(); if(!r.ok)throw new Error(data.detail||data.error||'IA indisponible'); answer=data.answer||'Je n’ai pas de réponse utile pour le moment.';
  }catch(err){console.error(err);answer=await localCompanion(text)}
  await LTDB.put('events',{id:uid(),type:'CHAT',role:'companion',text:answer,createdAt:new Date().toISOString()});render();
}
async function localCompanion(text){
  const snap=await companionSnapshot(),c=snap.context;
  if(c.latestCheckin)return `${snap.headline} Pour l’instant je te conseille de rester simple : adapte l’intensité à ton énergie et garde ton repère protéines en vue.`;
  return 'Je n’ai pas encore assez de données pour te conseiller proprement. Donne-moi ton ressenti du jour et je commencerai à construire le contexte.';
}

async function exportData(){const dump=await LTDB.dump(); const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`luis-transformation-${todayKey()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Export préparé');}
async function importData(e){const file=e.target.files?.[0]; if(!file)return; try{const payload=JSON.parse(await file.text()); await LTDB.restore(payload); state.profile=await LTDB.get('profile','me')||state.profile; toast('Import terminé'); render();}catch(err){toast('Import impossible · fichier invalide');}}
function recoveryText(x){ if(x.energy&&x.energy<=2)return {title:'Une chose mérite ton attention.',text:'Ton énergie est basse aujourd’hui. Je garderais la journée simple et j’adapterais seulement si ton ressenti le confirme.'}; if(x.sleep&&x.sleep<6)return {title:'Nuit courte.',text:'Une seule nuit ne suffit pas à modifier ton programme. Je la garde simplement en contexte.'}; return null; }
function parseDuration(raw){ const s=String(raw||'').trim(); if(!s)return {seconds:null,label:''}; if(/^\d+$/.test(s)){const min=Number(s);return {seconds:min*60,label:`${min}:00`};} const p=s.split(':').map(Number); if(p.some(Number.isNaN)) return {seconds:null,label:s}; let sec=0; if(p.length===2)sec=p[0]*60+p[1]; else if(p.length===3)sec=p[0]*3600+p[1]*60+p[2]; else return {seconds:null,label:s}; const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=sec%60; return {seconds:sec,label:h?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${m}:${String(ss).padStart(2,'0')}`}; }
function daysAgo(date){return Math.floor((Date.now()-new Date(date+'T00:00:00').getTime())/86400000)}
function signed(n){return n>0?`+${n}`:`${n}`}
function num(v){return v===''||v===null?null:Number(v)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
init();
