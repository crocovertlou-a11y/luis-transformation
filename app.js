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
function companionMark(cls='companion-mark'){return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc arc-a"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc arc-b"/></svg>`}
function nutritionEntry(x){return `<button class="nutrition-entry nutrition-entry-button" data-edit-food="${x.id}"><div><strong>${escapeHtml(x.description||'Repas')}</strong><span>${[x.protein?Math.round(x.protein)+' g protéines':'',x.calories?Math.round(x.calories)+' kcal':''].filter(Boolean).join(' · ')||'Repas enregistré'}</span></div><small>Source : ${x.source==='companion'?'Compagnon':'Saisie manuelle'} · Modifier ›</small></button>`}

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
  return `<div class="trend-hero"><div class="trend-mark"><svg viewBox="0 0 64 64"><path d="M13 44A23 23 0 0 1 45 12" class="fluidity-arc" style="stroke-width:6"/><path d="M51 19A23 23 0 0 1 20 52" class="fluidity-arc" style="stroke-width:6"/></svg><span class="initials" style="font-size:14px">${escapeHtml(state.profile.initials)}</span></div><div class="trend-copy">${reading}</div><p class="subtle">Le sens d’abord. Les graphiques seulement si tu veux creuser.</p></div>
  <div class="signals"><div class="signal"><strong>${weightDelta===null?'—':signed(weightDelta)+' kg'}</strong><span>Poids</span></div><div class="signal"><strong>${waistDelta===null?'—':signed(waistDelta)+' cm'}</strong><span>Tour de taille</span></div><div class="signal"><strong>${activities}</strong><span>Activités · 30 j</span></div></div>
  <div class="card" style="margin-top:14px"><div class="card-kicker">Comprendre</div><h3>Pourquoi cette lecture ?</h3><p class="subtle">Les graphiques et l’historique détaillé restent au niveau suivant.</p><div class="card-actions"><button class="action secondary" data-open="details">Explorer les données</button></div></div>`;
}
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
async function renderCompanion(){
  const messages=await LTDB.all('events'); const chat=messages.filter(x=>x.type==='CHAT').slice(-8);
  return `<section class="hero"><div class="companion-page-mark">${companionMark("companion-mark-large")}</div><div class="hello">Compagnon</div><div class="subtle">Présent partout. Bavard seulement quand cela mérite de l’être.</div></section>
  <div class="card primary-card"><div class="attention"><svg class="mini-fluidity" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><h3>Je suis là.</h3><p>Je peux déjà lire le contexte local. Quand je n’ai pas assez d’éléments, je te le dis.</p></div></div></div>
  <div class="card chat" id="chat">${chat.length?chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${escapeHtml(x.text)}</div>`).join(''):'<div class="bubble companion">Je préfère commencer par ce que je sais vraiment.</div>'}</div><div class="chatbar"><input id="chatInput" placeholder="Écris une question…"><button id="sendChat">Envoyer</button></div>`;
}
async function renderProfile(){
  return `<section class="hero"><div class="profile-head"><svg class="big-logo" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><div class="hello" style="font-size:28px;margin:0">${escapeHtml(state.profile.firstName)}</div><div class="subtle">${escapeHtml(state.profile.goal||'Ton évolution')}</div></div></div></section>
  <div class="card"><div class="card-kicker">Ce que tu sais de moi</div><div class="list"><div class="list-row"><div><strong>Objectif actuel</strong><div class="status">${escapeHtml(state.profile.goal||'À définir')}</div></div><span class="pill">Confirmé</span></div><div class="list-row"><div><strong>Alimentation</strong><div class="status">${state.profile.nutritionEnabled?'Accompagnement actif':'Masquée'}</div></div><span class="pill">Choix</span></div></div></div>
  <div class="card"><div class="switch-row"><div><strong>Accompagnement alimentation</strong><div class="status">Masqué lorsqu’il est désactivé.</div></div><input id="nutritionToggle" class="toggle" type="checkbox" ${state.profile.nutritionEnabled?'checked':''}></div></div>
  <div class="card"><div class="card-kicker">Tes données</div><h3>Export / Import</h3><p class="subtle">Tes données restent récupérables.</p><div class="card-actions"><button class="action" id="exportBtn">Exporter JSON</button><label class="action secondary">Importer JSON<input id="importInput" type="file" accept="application/json" hidden></label></div></div><div class="version">Luis Transformation · Build 0.5</div>`;
}
function bindPage(){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>{state.homeView=b.dataset.homeView;render();}));
  document.querySelectorAll('[data-route-card]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.routeCard)));
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.open)));
  document.querySelectorAll('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.editActivity.split(':'); editActivitySheet(kind,id);}));
  $('#sendChat')?.addEventListener('click',sendChat); $('#chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  $('#nutritionToggle')?.addEventListener('change',async e=>{state.profile.nutritionEnabled=e.target.checked; await LTDB.put('profile',state.profile); toast(e.target.checked?'Alimentation activée':'Alimentation masquée'); render();});
  $('#exportBtn')?.addEventListener('click',exportData); $('#importInput')?.addEventListener('change',importData);
}
async function quickAdd(){ openSheet('quick'); }
function showSheet(html){ $('#sheetContent').innerHTML=`<button class="sheet-x" type="button" data-close aria-label="Fermer">×</button>${html}`; $('#sheet').showModal(); bindSheet(); updateAllRanges(); }
function slider(name,label,min,max,step,value,unit=''){ return `<div class="slider-line"><div class="slider-head"><label>${label}</label><output data-output="${name}">${value}${unit}</output></div><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-range-unit="${unit}"></div>`; }
function openSheet(kind){
  if(kind==='quick') return showSheet(`<h2>Donner quelque chose</h2><div class="sheet-grid"><button class="sheet-choice" data-sheet="checkin">◌<strong>Ressenti</strong></button><button class="sheet-choice" data-sheet="workout">◎<strong>Force</strong></button><button class="sheet-choice" data-sheet="cardio">⌁<strong>Cardio</strong></button>${state.profile.nutritionEnabled?'<button class="sheet-choice" data-sheet="nutritionHub">◒<strong>Alimentation</strong></button>':''}</div>`);
  if(kind==='checkin') return showSheet(`<h2>Comment vas-tu aujourd’hui ?</h2><form id="checkinForm">${slider('sleep','Sommeil','0','12','0.25','7',' h')}${slider('energy','Énergie','1','5','1','3','/5')}${slider('stress','Stress','1','5','1','2','/5')}${slider('hunger','Faim','1','5','1','3','/5')}<div class="field"><label>Poids (kg)</label><input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal" placeholder="80.4"></div><div class="field"><label>Tour de taille (cm)</label><input name="waist" type="number" min="30" max="250" step="0.1" inputmode="decimal" placeholder="90.0"></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='workout') return showSheet(`<h2>Ta séance Force</h2><form id="workoutForm"><input type="hidden" name="name" value="Haut du corps">${forceExerciseInput('Développé couché',4,6,'2 min')}${forceExerciseInput('Tractions',4,8,'90 s')}${forceExerciseInput('Rowing',3,10,'90 s')}${forceExerciseInput('Développé épaules',3,10,'75 s')}${forceExerciseInput('Gainage',3,'45 s','45 s')}<div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="40"></div>${slider('effort','Ressenti','1','5','1','3','/5')}<button class="action" type="submit">Terminer la séance</button></form>`);
  if(kind==='workoutIdeas') return showSheet(`<h2>Suggestions Force</h2><div class="suggestion-list"><button class="suggestion-card" data-pick-workout="Haut du corps"><strong>Haut du corps · 40 min</strong><span>Développé couché · Tractions · Rowing · Épaules · Abdos</span></button><button class="suggestion-card" data-pick-workout="Full body"><strong>Full body · 40 min</strong><span>Squat · Développé couché · Rowing · Épaules · Gainage</span></button><button class="suggestion-card" data-pick-workout="Bas du corps"><strong>Bas du corps + abdos · 40 min</strong><span>Squat · Fentes · Hip hinge · Mollets · Gainage</span></button></div>`);
  if(kind==='cardio') return showSheet(`<h2>Ajouter une activité Cardio</h2><form id="cardioForm"><div class="field"><label>Type</label><select name="type"><option>Course</option><option>Vélo</option><option>Natation</option><option>Marche</option><option>Autre</option></select></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" max="23" inputmode="numeric" value="0"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" inputmode="numeric" value="40"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" inputmode="numeric" value="0"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" inputmode="numeric"></div><div class="field"><label>Cadence moy.</label><input name="cadence" type="number" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>Dénivelé + (m)</label><input name="elevation" type="number" inputmode="numeric"></div><div class="field"><label>Calories (kcal)</label><input name="calories" type="number" inputmode="numeric"></div></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='nutritionHub') return nutritionHubSheet();
  if(kind==='food') return showSheet(`<h2>Ajouter un repas</h2><form id="foodForm"><div class="field"><label>Décris simplement</label><textarea name="description" rows="3" placeholder="Poulet, riz, légumes et un yaourt"></textarea></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1"></div><div class="field"><label>Calories</label><input name="calories" type="number"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1"></div></div><div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1"></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes classiques</label><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='barcode') return showSheet(`<h2>Code-barres</h2><p class="subtle">Build 0.2 prépare le parcours : saisie → prévisualisation → confirmation. Le scan caméra arrivera ensuite.</p><form id="barcodeForm"><div class="field"><label>Code</label><input name="barcode" inputmode="numeric" placeholder="7612345678901"></div><div class="field"><label>Produit</label><input name="product" placeholder="Nom du produit"></div><button class="action" type="submit">Prévisualiser</button></form>`);
  if(kind==='photoFood') return showSheet(`<h2>Photographier un aliment</h2><p class="subtle">Prends une photo ou choisis-en une dans ta photothèque.</p><label class="action photo-action">Prendre une photo<input id="foodPhotoInput" type="file" accept="image/*" capture="environment" hidden></label><label class="action secondary photo-action">Photothèque<input id="foodLibraryInput" type="file" accept="image/*" hidden></label><div id="foodPhotoPreview" class="photo-preview empty">La photo apparaîtra ici avant confirmation.</div>`);
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
    <div class="nutrition-actions"><button class="sheet-choice" data-sheet="food">＋<strong>Ajouter un repas</strong><span>Description + macros</span></button><button class="sheet-choice" data-sheet="photoFood">◉<strong>Photo produit</strong><span>Prendre une photo ou photothèque</span></button><button class="sheet-choice" data-sheet="mealIdea">${companionMark("choice-companion")}<strong>Idée du Compagnon</strong><span>Selon ta journée</span></button><button class="sheet-choice" data-sheet="barcode">▣<strong>Code-barres</strong><span>Préparer / saisir un produit</span></button></div>
    <div class="nutrition-history"><div class="card-kicker">Ce que tu as saisi</div>${food.length?food.map(nutritionEntry).join(''):'<div class="empty">Aucun repas enregistré aujourd’hui.</div>'}</div>`);
}

async function editFoodSheet(id){
  const x=await LTDB.get('food',id); if(!x) return;
  showSheet(`<h2>Modifier le repas</h2><form id="foodEditForm">
    <input type="hidden" name="id" value="${x.id}">
    <div class="field"><label>Description</label><textarea name="description" rows="3">${escapeHtml(x.description||'')}</textarea></div>
    <div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1" value="${x.protein??''}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${x.calories??''}"></div></div>
    <div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1" value="${x.carbs??''}"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1" value="${x.fat??''}"></div></div>
    <div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1" value="${x.water??''}"></div>
    <div class="edit-actions"><button class="action" type="submit">Enregistrer les modifications</button><button class="action danger" type="button" id="deleteFood">Supprimer</button></div>
  </form>`);
}
async function updateFood(e){
  e.preventDefault(); const f=new FormData(e.currentTarget); const old=await LTDB.get('food',f.get('id')); if(!old)return;
  await LTDB.put('food',{...old,description:f.get('description')||'Repas',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:num(f.get('water')),updatedAt:new Date().toISOString()});
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
      <div class="field"><label>Type</label><select name="type">${['Course','Vélo','Natation','Marche','Autre'].map(v=>`<option ${x.type===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal" value="${x.distance??''}"></div>
      <div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" value="${h}"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" value="${m}"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" value="${s}"></div></div>
      <div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" value="${x.heartRateAvg??''}"></div><div class="field"><label>Cadence</label><input name="cadence" type="number" value="${x.cadenceAvg??''}"></div></div>
      <div class="range-row"><div class="field"><label>Dénivelé +</label><input name="elevation" type="number" value="${x.elevationGain??''}"></div><div class="field"><label>Calories</label><input name="calories" type="number" value="${x.calories??''}"></div></div>
      <div class="edit-actions"><button class="action" type="submit">Enregistrer</button><button class="action danger" type="button" id="deleteActivity">Supprimer</button></div></form>`);
  }
  const entries=x.exerciseEntries||[];
  return showSheet(`<h2>Modifier la séance Force</h2><form id="activityEditForm"><input type="hidden" name="kind" value="Force"><input type="hidden" name="id" value="${id}">
    <div class="edit-force-list">${entries.map((e,i)=>`<div class="edit-force-exercise"><div class="force-input-head"><div><strong>${escapeHtml(e.name)}</strong><span>${e.rest?`Récup. ${escapeHtml(String(e.rest))}`:''}</span></div></div>${(e.series||[]).map((s,j)=>`<div class="set-row"><span>S${j+1}</span><input name="editreps_${i}_${j}" type="number" inputmode="numeric" value="${s.reps??''}" placeholder="reps"><input name="editweight_${i}_${j}" type="number" step="0.5" inputmode="decimal" value="${s.weight??''}" placeholder="kg"></div>`).join('')||`<div class="field"><label>Dernière performance</label><input name="legacyperf_${i}" value="${escapeHtml(e.performance||'')}"></div>`}</div>`).join('')}</div>
    <div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" value="${Math.round((x.durationSeconds||0)/60)||40}"></div>
    <div class="edit-actions"><button class="action" type="submit">Enregistrer</button><button class="action danger" type="button" id="deleteActivity">Supprimer</button></div></form>`);
}
async function updateActivity(e){
  e.preventDefault(); const f=new FormData(e.currentTarget), kind=f.get('kind'), id=f.get('id'), store=kind==='Force'?'workouts':'cardio', old=await LTDB.get(store,id); if(!old)return;
  if(kind==='Cardio'){
    const seconds=(num(f.get('hours'))||0)*3600+(num(f.get('minutes'))||0)*60+(num(f.get('seconds'))||0);
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    const label=h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
    await LTDB.put(store,{...old,type:f.get('type'),distance:num(f.get('distance')),durationSeconds:seconds,durationLabel:label,heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),updatedAt:new Date().toISOString()});
  } else {
    const entries=(old.exerciseEntries||[]).map((e,i)=>{
      if(!(e.series||[]).length) return e;
      const series=e.series.map((s,j)=>({...s,reps:num(f.get(`editreps_${i}_${j}`))??s.reps,weight:num(f.get(`editweight_${i}_${j}`))}));
      return {...e,series,weight:series.map(v=>v.weight).filter(v=>v!=null).slice(-1)[0]??e.weight,performance:series.map(v=>`${v.reps??'—'}×${v.weight??'—'}kg`).join(' · ')};
    });
    const mins=num(f.get('durationMin'))||40;
    await LTDB.put(store,{...old,exerciseEntries:entries,durationSeconds:mins*60,durationLabel:`${mins}:00`,updatedAt:new Date().toISOString()});
  }
  $('#sheet').close(); toast('Saisie modifiée'); render();
}
async function deleteActivity(kind,id){const store=kind==='Force'?'workouts':'cardio'; await LTDB.del(store,id); $('#sheet').close(); toast('Saisie supprimée'); render();}

