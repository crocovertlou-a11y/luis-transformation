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
  try{
    if(!state.online) html+='<div class="offline-banner">Hors ligne · l’app reste utilisable et les données restent sur cet appareil.</div>';
    if(state.route==='home') html+=await renderHome();
    if(state.route==='training') html+=await renderTraining();
    if(state.route==='companion') html+=await renderCompanion();
    if(state.route==='profile') html+=await renderProfile();
    main.innerHTML=html; bindPage();
  }catch(err){
    console.error('Render error',err);
    main.innerHTML=`<section class="hero"><div class="hello">Luis Transformation</div><div class="subtle">Une partie de l’écran n’a pas pu être chargée.</div></section><div class="card"><h3>Tes données restent sur l’appareil.</h3><p class="subtle">Recharge l’app. Si le problème persiste, le bouton Profil reste disponible après redémarrage.</p></div>`;
  }
}
async function renderHome(){
  const safeAll=async store=>{try{return await LTDB.all(store)}catch(err){console.error('Lecture',store,err);return []}};
  const checkins=await safeAll('checkins'), workouts=await safeAll('workouts'), cardio=await safeAll('cardio'), food=await safeAll('food');
  state._food=food; state._cardio=cardio;
  const today=checkins.find(x=>x.date===todayKey()), todayWorkout=workouts.find(x=>x.date===todayKey());
  const protein=food.filter(x=>x.date===todayKey()).reduce((s,x)=>s+(Number(x.protein)||0),0);
  const view=state.homeView;
  return `<section class="hero home-hero"><div class="hello">${view==='today'?'Bonjour '+escapeHtml(state.profile.firstName)+'.':'Évolution'}</div>${view==='evolution'?'<div class="subtle">Tout ce que tu renseignes reste accessible ici.</div>':''}</section>
  <div class="segmented"><button data-home-view="today" class="${view==='today'?'active':''}">Aujourd’hui</button><button data-home-view="evolution" class="${view==='evolution'?'active':''}">Évolution</button></div>
  ${view==='today'?renderToday(today,todayWorkout,protein):await renderEvolution(checkins,workouts,cardio,food)}`;
}
function renderToday(today,todayWorkout,protein){
 const attention=today?recoveryText(today):null, cardioList=(state._cardio||[]).filter(x=>x.date===todayKey()), cardioToday=cardioList.length?cardioList[cardioList.length-1]:null, foodToday=(state._food||[]).filter(x=>x.date===todayKey());
 const kcal=foodToday.reduce((s,x)=>s+(+x.calories||0),0), target=state.profile.proteinTarget||170, remain=Math.max(0,target-protein);
 const check=today?`<div class="quiet-line clickable" data-open="checkin"><span>Ressenti enregistré</span><strong>Modifier</strong></div>`:`<div class="companion-prompt clickable" data-open="checkin"><div class="companion-orbit">${fluidityMark()}</div><div><div class="card-kicker">Compagnon</div><h3>Comment vas-tu aujourd’hui ?</h3><p>Quelques gestes suffisent. J’utiliserai le reste en silence.</p></div></div>`;
 return `${attention?`<div class="companion-inline"><span>${fluidityMark()}</span><div><strong>${attention.title}</strong><p>${attention.text}</p></div></div>`:''}${check}
 <div class="section-title"><h2>Ta journée</h2></div><div class="day-stream">
 <div class="day-item clickable" data-route-card="training"><div class="day-icon">F</div><div><div class="card-kicker">Force</div><h3>${todayWorkout?'Séance enregistrée':'Une séance prête quand tu l’es'}</h3><p>${todayWorkout?'Je garde tes charges pour préparer la suite.':'Séries, répétitions, récupération et charges sont prêtes.'}</p></div><span>›</span></div>
 ${cardioToday?`<div class="day-item clickable" data-route-card="training"><div class="day-icon">C</div><div><div class="card-kicker">Cardio</div><h3>${escapeHtml(cardioToday.type)} · ${cardioToday.distance?cardioToday.distance+' km · ':''}${cardioToday.durationLabel||''}</h3><p>Source : ${sourceLabel(cardioToday.source)}</p></div><span>›</span></div>`:`<div class="day-item clickable" data-open="cardio"><div class="day-icon">C</div><div><div class="card-kicker">Cardio</div><h3>Aucune activité aujourd’hui</h3><p>Ajoute-la seulement si elle existe.</p></div><span>+</span></div>`}
 ${state.profile.nutritionEnabled?`<div class="day-item clickable" data-open="nutritionHub"><div class="day-icon">A</div><div><div class="card-kicker">Alimentation</div><h3>${protein?Math.round(protein)+' / '+target+' g de protéines':'Aucun repas enregistré'}</h3><p>${protein?Math.round(remain)+' g restent sur ton repère'+(kcal?' · '+Math.round(kcal)+' kcal saisies':''):'Tes repas restent accessibles dans Alimentation.'}</p></div><span>›</span></div>`:''}</div>`;
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
async function renderEvolution(checkins,workouts,cardio,food=state._food||[]){
 const sorted=[...checkins].sort((a,b)=>b.date.localeCompare(a.date)), lw=sorted.find(x=>x.weight)?.weight, lz=sorted.find(x=>x.waist)?.waist;
 const enough=sorted.filter(x=>x.weight).length>=2;
 return `<div class="card"><div class="card-kicker">Lecture</div><h3>${enough?'Ton historique commence à permettre une lecture.':'Je n’ai pas encore assez de recul pour parler de tendance.'}</h3><p class="subtle">Je préfère montrer la dernière valeur disponible plutôt qu’un faux zéro.</p></div>
 <div class="destination-grid">${destinationCard('Poids',lw?lw+' kg':'—',lw?'Dernière mesure':'Pas encore renseigné')}${destinationCard('Tour de taille',lz?lz+' cm':'—',lz?'Dernière mesure':'Pas encore renseigné')}${destinationCard('Force',workouts.length,workouts.length?'séance(s) enregistrée(s)':'Aucune séance')}${destinationCard('Cardio',cardio.length,cardio.length?'activité(s) enregistrée(s)':'Aucune activité')}</div>
 <div class="card"><div class="card-kicker">Ressentis</div><h3>Historique récent</h3><div class="list">${sorted.slice(0,7).map(x=>`<div class="list-row"><div><strong>${x.date}</strong><div class="status">${[x.sleepQuality?`Sommeil ${x.sleepQuality}/5`:'',x.energy?`Énergie ${x.energy}/5`:'',x.stress?`Stress ${x.stress}/5`:'',x.hunger?`Faim ${x.hunger}/5`:''].filter(Boolean).join(' · ')||'Mesures enregistrées'}</div></div><span class="source-chip">${sourceLabel(x.source||'manual')}</span></div>`).join('')||'<div class="empty">Tes ressentis apparaîtront ici.</div>'}</div></div>
 <div class="card"><div class="card-kicker">Alimentation</div><h3>${food.length} entrée${food.length>1?'s':''}</h3><button class="action secondary" data-open="nutritionHub">Voir mes données</button></div>`;
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
  <div class="section-title"><h2>Historique récent</h2></div><div class="card list">${[...workouts.map(x=>({...x,kind:'Force'})),...cardio.map(x=>({...x,kind:'Cardio'}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<div class="list-row"><div><strong>${escapeHtml(x.name||x.type||x.kind)}</strong><div class="status">${x.date}${x.durationLabel?' · '+x.durationLabel:''}</div></div><span class="pill">${x.kind}</span></div>`).join('')||'<div class="empty">Aucune activité enregistrée.</div>'}</div>`;
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
  return `<section class="hero"><div class="companion-page-mark">◜◝</div><div class="hello">Compagnon</div><div class="subtle">Présent partout. Bavard seulement quand cela mérite de l’être.</div></section>
  <div class="card primary-card"><div class="attention"><svg class="mini-fluidity" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><h3>Je suis là.</h3><p>Je peux déjà lire le contexte local. Quand je n’ai pas assez d’éléments, je te le dis.</p></div></div></div>
  <div class="card chat" id="chat">${chat.length?chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${escapeHtml(x.text)}</div>`).join(''):'<div class="bubble companion">Je préfère commencer par ce que je sais vraiment.</div>'}</div><div class="chatbar"><input id="chatInput" placeholder="Écris une question…"><button id="sendChat">Envoyer</button></div>`;
}
async function renderProfile(){
  return `<section class="hero"><div class="profile-head"><svg class="big-logo" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><div class="hello" style="font-size:28px;margin:0">${escapeHtml(state.profile.firstName)}</div><div class="subtle">${escapeHtml(state.profile.goal||'Ton évolution')}</div></div></div></section>
  <div class="card"><div class="card-kicker">Ce que tu sais de moi</div><div class="list"><div class="list-row"><div><strong>Objectif actuel</strong><div class="status">${escapeHtml(state.profile.goal||'À définir')}</div></div><span class="pill">Confirmé</span></div><div class="list-row"><div><strong>Alimentation</strong><div class="status">${state.profile.nutritionEnabled?'Accompagnement actif':'Masquée'}</div></div><span class="pill">Choix</span></div></div></div>
  <div class="card"><div class="switch-row"><div><strong>Accompagnement alimentation</strong><div class="status">Masqué lorsqu’il est désactivé.</div></div><input id="nutritionToggle" class="toggle" type="checkbox" ${state.profile.nutritionEnabled?'checked':''}></div></div>
  <div class="card"><div class="card-kicker">Tes données</div><h3>Export / Import</h3><p class="subtle">Tes données restent récupérables.</p><div class="card-actions"><button class="action" id="exportBtn">Exporter JSON</button><label class="action secondary">Importer JSON<input id="importInput" type="file" accept="application/json" hidden></label></div></div><div class="version">Luis Transformation · Build 0.4.3</div>`;
}
function bindPage(){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>{state.homeView=b.dataset.homeView;render();}));
  document.querySelectorAll('[data-route-card]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.routeCard)));
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.open)));
  $('#sendChat')?.addEventListener('click',sendChat); $('#chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  $('#nutritionToggle')?.addEventListener('change',async e=>{state.profile.nutritionEnabled=e.target.checked; await LTDB.put('profile',state.profile); toast(e.target.checked?'Alimentation activée':'Alimentation masquée'); render();});
  $('#exportBtn')?.addEventListener('click',exportData); $('#importInput')?.addEventListener('change',importData);
}
async function quickAdd(){ openSheet('quick'); }
function showSheet(html){ $('#sheetContent').innerHTML=html; $('#sheet').showModal(); bindSheet(); updateAllRanges(); }
function slider(name,label,min,max,step,value,unit=''){ return `<div class="slider-line"><div class="slider-head"><label>${label}</label><output data-output="${name}">${value}${unit}</output></div><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-range-unit="${unit}"></div>`; }
function openSheet(kind){
  if(kind==='quick') return showSheet(`<h2>Donner quelque chose</h2><div class="sheet-grid"><button class="sheet-choice" data-sheet="checkin">◌<strong>Ressenti</strong></button><button class="sheet-choice" data-sheet="workout">◎<strong>Force</strong></button><button class="sheet-choice" data-sheet="cardio">⌁<strong>Cardio</strong></button>${state.profile.nutritionEnabled?'<button class="sheet-choice" data-sheet="nutritionHub">◒<strong>Alimentation</strong></button>':''}</div>`);
  if(kind==='checkin') return showSheet(`<h2>Comment vas-tu aujourd’hui ?</h2><form id="checkinForm">${slider('sleep','Sommeil','0','12','0.25','7',' h')}${slider('energy','Énergie','1','5','1','3','/5')}${slider('stress','Stress','1','5','1','2','/5')}${slider('hunger','Faim','1','5','1','3','/5')}<div class="field"><label>Poids (kg)</label><input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal" placeholder="80.4"></div><div class="field"><label>Tour de taille (cm)</label><input name="waist" type="number" min="30" max="250" step="0.1" inputmode="decimal" placeholder="90.0"></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='workout') return showSheet(`<h2>Ta séance Force</h2><form id="workoutForm"><input type="hidden" name="name" value="Haut du corps">${forceExerciseInput('Développé couché',4,6,'2 min')}${forceExerciseInput('Tractions',4,8,'90 s')}${forceExerciseInput('Rowing',3,10,'90 s')}${forceExerciseInput('Développé épaules',3,10,'75 s')}${forceExerciseInput('Gainage',3,'45 s','45 s')}<div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="40"></div>${slider('effort','Ressenti','1','5','1','3','/5')}<button class="action" type="submit">Terminer la séance</button></form>`);
  if(kind==='workoutIdeas') return showSheet(`<h2>Suggestions Force</h2><div class="suggestion-list"><button class="suggestion-card" data-pick-workout="Haut du corps"><strong>Haut du corps · 40 min</strong><span>Développé couché · Tractions · Rowing · Épaules · Abdos</span></button><button class="suggestion-card" data-pick-workout="Full body"><strong>Full body · 40 min</strong><span>Squat · Développé couché · Rowing · Épaules · Gainage</span></button><button class="suggestion-card" data-pick-workout="Bas du corps"><strong>Bas du corps + abdos · 40 min</strong><span>Squat · Fentes · Hip hinge · Mollets · Gainage</span></button></div>`);
  if(kind==='cardio') return showSheet(`<h2>Ajouter une activité Cardio</h2><form id="cardioForm"><div class="field"><label>Type</label><select name="type"><option>Course</option><option>Vélo</option><option>Natation</option><option>Marche</option><option>Autre</option></select></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" max="23" inputmode="numeric" value="0"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" inputmode="numeric" value="40"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" inputmode="numeric" value="0"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" inputmode="numeric"></div><div class="field"><label>Cadence moy.</label><input name="cadence" type="number" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>Dénivelé + (m)</label><input name="elevation" type="number" inputmode="numeric"></div><div class="field"><label>Calories (kcal)</label><input name="calories" type="number" inputmode="numeric"></div></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='nutritionHub') return showSheet(`<h2>Alimentation</h2><div class="nutrition-actions"><button class="sheet-choice" data-sheet="food">＋<strong>Ajouter un repas</strong><span>Description + macros</span></button><button class="sheet-choice" data-sheet="barcode">▣<strong>Code-barres</strong><span>Préparer / saisir un produit</span></button><button class="sheet-choice" data-sheet="photoFood">◉<strong>Photo produit</strong><span>Prévisualisation avant validation</span></button><button class="sheet-choice" data-sheet="mealIdea">✦<strong>Idée de repas</strong><span>Selon ce qu’il te reste aujourd’hui</span></button></div>`);
  if(kind==='food') return showSheet(`<h2>Ajouter un repas</h2><form id="foodForm"><div class="field"><label>Décris simplement</label><textarea name="description" rows="3" placeholder="Poulet, riz, légumes et un yaourt"></textarea></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1"></div><div class="field"><label>Calories</label><input name="calories" type="number"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1"></div></div><div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1"></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes classiques</label><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='barcode') return showSheet(`<h2>Code-barres</h2><p class="subtle">Build 0.4.3 prépare le parcours : saisie → prévisualisation → confirmation. Le scan caméra arrivera ensuite.</p><form id="barcodeForm"><div class="field"><label>Code</label><input name="barcode" inputmode="numeric" placeholder="7612345678901"></div><div class="field"><label>Produit</label><input name="product" placeholder="Nom du produit"></div><button class="action" type="submit">Prévisualiser</button></form>`);
  if(kind==='photoFood') return showSheet(`<h2>Photographier un aliment</h2><p class="subtle">Prends une photo ou choisis-en une dans ta photothèque.</p><label class="action photo-action">Prendre une photo<input id="foodPhotoInput" type="file" accept="image/*" capture="environment" hidden></label><label class="action secondary photo-action">Photothèque<input id="foodLibraryInput" type="file" accept="image/*" hidden></label><div id="foodPhotoPreview" class="photo-preview empty">La photo apparaîtra ici avant confirmation.</div>`);
  if(kind==='mealIdea') return mealIdeaSheet();
  if(kind==='details') return showSheet(`<h2>Données détaillées</h2><p class="subtle">Les graphiques restent volontairement derrière Évolution. Ce niveau sera enrichi sans changer l’écran principal.</p><button class="action secondary" data-close>Fermer</button>`);
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
function fluidityMark(){return `<svg class="fluidity-inline" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc arc-a"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc arc-b"/></svg>`}
function sourceLabel(s){return ({manual:'Saisie manuelle',companion:'Compagnon',import:'Import',garmin:'Garmin',strava:'Strava'})[s]||s||'Inconnue'}
function destinationCard(l,v,n){return `<div class="destination-card"><span>${l}</span><strong>${v}</strong><small>${n}</small></div>`}
function foodEntryHtml(x){return `<button class="food-entry" data-food-id="${x.id}"><div><strong>${escapeHtml(x.description||'Repas')}</strong><span>${[x.protein?Math.round(x.protein)+' g protéines':'',x.calories?Math.round(x.calories)+' kcal':''].filter(Boolean).join(' · ')||'Détail enregistré'}</span></div><div class="food-source"><span>${sourceLabel(x.source)}</span></div></button>`}

function forceExerciseInput(name,sets,reps,rest){
  const idx={'Développé couché':0,'Tractions':1,'Rowing':2,'Développé épaules':3,'Gainage':4}[name];
  return `<div class="force-input"><div class="force-input-head"><div><strong>${name}</strong><span>${sets} séries × ${reps} · récup. ${rest}</span></div><button type="button" class="technique-btn" data-technique="${name}">Technique</button></div><label>Poids utilisé (kg)<input name="weight${idx}" type="number" step="0.5" inputmode="decimal" placeholder="—"></label></div>`;
}
async function showFoodDetail(id){const x=(await LTDB.all('food')).find(v=>v.id===id);if(!x)return;showSheet(`<h2>${escapeHtml(x.description||'Repas')}</h2><div class="detail-stack"><div><span>Protéines</span><strong>${x.protein||'—'} g</strong></div><div><span>Calories</span><strong>${x.calories||'—'} kcal</strong></div><div><span>Glucides</span><strong>${x.carbs||'—'} g</strong></div><div><span>Lipides</span><strong>${x.fat||'—'} g</strong></div></div><div class="provenance"><div class="card-kicker">Provenance</div><strong>${sourceLabel(x.source)}</strong><p class="subtle">Tu peux toujours corriger une interprétation du Compagnon.</p></div><button class="action secondary" data-close>Fermer</button>`)}

function showTechnique(name){
  showSheet(`<h2>${escapeHtml(name)}</h2><div class="technique-visual"><div class="companion-page-mark">◜◝</div><p><strong>Technique</strong></p><p class="subtle">Le raccourci vidéo reste dans la séance pour le moment où tu en as besoin. Le catalogue vidéo validé sera branché ici.</p></div><button class="action secondary" data-close>Revenir à la séance</button>`);
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
  document.querySelectorAll('[data-food-id]').forEach(b=>b.addEventListener('click',()=>showFoodDetail(b.dataset.foodId)));
}
function updateAllRanges(){ document.querySelectorAll('input[type="range"]').forEach(updateRange); }
function updateRange(r){ const out=document.querySelector(`[data-output="${r.name}"]`); if(out) out.value=`${r.value}${r.dataset.rangeUnit||''}`; }
async function saveCheckin(e){e.preventDefault(); const f=new FormData(e.currentTarget); const row={id:todayKey(),date:todayKey(),sleep:num(f.get('sleep')),energy:num(f.get('energy')),stress:num(f.get('stress')),hunger:num(f.get('hunger')),weight:num(f.get('weight')),waist:num(f.get('waist')),source:'manual',updatedAt:new Date().toISOString()}; await LTDB.put('checkins',row); $('#sheet').close(); toast('Point du jour enregistré'); render();}
async function saveWorkout(e){
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const specs=[
    ['Développé couché',4,6,'2 min'],
    ['Tractions',4,8,'90 s'],
    ['Rowing',3,10,'90 s'],
    ['Développé épaules',3,10,'75 s'],
    ['Gainage',3,'45 s','45 s']
  ];
  const exerciseEntries=specs.map((spec,i)=>({
    name:spec[0], sets:spec[1], reps:spec[2], rest:spec[3],
    weight:num(f.get('weight'+i)),
    performance:f.get('weight'+i)?`${f.get('weight'+i)} kg`:'réalisé'
  }));
  const mins=num(f.get('durationMin'))||40;
  await LTDB.put('workouts',{
    id:uid(),date:todayKey(),name:'Haut du corps',
    durationSeconds:mins*60,durationLabel:`${mins}:00`,
    effort:num(f.get('effort')),exerciseEntries,
    source:'manual',createdAt:new Date().toISOString()
  });
  $('#sheet').close();
  toast('Séance Force enregistrée');
  render();
}
async function saveCardio(e){
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const totalSeconds=(num(f.get('hours'))||0)*3600+(num(f.get('minutes'))||0)*60+(num(f.get('seconds'))||0);
  const h=Math.floor(totalSeconds/3600);
  const m=Math.floor((totalSeconds%3600)/60);
  const s=totalSeconds%60;
  const durationLabel=h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  await LTDB.put('cardio',{
    id:uid(),date:todayKey(),type:f.get('type'),
    distance:num(f.get('distance')),durationSeconds:totalSeconds,durationLabel,
    heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),
    elevationGain:num(f.get('elevation')),calories:num(f.get('calories')),
    source:'manual',createdAt:new Date().toISOString()
  });
  $('#sheet').close();
  toast('Activité Cardio enregistrée');
  render();
}
async function saveFood(e){e.preventDefault();const f=new FormData(e.currentTarget);await LTDB.put('food',{id:uid(),date:todayKey(),description:f.get('description'),protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),classic:f.get('classic')==='on',source:'companion',confidence:'user_confirmed',createdAt:new Date().toISOString()});$('#sheet').close();toast('Repas enregistré · visible dans Alimentation');render();}

function showFatalBootError(err){
  console.error('Boot error',err);
  const main=document.querySelector('#main');
  if(main){
    main.innerHTML=`<section class="hero"><div class="hello">Luis Transformation</div>
      <div class="subtle">Le démarrage a rencontré un problème.</div></section>
      <div class="card"><h3>L’app reste récupérable.</h3>
      <p class="subtle">Aucune donnée n’a été supprimée. Recharge la page. Une erreur de démarrage ne laissera plus un écran blanc.</p></div>`;
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>init().catch(showFatalBootError),{once:true});
}else{
  init().catch(showFatalBootError);
}

