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
  const sorted=checkins.filter(x=>x.weight||x.waist).sort((a,b)=>a.date.localeCompare(b.date));
  const first=sorted[0], last=sorted.at(-1);
  const weightDelta=first?.weight&&last?.weight?+(last.weight-first.weight).toFixed(1):null;
  const waistDelta=first?.waist&&last?.waist?+(last.waist-first.waist).toFixed(1):null;
  const activities=workouts.filter(x=>daysAgo(x.date)<=30).length+cardio.filter(x=>daysAgo(x.date)<=30).length;
  const reading=sorted.length<2?'Je n’ai pas encore assez de recul pour lire une tendance fiable.':'Ton évolution reste cohérente avec ce que tu suis actuellement.';
  const photos=(await LTDB.all('photos')).sort((x,y)=>(y.date+y.createdAt).localeCompare(x.date+x.createdAt));
  const groups={}; photos.forEach(p=>(groups[p.date]??=[]).push(p));
  const gallery=Object.entries(groups).slice(0,12).map(([date,items])=>`<div class="photo-date-group"><div class="photo-date">${formatPhotoDate(date)}</div><div class="photo-thumbs">${items.map(p=>`<button class="photo-thumb" data-photo-view="${p.id}" aria-label="${escapeHtml(p.view||'Photo')} ${date}"><img src="${p.image}" alt="${escapeHtml(p.view||'Photo évolution')}"><span>${escapeHtml(p.view||'Photo')}</span></button>`).join('')}</div></div>`).join('');
  return `<div class="trend-hero"><div class="trend-mark"><svg viewBox="0 0 64 64"><path d="M13 44A23 23 0 0 1 45 12" class="fluidity-arc" style="stroke-width:6"/><path d="M51 19A23 23 0 0 1 20 52" class="fluidity-arc" style="stroke-width:6"/></svg><span class="initials" style="font-size:14px">${escapeHtml(state.profile.initials)}</span></div><div class="trend-copy">${reading}</div><p class="subtle">Le sens d’abord. Les graphiques seulement si tu veux creuser.</p></div>
  <div class="signals"><div class="signal"><strong>${weightDelta===null?'—':signed(weightDelta)+' kg'}</strong><span>Poids</span></div><div class="signal"><strong>${waistDelta===null?'—':signed(waistDelta)+' cm'}</strong><span>Tour de taille</span></div><div class="signal"><strong>${activities}</strong><span>Activités · 30 j</span></div></div>
  <div class="card photo-journal"><div class="card-kicker">Photos</div><div class="photo-title-row"><div><h3>Voir le changement</h3><p class="subtle">Même cadrage, même vue, une date. L’analyse IA viendra ensuite.</p></div><button class="action compact" data-open="progressPhoto">Ajouter</button></div>${gallery||'<div class="empty">Tes photos d’évolution apparaîtront ici en petites vignettes, classées par date.</div>'}</div>
  <div class="card" style="margin-top:14px"><div class="card-kicker">Comprendre</div><h3>Pourquoi cette lecture ?</h3><p class="subtle">Les graphiques et l’historique détaillé restent au niveau suivant.</p><div class="card-actions"><button class="action secondary" data-open="details">Explorer les données</button></div></div>`;
}
function formatPhotoDate(d){try{return new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'))}catch{return d}}

async function renderTraining(){
  const workouts=(await LTDB.all('workouts')).sort((a,b)=>b.date.localeCompare(a.date));
  const cardio=(await LTDB.all('cardio')).sort((a,b)=>b.date.localeCompare(a.date));
  const suggestion=suggestWorkout(workouts);
  const exerciseLog=exerciseJournal(workouts);
  return `<section class="hero"><div class="hello">Entraînement</div><div class="subtle">Tu peux suivre la proposition sans avoir à construire ta séance.</div></section>
  <div class="card training-feature"><div class="card-kicker">Force · proposition du jour</div><h3>${suggestion.title}</h3><p class="subtle">Une séance directement exécutable. Les charges proposées ne deviennent personnalisées que lorsque j’ai assez d’historique.</p>
  <div class="workout-plan">${suggestion.plan.map((x,i)=>`<div class="plan-exercise"><div class="plan-index">${i+1}</div><div class="plan-main"><strong>${escapeHtml(x.name)}</strong><div class="plan-meta">${x.sets} séries × ${x.reps} · récup. ${x.rest}</div><div class="plan-advice">${x.advice}</div></div><button class="technique-btn" data-technique="${escapeHtml(x.name)}">Technique</button></div>`).join('')}</div>
  <div class="card-actions"><button class="action" data-open="workout">Faire cette séance</button><button class="action secondary" data-open="workoutIdeas">Autre proposition</button></div></div>
  <div class="card"><div class="card-kicker">Journal Force</div><h3>Où tu en es, exercice par exercice</h3><div class="list exercise-log">${exerciseLog||'<div class="empty">Ton journal se construira à mesure que tu enregistres tes charges.</div>'}</div></div>
  <div class="card"><div class="card-kicker">Cardio</div><h3>${cardio.length?`${cardio.length} activité${cardio.length>1?'s':''} enregistrée${cardio.length>1?'s':''}`:'Course · vélo · natation · marche'}</h3><p class="subtle">Saisie rapide, avec une durée adaptée au clavier iPhone.</p><div class="card-actions"><button class="action" data-open="cardio">Ajouter une activité</button></div></div>
  <div class="section-title"><h2>Historique récent</h2></div><div class="card list">${[...workouts.map(x=>({...x,kind:'Force'})),...cardio.map(x=>({...x,kind:'Cardio'}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<button class="list-row history-button" data-edit-activity="${x.kind}:${x.id}"><div><strong>${escapeHtml(x.name||x.type||x.kind)}</strong><div class="status">${x.date}${x.durationLabel?' · '+x.durationLabel:''}</div></div><span class="pill">${x.kind} · Modifier</span></button>`).join('')||'<div class="empty">Aucune activité enregistrée.</div>'}</div>`;
}
function suggestWorkout(workouts){
  const lastByName={};
  for(const w of workouts) for(const e of (w.exerciseEntries||[])) if(!lastByName[e.name]) lastByName[e.name]=e;
  const last=(name)=>lastByName[name]?.weight ? `Dernière charge : ${lastByName[name].weight} kg. Je l’utilise comme contexte, pas comme ordre.` : `Je n’ai pas encore assez de recul pour conseiller une charge.`;
  return {title:'Haut du corps · ~40 min',plan:[
    {name:'Développé couché',sets:4,reps:6,rest:'2 min',advice:last('Développé couché')},
    {name:'Tractions',sets:4,reps:8,rest:'90 s',advice:last('Tractions')},
    {name:'Rowing',sets:3,reps:10,rest:'90 s',advice:last('Rowing')},
    {name:'Développé épaules',sets:3,reps:10,rest:'75 s',advice:last('Développé épaules')},
    {name:'Gainage',sets:3,reps:'45 s',rest:'45 s',advice:'Pas de charge nécessaire.'}
  ]};
}
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
  <div class="card"><div class="card-kicker">Tes données</div><h3>Export / Import</h3><p class="subtle">Tes données restent récupérables.</p><div class="card-actions"><button class="action" id="exportBtn">Exporter JSON</button><label class="action secondary">Importer JSON<input id="importInput" type="file" accept="application/json" hidden></label></div></div><div class="version">Luis Transformation · Build 0.7.1</div>`;
}
function bindPage(){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>{state.homeView=b.dataset.homeView;render();}));
  document.querySelectorAll('[data-route-card]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.routeCard)));
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.open))); document.querySelectorAll('[data-photo-view]').forEach(b=>b.addEventListener('click',()=>viewProgressPhoto(b.dataset.photoView)));
  document.querySelectorAll('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.editActivity.split(':'); editActivitySheet(kind,id);}));
  $('#sendChat')?.addEventListener('click',sendChat); $('#chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  $('#nutritionToggle')?.addEventListener('change',async e=>{state.profile.nutritionEnabled=e.target.checked; await LTDB.put('profile',state.profile); toast(e.target.checked?'Alimentation activée':'Alimentation masquée'); render();});
  $('#exportBtn')?.addEventListener('click',exportData); $('#importInput')?.addEventListener('change',importData);
}
async function quickAdd(){ openSheet('quick'); }
function showSheet(html){ stopBarcodeCamera(); $('#sheetContent').innerHTML=`<button class="sheet-x" type="button" data-close aria-label="Fermer">×</button>${html}`; $('#sheet').showModal(); bindSheet(); updateAllRanges(); }
function slider(name,label,min,max,step,value,unit=''){ return `<div class="slider-line"><div class="slider-head"><label>${label}</label><output data-output="${name}">${value}${unit}</output></div><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-range-unit="${unit}"></div>`; }
function openSheet(kind){
  if(kind==='quick') return showSheet(`<h2>Donner quelque chose</h2><div class="sheet-grid"><button class="sheet-choice" data-sheet="checkin">◌<strong>Ressenti</strong></button><button class="sheet-choice" data-sheet="workout">◎<strong>Force</strong></button><button class="sheet-choice" data-sheet="cardio">⌁<strong>Cardio</strong></button>${state.profile.nutritionEnabled?'<button class="sheet-choice" data-sheet="nutritionHub">◒<strong>Alimentation</strong></button>':''}</div>`);
  if(kind==='checkin') return showSheet(`<h2>Comment vas-tu aujourd’hui ?</h2><form id="checkinForm">${dateField('date',todayKey())}${slider('sleep','Sommeil','0','12','0.25','7',' h')}${slider('energy','Énergie','1','5','1','3','/5')}${slider('stress','Stress','1','5','1','2','/5')}${slider('hunger','Faim','1','5','1','3','/5')}<div class="field"><label>Poids (kg)</label><input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal" placeholder="80.4"></div><div class="field"><label>Tour de taille (cm)</label><input name="waist" type="number" min="30" max="250" step="0.1" inputmode="decimal" placeholder="90.0"></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='workout') return showSheet(`<h2>Ta séance Force</h2><form id="workoutForm"><input type="hidden" name="name" value="Haut du corps">${dateField('date',todayKey())}${forceExerciseInput('Développé couché',4,6,'2 min')}${forceExerciseInput('Tractions',4,8,'90 s')}${forceExerciseInput('Rowing',3,10,'90 s')}${forceExerciseInput('Développé épaules',3,10,'75 s')}${forceExerciseInput('Gainage',3,'45 s','45 s')}<div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="40"></div>${slider('effort','Ressenti','1','5','1','3','/5')}<button class="action" type="submit">Terminer la séance</button></form>`);
  if(kind==='workoutIdeas') return showSheet(`<h2>Suggestions Force</h2><div class="suggestion-list"><button class="suggestion-card" data-pick-workout="Haut du corps"><strong>Haut du corps · 40 min</strong><span>Développé couché · Tractions · Rowing · Épaules · Abdos</span></button><button class="suggestion-card" data-pick-workout="Full body"><strong>Full body · 40 min</strong><span>Squat · Développé couché · Rowing · Épaules · Gainage</span></button><button class="suggestion-card" data-pick-workout="Bas du corps"><strong>Bas du corps + abdos · 40 min</strong><span>Squat · Fentes · Hip hinge · Mollets · Gainage</span></button></div>`);
  if(kind==='progressPhoto') return showSheet(`<h2>Photo d’évolution</h2><p class="subtle">Prends une photo ou choisis-en une, puis recadre-la avant de l’enregistrer.</p>${dateField('photoDate',todayKey())}<div class="field"><label>Vue</label><select id="progressPhotoView"><option>Face</option><option>Profil</option><option>Dos</option></select></div><div class="photo-source-actions"><label class="action" for="progressCameraInput">Prendre une photo<input id="progressCameraInput" type="file" accept="image/*" capture="environment" class="visually-hidden-file"></label><label class="action secondary" for="progressLibraryInput">Photothèque<input id="progressLibraryInput" type="file" accept="image/*" class="visually-hidden-file"></label></div><div class="photo-guide-note">Conseil : même lumière, même distance et posture détendue pour rendre les comparaisons utiles.</div>`);
  if(kind==='cardio') return showSheet(`<h2>Ajouter une activité Cardio</h2><form id="cardioForm">${dateField('date',todayKey())}<div class="field"><label>Type</label><select name="type"><option>Course</option><option>Vélo</option><option>Natation</option><option>Marche</option><option>Autre</option></select></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" max="23" inputmode="numeric" value="0"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" inputmode="numeric" value="40"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" inputmode="numeric" value="0"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" inputmode="numeric"></div><div class="field"><label>Cadence moy.</label><input name="cadence" type="number" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>Dénivelé + (m)</label><input name="elevation" type="number" inputmode="numeric"></div><div class="field"><label>Calories (kcal)</label><input name="calories" type="number" inputmode="numeric"></div></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='nutritionHub') return nutritionHubSheet();
  if(kind==='food') return showSheet(`<h2>Ajouter un repas</h2><form id="foodForm">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions('lunch')}</select></div><div class="field"><label>Décris simplement</label><textarea name="description" rows="3" placeholder="Poulet, riz, légumes et un yaourt"></textarea></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1"></div><div class="field"><label>Calories</label><input name="calories" type="number"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1"></div></div><div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1"></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes classiques</label><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='barcode') return showSheet(`<h2>Scanner un produit</h2><p class="subtle">Cadre le code-barres avec l’appareil photo. Dès qu’il est reconnu, le produit est recherché.</p><div class="barcode-scanner"><video id="barcodeVideo" playsinline muted></video><div class="barcode-frame"><span></span></div><div id="barcodeScanStatus" class="ai-status">Appuie sur « Ouvrir la caméra ».</div></div><button class="action" type="button" id="startBarcodeCamera">Ouvrir la caméra</button><button class="text-action" type="button" id="toggleManualBarcode">Saisir le code manuellement</button><form id="barcodeForm" class="manual-barcode hidden">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions('lunch')}</select></div><div class="field"><label>Code-barres</label><input name="barcode" inputmode="numeric" autocomplete="off" placeholder="7612345678901" required></div><button class="action secondary" type="submit" id="barcodeLookupBtn">Rechercher</button></form><div class="ai-note">Le scan est traité sur ton téléphone. Seul le numéro du code-barres est envoyé à Open Food Facts.</div>`);
  if(kind==='photoFood') return showSheet(`<h2>Photo aliment / repas</h2><p class="subtle">Prends une photo ou choisis-en une. Le Compagnon propose ce qu’il reconnaît, puis tu corriges ou confirmes.</p>${dateField('photoDate',todayKey())}<div class="field"><label>Moment</label><select id="photoMealType">${mealTypeOptions('lunch')}</select></div><div class="photo-actions"><label class="action photo-action">Prendre une photo<input id="foodPhotoInput" type="file" accept="image/*" capture="environment" hidden></label><label class="action secondary photo-action">Photothèque<input id="foodLibraryInput" type="file" accept="image/*" hidden></label></div><div id="foodPhotoPreview" class="photo-preview empty">Aucune photo sélectionnée.</div><div id="foodAIStatus" class="ai-status"></div>`);
  if(kind==='mealIdea') return mealIdeaSheet();
  if(kind==='details') return showSheet(`<h2>Données détaillées</h2><p class="subtle">Les graphiques restent volontairement derrière Évolution. Ce niveau sera enrichi sans changer l’écran principal.</p><button class="action secondary" data-close>Fermer</button>`);
}
async function nutritionHubSheet(){
  const all=await LTDB.all('food');
  const food=all.filter(x=>x.date===todayKey()).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const protein=food.reduce((s,x)=>s+(Number(x.protein)||0),0);
  const calories=food.reduce((s,x)=>s+(Number(x.calories)||0),0);
  const target=state.profile.proteinTarget||170;
  const remain=Math.max(0,target-protein);
  return showSheet(`<h2>Alimentation</h2>
    <div class="nutrition-summary"><div class="card-kicker">Aujourd’hui</div><div class="nutrition-total"><strong>${Math.round(protein)} / ${target} g</strong><span>protéines</span></div><div class="nutrition-bar"><i style="width:${Math.min(100,(protein/target)*100)}%"></i></div><p>${protein?`${Math.round(remain)} g restent sur ton repère${calories?` · ${Math.round(calories)} kcal saisies`:''}.`:'Ajoute simplement ce que tu manges. Je garde le fil de la journée.'}</p></div>
    <div class="nutrition-actions"><button class="sheet-choice" data-sheet="food">＋<strong>Ajouter un repas</strong><span>Description + macros</span></button><button class="sheet-choice" data-sheet="photoFood">◉<strong>Photo aliment / repas</strong><span>Le Compagnon analyse puis tu confirmes</span></button><button class="sheet-choice" data-sheet="mealIdea">${companionMark("choice-companion")}<strong>Idée du Compagnon</strong><span>Selon ta journée</span></button><button class="sheet-choice" data-sheet="barcode">▣<strong>Code-barres</strong><span>Préparer / saisir un produit</span></button></div>
    <div class="nutrition-history"><div class="card-kicker">Ce que tu as saisi</div>${food.length?food.map(nutritionEntry).join(''):'<div class="empty">Aucun repas enregistré aujourd’hui.</div>'}</div>`);
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
      <div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" value="${x.heartRateAvg??''}"></div><div class="field"><label>Cadence</label><input name="cadence" type="number" value="${x.cadenceAvg??''}"></div></div>
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
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{stopBarcodeCamera();$('#sheet').close()}));
  document.querySelectorAll('[data-pick-workout]').forEach(b=>b.addEventListener('click',()=>{openSheet('workout'); setTimeout(()=>{const f=$('#workoutForm'); if(f) f.elements.name.value=b.dataset.pickWorkout;},0)}));
  document.querySelectorAll('input[type="range"]').forEach(r=>r.addEventListener('input',()=>updateRange(r)));
  $('#checkinForm')?.addEventListener('submit',saveCheckin); $('#workoutForm')?.addEventListener('submit',saveWorkout); $('#cardioForm')?.addEventListener('submit',saveCardio); $('#foodForm')?.addEventListener('submit',saveFood); $('#barcodeForm')?.addEventListener('submit',lookupBarcode); $('#startBarcodeCamera')?.addEventListener('click',startBarcodeCamera); $('#toggleManualBarcode')?.addEventListener('click',()=>$('#barcodeForm')?.classList.toggle('hidden')); $('#barcodeConfirmForm')?.addEventListener('submit',saveBarcodeFood); $('#aiFoodConfirmForm')?.addEventListener('submit',saveAIFood);
  $('#foodPhotoInput')?.addEventListener('change',previewFoodPhoto);
  $('#foodLibraryInput')?.addEventListener('change',previewFoodPhoto); $('#progressCameraInput')?.addEventListener('change',prepareProgressPhoto); $('#progressLibraryInput')?.addEventListener('change',prepareProgressPhoto);
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
  const specs=[['Développé couché',4,6,'2 min'],['Tractions',4,8,'90 s'],['Rowing',3,10,'90 s'],['Développé épaules',3,10,'75 s'],['Gainage',3,'45 s','45 s']];
  const exerciseEntries=specs.map((sp,i)=>{
    const series=Array.from({length:sp[1]},(_,s)=>({set:s+1,reps:num(f.get(`reps_${i}_${s}`))||sp[2],weight:num(f.get(`weight_${i}_${s}`))})); 
    const weights=series.map(x=>x.weight).filter(x=>x!=null);
    return {name:sp[0],sets:sp[1],targetReps:sp[2],rest:sp[3],series,weight:weights.length?weights[weights.length-1]:null,performance:series.map(x=>`${x.reps}×${x.weight??'—'}kg`).join(' · ')};
  });
  const date=f.get('date')||todayKey();
  const mins=num(f.get('durationMin'))||40;
  await LTDB.put('workouts',{id:uid(),date,name:'Haut du corps',durationSeconds:mins*60,durationLabel:`${mins}:00`,effort:num(f.get('effort')),exerciseEntries,source:'manual',createdAt:new Date().toISOString()});
  $('#sheet').close(); toast('Séance Force enregistrée'); render();
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


let progressCrop={src:null,img:null,scale:1,x:0,y:0};
async function prepareProgressPhoto(e){
  const input=e.currentTarget;
  const file=input?.files?.[0];
  if(!file){ toast('Aucune photo sélectionnée'); return; }

  // iOS Safari/PWA: copy the values BEFORE replacing the sheet.
  const date=$('#sheetContent [name="photoDate"]')?.value||todayKey();
  const view=$('#progressPhotoView')?.value||'Face';

  try{
    const data=await readProgressPhotoFile(file);
    const img=new Image();
    img.onload=()=>{
      progressCrop={src:data,img,scale:1,x:0,y:0,date,view};
      showProgressCrop(date,view);
    };
    img.onerror=()=>toast('Impossible de prévisualiser cette photo');
    img.src=data;
  }catch(err){
    console.error('Progress photo read failed',err);
    toast('Impossible de charger cette photo');
  }finally{
    // Allows choosing the same photo again on iOS.
    if(input) input.value='';
  }
}
function readProgressPhotoFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error('FILE_READ_FAILED'));
    reader.onabort=()=>reject(new Error('FILE_READ_ABORTED'));
    reader.readAsDataURL(file);
  });
}
function showProgressCrop(date=progressCrop.date||todayKey(),view=progressCrop.view||'Face'){
  showSheet(`<h2>Recadrer</h2><p class="subtle">Déplace la photo et ajuste le zoom. Le cadre vertical sera conservé dans l’historique.</p><div class="crop-stage" id="cropStage"><img id="cropImage" src="${progressCrop.src}"><div class="crop-guide"><i></i><i></i><i></i></div></div><div class="field"><label>Zoom</label><input id="cropZoom" type="range" min="1" max="3" step="0.01" value="1"></div><div class="crop-nudge"><button type="button" data-nudge="0,-20">↑</button><button type="button" data-nudge="-20,0">←</button><button type="button" data-nudge="20,0">→</button><button type="button" data-nudge="0,20">↓</button></div><button class="action" id="saveProgressPhoto" type="button">Enregistrer la photo</button><div class="status">Date : ${date} · ${view}</div>`);
  const im=$('#cropImage'); progressCrop.x=0;progressCrop.y=0;progressCrop.scale=1; applyCropTransform();
  $('#cropZoom')?.addEventListener('input',e=>{progressCrop.scale=Number(e.target.value);applyCropTransform()});
  document.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>{const [dx,dy]=b.dataset.nudge.split(',').map(Number);progressCrop.x+=dx;progressCrop.y+=dy;applyCropTransform()}));
  let sx=0,sy=0,ox=0,oy=0;
  $('#cropStage')?.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;ox=progressCrop.x;oy=progressCrop.y;e.currentTarget.setPointerCapture(e.pointerId)});
  $('#cropStage')?.addEventListener('pointermove',e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;progressCrop.x=ox+e.clientX-sx;progressCrop.y=oy+e.clientY-sy;applyCropTransform()});
  $('#saveProgressPhoto')?.addEventListener('click',()=>saveProgressPhoto(date,view));
}
function applyCropTransform(){const im=$('#cropImage');if(im)im.style.transform=`translate(${progressCrop.x}px,${progressCrop.y}px) scale(${progressCrop.scale})`}
async function saveProgressPhoto(date,view){
  const img=progressCrop.img;if(!img)return;
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=960;const c=canvas.getContext('2d');
  const stage=$('#cropStage'), rect=stage.getBoundingClientRect();
  const base=Math.max(720/img.naturalWidth,960/img.naturalHeight);
  const scale=base*progressCrop.scale;
  const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
  const dx=(720-dw)/2+(progressCrop.x/rect.width)*720,dy=(960-dh)/2+(progressCrop.y/rect.height)*960;
  c.drawImage(img,dx,dy,dw,dh);
  const image=canvas.toDataURL('image/jpeg',0.78);
  await LTDB.put('photos',{id:uid(),date,view,image,createdAt:new Date().toISOString()});
  $('#sheet').close();toast('Photo ajoutée à ton évolution');render();
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
