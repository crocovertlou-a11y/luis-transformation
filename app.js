const $ = s => document.querySelector(s);
const state = { route:'home', homeView:'today', profile:null, online:navigator.onLine };
const todayKey = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

async function init(){
  await LTDB.open(); await LTDB.migrateLegacy();
  state.profile = await LTDB.get('profile','me') || {
    id:'me', firstName:'Luis', initials:'LS', goal:'Évoluer avec constance', nutritionEnabled:true,
    createdAt:new Date().toISOString(), onboardingCompleted:true
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
  const main=$('#main');
  let html='';
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
  const protein=food.filter(x=>x.date===todayKey()).reduce((s,x)=>s+(Number(x.protein)||0),0);
  const view=state.homeView;
  return `
  <section class="hero"><div class="hello">Bonjour ${escapeHtml(state.profile.firstName)}.</div><div class="subtle">${view==='today'?'Ce qui compte maintenant.':'Ce que ton parcours raconte.'}</div></section>
  <div class="segmented"><button data-home-view="today" class="${view==='today'?'active':''}">Aujourd’hui</button><button data-home-view="evolution" class="${view==='evolution'?'active':''}">Évolution</button></div>
  ${view==='today' ? renderToday(today,todayWorkout,cardio,protein) : await renderEvolution(checkins,workouts,cardio,food)}
  `;
}
function renderToday(today,todayWorkout,cardio,protein){
  const recovery = today ? recoveryText(today) : 'Je n’ai pas encore assez d’informations sur ta journée.';
  const proteinTarget = state.profile.proteinTarget || 170;
  return `
    <div class="card primary-card"><div class="attention"><svg class="mini-fluidity" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><h3>${today?'Tout est cohérent pour commencer.':'On commence simplement.'}</h3><p>${recovery}</p></div></div></div>
    <div class="section-title"><h2>Aujourd’hui</h2><span class="status">${new Intl.DateTimeFormat('fr-CH',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span></div>
    <div class="card clickable" data-open="checkin"><div class="card-kicker">Ressenti</div><h3>${today?'Point du jour enregistré':'Comment vas-tu aujourd’hui ?'}</h3>${today?`<div class="metric-row"><div class="metric"><strong>${today.sleep||'—'}</strong><small>Sommeil h</small></div><div class="metric"><strong>${today.energy||'—'}/5</strong><small>Énergie</small></div><div class="metric"><strong>${today.stress||'—'}/5</strong><small>Stress</small></div></div>`:'<p class="subtle">Quelques secondes suffisent. Tout est facultatif.</p>'}</div>
    <div class="card clickable" data-route-card="training"><div class="card-kicker">Entraînement</div><h3>${todayWorkout?escapeHtml(todayWorkout.name||'Séance enregistrée'):'Aucune séance planifiée'}</h3><p class="subtle">Force et Cardio vivent ici sans transformer l’app en tracker spécialisé.</p><div class="card-actions"><button class="action secondary">Voir l’entraînement</button></div></div>
    ${state.profile.nutritionEnabled?`<div class="card clickable" data-open="food"><div class="card-kicker">Alimentation</div><h3>${protein?`${Math.round(protein)} / ${proteinTarget} g de protéines`:'Accompagnement actif'}</h3><p class="subtle">${protein?'La donnée est là si elle sert ta décision.':'Ajoute un repas ou laisse le Compagnon apprendre progressivement.'}</p><div class="card-actions"><button class="action secondary">Ajouter un repas</button></div></div>`:''}
  `;
}
async function renderEvolution(checkins,workouts,cardio,food){
  const sorted=checkins.filter(x=>x.weight||x.waist).sort((a,b)=>a.date.localeCompare(b.date));
  const first=sorted[0], last=sorted.at(-1);
  const weightDelta = first?.weight && last?.weight ? +(last.weight-first.weight).toFixed(1) : null;
  const waistDelta = first?.waist && last?.waist ? +(last.waist-first.waist).toFixed(1) : null;
  const recentWorkouts=workouts.filter(x=>daysAgo(x.date)<=30).length;
  const recentCardio=cardio.filter(x=>daysAgo(x.date)<=30).length;
  const reading = sorted.length<2 ? 'Je n’ai pas encore assez de recul pour lire une tendance fiable.' : 'Ton parcours commence à raconter quelque chose de cohérent.';
  return `
    <div class="trend-hero">
      <div class="trend-mark"><svg viewBox="0 0 64 64"><path d="M13 44A23 23 0 0 1 45 12" class="fluidity-arc" style="stroke-width:6"/><path d="M51 19A23 23 0 0 1 20 52" class="fluidity-arc" style="stroke-width:6"/></svg><span class="initials" style="font-size:14px">${escapeHtml(state.profile.initials)}</span></div>
      <div class="trend-copy">${reading}</div><p class="subtle">Je te montre d’abord le sens. Les chiffres restent disponibles si tu veux comprendre davantage.</p>
    </div>
    <div class="signals">
      <div class="signal"><strong>${weightDelta===null?'—':signed(weightDelta)+' kg'}</strong><span>Poids</span></div>
      <div class="signal"><strong>${waistDelta===null?'—':signed(waistDelta)+' cm'}</strong><span>Tour de taille</span></div>
      <div class="signal"><strong>${recentWorkouts+recentCardio}</strong><span>Activités · 30 j</span></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card-kicker">Comprendre</div><h3>Pourquoi cette lecture ?</h3><p class="subtle">Le détail et les graphiques sont volontairement au deuxième niveau.</p><div class="card-actions"><button class="action secondary" data-open="details">Explorer les données</button></div></div>
  `;
}
async function renderTraining(){
  const workouts=(await LTDB.all('workouts')).sort((a,b)=>b.date.localeCompare(a.date));
  const cardio=(await LTDB.all('cardio')).sort((a,b)=>b.date.localeCompare(a.date));
  return `<section class="hero"><div class="hello">Entraînement</div><div class="subtle">Force et Cardio, dans le même environnement.</div></section>
  <div class="card"><div class="card-kicker">Force</div><h3>${workouts.length?`${workouts.length} séance${workouts.length>1?'s':''} enregistrée${workouts.length>1?'s':''}`:'Commencer sans tracker en temps réel'}</h3><p class="subtle">Programme, séance réalisée et ressenti. Le matériel sportif reste le meilleur outil de capture.</p><div class="card-actions"><button class="action" data-open="workout">Ajouter une séance</button></div></div>
  <div class="card"><div class="card-kicker">Cardio</div><h3>${cardio.length?`${cardio.length} activité${cardio.length>1?'s':''} enregistrée${cardio.length>1?'s':''}`:'Course · vélo · natation · marche'}</h3><p class="subtle">Distance, durée, allure/vitesse, cadence ou FC uniquement quand elles sont réellement disponibles.</p><div class="card-actions"><button class="action" data-open="cardio">Ajouter une activité</button></div></div>
  <div class="section-title"><h2>Historique récent</h2></div>
  <div class="card list">${[...workouts.map(x=>({...x,kind:'Force'})),...cardio.map(x=>({...x,kind:'Cardio'}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(x=>`<div class="list-row"><div><strong>${escapeHtml(x.name||x.type||x.kind)}</strong><div class="status">${x.date}</div></div><span class="pill">${x.kind}</span></div>`).join('')||'<div class="empty">Aucune activité enregistrée pour le moment.</div>'}</div>`;
}
async function renderCompanion(){
  const messages=await LTDB.all('events'); const chat=messages.filter(x=>x.type==='CHAT').slice(-8);
  return `<section class="hero"><div class="hello">Compagnon</div><div class="subtle">Présent partout. Bavard seulement quand cela mérite de l’être.</div></section>
  <div class="card primary-card"><div class="attention"><svg class="mini-fluidity" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><h3>Je suis là.</h3><p>Dans Build 0.1, je peux déjà lire le contexte local et expliquer ce qui est enregistré. L’IA distante sera branchée dans un build suivant.</p></div></div></div>
  <div class="card chat" id="chat">${chat.length?chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${escapeHtml(x.text)}</div>`).join(''):'<div class="bubble companion">Je préfère commencer par ce que je sais vraiment : tes données enregistrées ici.</div>'}</div>
  <div class="chatbar"><input id="chatInput" placeholder="Écris une question…"><button id="sendChat">Envoyer</button></div>`;
}
async function renderProfile(){
  return `<section class="hero"><div class="profile-head"><svg class="big-logo" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><div class="hello" style="font-size:28px;margin:0">${escapeHtml(state.profile.firstName)}</div><div class="subtle">${escapeHtml(state.profile.goal||'Ton évolution')}</div></div></div></section>
  <div class="card"><div class="card-kicker">Ce que tu sais de moi</div><div class="list"><div class="list-row"><div><strong>Objectif actuel</strong><div class="status">${escapeHtml(state.profile.goal||'À définir')}</div></div><span class="pill">Confirmé</span></div><div class="list-row"><div><strong>Alimentation</strong><div class="status">${state.profile.nutritionEnabled?'Accompagnement actif':'Masquée'}</div></div><span class="pill">Choix</span></div></div></div>
  <div class="card"><div class="switch-row"><div><strong>Accompagnement alimentation</strong><div class="status">Masqué totalement lorsqu’il est désactivé.</div></div><input id="nutritionToggle" class="toggle" type="checkbox" ${state.profile.nutritionEnabled?'checked':''}></div></div>
  <div class="card"><div class="card-kicker">Tes données</div><h3>Export / Import</h3><p class="subtle">Tes données doivent rester récupérables. Build 0.1 exporte déjà la base locale complète.</p><div class="card-actions"><button class="action" id="exportBtn">Exporter JSON</button><label class="action secondary">Importer JSON<input id="importInput" type="file" accept="application/json" hidden></label></div></div>
  <div class="version">Luis Transformation · Build 0.1 · Offline-first foundation</div>`;
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
function showSheet(html){ $('#sheetContent').innerHTML=html; $('#sheet').showModal(); bindSheet(); }
function openSheet(kind){
  if(kind==='quick') return showSheet(`<h2>Donner quelque chose</h2><div class="sheet-grid"><button class="sheet-choice" data-sheet="checkin">◌<strong>Ressenti</strong></button><button class="sheet-choice" data-sheet="workout">◎<strong>Force</strong></button><button class="sheet-choice" data-sheet="cardio">⌁<strong>Cardio</strong></button>${state.profile.nutritionEnabled?'<button class="sheet-choice" data-sheet="food">◒<strong>Repas</strong></button>':''}</div>`);
  if(kind==='checkin') return showSheet(`<h2>Comment vas-tu aujourd’hui ?</h2><form id="checkinForm"><div class="range-row"><div class="field"><label>Sommeil (h)</label><input name="sleep" type="number" min="0" max="16" step="0.1" inputmode="decimal"></div><div class="field"><label>Énergie (1–5)</label><input name="energy" type="number" min="1" max="5" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>Stress (1–5)</label><input name="stress" type="number" min="1" max="5" inputmode="numeric"></div><div class="field"><label>Poids (kg)</label><input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal"></div></div><div class="field"><label>Tour de taille (cm)</label><input name="waist" type="number" min="30" max="250" step="0.1" inputmode="decimal"></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='workout') return showSheet(`<h2>Ajouter une séance Force</h2><form id="workoutForm"><div class="field"><label>Séance</label><input name="name" placeholder="Haut du corps"></div><div class="range-row"><div class="field"><label>Durée (min)</label><input name="duration" type="number" inputmode="numeric"></div><div class="field"><label>Ressenti (1–5)</label><input name="effort" type="number" min="1" max="5"></div></div><div class="field"><label>Note</label><textarea name="notes" rows="3"></textarea></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='cardio') return showSheet(`<h2>Ajouter une activité Cardio</h2><form id="cardioForm"><div class="field"><label>Type</label><select name="type"><option>Course</option><option>Vélo</option><option>Natation</option><option>Marche</option><option>Autre</option></select></div><div class="range-row"><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal"></div><div class="field"><label>Durée (min)</label><input name="duration" type="number" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" inputmode="numeric"></div><div class="field"><label>Cadence moy.</label><input name="cadence" type="number" inputmode="numeric"></div></div><button class="action" type="submit">Prévisualiser & enregistrer</button></form>`);
  if(kind==='food') return showSheet(`<h2>Ajouter un repas</h2><form id="foodForm"><div class="field"><label>Décris simplement</label><textarea name="description" rows="3" placeholder="Poulet, riz, légumes et un yaourt"></textarea></div><div class="range-row"><div class="field"><label>Protéines estimées (g)</label><input name="protein" type="number" inputmode="decimal"></div><div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1" inputmode="decimal"></div></div><p class="status">Build 0.1 n’invente aucune valeur : laisse vide si tu ne sais pas.</p><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='details') return showSheet(`<h2>Données détaillées</h2><p class="subtle">Le niveau 3 est volontairement séparé d’Évolution. Les graphiques arrivent au Build 0.2 ; le modèle de données est déjà prêt.</p><button class="action secondary" data-close>Fermer</button>`);
}
function bindSheet(){
  document.querySelectorAll('[data-sheet]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.sheet)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#sheet').close()));
  $('#checkinForm')?.addEventListener('submit',saveCheckin); $('#workoutForm')?.addEventListener('submit',saveWorkout); $('#cardioForm')?.addEventListener('submit',saveCardio); $('#foodForm')?.addEventListener('submit',saveFood);
}
async function saveCheckin(e){e.preventDefault(); const f=new FormData(e.currentTarget); const row={id:todayKey(),date:todayKey(),sleep:num(f.get('sleep')),energy:num(f.get('energy')),stress:num(f.get('stress')),weight:num(f.get('weight')),waist:num(f.get('waist')),updatedAt:new Date().toISOString()}; await LTDB.put('checkins',row); $('#sheet').close(); toast('Point du jour enregistré'); render();}
async function saveWorkout(e){e.preventDefault(); const f=new FormData(e.currentTarget); await LTDB.put('workouts',{id:uid(),date:todayKey(),name:f.get('name')||'Séance Force',duration:num(f.get('duration')),effort:num(f.get('effort')),notes:f.get('notes')||'',source:'manual',createdAt:new Date().toISOString()}); $('#sheet').close(); toast('Séance Force enregistrée'); render();}
async function saveCardio(e){e.preventDefault(); const f=new FormData(e.currentTarget); await LTDB.put('cardio',{id:uid(),date:todayKey(),type:f.get('type'),distance:num(f.get('distance')),duration:num(f.get('duration')),heartRateAvg:num(f.get('hr')),cadenceAvg:num(f.get('cadence')),source:'manual',createdAt:new Date().toISOString()}); $('#sheet').close(); toast('Activité Cardio enregistrée'); render();}
async function saveFood(e){e.preventDefault(); const f=new FormData(e.currentTarget); await LTDB.put('food',{id:uid(),date:todayKey(),dateTime:new Date().toISOString(),description:f.get('description')||'Repas',protein:num(f.get('protein')),water:num(f.get('water')),source:'manual',confidence:'user',createdAt:new Date().toISOString()}); $('#sheet').close(); toast('Repas enregistré'); render();}
async function sendChat(){const input=$('#chatInput'); const text=input?.value.trim(); if(!text)return; await LTDB.put('events',{id:uid(),type:'CHAT',role:'user',text,createdAt:new Date().toISOString()}); const context=await localCompanion(text); await LTDB.put('events',{id:uid(),type:'CHAT',role:'companion',text:context,createdAt:new Date().toISOString()}); render();}
async function localCompanion(text){const low=text.toLowerCase(); const checkins=await LTDB.all('checkins'); const latest=checkins.sort((a,b)=>b.date.localeCompare(a.date))[0]; if(/(comment|vais|aujourd)/.test(low)){ if(!latest) return 'Je ne sais pas encore suffisamment bien. Donne-moi simplement ton ressenti du jour et je pourrai commencer à te répondre avec plus de contexte.'; return `Aujourd’hui, tu as indiqué ${latest.sleep?latest.sleep+' h de sommeil, ':''}${latest.energy?'une énergie de '+latest.energy+'/5 et ':''}${latest.stress?'un stress de '+latest.stress+'/5.':''} Je garde le constat simple pour le moment.`; } if(/(sais|connais|mémoire)/.test(low)) return `Je sais ce que tu m’as explicitement donné : ton objectif « ${state.profile.goal} » et les données enregistrées dans cette app. Je ne transforme pas une supposition en fait.`; return 'Build 0.1 fonctionne encore sans IA distante. Je peux utiliser ton contexte local, mais je préfère te dire clairement quand je ne sais pas encore.';}
async function exportData(){const dump=await LTDB.dump(); const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`luis-transformation-${todayKey()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Export préparé');}
async function importData(e){const file=e.target.files?.[0]; if(!file)return; try{const payload=JSON.parse(await file.text()); await LTDB.restore(payload); state.profile=await LTDB.get('profile','me')||state.profile; toast('Import terminé'); render();}catch(err){toast('Import impossible · fichier invalide');}}
function recoveryText(x){if(x.energy&&x.energy<=2)return 'Ton énergie est basse aujourd’hui. Je ne vais pas surinterpréter : adapte seulement si ton ressenti le confirme.'; if(x.sleep&&x.sleep<6)return 'La nuit a été courte. Une donnée isolée ne suffit pas à changer le programme, mais je la garde en contexte.'; return 'Rien de particulier ne mérite ton attention pour le moment.';}
function daysAgo(date){return Math.floor((Date.now()-new Date(date+'T00:00:00').getTime())/86400000)}
function signed(n){return n>0?`+${n}`:`${n}`}
function num(v){return v===''||v===null?null:Number(v)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
init();