function showTechnique(name){
  showSheet(`<h2>${escapeHtml(name)}</h2><div class="technique-visual"><div class="companion-page-mark">${companionMark("companion-mark-large")}</div><p><strong>Technique</strong></p><p class="subtle">Le raccourci vidéo reste dans la séance pour le moment où tu en as besoin. Le catalogue vidéo validé sera branché ici.</p></div><button class="action secondary" data-close>Revenir à la séance</button>`);
}

function bindSheet(){
  document.querySelectorAll('[data-sheet]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.sheet)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#sheet').close()));
  document.querySelectorAll('[data-pick-workout]').forEach(b=>b.addEventListener('click',()=>{openSheet('workout'); setTimeout(()=>{const f=$('#workoutForm'); if(f) f.elements.name.value=b.dataset.pickWorkout;},0)}));
  document.querySelectorAll('input[type="range"]').forEach(r=>r.addEventListener('input',()=>updateRange(r)));
  $('#checkinForm')?.addEventListener('submit',saveCheckin); $('#workoutForm')?.addEventListener('submit',saveWorkout); $('#cardioForm')?.addEventListener('submit',saveCardio); $('#foodForm')?.addEventListener('submit',saveFood); $('#barcodeForm')?.addEventListener('submit',previewBarcode);
  $('#foodPhotoInput')?.addEventListener('change',previewFoodPhoto);
  $('#foodLibraryInput')?.addEventListener('change',previewFoodPhoto);
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
async function saveCheckin(e){e.preventDefault(); const f=new FormData(e.currentTarget); const row={id:todayKey(),date:todayKey(),sleep:num(f.get('sleep')),energy:num(f.get('energy')),stress:num(f.get('stress')),hunger:num(f.get('hunger')),weight:num(f.get('weight')),waist:num(f.get('waist')),updatedAt:new Date().toISOString()}; await LTDB.put('checkins',row); $('#sheet').close(); toast('Point du jour enregistré'); render();}
async function saveWorkout(e){
  e.preventDefault(); const f=new FormData(e.currentTarget);
  const specs=[['Développé couché',4,6,'2 min'],['Tractions',4,8,'90 s'],['Rowing',3,10,'90 s'],['Développé épaules',3,10,'75 s'],['Gainage',3,'45 s','45 s']];
  const exerciseEntries=specs.map((sp,i)=>{
    const series=Array.from({length:sp[1]},(_,s)=>({set:s+1,reps:num(f.get(`reps_${i}_${s}`))||sp[2],weight:num(f.get(`weight_${i}_${s}`))})); 
    const weights=series.map(x=>x.weight).filter(x=>x!=null);
    return {name:sp[0],sets:sp[1],targetReps:sp[2],rest:sp[3],series,weight:weights.length?weights[weights.length-1]:null,performance:series.map(x=>`${x.reps}×${x.weight??'—'}kg`).join(' · ')};
  });
  const mins=num(f.get('durationMin'))||40;
  await LTDB.put('workouts',{id:uid(),date:todayKey(),name:'Haut du corps',durationSeconds:mins*60,durationLabel:`${mins}:00`,effort:num(f.get('effort')),exerciseEntries,source:'manual',createdAt:new Date().toISOString()});
  $('#sheet').close(); toast('Séance Force enregistrée'); render();
}
async function saveCardio(e){e.preventDefault(); const f=new FormData(e.currentTarget); const parsed=parseDuration(f.get('duration')); await LTDB.put('cardio',{id:uid(),date:todayKey(),type:f.get('type'),distance:num(f.get('distance')),durationSeconds:parsed.seconds,durationLabel:parsed.label,heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),source:'manual',createdAt:new Date().toISOString()}); $('#sheet').close(); toast('Activité Cardio enregistrée'); render();}
async function saveFood(e){e.preventDefault(); const f=new FormData(e.currentTarget); await LTDB.put('food',{id:uid(),date:todayKey(),dateTime:new Date().toISOString(),description:f.get('description')||'Repas',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:num(f.get('water')),classic:f.get('classic')==='on',source:'companion',confidence:'user',createdAt:new Date().toISOString()}); toast('Repas enregistré · visible dans Alimentation'); await nutritionHubSheet(); render();}
function previewBarcode(e){e.preventDefault(); const f=new FormData(e.currentTarget); const code=f.get('barcode')||'—', product=f.get('product')||'Produit à identifier'; showSheet(`<h2>Prévisualisation produit</h2><div class="card"><div class="card-kicker">Code-barres</div><h3>${escapeHtml(product)}</h3><p class="subtle">${escapeHtml(code)}</p><p>Le parcours de confirmation est en place. La recherche automatique des valeurs sera branchée avec le backend nutrition.</p><div class="card-actions"><button class="action secondary" data-close>Fermer</button></div></div>`);}
function previewFoodPhoto(e){ const file=e.target.files?.[0]; if(!file)return; const url=URL.createObjectURL(file); const box=$('#foodPhotoPreview'); box.className='photo-preview'; box.innerHTML=`<img src="${url}" alt="Prévisualisation du produit"><div class="card-actions"><button class="action secondary" data-close>Annuler</button><button class="action" type="button" id="confirmPhoto">Confirmer la photo</button></div>`; $('#confirmPhoto')?.addEventListener('click',()=>{toast('Photo confirmée'); $('#sheet').close(); URL.revokeObjectURL(url);}); }
async function sendChat(){const input=$('#chatInput'); const text=input?.value.trim(); if(!text)return; await LTDB.put('events',{id:uid(),type:'CHAT',role:'user',text,createdAt:new Date().toISOString()}); const context=await localCompanion(text); await LTDB.put('events',{id:uid(),type:'CHAT',role:'companion',text:context,createdAt:new Date().toISOString()}); render();}
async function localCompanion(text){const low=text.toLowerCase(); const checkins=await LTDB.all('checkins'); const latest=checkins.sort((a,b)=>b.date.localeCompare(a.date))[0]; if(/(comment|vais|aujourd)/.test(low)){ if(!latest) return 'Je ne sais pas encore suffisamment bien. Donne-moi simplement ton ressenti du jour et je pourrai commencer à te répondre avec plus de contexte.'; return `Aujourd’hui, tu as indiqué ${latest.sleep?latest.sleep+' h de sommeil, ':''}${latest.energy?'une énergie de '+latest.energy+'/5 et ':''}${latest.stress?'un stress de '+latest.stress+'/5.':''} Je garde le constat simple pour le moment.`; } if(/(sais|connais|mémoire)/.test(low)) return `Je sais ce que tu m’as explicitement donné : ton objectif « ${state.profile.goal} » et les données enregistrées ici. Je ne transforme pas une supposition en fait.`; return 'Je peux utiliser ton contexte local, mais je préfère te dire clairement quand je ne sais pas encore.';}
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
