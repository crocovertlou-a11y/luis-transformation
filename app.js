const $ = s => document.querySelector(s);
const state = { route:'home', homeView:'today', profile:null, online:navigator.onLine };
const todayKey = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const PHOTO_PRIVACY_STORAGE='fluidite_photo_privacy_v1';
const PHOTO_VAULT_TTL_MS=3*60*1000;
let photoVaultSession={unlocked:false,expiresAt:0,timer:null};
let photoVaultSheetActive=false;
function b64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromB64url(v=''){const s=String(v).replace(/-/g,'+').replace(/_/g,'/');const padded=s+'='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(padded),c=>c.charCodeAt(0))}
function photoPrivacyConfig(){try{return JSON.parse(localStorage.getItem(PHOTO_PRIVACY_STORAGE)||'null')||{enabled:true,method:null}}catch{return {enabled:true,method:null}}}
function savePhotoPrivacyConfig(cfg){localStorage.setItem(PHOTO_PRIVACY_STORAGE,JSON.stringify({...cfg,enabled:true,updatedAt:new Date().toISOString()}))}
function photoVaultUnlocked(){return photoVaultSession.unlocked&&Date.now()<photoVaultSession.expiresAt}
function touchPhotoVault(){if(!photoVaultSession.unlocked)return;photoVaultSession.expiresAt=Date.now()+PHOTO_VAULT_TTL_MS;clearTimeout(photoVaultSession.timer);photoVaultSession.timer=setTimeout(()=>lockPhotoVault('timeout'),PHOTO_VAULT_TTL_MS+150)}
function lockPhotoVault(reason='manual',refresh=true){photoVaultSession.unlocked=false;photoVaultSession.expiresAt=0;clearTimeout(photoVaultSession.timer);photoVaultSession.timer=null;if(photoVaultSheetActive&&$('#sheet')?.open){photoVaultSheetActive=false;$('#sheet').close()}if(refresh&&state.route==='home'&&state.homeView==='evolution')render();if(reason==='manual')toast('Photos verrouillées')}
async function hashPhotoPin(pin,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromB64url(salt),iterations:180000,hash:'SHA-256'},material,256);return b64url(bits)}
function webAuthnAvailable(){return !!(window.PublicKeyCredential&&navigator.credentials?.create&&navigator.credentials?.get&&window.isSecureContext)}
async function setupPhotoBiometric(){if(!webAuthnAvailable())throw new Error('BIOMETRY_UNAVAILABLE');const challenge=crypto.getRandomValues(new Uint8Array(32)),userId=crypto.getRandomValues(new Uint8Array(32));const cred=await navigator.credentials.create({publicKey:{challenge,rp:{name:'Fluidité'},user:{id:userId,name:'fluidite-photos',displayName:'Fluidité · Photos'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},timeout:60000,attestation:'none'}});if(!cred?.rawId)throw new Error('BIOMETRY_SETUP_FAILED');savePhotoPrivacyConfig({method:'webauthn',credentialId:b64url(cred.rawId)});photoVaultSession.unlocked=true;touchPhotoVault();return true}
async function unlockPhotoBiometric(){const cfg=photoPrivacyConfig();if(!cfg.credentialId)return setupPhotoBiometric();if(!webAuthnAvailable())throw new Error('BIOMETRY_UNAVAILABLE');const assertion=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:fromB64url(cfg.credentialId)}],userVerification:'required',timeout:60000}});if(!assertion?.rawId||b64url(assertion.rawId)!==cfg.credentialId)throw new Error('BIOMETRY_FAILED');photoVaultSession.unlocked=true;touchPhotoVault();return true}
async function setupPhotoPin(){if(!crypto?.subtle)throw new Error('PIN_UNAVAILABLE');const pin=prompt('Choisis un code Fluidité (au moins 6 caractères) pour protéger tes photos :');if(!pin)return false;if(pin.length<6){toast('Utilise au moins 6 caractères');return false}const confirmPin=prompt('Confirme le code Fluidité :');if(pin!==confirmPin){toast('Les codes ne correspondent pas');return false}const salt=b64url(crypto.getRandomValues(new Uint8Array(16))),pinHash=await hashPhotoPin(pin,salt);savePhotoPrivacyConfig({method:'pin',pinSalt:salt,pinHash});photoVaultSession.unlocked=true;touchPhotoVault();return true}
async function unlockPhotoPin(){const cfg=photoPrivacyConfig();if(!cfg.pinHash)return setupPhotoPin();const pin=prompt('Code Fluidité pour afficher tes photos :');if(!pin)return false;const test=await hashPhotoPin(pin,cfg.pinSalt);if(test!==cfg.pinHash){toast('Code incorrect');return false}photoVaultSession.unlocked=true;touchPhotoVault();return true}
function photoVaultLockSheet(message='Tes photos d’évolution sont masquées par défaut.'){
  const cfg=photoPrivacyConfig(),biometricLabel=cfg.method==='webauthn'?'Déverrouiller avec Face ID / Touch ID':'Activer Face ID / Touch ID';
  showSheet(`<div class="photo-vault-lock"><div class="photo-vault-icon">◉</div><div class="card-kicker">COFFRE PHOTOS</div><h2>Photos protégées</h2><p class="subtle">${escapeHtml(message)} Fluidité ne reçoit jamais tes données biométriques : la vérification est gérée par iOS.</p><div class="photo-vault-actions">${webAuthnAvailable()?`<button class="action" type="button" id="unlockPhotoBiometric">${biometricLabel}</button>`:''}<button class="action secondary" type="button" id="unlockPhotoPin">${cfg.method==='pin'?'Déverrouiller avec mon code':'Utiliser un code Fluidité'}</button></div><p class="photo-vault-note">Le coffre se reverrouille quand l’app passe en arrière-plan et après quelques minutes d’inactivité.</p></div>`);
  $('#unlockPhotoBiometric')?.addEventListener('click',async()=>{try{await unlockPhotoBiometric();$('#sheet').close();document.dispatchEvent(new Event('fluidite-photo-unlocked'));toast('Photos déverrouillées');render()}catch(err){console.error(err);toast(err?.name==='NotAllowedError'?'Déverrouillage annulé':'Face ID / Touch ID indisponible')}});
  $('#unlockPhotoPin')?.addEventListener('click',async()=>{try{if(await unlockPhotoPin()){$('#sheet').close();document.dispatchEvent(new Event('fluidite-photo-unlocked'));toast('Photos déverrouillées');render()}}catch(err){console.error(err);toast('Impossible de configurer le code')}});
}
async function ensurePhotoVaultUnlocked(afterUnlock=null,message){if(photoVaultUnlocked()){touchPhotoVault();if(afterUnlock)afterUnlock();return true}const cfg=photoPrivacyConfig();photoVaultLockSheet(message||(!cfg.method?'Configure une protection pour ouvrir ta galerie.':'Authentifie-toi pour ouvrir ta galerie.'));if(afterUnlock){const handler=()=>{if(photoVaultUnlocked()){document.removeEventListener('fluidite-photo-unlocked',handler);afterUnlock()}};document.addEventListener('fluidite-photo-unlocked',handler,{once:true})}return false}
function openPhotoSensitiveSheet(html,backAction=null){photoVaultSheetActive=true;touchPhotoVault();showSheet(html,backAction)}

async function init(){
  await LTDB.open(); await LTDB.migrateLegacy();
  state.profile = await LTDB.get('profile','me') || {
    id:'me', firstName:'Luis', initials:'LS', goal:'Évoluer avec constance', nutritionEnabled:true,
    proteinTarget:170, createdAt:new Date().toISOString(), onboardingCompleted:true
  };
  await LTDB.put('profile',state.profile);
  try{await LTDB.autoSnapshot();}catch(err){console.warn('AUTO_BACKUP_FAILED',err);}
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
  $('#sheet').addEventListener('close',()=>{if(photoVaultSheetActive){photoVaultSheetActive=false;lockPhotoVault('sheet-close',state.route==='home'&&state.homeView==='evolution')}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)lockPhotoVault('background')});
  window.addEventListener('pagehide',()=>lockPhotoVault('background',false));
  // V2.10.4.2: delegated action for the dynamically-rendered training recommendation.
  // This avoids fragile per-render listeners and opens exactly the workout shown on the card.
  $('#main')?.addEventListener('click',async e=>{
    const btn=e.target?.closest?.('#startSuggestedTraining');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    if(btn.dataset.busy==='1')return;
    btn.dataset.busy='1';
    const previous=btn.textContent;
    try{
      const id=btn.dataset.suggestedWorkout||'upper';
      const workout=workoutById(id);
      if(!workout){toast('Séance indisponible');return;}
      await workoutDetailSheet(workout);
    }catch(err){
      console.error('Unable to open suggested workout',err);
      toast('Impossible d’ouvrir la séance');
    }finally{
      btn.dataset.busy='0';
      btn.textContent=previous;
    }
  });
}
function navigate(route){ if(photoVaultUnlocked())lockPhotoVault('leave-photos',false); state.route=route; document.querySelectorAll('.nav-item[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===route)); render(); $('#main').focus(); }
async function render(){
  const main=$('#main'); let html='';
  const brand=document.querySelector('.brand-title'); if(brand) brand.textContent=state.route==='home'?'FLUIDITÉ':(state.route==='training'?'Entraînement':state.route==='companion'?'Compagnon':'Profil');
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
  if(view==='evolution') return `<div class="today-backline"><button class="action ghost" data-home-view="today">‹ Aujourd’hui</button></div>${await renderEvolution(checkins,workouts,cardio)}`;
  return `<section class="today-welcome"><h1>Bonjour ${escapeHtml(state.profile.firstName)} <span>👋</span></h1><p>Prêt à prendre soin de toi aujourd’hui ?</p></section>${await renderToday(today,todayWorkout,todayCardio,protein,calories,todayFood.length)}`;
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



function dateKeyFromDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatNutritionDate(key){
  const d=new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
}
function monthLabel(year,month){
  return new Intl.DateTimeFormat('fr-CH',{month:'long',year:'numeric'}).format(new Date(year,month,1));
}

function previousDayKey(dateKey=todayKey()){
  const d=new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  const preview=rows.slice(0,3).map(x=>x.description||'Aliment').filter(Boolean).join(', ');
  const details=rows.length
    ? `<div class="meal-items">${rows.map(x=>`<button type="button" class="meal-item-row" data-edit-food="${x.id}"><span>${escapeHtml(x.description||'Aliment')}</span><small>${x.calories?Math.round(x.calories)+' kcal':''}${x.protein?` · ${Math.round(x.protein)} g prot.`:''}</small><b>›</b></button>`).join('')}</div>`
    : '';
  return `<section class="nutrition-meal-card nutrition-meal-card-v2">
    <div class="nutrition-meal-head">
      <div class="nutrition-meal-title"><span class="nutrition-meal-icon">${mealIcon(type)}</span><div><strong>${mealTypeLabel(type)}</strong><small>${rows.length?`${Math.round(sum.calories)} kcal · ${Math.round(sum.protein)} g prot.`:'À compléter'}</small>${preview?`<em>${escapeHtml(preview)}${rows.length>3?'…':''}</em>`:''}</div></div>
      <div class="nutrition-meal-actions"><button type="button" class="nutrition-meal-add" data-meal-add="${type}">＋ Ajouter</button><button type="button" class="nutrition-copy-yesterday" data-copy-yesterday="${type}">▣ Copier hier</button></div>
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

function fluidityIntensityFromCardio(x){
  const type=String(x.type||'').toLowerCase(),dist=Number(x.distance)||0,dur=Number(x.durationMin)||0,hr=Number(x.avgHr)||Number(x.heartRate)||0;
  if(/fraction|interval|tempo|course|race/.test(type)||dist>=12||dur>=75||hr>=165)return 'high';
  if(dist>=8||dur>=45||hr>=145)return 'moderate_high';
  return 'moderate';
}
function fluidityNutritionContext(food){
  food=Array.isArray(food)?food:[];
  const today=todayKey(),target=Number(state.profile.proteinTarget)||170;
  const rows=food.filter(x=>x.date===today);
  const protein=rows.reduce((a,x)=>a+(Number(x.protein)||0),0);
  const calories=rows.reduce((a,x)=>a+(Number(x.calories)||0),0);
  const hour=new Date().getHours();
  const proteinRatio=target>0?protein/target:0;
  // Nutrition is a context signal, never a standalone reason to cancel training.
  let support='unknown';
  if(rows.length){
    if(hour>=16 && proteinRatio<.5) support='low';
    else if(proteinRatio>=.7) support='good';
    else support='partial';
  }
  return {rows:rows.length,protein,calories,target,proteinRatio,hour,support};
}

function fluidityTrajectory(workouts,cardio,checkins){
  workouts=Array.isArray(workouts)?workouts:[];
  cardio=Array.isArray(cardio)?cardio:[];
  checkins=Array.isArray(checkins)?checkins:[];
  const recentForce=workouts.filter(x=>daysAgo(x.date)>=1&&daysAgo(x.date)<=7);
  const previousForce=workouts.filter(x=>daysAgo(x.date)>=8&&daysAgo(x.date)<=21);
  const recentCardio=cardio.filter(x=>daysAgo(x.date)>=1&&daysAgo(x.date)<=7);
  const recentCheckins=checkins.filter(x=>daysAgo(x.date)>=1&&daysAgo(x.date)<=7);

  const efforts=recentForce.map(x=>Number(x.effort)).filter(Number.isFinite);
  const avgEffort=efforts.length?efforts.reduce((a,b)=>a+b,0)/efforts.length:null;
  const lowRecovery=recentCheckins.filter(x=>Number(x.recovery)>0&&Number(x.recovery)<=2).length;
  const lowEnergy=recentCheckins.filter(x=>Number(x.energy)>0&&Number(x.energy)<=2).length;
  const shortSleep=recentCheckins.filter(x=>Number(x.sleep)>0&&Number(x.sleep)<6).length;
  const hardCardio=recentCardio.filter(x=>['high','moderate_high'].includes(fluidityIntensityFromCardio(x))).length;
  const load7=recentForce.length+recentCardio.length;

  let fatigue='normal';
  const fatigueSignals=(avgEffort!=null&&avgEffort>=4?1:0)+(lowRecovery>=2?1:0)+(lowEnergy>=2?1:0)+(shortSleep>=2?1:0)+(load7>=7?1:0)+(hardCardio>=3?1:0);
  if(fatigueSignals>=3) fatigue='high';
  else if(fatigueSignals>=2) fatigue='watch';

  // Learning-loop trend: use persisted proposed-vs-realized signals rather than inventing performance scores.
  const learned=recentForce.flatMap(w=>w.coach?.learning?.exercises||[]);
  const above=learned.filter(x=>x.signal==='above').length;
  const below=learned.filter(x=>x.signal==='below').length;
  let progression='insufficient';
  if(learned.length>=3){
    if(above>=2&&above>below) progression='progressing';
    else if(below>=2&&below>above) progression='struggling';
    else progression='stable';
  }
  return {fatigue,fatigueSignals,progression,above,below,learned:learned.length,load7,force7:recentForce.length,cardio7:recentCardio.length,previousForce:previousForce.length};
}

function fluidityEngine(today,todayWorkout,todayCardio,workouts,cardio,food,checkins){
  todayCardio=Array.isArray(todayCardio)?todayCardio:[];
  workouts=Array.isArray(workouts)?workouts:[];
  cardio=Array.isArray(cardio)?cardio:[];
  food=Array.isArray(food)?food:[];
  const allowed=['planned_session','adapted_session','alternative_session','recovery','day_complete','insufficient_data'];
  if(!today)return {decision:'insufficient_data',allowedActions:['insufficient_data'],confidence:'high',priority:'high',shouldSpeak:true,title:'Comment vas-tu aujourd’hui ?',message:'Donne-moi ton ressenti et je t’aide à construire ta journée.',action:'checkin'};
  const energy=Number(today.energy)||3,stress=Number(today.stress)||3,sleep=Number(today.sleep)||7;
  const nutrition=fluidityNutritionContext(food);
  const trajectory=fluidityTrajectory(workouts,cardio,checkins);
  const recentActs=[...workouts,...cardio].filter(x=>daysAgo(x.date)>=1&&daysAgo(x.date)<=3);
  const recentHeavy=recentActs.length>=3;
  const cardioLoad=todayCardio.some(x=>fluidityIntensityFromCardio(x)==='high')?'high':todayCardio.some(x=>fluidityIntensityFromCardio(x)==='moderate_high')?'moderate_high':todayCardio.length?'moderate':'none';
  if(todayWorkout){
    return {decision:'day_complete',allowedActions:['day_complete','recovery'],confidence:'high',priority:'low',shouldSpeak:true,title:'Journée accomplie',message:'Belle séance aujourd’hui. Tu as fait ce qu’il fallait — profite maintenant de la récupération.',action:null};
  }
  if(cardioLoad==='high'||cardioLoad==='moderate_high'){
    return {decision:'alternative_session',allowedActions:['alternative_session','recovery','day_complete'],confidence:'high',priority:'high',shouldSpeak:true,title:'Ta journée a déjà bien commencé',message:'Ta sortie a déjà bien sollicité les jambes. Si tu veux t’entraîner encore, privilégie plutôt le haut du corps ou garde simplement la récupération.',action:'training'};
  }
  if(trajectory.fatigue==='high' && energy<=3){
    return {decision:'recovery',allowedActions:['adapted_session','recovery'],confidence:'high',priority:'high',shouldSpeak:true,title:'La tendance invite à lever le pied',message:`Je vois plusieurs signaux de fatigue sur les 7 derniers jours. Aujourd’hui, je privilégie récupération ou séance très légère plutôt que de pousser la progression.`,action:'training',nutritionContext:nutrition,trajectory};
  }
  if(trajectory.fatigue==='watch' && energy<=3){
    return {decision:'adapted_session',allowedActions:['planned_session','adapted_session','recovery'],confidence:'medium',priority:'high',shouldSpeak:true,title:'Je garde un œil sur la fatigue',message:'La tendance des derniers jours montre plusieurs signaux à surveiller. Tu peux t’entraîner, mais je garde la progression prudente aujourd’hui.',action:'training',nutritionContext:nutrition,trajectory};
  }
  const lowSignals=(energy<=2?1:0)+(stress>=4?1:0)+(sleep<6?1:0)+(Number(today?.recovery||3)<=2?1:0);
  if(energy<=1){
    const nutritionNote=nutrition.support==='low'?' Ton alimentation enregistrée est encore légère aujourd’hui : pense aussi à soutenir ta récupération avec un repas complet selon ta faim.':'';
    return {decision:'adapted_session',allowedActions:['adapted_session','recovery'],confidence:'high',priority:'high',shouldSpeak:true,title:'Aujourd’hui, on adapte',message:'Ton énergie est très basse. Je garde l’entraînement possible, mais sans chercher une progression agressive : priorité au mouvement propre et à une séance maîtrisée.'+nutritionNote,action:'training',nutritionContext:nutrition};
  }
  if(lowSignals>=2||recentHeavy&&energy<=3){
    return {decision:'recovery',allowedActions:['adapted_session','recovery','day_complete'],confidence:'high',priority:'high',shouldSpeak:true,title:'Allège aujourd’hui',message:'Plusieurs signaux vont dans le même sens. Je privilégierais une journée légère plutôt que de forcer la séance prévue.',action:'training'};
  }
  if(sleep<6&&energy>=4){
    return {decision:'planned_session',allowedActions:['planned_session','adapted_session'],confidence:'medium',priority:'low',shouldSpeak:true,title:'Séance maintenue',message:'Tes sensations sont bonnes malgré une nuit courte. Garde la séance prévue et reste attentif à ton énergie pendant l’échauffement.',action:'training'};
  }
  if(nutrition.support==='low' && nutrition.hour>=16){
    return {decision:'adapted_session',allowedActions:['planned_session','adapted_session'],confidence:'medium',priority:'low',shouldSpeak:true,title:'Séance maintenue, progression prudente',message:`Ton ressenti permet de t’entraîner. En revanche, tes apports enregistrés sont encore légers aujourd’hui (${Math.round(nutrition.protein)} g de protéines sur ${nutrition.target} g) : je garde la séance, mais je ne pousse pas une hausse agressive des charges.`,action:'training',nutritionContext:nutrition};
  }
  return {decision:'planned_session',allowedActions:['planned_session','adapted_session'],confidence:'high',priority:'low',shouldSpeak:true,title:'Tu peux suivre le plan',message:'Ton ressenti est cohérent avec une séance normale aujourd’hui.',action:'training',nutritionContext:nutrition};
}
function fluidityNutritionComment(decision,todayCardio,protein,calories,foodCount){
  if(!foodCount)return null;
  const hour=new Date().getHours(),target=Number(state.profile.proteinTarget)||170,remaining=Math.max(0,Math.round(target-protein));
  const hard=todayCardio.some(x=>['high','moderate_high'].includes(fluidityIntensityFromCardio(x)));
  if(remaining<=10)return null;
  if(hour<14)return {text:`Tu es à ${Math.round(protein)} g sur ${target} g de protéines. Tu as encore plusieurs repas pour avancer naturellement vers ton repère.`,suggest:false};
  if(hard&&hour>=16&&(protein<target*.75||calories<1500))return {text:`Ta journée a été active. Il te reste environ ${remaining} g de protéines : je peux te proposer un repas complet pour accompagner la récupération.`,suggest:true};
  if(hour>=18&&protein<target*.8)return {text:`Il te reste environ ${remaining} g de protéines aujourd’hui. Je peux te proposer un repas réaliste selon ce qu’il reste à couvrir.`,suggest:true};
  if(decision==='day_complete'&&hour>=17)return {text:'Après ta séance, garde simplement un repas complet selon ta faim. Je peux te proposer quelques idées si tu veux.',suggest:true};
  return {text:`Tu es à ${Math.round(protein)} g sur ${target} g de protéines. Pas besoin de forcer : répartis simplement le reste sur les prochains repas.`,suggest:false};
}

async function renderToday(today,todayWorkout,todayCardio,protein,calories,foodCount){
  todayCardio=Array.isArray(todayCardio)?todayCardio:[];
  protein=Number(protein)||0;
  calories=Number(calories)||0;
  foodCount=Number(foodCount)||0;

  const [workoutsAll,cardioAll,foodAll,checkinsAll]=await Promise.all(['workouts','cardio','food','checkins'].map(s=>LTDB.all(s)));
  const decision=fluidityEngine(today,todayWorkout,todayCardio,workoutsAll,cardioAll,foodAll,checkinsAll);
  const nutritionAdvice=fluidityNutritionComment(decision.decision,todayCardio,protein,calories,foodCount);
  const todayFood=foodAll.filter(x=>x.date===todayKey());
  const water=todayFood.reduce((n,x)=>n+(Number(x.water)||0),0), waterTarget=3;
  const recovery=today?.recovery!=null?Number(today.recovery):null;
  const metric=(icon,label,val,n,kind='purple')=>`<div class="today-vital ${kind}"><div class="vital-label"><span>${icon}</span>${label}</div><strong>${val}</strong><div class="vital-track"><i style="width:${Math.max(8,Math.min(100,n))}%"></i></div></div>`;
  const vitals=today?`${metric('⚡','Énergie',`${today.energy??'—'}/5`,Number(today.energy||0)*20,'orange')}${metric('◉','Stress',`${today.stress??'—'}/5`,Number(today.stress||0)*20,'purple')}${metric('☾','Sommeil',today.sleep!=null?`${today.sleep}h`:'—',Math.min(100,Number(today.sleep||0)/8*100),'blue')}${metric('♡','Récupération',recovery!=null?`${recovery}/5`:'—',recovery!=null?recovery*20:50,'green')}${metric('◔','Faim',`${today.hunger??'—'}/5`,Number(today.hunger||0)*20,'orange')}`:'';
  const checkin=`<section class="today-wellbeing clickable" data-open="checkin"><div class="today-card-head"><h2>♡ &nbsp;Comment vas-tu aujourd’hui ?</h2><span>${today?'Modifier ›':'Renseigner ›'}</span></div>${today?`<div class="today-vitals">${vitals}</div>`:`<div class="today-empty-feel">Quelques secondes suffisent pour adapter ta journée.</div>`}<div class="hydration-line" data-open="hydrationQuick"><div><span class="water-icon">💧</span><strong>Hydratation</strong> <b>${water.toFixed(1).replace('.',',')} L / ${waterTarget} L</b></div><div class="water-drops">${Array.from({length:6},(_,i)=>`<i class="${i<Math.round(water/waterTarget*6)?'on':''}">●</i>`).join('')} <span>›</span></div></div></section>`;
  const recommendation=today?`<section class="today-companion-card"><div class="companion-left"><div class="today-kicker">✦ &nbsp;Fluidité te recommande</div><h2>${escapeHtml(decision.title)}</h2><p>${escapeHtml(decision.message)}</p><div class="session-mini"><div class="session-icon">⌁</div><div class="session-copy"><strong>${decision.decision==='alternative_session'?'Séance Force – Haut du corps':decision.decision==='recovery'?'Récupération active':decision.decision==='day_complete'?'Journée accomplie':'Séance Force – adaptée à toi'}</strong><small>${decision.decision==='day_complete'?'La récupération fait partie de la progression.':'Une proposition cohérente avec ta disponibilité du jour.'}</small></div><span class="adapt-pill">Adaptée pour toi</span><div class="session-stats"><span>◷ <b>${decision.decision==='recovery'?'20':decision.decision==='adapted_session'?'30–40':'40'} min</b></span><span>◎ <b>${decision.decision==='recovery'?'Mobilité':decision.decision==='adapted_session'?'Force contrôlée':'Force & volume'}</b></span><span>▥ <b>${decision.decision==='recovery'?'Légère':decision.decision==='adapted_session'?'Modérée −':'Modérée'}</b></span><span>♡ <b>${decision.confidence==='high'?'Bonne':'À écouter'}</b></span></div></div><div class="companion-actions">${decision.action==='training'?'<button class="action secondary outline" data-fluidity-force="detail">Voir le détail</button><button class="action orange" data-fluidity-force="start">Démarrer la séance</button>':'<button class="action secondary outline" data-open="checkin">Réévaluer</button>'}</div>${nutritionAdvice?`<div class="fluidity-nutrition-advice"><span>${escapeHtml(nutritionAdvice.text)}</span>${nutritionAdvice.suggest?'<button class="nutrition-proposal-btn" data-nutrition-proposals>Me proposer un repas</button>':''}</div>`:''}</div><div class="companion-right"><div class="fluidity-breath today-big-breath">${companionMark('companion-mark-large')}</div><h3>Respire.<br><em>Recentre-toi.</em><br><b>Avance.</b></h3><i></i><p>Un pas après l’autre,<br>avec régularité<br>et bienveillance.</p></div></section>`:`<section class="today-companion-card empty-companion"><div class="companion-left"><div class="today-kicker">✦ &nbsp;Ton compagnon Fluidité</div><h2>Je m’adapte à toi.</h2><p>Renseigne ton ressenti pour que je puisse te proposer la meilleure prochaine action.</p><button class="action orange" data-open="checkin">Comment vas-tu ?</button></div><div class="companion-right"><div class="fluidity-breath today-big-breath">${companionMark('companion-mark-large')}</div><h3>Respire.<br><em>Recentre-toi.</em><br><b>Avance.</b></h3></div></section>`;
  const run=todayCardio[0];
  const done=[`<button type="button" class="done-tile green" data-route-card="training"><span>🏃</span><div><strong>Course à pied</strong><small>${run?(run.distance?`${run.distance} km aujourd’hui`:'Activité enregistrée'):'Aucune activité enregistrée'}</small></div></button>`,`<button type="button" class="done-tile orange" data-route-card="training"><span>◉</span><div><strong>Force</strong><small>${todayWorkout?'Séance enregistrée':'Aucune activité enregistrée'}</small></div></button>`,`<button type="button" class="done-tile purple" data-open="nutritionHub"><span>♨</span><div><strong>Alimentation</strong><small>${foodCount?`${Math.round(protein)} g de protéines`:'Aucun repas enregistré'}</small></div></button>`,`<button type="button" class="done-tile blue" data-open="hydrationQuick"><span>▣</span><div><strong>Eau</strong><small>${water?`${water.toFixed(1).replace('.',',')} L enregistrés`:'Aucune donnée enregistrée'}</small></div></button>`].join('');
  const validCheckins=checkinsAll.filter(x=>x.weight!=null||x.waist!=null).sort((a,b)=>a.date.localeCompare(b.date));
  const first=validCheckins[0]||{}, last=validCheckins.at(-1)||{};
  const delta=(a,b,u)=>a!=null&&b!=null?`${(Number(b)-Number(a)>0?'+':'')+(Number(b)-Number(a)).toFixed(1).replace('.',',')} ${u}`:'—';
  const active7=new Set([...workoutsAll,...cardioAll].filter(x=>daysAgo(x.date)<=6).map(x=>x.date)).size;
  const evolution=`<section class="today-evolution clickable" data-home-view="evolution"><div class="today-card-head"><h2>↗ &nbsp;Ton évolution</h2><span>7 derniers jours⌄</span></div><div class="evo-grid"><div><label>Poids</label><strong>${last.weight!=null?`${Number(last.weight).toFixed(1).replace('.',',')} kg`:'— kg'}</strong><small>${delta(first.weight,last.weight,'kg')}</small><i class="spark">⌁⌁</i></div><div><label>Tour de taille</label><strong>${last.waist!=null?`${Number(last.waist).toFixed(1).replace('.',',')} cm`:'— cm'}</strong><small>${delta(first.waist,last.waist,'cm')}</small><i class="spark">⌁⌁</i></div><div><label>Séances</label><strong>${workoutsAll.filter(x=>daysAgo(x.date)<=6).length}</strong><small>7 derniers jours</small><i class="spark">⌁⌁</i></div><div><label>Jours actifs</label><strong>${active7}</strong><small>7 derniers jours</small><i class="spark">⌁⌁</i></div></div></section>`;
  return `${checkin}${recommendation}<section class="today-accomplished"><div class="today-card-head"><h2>⚑ &nbsp;Ce que tu as déjà accompli</h2></div><div class="done-grid">${done}</div></section>${evolution}`;
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
  const explanation=sorted.length<2
    ? 'Il me faut au moins deux mesures comparables pour distinguer une tendance d’une variation ponctuelle. Continue simplement à enregistrer poids, tour de taille et photos dans des conditions similaires.'
    : `Je m’appuie sur tes mesures enregistrées et ton activité récente.${weightDelta!==null?` Poids : ${signed(weightDelta)} kg depuis ta première mesure.`:''}${waistDelta!==null?` Tour de taille : ${signed(waistDelta)} cm.`:''} ${activities?`${activities} activité${activities>1?'s':''} enregistrée${activities>1?'s':''} sur 30 jours.`:'Je manque encore d’activité enregistrée pour relier entraînement et évolution.'} Je regarde surtout la tendance, jamais une mesure isolée.`;
  const photos=(await LTDB.all('photos')).sort((x,y)=>(y.date+y.createdAt).localeCompare(x.date+x.createdAt));
  const unlocked=photoVaultUnlocked();
  const groups={}; photos.forEach(p=>(groups[p.date]??=[]).push(p));
  const gallery=unlocked?Object.entries(groups).slice(0,12).map(([date,items])=>`<div class="photo-date-group"><div class="photo-date">${formatPhotoDate(date)}</div><div class="photo-thumbs">${items.map(p=>`<button class="photo-thumb" data-photo-view="${p.id}" aria-label="${escapeHtml(p.view||'Photo')} ${date}"><img src="${p.image}" alt="${escapeHtml(p.view||'Photo évolution')}"><span>${escapeHtml(p.view||'Photo')}</span></button>`).join('')}</div></div>`).join(''):'';
  return `<div class="trend-hero"><div class="trend-mark"><svg viewBox="0 0 64 64"><path d="M13 44A23 23 0 0 1 45 12" class="fluidity-arc" style="stroke-width:6"/><path d="M51 19A23 23 0 0 1 20 52" class="fluidity-arc" style="stroke-width:6"/></svg><span class="initials" style="font-size:14px">${escapeHtml(state.profile.initials)}</span></div><div class="trend-copy">${reading}</div><p class="subtle">Le sens d’abord. Les graphiques seulement si tu veux creuser.</p></div>
  <div class="signals"><div class="signal"><strong>${latestWeight==null?'—':latestWeight.toFixed(1)+' kg'}</strong><span>Poids${weightDelta===null?'':` · ${signed(weightDelta)} kg`}</span></div><div class="signal"><strong>${latestWaist==null?'—':latestWaist.toFixed(1)+' cm'}</strong><span>Tour de taille${waistDelta===null?'':` · ${signed(waistDelta)} cm`}</span></div><div class="signal"><strong>${activities}</strong><span>Activités · 30 j</span></div></div>
  <div class="card photo-journal"><div class="card-kicker">Photos</div><div class="photo-title-row"><div><h3>Voir le changement</h3><p class="subtle">Même cadrage, même vue, une date. Tes photos restent masquées tant que le coffre est verrouillé.</p></div>${unlocked?`<div class="photo-top-actions"><button class="action secondary compact" type="button" data-open="photoCompare">Comparer</button><button class="action compact" type="button" data-open="progressPhoto">Ajouter</button></div>`:''}</div>${unlocked?(gallery||'<div class="empty">Aucune photo d’évolution enregistrée pour le moment.</div>'):`<button class="photo-vault-preview" type="button" id="unlockPhotoVaultEvolution"><span class="photo-vault-blur-grid"><i></i><i></i><i></i></span><strong>Photos masquées</strong><small>${photos.length?`${photos.length} photo${photos.length>1?'s':''} protégée${photos.length>1?'s':''}`:'Coffre prêt à protéger tes prochaines photos'}</small><b>Déverrouiller</b></button>`}</div>
  <div class="card" style="margin-top:14px"><div class="card-kicker">Comprendre</div><h3>Pourquoi cette lecture ?</h3><p class="subtle">${escapeHtml(explanation)}</p><div class="card-actions"><button class="action secondary" data-open="details">Explorer les données</button></div></div>`;
}
function formatPhotoDate(d){try{return new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'))}catch{return d}}

function fluidityWorkoutForDecision(decision,workouts){
  const base=suggestWorkout(workouts);
  if(decision?.decision==='alternative_session') return workoutById('upper');
  if(decision?.decision==='recovery') return workoutById('recovery');
  return base;
}

async function renderTraining(){
  const workouts=(await LTDB.all('workouts')).sort((a,b)=>b.date.localeCompare(a.date));
  const cardio=(await LTDB.all('cardio')).sort((a,b)=>b.date.localeCompare(a.date));
  let baseSuggestion=suggestWorkout(workouts);

  // V2.1: read the SAME central day decision used on Aujourd’hui.
  // Guarded so Entraînement can never fail to render if context is unavailable.
  let dailyDecision=null;
  try{
    const [checkins,food]=await Promise.all([LTDB.all('checkins'),LTDB.all('food')]);
    const today=todayKey();
    const todayCheckin=checkins.find(x=>x.date===today)||null;
    const todayWorkout=workouts.find(x=>x.date===today)||null;
    const todayCardio=cardio.filter(x=>x.date===today);
    dailyDecision=fluidityEngine(todayCheckin,todayWorkout,todayCardio,workouts,cardio,food,checkins);
  }catch(err){
    console.warn('V2.1 training context unavailable; keeping local suggestion',err);
  }

  baseSuggestion=fluidityWorkoutForDecision(dailyDecision,workouts);

  const mode=dailyDecision?.decision||'planned_session';
  const adapted=mode==='adapted_session';
  const recovery=mode==='recovery';

  const suggestion={
    ...baseSuggestion,
    title: adapted ? `${baseSuggestion.title} · adapté aujourd’hui`
      : recovery ? 'Récupération active'
      : baseSuggestion.title,
    subtitle: adapted
      ? baseSuggestion.subtitle.replace(/~\d+\s*min/, '~30–40 min')
      : recovery ? '~20 min · mobilité + récupération'
      : baseSuggestion.subtitle,
    goalLabel: adapted ? 'Force contrôlée'
      : recovery ? 'Récupération'
      : baseSuggestion.goalLabel,
    reason: (adapted||recovery) && dailyDecision?.message
      ? dailyDecision.message
      : baseSuggestion.reason
  };

  const syncNote=(adapted||recovery)
    ? 'Synchronisé avec ta décision du jour · le Compagnon ne doit pas contredire ce cadre.'
    : 'Suggestion locale immédiate · le Compagnon peut l’affiner avec ton contexte récent.';

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
      <div class="smart-fallback-note">${escapeHtml(syncNote)}</div>
      <div class="card-actions">
        <button class="action orange" id="startSuggestedTraining" type="button" data-suggested-workout="${escapeHtml(recovery?'recovery':(baseSuggestion?.id||suggestion?.id||'upper'))}">${recovery?'Démarrer la récupération active':'Voir et démarrer la séance'}</button>
        <button class="action" id="askSmartTraining" type="button">Affiner avec le Compagnon</button>
        <button class="action secondary" data-open="workoutIdeas">Choisir moi-même</button><button class="text-action" data-open="exerciseLibrary">Bibliothèque d’exercices</button>
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
  const [workouts,cardio,checkins,nutrition]=await Promise.all([LTDB.all('workouts'),LTDB.all('cardio'),LTDB.all('checkins'),LTDB.all('food')]);
  const recent=(rows,days)=>rows.filter(x=>daysAgo(x.date)<=days).sort((a,b)=>b.date.localeCompare(a.date));
  return {
    date:todayKey(),
    force:recent(workouts,14).slice(0,12).map(w=>({date:w.date,name:w.name,duration:w.durationLabel||null,effort:w.effort??null,exercises:(w.exerciseEntries||[]).map(e=>({name:e.name,performance:e.performance||null}))})),
    cardio:recent(cardio,14).slice(0,15).map(c=>({date:c.date,type:c.type,name:c.name||null,distance:c.distance??null,duration:c.durationLabel||null,heartRateAvg:c.heartRateAvg??null,elevationGain:c.elevationGain??null,source:c.importSource||c.source||null})),
    recovery:recent(checkins,7).slice(0,7).map(c=>({date:c.date,sleep:c.sleep??null,stress:c.stress??null,energy:c.energy??null,hunger:c.hunger??null,weight:c.weight??null,waist:c.waist??null})),
    nutrition:recent(nutrition,3).slice(0,20).map(n=>({date:n.date,meal:n.meal||n.type||null,protein:n.protein??null,calories:n.calories??null})),
    constraints:{preferredDurationMin:40,primaryFocus:'force et recomposition corporelle',freedom:'L’utilisateur peut toujours changer la séance'},
    allowedExercises:[...new Set(workoutLibrary().flatMap(w=>w.plan.map(e=>e.name)))],
    availableWorkouts:workoutLibrary().map(w=>({id:w.id,title:w.title,subtitle:w.subtitle,tags:w.tags||[],plan:w.plan})),
    dailyDecision:(()=>{
      try{
        const today=todayKey();
        const todayCheckin=checkins.find(x=>x.date===today)||null;
        const todayWorkout=workouts.find(x=>x.date===today)||null;
        const todayCardio=cardio.filter(x=>x.date===today);
        return fluidityEngine(todayCheckin,todayWorkout,todayCardio,workouts,cardio,nutrition,checkins);
      }catch(err){
        console.warn('V2.1 smart context decision unavailable',err);
        return null;
      }
    })()
  };
}
async function loadSmartTrainingSuggestion(){
  const box=$('#smartTrainingSuggestion'),btn=$('#askSmartTraining');
  if(btn){btn.disabled=true;btn.textContent='Le Compagnon réfléchit…'}
  try{
    const context=await smartTrainingContext();
    const r=await fetch('/.netlify/functions/training-ai-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context})});
    const data=await r.json();if(!r.ok)throw new Error(data.detail||data.error||'Analyse impossible');
    const dd=context.dailyDecision;
    const constrained=dd && ['adapted_session','recovery'].includes(dd.decision);
    state.aiWorkout=data.workout;
    const shownTitle=constrained?(dd.decision==='recovery'?'Récupération active':`${data.workout.title} · adapté aujourd’hui`):data.workout.title;
    const shownGoal=constrained?(dd.decision==='recovery'?'Récupération':'Force contrôlée'):(data.workout.goalLabel||'Force');
    const shownReason=constrained?dd.message:data.reason;
    box.innerHTML=`<div class="training-v2-head"><div><h3>${escapeHtml(shownTitle)}</h3><p class="subtle">${escapeHtml(data.workout.subtitle)}</p></div><span class="pill">${escapeHtml(shownGoal)}</span></div><div class="training-v2-reason">${escapeHtml(shownReason)}</div>${data.contextNote?`<div class="smart-context-note">${escapeHtml(data.contextNote)}</div>`:''}<div class="card-actions"><button class="action" id="viewAIWorkout" type="button">Voir la séance</button><button class="action secondary" id="regenerateAIWorkout" type="button">Une autre proposition</button><button class="text-action" data-open="workoutIdeas">Choisir moi-même</button></div>`;
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
    {id:'recovery',title:'Récupération active',subtitle:'~20 min · mobilité + récupération',goalLabel:'Récupération',tags:['recovery','bodyweight'],plan:[
      {name:'Respiration 90/90',sets:3,reps:'5 respirations',rest:'30 s'},
      {name:'Cat-Cow',sets:2,reps:10,rest:'30 s'},
      {name:'Rotation thoracique',sets:2,reps:'8 / côté',rest:'30 s'},
      {name:'Étirement fléchisseur de hanche',sets:2,reps:'40 s / côté',rest:'20 s'},
      {name:'Dead bug',sets:3,reps:'8 / côté',rest:'45 s'}
    ]},
    {id:'bodyweight',title:'Full body sans matériel',subtitle:'~30 min · maison / voyage',goalLabel:'Conditionnement',tags:['full','bodyweight'],plan:[
      {name:'Pompes',sets:4,reps:'8–15',rest:'60 s'},
      {name:'Squat au poids du corps',sets:4,reps:'15–20',rest:'60 s'},
      {name:'Fentes marchées',sets:3,reps:'12 / jambe',rest:'60 s'},
      {name:'Mountain climbers',sets:3,reps:'30 s',rest:'45 s'},
      {name:'Gainage',sets:3,reps:'45 s',rest:'45 s'}
    ]},
    {id:'band',title:'Full body élastique',subtitle:'~30 min · élastique',goalLabel:'Renforcement',tags:['full','band'],plan:[
      {name:'Rowing élastique',sets:4,reps:12,rest:'60 s'},
      {name:'Squat avec élastique',sets:4,reps:15,rest:'60 s'},
      {name:'Développé poitrine élastique',sets:3,reps:12,rest:'60 s'},
      {name:'Face pull élastique',sets:3,reps:15,rest:'45 s'},
      {name:'Pallof press',sets:3,reps:'10 / côté',rest:'45 s'}
    ]},
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
      {name:'Extensions triceps',sets:3,reps:12,rest:'60 s'},
      {name:'Dead bug',sets:3,reps:'8 / côté',rest:'45 s'}
    ]},
    {id:'pull',title:'Pull',subtitle:'~35 min · tirage',goalLabel:'Hypertrophie',tags:['upper','pull'],plan:[
      {name:'Tractions',sets:4,reps:8,rest:'90 s'},
      {name:'Rowing',sets:4,reps:10,rest:'90 s'},
      {name:'Tirage vertical',sets:3,reps:10,rest:'75 s'},
      {name:'Face pull',sets:3,reps:15,rest:'60 s'},
      {name:'Curl biceps',sets:3,reps:12,rest:'60 s'},
      {name:'Pallof press',sets:3,reps:'10 / côté',rest:'45 s'}
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
function trendAverage(rows,key){
  const vals=rows.map(x=>Number(x?.[key])).filter(Number.isFinite);
  return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
}
function trendWindowSummary(days,checkins,workouts,cardio,food,proteinTarget){
  const ci=checkins.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<days);
  const wo=workouts.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<days);
  const ca=cardio.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<days);
  const fo=food.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<days);
  const dailyFood={};
  for(const x of fo){ if(!dailyFood[x.date])dailyFood[x.date]={protein:0,calories:0,entries:0}; dailyFood[x.date].protein+=Number(x.protein)||0; dailyFood[x.date].calories+=Number(x.calories)||0; dailyFood[x.date].entries++; }
  const foodDays=Object.values(dailyFood).filter(x=>x.entries>0);
  const half=Math.max(2,Math.floor(days/2));
  const recent=ci.filter(x=>daysAgo(x.date)<half), previous=ci.filter(x=>daysAgo(x.date)>=half&&daysAgo(x.date)<days);
  const delta=(key)=>{const a=trendAverage(recent,key),b=trendAverage(previous,key);return a!=null&&b!=null&&recent.length>=2&&previous.length>=2?Math.round((a-b)*10)/10:null};
  return {days,coverage:{checkins:ci.length,nutritionDays:foodDays.length,forceSessions:wo.length,cardioSessions:ca.length},body:{weightAvg:trendAverage(ci,'weight'),waistAvg:trendAverage(ci,'waist'),weightRecentVsPrevious:delta('weight'),waistRecentVsPrevious:delta('waist')},wellbeing:{sleepAvg:trendAverage(ci,'sleep'),energyAvg:trendAverage(ci,'energy'),stressAvg:trendAverage(ci,'stress'),hungerAvg:trendAverage(ci,'hunger'),sleepRecentVsPrevious:delta('sleep'),energyRecentVsPrevious:delta('energy'),stressRecentVsPrevious:delta('stress')},training:{forceSessions:wo.length,cardioSessions:ca.length,cardioDistance:Math.round(ca.reduce((sum,x)=>sum+(Number(x.distance)||0),0)*10)/10,activeDays:new Set([...wo,...ca].map(x=>x.date)).size},nutrition:{daysLogged:foodDays.length,proteinAvg:foodDays.length?Math.round(foodDays.reduce((a,b)=>a+b.protein,0)/foodDays.length):null,proteinTargetDays:proteinTarget?foodDays.filter(x=>x.protein>=proteinTarget).length:null}};
}
function buildCompanionTrends(checkins,workouts,cardio,food,proteinTarget){ return {windows:[7,14,30].map(d=>trendWindowSummary(d,checkins,workouts,cardio,food,proteinTarget)),minimums:{days7:{checkins:4,nutritionDays:4},days14:{checkins:7,nutritionDays:7},days30:{checkins:12,nutritionDays:12},rule:'duration_and_density_required'}}; }
function fluidityDataQuality(checkins,workouts,cardio,food){
  const recent=(rows,days)=>rows.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<days);
  const c30=recent(checkins,30),w30=recent(workouts,30),ca30=recent(cardio,30),f30=recent(food,30);
  const issues=[];
  const impossible=(label,count)=>{if(count)issues.push({level:'warning',area:label,count});};
  impossible('checkins_incoherents',c30.filter(x=>(x.weight!=null&&(Number(x.weight)<35||Number(x.weight)>250))||(x.waist!=null&&(Number(x.waist)<40||Number(x.waist)>200))||(x.sleep!=null&&(Number(x.sleep)<0||Number(x.sleep)>16))).length);
  impossible('cardio_incoherent',ca30.filter(x=>(x.distance!=null&&(Number(x.distance)<0||Number(x.distance)>500))||(x.durationSeconds!=null&&(Number(x.durationSeconds)<0||Number(x.durationSeconds)>86400))||(x.heartRateAvg!=null&&(Number(x.heartRateAvg)<35||Number(x.heartRateAvg)>230))||(x.cadenceAvg!=null&&(Number(x.cadenceAvg)<40||Number(x.cadenceAvg)>260))||(x.calories!=null&&(Number(x.calories)<0||Number(x.calories)>10000))).length);
  const imported=ca30.filter(x=>x.source==='import'||x.source==='strava'||x.importSource);
  const missingImported=imported.filter(x=>x.distance==null||!x.durationSeconds).length;
  if(missingImported)issues.push({level:'info',area:'imports_cardio_incomplets',count:missingImported});
  const duplicateCardio=(()=>{const seen=new Set();let n=0;for(const x of ca30){const k=[x.date,x.type||'',Math.round((Number(x.distance)||0)*100),Math.round((Number(x.durationSeconds)||0)/5)].join('|');if(seen.has(k))n++;else seen.add(k)}return n})();
  if(duplicateCardio)issues.push({level:'info',area:'cardio_doublons_probables',count:duplicateCardio});
  const dates=[...c30,...w30,...ca30,...f30].map(x=>x.date).filter(Boolean);
  const futureDates=dates.filter(d=>daysAgo(d)<0).length;if(futureDates)issues.push({level:'warning',area:'dates_futures',count:futureDates});
  const score=Math.max(0,100-issues.reduce((s,x)=>s+(x.level==='warning'?20:8)*x.count,0));
  return {score,status:score>=90?'good':score>=70?'watch':'limited',issues,coverage30:{checkins:c30.length,forceSessions:w30.length,cardioSessions:ca30.length,nutritionDays:new Set(f30.map(x=>x.date)).size},rules:{cardioCadence:'course/marche attendue en pas par minute (ppm); aucune cadence max/puissance utilisée',imports:'distance et durée requises pour considérer un import cardio complet',principle:'une donnée douteuse ne doit jamais devenir un fait certain pour le Compagnon'}};
}
async function companionSnapshot(){
  const [checkins,workouts,cardio,food]=await Promise.all(['checkins','workouts','cardio','food'].map(s=>LTDB.all(s)));
  const today=todayKey();
  const recentCheckins=checkins.filter(x=>daysAgo(x.date)<=7).sort((a,b)=>b.date.localeCompare(a.date));
  const recentWorkouts=workouts.filter(x=>daysAgo(x.date)<=14).sort((a,b)=>b.date.localeCompare(a.date));
  const recentCardio=cardio.filter(x=>daysAgo(x.date)<=14).sort((a,b)=>b.date.localeCompare(a.date));
  const latest=checkins.find(x=>x.date===today)||recentCheckins[0]||null;
  const todayFood=food.filter(x=>x.date===today);
  const todayCardio=cardio.filter(x=>x.date===today);
  const todayWorkout=workouts.find(x=>x.date===today)||null;
  const protein=todayFood.reduce((s,x)=>s+(Number(x.protein)||0),0);
  const calories=todayFood.reduce((s,x)=>s+(Number(x.calories)||0),0);
  const water=todayFood.reduce((s,x)=>s+(Number(x.water)||0),0);
  const decision=fluidityEngine(latest,todayWorkout,todayCardio,workouts,cardio,food,checkins);
  const proteinTarget=Number(state.profile.proteinTarget)||170;
  const context={
    today,
    goal:state.profile.goal||null,
    proteinTarget,
    latestCheckin:latest,
    nutritionToday:{protein:Math.round(protein*10)/10,calories:Math.round(calories),water:Math.round(water*10)/10,entries:todayFood.length},
    todayWorkout:todayWorkout?{name:todayWorkout.name||null,duration:todayWorkout.durationLabel||null,effort:todayWorkout.effort??null}:null,
    todayCardio:todayCardio.map(c=>({type:c.type||null,name:c.name||null,distance:c.distance??null,duration:c.durationLabel||null,heartRateAvg:c.heartRateAvg??null,cadenceAvg:c.cadenceAvg??c.cadence??null,calories:c.calories??null})),
    recentForce:recentWorkouts.slice(0,8).map(w=>({date:w.date,name:w.name||null,duration:w.durationLabel||null,effort:w.effort??null})),
    recentCardio:recentCardio.slice(0,8).map(c=>({date:c.date,type:c.type||null,name:c.name||null,distance:c.distance??null,duration:c.durationLabel||null,heartRateAvg:c.heartRateAvg??null,cadenceAvg:c.cadenceAvg??c.cadence??null})),
    recentCheckins:recentCheckins.slice(0,7).map(c=>({date:c.date,sleep:c.sleep??null,stress:c.stress??null,energy:c.energy??null,recovery:c.recovery??null,hunger:c.hunger??null,weight:c.weight??null,waist:c.waist??null})),
    dailyDecision:decision,
    trends:buildCompanionTrends(checkins,workouts,cardio,food,proteinTarget),
    dataQuality:fluidityDataQuality(checkins,workouts,cardio,food),
    continuity:{
      forceLast7:recentWorkouts.filter(w=>daysAgo(w.date)<=7).length,
      cardioLast7:recentCardio.filter(c=>daysAgo(c.date)<=7).length,
      checkinsLast7:recentCheckins.length,
      lastForce:recentWorkouts[0]?{date:recentWorkouts[0].date,name:recentWorkouts[0].name||null}:null,
      lastCardio:recentCardio[0]?{date:recentCardio[0].date,type:recentCardio[0].type||null,name:recentCardio[0].name||null,distance:recentCardio[0].distance??null}:null
    },
    availableWorkouts:workoutLibrary().map(w=>({id:w.id,title:w.title,subtitle:w.subtitle,tags:w.tags||[],plan:w.plan})),
    allowedExercises:[...new Set(workoutLibrary().flatMap(w=>w.plan.map(e=>e.name)))]
  };
  const brief=companionBriefV22(context);
  return {headline:brief.title,brief,context};
}
function companionBriefV22(c){
  const d=c.dailyDecision||{};
  const n=c.nutritionToday||{};
  let title=d.title||'Je construis ton contexte.';
  let text=d.message||'Plus tu enregistres tes journées, plus je peux être précis.';
  let action=d.action||null;
  let actionLabel=action==='training'?'Voir l’entraînement':action==='checkin'?'Renseigner mon ressenti':null;
  const notes=[];
  if(n.entries>0 && c.proteinTarget){
    const remaining=Math.max(0,Math.round(c.proteinTarget-(Number(n.protein)||0)));
    if(remaining>0) notes.push(`Il te reste environ ${remaining} g de protéines pour atteindre ton repère du jour.`);
    else notes.push('Ton repère protéines est atteint pour aujourd’hui.');
  }
  if((Number(n.water)||0)>0 && Number(n.water)<1.5) notes.push(`Hydratation enregistrée : ${Number(n.water).toFixed(1).replace('.',',')} L.`);
  return {title,text,action,actionLabel,note:notes[0]||'',confidence:d.confidence||'medium'};
}

function cleanCompanionText(text){
  return String(text||'')
    .replace(/\*\*(.*?)\*\*/g,'$1')
    .replace(/__(.*?)__/g,'$1')
    .replace(/^\s*[-•]\s+/gm,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}
function companionFingerprint(text){
  return cleanCompanionText(text).toLowerCase()
    .replace(/[àâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u')
    .replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
}

function companionChatDay(x){
  const raw=x?.createdAt||'';
  const d=raw?new Date(raw):null;
  if(!d||Number.isNaN(d.getTime()))return '';
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function companionHistoryLabel(day){
  const d=new Date(day+'T12:00:00');
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
}
async function renderCompanion(){
  const messages=await LTDB.all('events');
  for(const m of messages.filter(x=>x.type==='CHAT'&&x.role==='companion'&&/\*\*|__/.test(String(x.text||'')))){
    const cleaned=cleanCompanionText(m.text);
    if(cleaned!==m.text)await LTDB.put('events',{...m,text:cleaned});
  }
  const allTodayChat=messages.filter(x=>x.type==='CHAT'&&companionChatDay(x)===todayKey()).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  // L’écran principal reste volontairement léger : uniquement le dernier échange complet.
  let chat=[];
  const lastCompanionIndex=allTodayChat.map(x=>x.role).lastIndexOf('companion');
  if(lastCompanionIndex>=0){
    let userIndex=-1;
    for(let i=lastCompanionIndex-1;i>=0;i--){if(allTodayChat[i].role==='user'){userIndex=i;break;}}
    chat=allTodayChat.slice(userIndex>=0?userIndex:lastCompanionIndex,lastCompanionIndex+1);
  }
  const snap=await companionSnapshot(),b=snap.brief;
  return `<section class="hero companion-hero-v233"><div class="companion-page-mark">${companionMark("companion-mark-large")}</div><div class="hello">Compagnon</div><button class="companion-history-link" id="openCompanionHistory">Historique</button><div class="subtle">Je relie ton ressenti, tes entraînements, ton cardio, ton alimentation et ton évolution.</div></section>
  <div class="card primary-card companion-v22-brief">
    <div class="card-kicker">${companionMark("choice-companion")} Priorité du moment</div>
    <h3>${escapeHtml(b.title)}</h3>
    <p>${escapeHtml(b.text)}</p>
    ${b.note?`<div class="smart-context-note">${escapeHtml(b.note)}</div>`:''}
    ${b.actionLabel?`<div class="card-actions"><button class="action" data-companion-action="${escapeHtml(b.action)}">${escapeHtml(b.actionLabel)}</button></div>`:''}
  </div>
  <div class="card companion-v22-questions">
    <div class="card-kicker">Questions rapides</div>
    <div class="companion-quick-grid">
      <button class="action secondary compact" data-companion-prompt="Que dois-je privilégier aujourd’hui ?">Ma priorité aujourd’hui</button>
      <button class="action secondary compact" data-companion-prompt="Que penses-tu de mon entraînement aujourd’hui ?">Mon entraînement</button>
      <button class="action secondary compact" data-companion-prompt="Comment trouves-tu mon équilibre cardio et force ces derniers jours ?">Mon cardio</button>
      <button class="action secondary compact" data-companion-prompt="Que dois-je encore privilégier côté alimentation aujourd’hui ?">Mon alimentation</button>
      <button class="action secondary compact" id="openCompanionEvolution">Mon évolution</button>
      <button class="action secondary compact" data-companion-prompt="Quelles tendances utiles vois-tu sur mes 7, 14 et 30 derniers jours ?">Mes tendances</button>
      <button class="action secondary compact" data-companion-prompt="Fais le point sur ma trajectoire et dis-moi si je dois continuer, surveiller quelque chose ou ajuster mon cap.">Mon cap</button>
    </div>
  </div>
  <div class="card chat" id="chat">${chat.length?chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${escapeHtml(cleanCompanionText(x.text))}${x.role==='companion'&&x.action?`<button class="companion-inline-action" data-companion-chat-action="${escapeHtml(x.action.type||'')}" data-companion-workout="${escapeHtml(x.action.workoutId||'')}">${escapeHtml(x.action.label||'Voir')}</button>`:''}</div>`).join(''):'<div class="bubble companion">Je peux maintenant répondre en tenant compte de ta journée réelle, sans inventer les données qui manquent.</div>'}</div>
  <div class="chatbar"><input id="chatInput" placeholder="Pose une question sur ta journée…"><button id="sendChat">Envoyer</button></div>`;
}

async function renderProfile(){
  const snaps=await LTDB.listSnapshots().catch(()=>[]),last=snaps[0]||null;
  const lastLabel=last?new Date(last.createdAt).toLocaleString('fr-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Aucune encore';
  return `<section class="hero"><div class="profile-head"><svg class="big-logo" viewBox="0 0 64 64"><path d="M15 43.5A22 22 0 0 1 44.5 14" class="fluidity-arc"/><path d="M49.2 20.2A22 22 0 0 1 19.8 50" class="fluidity-arc"/></svg><div><div class="hello" style="font-size:28px;margin:0">${escapeHtml(state.profile.firstName)}</div><div class="subtle">${escapeHtml(state.profile.goal||'Ton évolution')}</div></div></div></section>
  <div class="card"><div class="card-kicker">Ce que tu sais de moi</div><div class="list"><button class="list-row history-button" data-open="goalEdit"><div><strong>Objectif principal</strong><div class="status">${escapeHtml(state.profile.goal||'À définir')}</div></div><span class="pill">Modifier</span></button><div class="list-row"><div><strong>Alimentation</strong><div class="status">${state.profile.nutritionEnabled?'Accompagnement actif':'Masquée'}</div></div><span class="pill">Choix</span></div></div><p class="subtle">Fluidité peut te proposer d’ajuster le cap, mais ne change jamais ton objectif principal sans ton accord.</p></div>
  <div class="card"><div class="switch-row"><div><strong>Accompagnement alimentation</strong><div class="status">Masqué lorsqu’il est désactivé.</div></div><input id="nutritionToggle" class="toggle" type="checkbox" ${state.profile.nutritionEnabled?'checked':''}></div></div>
  <div class="card photo-privacy-card"><div class="card-kicker">Confidentialité photos</div><h3>Coffre Photos</h3><p class="subtle">Tes photos d’évolution sont masquées par défaut. Elles se reverrouillent automatiquement si Fluidité passe en arrière-plan ou après quelques minutes.</p><div class="backup-status"><strong>Protection</strong><span>${photoPrivacyConfig().method==='webauthn'?'Face ID / Touch ID':photoPrivacyConfig().method==='pin'?'Code Fluidité':'À configurer au premier accès'}</span><small>${photoVaultUnlocked()?'Coffre actuellement déverrouillé':'Coffre verrouillé'}</small></div><div class="card-actions"><button class="action" id="photoPrivacyUnlockBtn">${photoVaultUnlocked()?'Prolonger le déverrouillage':'Déverrouiller / configurer'}</button>${photoVaultUnlocked()?'<button class="action secondary" id="photoPrivacyLockBtn">Verrouiller maintenant</button>':''}</div></div>
  <div class="card backup-card"><div class="card-kicker">Sécurité & sauvegarde</div><h3>Protection de tes données</h3><p class="subtle">Tes données restent d’abord sur cet iPhone. Fluidité garde jusqu’à 7 instantanés locaux et peut créer une sauvegarde chiffrée à conserver ailleurs.</p><div class="backup-status"><strong>Dernière sauvegarde locale</strong><span>${escapeHtml(lastLabel)}</span><small>${snaps.length} / 7 instantanés disponibles</small></div><div class="card-actions"><button class="action" id="snapshotBtn">Sauvegarder maintenant</button><button class="action secondary" id="localBackupsBtn">Restaurer une sauvegarde locale</button></div><div class="card-actions"><button class="action" id="encryptedExportBtn">Exporter une sauvegarde chiffrée</button><label class="action secondary">Importer / restaurer<input id="importInput" type="file" accept=".fluidite,.json,application/json,application/octet-stream" hidden></label></div><details class="backup-advanced"><summary>Options avancées</summary><p class="subtle">L’export JSON n’est pas chiffré. À utiliser seulement pour dépannage ou migration contrôlée.</p><button class="action secondary" id="exportBtn">Exporter JSON non chiffré</button></details></div><div class="version">Luis Transformation · V2.10.4.2 Suggestion → Action</div>`;
}
function bindPage(){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.homeView;if(state.homeView==='evolution'&&next!=='evolution')lockPhotoVault('leave-photos',false);state.homeView=next;render();}));
  document.querySelectorAll('[data-route-card]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.routeCard)));
  document.querySelectorAll('[data-nutrition-proposals]').forEach(b=>b.addEventListener('click',openNutritionProposals));
  document.querySelectorAll('[data-fluidity-force]').forEach(b=>b.addEventListener('click',async()=>{const [ws,cs,fs,ks]=await Promise.all([LTDB.all('workouts'),LTDB.all('cardio'),LTDB.all('food'),LTDB.all('checkins')]);ws.sort((a,b)=>b.date.localeCompare(a.date));cs.sort((a,b)=>b.date.localeCompare(a.date));const today=todayKey(),check=ks.find(x=>x.date===today)||null,todayWorkout=ws.find(x=>x.date===today)||null,todayCardio=cs.filter(x=>x.date===today),decision=fluidityEngine(check,todayWorkout,todayCardio,ws,cs,fs,ks),w=fluidityWorkoutForDecision(decision,ws);if(b.dataset.fluidityForce==='detail')return workoutDetailSheet(w);await workoutDetailSheet(w);chosenWorkoutForm();}));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e?.stopPropagation?.();openSheet(b.dataset.open)}); document.querySelectorAll('[data-photo-view]').forEach(b=>b.onclick=()=>viewProgressPhoto(b.dataset.photoView));
  document.querySelectorAll('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.editActivity.split(':'); editActivitySheet(kind,id);}));
  $('#openCompanionHistory')?.addEventListener('click',openCompanionHistory);
  $('#openCompanionEvolution')?.addEventListener('click',openCompanionEvolution);
  $('#unlockPhotoVaultEvolution')?.addEventListener('click',()=>ensurePhotoVaultUnlocked());
  $('#sendChat')?.addEventListener('click',sendChat); $('#chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  document.querySelectorAll('[data-companion-prompt]').forEach(b=>b.addEventListener('click',()=>{const input=$('#chatInput');if(input){input.value=b.dataset.companionPrompt;sendChat();}}));
  document.querySelectorAll('[data-companion-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.companionAction;if(a==='training')navigate('training');else if(a==='checkin')openSheet('checkin');}));
  document.querySelectorAll('[data-companion-chat-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.companionChatAction,id=b.dataset.companionWorkout;
    if((a==='open_workout'||a==='prepare_workout')&&id){prepareCompanionAction({type:'prepare_workout',workoutId:id});}
    else if(a==='training')navigate('training');
    else if(a==='recipe')openCompanionRecipe();
    else if(a==='nutrition')navigate('nutrition');
    else if(a==='checkin')openSheet('checkin');
  }));
  $('#nutritionToggle')?.addEventListener('change',async e=>{state.profile.nutritionEnabled=e.target.checked; await LTDB.put('profile',state.profile); toast(e.target.checked?'Alimentation activée':'Alimentation masquée'); render();});
  $('#photoPrivacyUnlockBtn')?.addEventListener('click',()=>ensurePhotoVaultUnlocked()); $('#photoPrivacyLockBtn')?.addEventListener('click',()=>{lockPhotoVault('manual');render()});
  $('#snapshotBtn')?.addEventListener('click',createManualSnapshot); $('#localBackupsBtn')?.addEventListener('click',openLocalBackups); $('#encryptedExportBtn')?.addEventListener('click',exportEncryptedBackup); $('#exportBtn')?.addEventListener('click',exportData); $('#importInput')?.addEventListener('change',importData);
}
async function quickAdd(){ openSheet('quick'); }
let sheetBackAction=null;
function showSheet(html,backAction=null){ stopBarcodeCamera(); stopProgressCamera(); sheetBackAction=typeof backAction==='function'?backAction:null; $('#sheetContent').innerHTML=`<button class="sheet-x" type="button" data-close aria-label="Fermer">×</button>${html}`; $('#sheet').showModal(); bindSheet(); updateAllRanges(); }
function slider(name,label,min,max,step,value,unit=''){ return `<div class="slider-line"><div class="slider-head"><label>${label}</label><output data-output="${name}">${value}${unit}</output></div><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-range-unit="${unit}"></div>`; }
function openSheet(kind){
  if((kind==='photoCompare'||kind==='progressPhoto')&&!photoVaultUnlocked()){ensurePhotoVaultUnlocked(()=>openSheet(kind));return}
  if(kind==='photoCompare'||kind==='progressPhoto'){photoVaultSheetActive=true;touchPhotoVault()}
  if(kind==='quick') return showSheet(`<h2>Donner quelque chose</h2><div class="sheet-grid"><button class="sheet-choice" data-sheet="checkin">◌<strong>Ressenti</strong></button><button class="sheet-choice" data-sheet="workout">◎<strong>Force</strong></button><button class="sheet-choice" data-sheet="cardio">⌁<strong>Cardio</strong></button>${state.profile.nutritionEnabled?'<button class="sheet-choice" data-sheet="nutritionHub">◒<strong>Alimentation</strong></button>':''}</div>`);
  if(kind==='checkin') {
    showSheet(`<h2>Comment vas-tu aujourd’hui ?</h2><form id="checkinForm">${dateField('date',todayKey())}${slider('sleep','Sommeil','0','12','0.25','7',' h')}${slider('energy','Énergie','1','5','1','3','/5')}${slider('stress','Stress','1','5','1','2','/5')}${slider('recovery','Récupération','1','5','1','3','/5')}${slider('hunger','Faim','1','5','1','3','/5')}<div class="field"><label>Poids (kg)</label><input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal" placeholder="80.4"></div><div class="field"><label>Tour de taille (cm)</label><input name="waist" type="number" min="30" max="250" step="0.1" inputmode="decimal" placeholder="90.0"></div><button class="action" type="submit">Enregistrer</button></form>`);
    const form=$('#checkinForm'), date=todayKey();
    LTDB.get('checkins',date).then(existing=>{
      if(!existing || !form || !form.isConnected) return;
      ['sleep','energy','stress','recovery','hunger','weight','waist'].forEach(name=>{
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
  if(kind==='exerciseLibrary'){
    const groups={
      'Récupération & mobilité':['Respiration 90/90','Cat-Cow','Rotation thoracique','Étirement fléchisseur de hanche','Dead bug'],
      'Sans matériel':['Pompes','Squat au poids du corps','Fentes marchées','Mountain climbers','Gainage'],
      'Élastiques':['Rowing élastique','Squat avec élastique','Développé poitrine élastique','Face pull élastique','Pallof press'],
      'Haut du corps':['Développé couché','Développé incliné','Développé épaules','Élévations latérales','Face pull','Tractions','Rowing','Tirage horizontal','Tirage vertical','Curl biceps','Extensions triceps'],
      'Bas du corps':['Squat','Fentes','Soulevé de terre roumain','Mollets']
    };
    return showSheet(`<h2>Bibliothèque d’exercices</h2><p class="subtle">30 exercices disponibles aujourd’hui · chaque exercice ouvre sa fiche technique.</p><div class="exercise-library-groups">${Object.entries(groups).map(([g,names])=>`<section class="exercise-library-group"><h3>${escapeHtml(g)}</h3><div class="exercise-library-grid">${names.map(name=>`<button class="exercise-library-item" type="button" data-technique="${escapeHtml(name)}"><strong>${escapeHtml(name)}</strong><span>Technique ›</span></button>`).join('')}</div></section>`).join('')}</div>`);
  }
  if(kind==='workoutIdeas') return showSheet(`<h2>Choisir l’entraînement</h2><p class="subtle">Choisis librement le type de séance. La suggestion n’est qu’un point de départ.</p><div class="workout-choice-grid">${workoutLibrary().map(w=>`<button class="suggestion-card workout-choice-card" data-workout-choice="${w.id}"><div><strong>${escapeHtml(w.title)}</strong><span>${escapeHtml(w.subtitle)} · ${escapeHtml(w.goalLabel)}</span></div><span>›</span></button>`).join('')}</div>`);
  if(kind==='forceHistory') return LTDB.all('workouts').then(rows=>showSheet(`<h2>Historique Force</h2><div class="list">${rows.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<button class="list-row history-button" data-edit-activity="Force:${x.id}"><div><strong>${escapeHtml(x.name||'Séance Force')}</strong><div class="status">${formatPhotoDate(x.date)}${x.durationLabel?` · ${x.durationLabel}`:''}</div></div><span class="pill">Modifier</span></button>`).join('')||'<div class="empty">Aucune séance Force.</div>'}</div>`));
  if(kind==='stravaHub') return showSheet(`<h2>Strava</h2><p class="subtle">Connecte ton compte, puis récupère tes dernières activités quand tu le souhaites. Rien n’est enregistré automatiquement.</p><div class="strava-card"><div class="strava-mark">S</div><div><strong>Connexion Strava</strong><span>Lecture de tes activités uniquement</span></div></div><div class="strava-actions"><a class="action strava-connect" href="/.netlify/functions/strava-auth-start">Connecter Strava</a><button class="action secondary" id="fetchStravaActivities" type="button">Récupérer mes activités</button></div><div id="stravaStatus" class="strava-status"></div><div id="stravaActivities"></div>`);
  if(kind==='cardioImport') return showSheet(`<h2>Importer une activité</h2><p class="subtle">Choisis un fichier GPX, TCX ou FIT. Je lis les données puis tu vérifies avant l’enregistrement.</p><label class="import-drop-card"><span class="import-icon">↥</span><strong>Choisir un fichier</strong><span>GPX · TCX · FIT</span><input id="cardioImportInput" type="file" accept=".gpx,.tcx,.fit,application/gpx+xml,application/vnd.garmin.tcx+xml,application/octet-stream" hidden></label><div class="import-privacy">Analyse locale. Rien n’est enregistré sans ta confirmation.</div><div id="cardioImportStatus"></div>`);
  if(kind==='cardioHistory') return LTDB.all('cardio').then(rows=>showSheet(`<h2>Historique Cardio</h2><div class="list">${rows.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<button class="list-row history-button" data-edit-activity="Cardio:${x.id}"><div><strong>${escapeHtml(x.type||'Cardio')}</strong><div class="status">${formatPhotoDate(x.date)}${x.distance?` · ${x.distance} km`:''}${x.durationLabel?` · ${x.durationLabel}`:''}</div></div><span class="pill">Modifier</span></button>`).join('')||'<div class="empty">Aucune activité Cardio.</div>'}</div>`));
  if(kind==='cardio') return showSheet(`<h2>Ajouter une activité Cardio</h2><form id="cardioForm">${dateField('date',todayKey())}<div class="field"><label>Type</label><select name="type"><option>Course</option><option>Vélo</option><option>Natation</option><option>Marche</option><option>Autre</option></select></div><div class="field"><label>Distance (km)</label><input name="distance" type="number" step="0.01" inputmode="decimal"></div><div class="duration-picker"><div><label>Heures</label><input name="hours" type="number" min="0" max="23" inputmode="numeric" value="0"></div><span>:</span><div><label>Minutes</label><input name="minutes" type="number" min="0" max="59" inputmode="numeric" value="40"></div><span>:</span><div><label>Secondes</label><input name="seconds" type="number" min="0" max="59" inputmode="numeric" value="0"></div></div><div class="range-row"><div class="field"><label>FC moyenne</label><input name="hr" type="number" inputmode="numeric"></div><div class="field"><label>Cadence moy.</label><input name="cadence" type="number" inputmode="numeric"></div></div><div class="range-row"><div class="field"><label>Dénivelé + (m)</label><input name="elevation" type="number" inputmode="numeric"></div><div class="field"><label>Calories (kcal)</label><input name="calories" type="number" inputmode="numeric"></div></div><button class="action" type="submit">Enregistrer</button></form>`);
  if(kind==='nutritionHub') return nutritionHubSheet();
  if(kind==='recipeIngredientAdd'){
    return showSheet(`<h2>Ajouter un ingrédient</h2><p class="subtle">Utilise exactement les mêmes outils que pour tes repas.</p><div class="nutrition-actions meal-add-methods"><button class="sheet-choice" data-sheet="foodSearch">⌕<strong>Rechercher un aliment</strong><span>Nom, marque ou produit</span></button><button class="sheet-choice" data-sheet="barcode">▣<strong>Scanner un produit</strong><span>Code-barres</span></button><button class="sheet-choice" data-sheet="photoFood">◉<strong>Photo</strong><span>Le Compagnon analyse puis tu confirmes</span></button><button class="sheet-choice" data-sheet="recipeManualIngredient">＋<strong>Saisie manuelle</strong><span>Quantité + macros</span></button></div>`);
  }
  if(kind==='recipeManualIngredient'){
    return showSheet(`<h2>Ingrédient manuel</h2><form id="recipeManualIngredientForm"><div class="field"><label>Nom</label><input name="name" required placeholder="Ex. flocons d’avoine"></div><div class="field"><label>Quantité (g)</label><input name="qty" type="number" min="0" step="0.1"></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" min="0" step="0.1"></div><div class="field"><label>Calories</label><input name="calories" type="number" min="0" step="1"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" min="0" step="0.1"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" min="0" step="0.1"></div></div><button class="action" type="submit">Ajouter à la recette</button></form>`);
  }

  if(kind==='nutritionMealAdd'){
    const type=pendingNutritionMealType||'lunch';
    return showSheet(`<h2>${mealTypeLabel(type)}</h2><p class="subtle">Comment veux-tu ajouter quelque chose à ce repas ?</p><div class="nutrition-actions meal-add-methods"><button class="sheet-choice nutrition-favorite-choice" data-food-favorites>★<strong>Mes aliments favoris</strong><span>Réutiliser en 1 clic avec la dernière quantité</span></button><button class="sheet-choice" data-sheet="foodSearch">⌕<strong>Rechercher un aliment</strong><span>Nom, marque ou produit</span></button><button class="sheet-choice" data-sheet="barcode">▣<strong>Scanner un produit</strong><span>Code-barres</span></button><button class="sheet-choice" data-sheet="photoFood">◉<strong>Photo aliment / repas</strong><span>Le Compagnon analyse puis tu confirmes</span></button><button class="sheet-choice" data-personal-recipes>♨<strong>Mes recettes</strong><span>Ajouter une recette personnelle</span></button><button class="sheet-choice" data-sheet="food">＋<strong>Saisie manuelle</strong><span>Description + macros</span></button></div>`,()=>nutritionHubSheet());
  }
  if(kind==='hydrationQuick') return (async()=>{const date=todayKey(),rows=(await LTDB.all('food')).filter(x=>x.date===date),current=rows.reduce((s,x)=>s+(Number(x.water)||0),0);showSheet(`<h2>Hydratation</h2><p class="subtle">Mets à jour ton total d’eau pour aujourd’hui.</p><form id="hydrationQuickForm">${dateField('date',date)}<div class="field"><label>Total aujourd’hui (L)</label><input name="water" type="number" min="0" max="8" step="0.1" inputmode="decimal" value="${current?current.toFixed(1):''}" placeholder="Ex. 1,5" required></div><button class="action" type="submit">Mettre à jour</button></form>`);})();
  if(kind==='food') return showSheet(`<h2>Ajouter un repas</h2><form id="foodForm">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><div class="field"><label>Décris simplement</label><textarea name="description" rows="3" placeholder="Poulet, riz, légumes et un yaourt"></textarea></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input name="protein" type="number" step="0.1"></div><div class="field"><label>Calories</label><input name="calories" type="number"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input name="carbs" type="number" step="0.1"></div><div class="field"><label>Lipides (g)</label><input name="fat" type="number" step="0.1"></div></div><div class="field"><label>Eau (L)</label><input name="water" type="number" step="0.1"></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes favoris</label><button class="action" type="submit">Enregistrer</button></form>`,pendingNutritionMealType?()=>openSheet('nutritionMealAdd'):null);
  if(kind==='foodSearch') return showSheet(`<h2>Rechercher un aliment</h2><p class="subtle">Recherche par nom ou marque. Choisis un résultat, indique la quantité et confirme avant l’enregistrement.</p><input type="hidden" id="foodSearchMealContext" value="${escapeHtml(pendingNutritionMealType||'')}"><form id="foodSearchForm"><div class="food-search-line"><input name="query" autocomplete="off" placeholder="Ex. skyr, poulet, Lidl High Protein…" required><button class="action compact" type="submit">Rechercher</button></div></form><button class="text-action food-favorites-shortcut" type="button" data-food-favorites>★ Mes aliments favoris</button><div id="foodSearchStatus" class="ai-status"></div><div id="foodSearchResults"></div><div class="ai-note">Produits de marque : Open Food Facts. Aliments génériques : base nutritionnelle intégrée en complément.</div>`,pendingNutritionMealType?()=>openSheet('nutritionMealAdd'):null);
  if(kind==='barcode') return showSheet(`<h2>Scanner un produit</h2><p class="subtle">Cadre le code-barres avec l’appareil photo. Dès qu’il est reconnu, le produit est recherché.</p><div class="barcode-scanner"><video id="barcodeVideo" playsinline muted></video><div class="barcode-frame"><span></span></div><div id="barcodeScanStatus" class="ai-status">Appuie sur « Ouvrir la caméra ».</div></div><button class="action" type="button" id="startBarcodeCamera">Ouvrir la caméra</button><button class="text-action" type="button" id="toggleManualBarcode">Saisir le code manuellement</button><form id="barcodeForm" class="manual-barcode hidden">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><div class="field"><label>Code-barres</label><input name="barcode" inputmode="numeric" autocomplete="off" placeholder="7612345678901" required></div><button class="action secondary" type="submit" id="barcodeLookupBtn">Rechercher</button></form><div class="ai-note">Le scan est traité sur ton téléphone. Seul le numéro du code-barres est envoyé à Open Food Facts.</div>`,pendingNutritionMealType?()=>openSheet('nutritionMealAdd'):null);
  if(kind==='photoFood') return showSheet(`<h2>Photo aliment / repas</h2><p class="subtle">Prends une photo ou choisis-en une. Le Compagnon propose ce qu’il reconnaît, puis tu corriges ou confirmes.</p>${dateField('photoDate',todayKey())}<div class="field"><label>Moment</label><select id="photoMealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><div class="photo-actions"><label class="action photo-action">Prendre une photo<input id="foodPhotoInput" type="file" accept="image/*" capture="environment" hidden></label><label class="action secondary photo-action">Photothèque<input id="foodLibraryInput" type="file" accept="image/*" hidden></label></div><div id="foodPhotoPreview" class="photo-preview empty">Aucune photo sélectionnée.</div><div id="foodAIStatus" class="ai-status"></div>`,pendingNutritionMealType?()=>openSheet('nutritionMealAdd'):null);
  if(kind==='photoCompare') {
    LTDB.all('photos').then(photos=>{
      const dates=[...new Set(photos.map(p=>p.date))].sort().reverse();
      if(dates.length<2){
        openPhotoSensitiveSheet(`<h2>Comparer deux dates</h2><div class="empty">Ajoute des photos sur au moins deux dates différentes pour lancer une comparaison.</div>`);
        return;
      }
      openPhotoSensitiveSheet(`<h2>Comparer deux dates</h2><p class="subtle">Choisis deux moments de ton évolution.</p><div class="compare-date-grid"><div class="field"><label>Avant</label><select id="compareDateA">${dates.map((d,i)=>`<option value="${d}" ${i===1?'selected':''}>${formatPhotoDate(d)}</option>`).join('')}</select></div><div class="field"><label>Après</label><select id="compareDateB">${dates.map((d,i)=>`<option value="${d}" ${i===0?'selected':''}>${formatPhotoDate(d)}</option>`).join('')}</select></div></div><button class="action" id="launchPhotoCompare" type="button">Afficher la comparaison</button>`);
      $('#launchPhotoCompare')?.addEventListener('click',()=>renderPhotoComparison($('#compareDateA').value,$('#compareDateB').value));
    });
    return;
  }
  if(kind==='progressPhoto') {
    stopProgressCamera();
    return showSheet(`<h2>Photo d’évolution</h2><p class="subtle">Prends une photo ou choisis-en une, puis recadre-la avant de l’enregistrer.</p>${dateField('photoDate',todayKey())}<div class="field"><label>Vue</label><select id="progressPhotoView"><option>Face</option><option>Profil</option><option>Dos</option></select></div><div class="photo-source-actions"><button class="action" id="openProgressCamera" type="button">Prendre une photo</button><label class="action secondary">Photothèque<input id="progressLibraryInput" type="file" accept="image/*" hidden></label></div><div class="photo-guide-note">Conseil : même lumière, même distance et posture détendue pour rendre les comparaisons utiles.</div>`);
  }
  if(kind==='mealIdea') return mealIdeaSheet();
  if(kind==='goalEdit') return showSheet(`<h2>Objectif principal</h2><p class="subtle">C’est ton cap. Fluidité peut conseiller, mais toi seul le modifies.</p><form id="goalEditForm"><div class="field"><label>Objectif</label><select name="goal"><option value="Recomposition corporelle" ${state.profile.goal==='Recomposition corporelle'?'selected':''}>Recomposition corporelle</option><option value="Abdos visibles" ${state.profile.goal==='Abdos visibles'?'selected':''}>Abdos visibles</option><option value="Progression Force" ${state.profile.goal==='Progression Force'?'selected':''}>Progression Force</option><option value="Performance course" ${state.profile.goal==='Performance course'?'selected':''}>Performance course</option><option value="Maintien" ${state.profile.goal==='Maintien'?'selected':''}>Maintien</option></select></div><div class="field"><label>Ou préciser librement</label><input name="customGoal" value="${escapeHtml(['Recomposition corporelle','Abdos visibles','Progression Force','Performance course','Maintien'].includes(state.profile.goal)?'':(state.profile.goal||''))}" placeholder="Ex. perdre du tour de taille sans perdre de force"></div><button class="action" type="submit">Confirmer l’objectif</button></form>`);
  if(kind==='details') return showSheet(`<h2>Données détaillées</h2><p class="subtle">Les graphiques restent volontairement derrière Évolution. Ce niveau sera enrichi sans changer l’écran principal.</p><button class="action secondary" data-close>Fermer</button>`);
}

async function copyMealFromYesterday(type){
  const today=todayKey(),yesterday=previousDayKey(today);
  const all=await LTDB.all('food');
  const source=all.filter(x=>x.date===yesterday&&x.mealType===type);
  if(!source.length){toast(`Aucun ${mealTypeLabel(type).toLowerCase()} hier`);return;}
  const existing=all.filter(x=>x.date===today&&x.mealType===type);
  let mode='add';
  if(existing.length){
    const replace=confirm(`${mealTypeLabel(type)} contient déjà ${existing.length} élément${existing.length>1?'s':''}.\n\nOK = remplacer par le repas d’hier\nAnnuler = ajouter le repas d’hier`);
    mode=replace?'replace':'add';
  }
  if(mode==='replace'){
    for(const x of existing) await LTDB.del('food',x.id);
  }
  const stamp=Date.now();
  for(let i=0;i<source.length;i++){
    const x=source[i];
    const copy={...x,id:uid(),date:today,createdAt:new Date(stamp+i).toISOString(),copiedFromDate:yesterday,copiedFromId:x.id};
    await LTDB.put('food',copy);
  }
  toast(`${mealTypeLabel(type)} copié depuis hier`);
  await nutritionHubSheet();render();
}



function addIngredientToCurrentRecipe(ingredient){
  if(!state.recipeEditing) state.recipeEditing={id:'',name:'',portions:1,ingredients:[]};
  if(!Array.isArray(state.recipeEditing.ingredients)) state.recipeEditing.ingredients=[];
  state.recipeEditing.ingredients.push({
    name:ingredient.name||'Ingrédient',
    qty:Number(ingredient.qty)||0,
    protein:Number(ingredient.protein)||0,
    calories:Number(ingredient.calories)||0,
    carbs:Number(ingredient.carbs)||0,
    fat:Number(ingredient.fat)||0,
    source:ingredient.source||'manual'
  });
  state.recipeIngredientMode=false;
  renderRecipeEditor();
  toast('Ingrédient ajouté à la recette');
}

async function getPersonalRecipes(){
  const rows=await LTDB.all('memory');
  return rows.filter(x=>x.type==='personal-recipe').sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
}
function recipeTotals(ingredients=[]){
  return ingredients.reduce((a,x)=>({calories:a.calories+(Number(x.calories)||0),protein:a.protein+(Number(x.protein)||0),carbs:a.carbs+(Number(x.carbs)||0),fat:a.fat+(Number(x.fat)||0)}),{calories:0,protein:0,carbs:0,fat:0});
}
function recipeIngredientRow(i,x={}){
  return `<div class="recipe-ingredient-row" data-recipe-row="${i}"><input name="ingredientName" placeholder="Ingrédient" value="${escapeHtml(x.name||'')}"><input name="ingredientQty" type="number" min="0" step="0.1" placeholder="g" value="${x.qty??''}"><input name="ingredientProtein" type="number" min="0" step="0.1" placeholder="Prot." value="${x.protein??''}"><input name="ingredientCalories" type="number" min="0" step="1" placeholder="kcal" value="${x.calories??''}"><input name="ingredientCarbs" type="number" min="0" step="0.1" placeholder="Gluc." value="${x.carbs??''}"><input name="ingredientFat" type="number" min="0" step="0.1" placeholder="Lip." value="${x.fat??''}"><button type="button" class="recipe-remove" data-remove-recipe-row="${i}">×</button></div>`;
}
async function personalRecipesSheet(){
  const recipes=await getPersonalRecipes();
  return showSheet(`<div class="nutrition-page-head"><div><div class="card-kicker">Alimentation</div><h2>Mes recettes</h2></div><button class="action compact" type="button" data-new-recipe>＋ Nouvelle</button></div>${recipes.length?`<div class="personal-recipe-list">${recipes.map(r=>{const t=recipeTotals(r.ingredients),p=Math.max(1,Number(r.portions)||1);return `<section class="personal-recipe-card"><button type="button" class="personal-recipe-main" data-use-recipe="${r.id}"><div><strong>${escapeHtml(r.name||'Recette')}</strong><small>${r.ingredients?.length||0} ingrédient${(r.ingredients?.length||0)>1?'s':''} · ${p} portion${p>1?'s':''}</small></div><span>${Math.round(t.calories/p)} kcal<br><small>${Math.round(t.protein/p)} g prot. / portion</small></span></button><button type="button" class="recipe-edit-link" data-edit-recipe="${r.id}">Modifier</button></section>`}).join('')}</div>`:`<div class="empty">Aucune recette personnelle. Crée ta première recette.</div>`}`);
}
async function recipeEditorSheet(id=''){
  const recipes=await getPersonalRecipes(),r=recipes.find(x=>x.id===id)||{id:'',name:'',portions:1,ingredients:[]};
  state.recipeEditing={...r,ingredients:(r.ingredients||[]).map(x=>({...x}))};
  renderRecipeEditor();
}
function renderRecipeEditor(){
  const r=state.recipeEditing||{id:'',name:'',portions:1,ingredients:[]},t=recipeTotals(r.ingredients),p=Math.max(.01,Number(r.portions)||1);
  const ingredientList=(r.ingredients||[]).length
    ? `<div class="recipe-added-list">${r.ingredients.map((x,i)=>`<div class="recipe-added-item"><div><strong>${escapeHtml(x.name||'Ingrédient')}</strong><small>${x.qty?`${x.qty} g · `:''}${Math.round(Number(x.calories)||0)} kcal · ${(Number(x.protein)||0).toFixed(1)} g prot.</small></div><button type="button" class="recipe-remove" data-remove-recipe-row="${i}">×</button></div>`).join('')}</div>`
    : `<div class="empty recipe-empty">Aucun ingrédient. Appuie sur « Ajouter un ingrédient ».</div>`;
  showSheet(`<h2>${r.id?'Modifier':'Nouvelle'} recette</h2><form id="recipeForm"><div class="field"><label>Nom de la recette</label><input name="recipeName" required value="${escapeHtml(r.name||'')}" placeholder="Ex. Bowl cake"></div><div class="field"><label>Nombre de portions préparées</label><input name="recipePortions" type="number" min="0.25" step="0.25" required value="${r.portions||1}"><small>Ex. 4 si la recette complète donne quatre portions.</small></div><div class="recipe-section-title"><strong>Ingrédients</strong><button type="button" class="text-action" data-add-recipe-ingredient>＋ Ajouter</button></div>${ingredientList}<section class="recipe-preview"><strong>Par portion</strong><div><span>${Math.round(t.calories/p)} kcal</span><span>${(t.protein/p).toFixed(1)} g prot.</span><span>${(t.carbs/p).toFixed(1)} g gluc.</span><span>${(t.fat/p).toFixed(1)} g lip.</span></div></section><button class="action" type="submit">Enregistrer la recette</button>${r.id?`<button class="recipe-delete-action" type="button" data-delete-recipe="${r.id}">Supprimer la recette</button>`:''}</form>`);
}
function syncRecipeEditorFromForm(){
  const f=$('#recipeForm');if(!f||!state.recipeEditing)return;
  state.recipeEditing.name=String(f.recipeName?.value||'');
  state.recipeEditing.portions=Number(f.recipePortions?.value)||1;
}
async function savePersonalRecipe(e){
  e.preventDefault();syncRecipeEditorFromForm();
  const r=state.recipeEditing;if(!r?.name.trim())return;
  r.ingredients=(r.ingredients||[]).filter(x=>x.name.trim());
  if(!r.ingredients.length){toast('Ajoute au moins un ingrédient');return;}
  const now=new Date().toISOString();
  await LTDB.put('memory',{...r,id:r.id||uid(),type:'personal-recipe',createdAt:r.createdAt||now,updatedAt:now});
  toast('Recette enregistrée');await personalRecipesSheet();
}
function confirmDeletePersonalRecipe(id){
  const r=state.recipeEditing;if(!r?.id||r.id!==id)return;
  syncRecipeEditorFromForm();
  showSheet(`<div class="recipe-delete-confirm"><h2>Supprimer cette recette ?</h2><p class="subtle">« ${escapeHtml(r.name||'Cette recette')} » sera retirée de Mes recettes. Les repas déjà enregistrés dans ton suivi resteront inchangés.</p><div class="recipe-delete-confirm-actions"><button class="recipe-delete-action solid" type="button" data-confirm-delete-recipe="${r.id}">Supprimer définitivement</button><button class="action secondary" type="button" data-cancel-delete-recipe>Annuler</button></div></div>`,()=>renderRecipeEditor());
}
async function deletePersonalRecipe(id){
  const r=state.recipeEditing;if(!r?.id||r.id!==id)return;
  await LTDB.del('memory',id);
  state.recipeEditing=null;
  toast('Recette supprimée');
  await personalRecipesSheet();
}
async function usePersonalRecipe(id){
  const recipes=await getPersonalRecipes(),r=recipes.find(x=>x.id===id);if(!r)return;
  state.recipeToUse=r;
  const t=recipeTotals(r.ingredients),p=Math.max(.01,Number(r.portions)||1);
  showSheet(`<h2>${escapeHtml(r.name)}</h2><p class="subtle">Quelle quantité as-tu mangée ?</p><form id="useRecipeForm"><input type="hidden" name="recipeId" value="${r.id}"><div class="portion-pills">${[['0.25','¼'],['0.5','½'],['0.75','¾'],['1','1'],['1.5','1½'],['2','2']].map(([v,l])=>`<label><input type="radio" name="portionUsed" value="${v}" ${v==='1'?'checked':''}><span>${l}</span></label>`).join('')}</div><div class="field"><label>Ou saisir une portion</label><input name="customPortion" type="number" min="0.05" step="0.05" placeholder="Ex. 0.33"></div><div class="field"><label>Repas</label><select name="mealType">${mealTypeOptions(pendingNutritionMealType||'lunch')}</select></div><section class="recipe-preview"><strong>Pour 1 portion</strong><div><span>${Math.round(t.calories/p)} kcal</span><span>${(t.protein/p).toFixed(1)} g prot.</span><span>${(t.carbs/p).toFixed(1)} g gluc.</span><span>${(t.fat/p).toFixed(1)} g lip.</span></div></section><button class="action" type="submit">Ajouter au repas</button></form>`);
}
async function addRecipeToMeal(e){
  e.preventDefault();const f=new FormData(e.currentTarget),r=state.recipeToUse;if(!r)return;
  const used=Number(f.get('customPortion'))||Number(f.get('portionUsed'))||1,p=Math.max(.01,Number(r.portions)||1),t=recipeTotals(r.ingredients),factor=used/p;
  await LTDB.put('food',{id:uid(),date:todayKey(),mealType:f.get('mealType')||'lunch',description:r.name,protein:Number((t.protein*factor).toFixed(1)),calories:Math.round(t.calories*factor),carbs:Number((t.carbs*factor).toFixed(1)),fat:Number((t.fat*factor).toFixed(1)),water:0,classic:false,source:'personal-recipe',recipeId:r.id,recipePortion:used,createdAt:new Date().toISOString()});
  toast(`${r.name} ajouté · ${used} portion${used>1?'s':''}`);pendingNutritionMealType=null;await nutritionHubSheet();render();
}



async function nutritionProposalContext(){
  const [food,cardio,recipes]=await Promise.all([LTDB.all('food'),LTDB.all('cardio'),getPersonalRecipes()]);
  const today=todayKey(),todayFood=food.filter(x=>x.date===today),target=Number(state.profile.proteinTarget)||170;
  const sum=k=>todayFood.reduce((s,x)=>s+(Number(x[k])||0),0);
  return {
    date:today,hour:new Date().getHours(),goal:state.profile.goal||null,proteinTarget:target,
    today:{protein:Number(sum('protein').toFixed(1)),calories:Math.round(sum('calories')),carbs:Number(sum('carbs').toFixed(1)),fat:Number(sum('fat').toFixed(1)),entries:todayFood.length},
    cardioToday:cardio.filter(x=>x.date===today).map(x=>({type:x.type||null,distance:x.distance??null,duration:x.durationLabel||null})),
    personalRecipes:recipes.slice(0,12).map(r=>{const t=recipeTotals(r.ingredients),p=Math.max(.01,Number(r.portions)||1);return {id:r.id,name:r.name,protein:Number((t.protein/p).toFixed(1)),calories:Math.round(t.calories/p),carbs:Number((t.carbs/p).toFixed(1)),fat:Number((t.fat/p).toFixed(1))}})
  };
}
async function fetchNutritionSuggestions(){
  const context=await nutritionProposalContext();
  const r=await fetch('/.netlify/functions/nutrition-recipes-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context})});
  const data=await r.json();if(!r.ok)throw new Error(data.detail||data.error||'Propositions indisponibles');
  state.nutritionSuggestions=data.suggestions||[];
  return state.nutritionSuggestions;
}
async function openCompanionRecipe(){
  showSheet(`<h2>Ta recette</h2><div class="nutrition-ai-loading">Je regarde ta journée et je prépare une recette adaptée…</div>`,()=>{$('#sheet').close()});
  try{const rows=await fetchNutritionSuggestions();if(!rows.length)throw new Error('Aucune recette');state.nutritionSuggestionIndex=0;showNutritionRecipeDetail(0);}
  catch(e){console.error(e);showSheet(`<h2>Ta recette</h2><p class="subtle">Je n’arrive pas à préparer une recette fiable pour le moment.</p><button class="action secondary" data-close>Retour au Compagnon</button>`,()=>{$('#sheet').close()});}
}
async function openNutritionProposals(){
  showSheet(`<h2>Propositions de repas</h2><div class="nutrition-ai-loading">Je regarde ta journée et je prépare 3 idées réalistes…</div>`);
  try{await fetchNutritionSuggestions();renderNutritionProposals();}
  catch(e){console.error(e);showSheet(`<h2>Propositions de repas</h2><p class="subtle">Je n’arrive pas à générer des propositions fiables pour le moment.</p><button class="action secondary" data-close>Fermer</button>`);}
}
function renderNutritionProposals(){
  const rows=state.nutritionSuggestions||[];
  showSheet(`<h2>Propositions de repas</h2><p class="subtle">Estimations à confirmer avant enregistrement.</p><div class="nutrition-ai-list">${rows.map((x,i)=>`<button class="nutrition-ai-card nutrition-ai-card-button" data-open-ai-recipe="${i}"><div><strong>${escapeHtml(x.name)}</strong><small>${Math.round(x.calories)} kcal · ${Math.round(x.protein)} g prot. · ${Math.round(x.carbs)} g gluc. · ${Math.round(x.fat)} g lip.</small></div><p>${escapeHtml(x.reason||'Voir la recette')}</p></button>`).join('')}</div>`);
  document.querySelectorAll('[data-open-ai-recipe]').forEach(b=>b.onclick=()=>showNutritionRecipeDetail(Number(b.dataset.openAiRecipe),renderNutritionProposals));
}
function normalizeRecipeName(v=''){return String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function nutritionSuggestionRecipeKey(x={}){return [normalizeRecipeName(x.name),Math.round(Number(x.calories)||0),Math.round(Number(x.protein)||0),Math.round(Number(x.carbs)||0),Math.round(Number(x.fat)||0)].join('|');}
function storedRecipeSuggestionKey(r={}){const m=r.estimatedMacros||recipeTotals(r.ingredients||[]);return nutritionSuggestionRecipeKey({name:r.name,calories:m.calories,protein:m.protein,carbs:m.carbs,fat:m.fat});}
async function showNutritionRecipeDetail(i,backAction=null){
  const rows=state.nutritionSuggestions||[],x=rows[i];if(!x)return;
  state.nutritionSuggestionIndex=i;
  const savedKey=nutritionSuggestionRecipeKey(x);
  const savedRecipes=await getPersonalRecipes();
  const alreadySaved=savedRecipes.some(r=>r.source==='companion-suggestion'&&storedRecipeSuggestionKey(r)===savedKey);
  const ingredients=(x.ingredients||[]).map(v=>`<li>${escapeHtml(v)}</li>`).join('');
  const prep=(x.preparation||[]).map((v,j)=>`<li><span>${j+1}</span><p>${escapeHtml(v)}</p></li>`).join('');
  showSheet(`<div class="companion-recipe-detail"><div class="card-kicker">RECETTE DU COMPAGNON</div><h2>${escapeHtml(x.name)}</h2>${x.reason?`<p class="subtle">${escapeHtml(x.reason)}</p>`:''}<div class="recipe-macro-grid"><div><strong>${Math.round(x.calories)}</strong><small>kcal</small></div><div><strong>${Math.round(x.protein)} g</strong><small>Protéines</small></div><div><strong>${Math.round(x.carbs)} g</strong><small>Glucides</small></div><div><strong>${Math.round(x.fat)} g</strong><small>Lipides</small></div></div><section class="recipe-detail-section"><h3>Ingrédients</h3><ul class="recipe-detail-ingredients">${ingredients}</ul></section>${prep?`<section class="recipe-detail-section"><h3>Préparation</h3><ol class="recipe-detail-steps">${prep}</ol></section>`:''}<div class="recipe-detail-actions"><button class="action" data-add-ai-meal-detail="${i}">Ajouter au repas du jour</button><button class="action secondary${alreadySaved?' recipe-saved':''}" data-save-ai-recipe-detail="${i}" ${alreadySaved?'disabled aria-disabled="true"':''}>${alreadySaved?'✓ Ajoutée à Mes recettes':'Ajouter à Mes recettes'}</button>${rows.length>1?`<button class="text-action recipe-another" data-next-ai-recipe>Une autre idée</button>`:''}</div></div>`,backAction||(()=>{$('#sheet').close()}));
  $('[data-add-ai-meal-detail]')?.addEventListener('click',()=>confirmNutritionSuggestionSheet(i));
  $('[data-save-ai-recipe-detail]')?.addEventListener('click',()=>saveNutritionSuggestionRecipe(i,backAction));
  $('[data-next-ai-recipe]')?.addEventListener('click',()=>showNutritionRecipeDetail((i+1)%rows.length,backAction));
}
function confirmNutritionSuggestionSheet(i){
  const x=(state.nutritionSuggestions||[])[i];if(!x)return;
  showSheet(`<h2>Ajouter au suivi du jour</h2><p class="subtle">${escapeHtml(x.name)} · ${Math.round(x.calories)} kcal · ${Math.round(x.protein)} g prot.</p><form id="confirmAIRecipeMeal"><div class="field"><label>Repas</label><select name="mealType">${mealTypeOptions(x.mealType||'dinner')}</select></div><button class="action" type="submit">Confirmer l’ajout</button></form>`,()=>showNutritionRecipeDetail(i));
  $('#confirmAIRecipeMeal')?.addEventListener('submit',e=>{e.preventDefault();confirmNutritionSuggestion(i,new FormData(e.currentTarget).get('mealType'));});
}
async function confirmNutritionSuggestion(i,mealType=null){
  const x=(state.nutritionSuggestions||[])[i];if(!x)return;
  await LTDB.put('food',{id:uid(),date:todayKey(),mealType:mealType||x.mealType||'dinner',description:x.name,protein:Number(x.protein)||0,calories:Number(x.calories)||0,carbs:Number(x.carbs)||0,fat:Number(x.fat)||0,water:0,classic:false,source:'companion-suggestion',createdAt:new Date().toISOString()});
  toast('Repas ajouté au suivi du jour');document.querySelector('#sheet')?.close();render();
}
async function saveNutritionSuggestionRecipe(i,backAction=null){
  const x=(state.nutritionSuggestions||[])[i];if(!x)return;
  const btn=$('[data-save-ai-recipe-detail]');
  if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent='Ajout en cours…';}
  const key=nutritionSuggestionRecipeKey(x),recipes=await getPersonalRecipes();
  const existing=recipes.find(r=>r.source==='companion-suggestion'&&storedRecipeSuggestionKey(r)===key);
  if(existing){toast('Cette recette est déjà dans Mes recettes');await showNutritionRecipeDetail(i,backAction);return;}
  const ingredients=(x.ingredients||[]).map((name,j)=>({name,qty:0,protein:j?0:Number(x.protein)||0,calories:j?0:Number(x.calories)||0,carbs:j?0:Number(x.carbs)||0,fat:j?0:Number(x.fat)||0,source:'ai-suggestion'}));
  await LTDB.put('memory',{id:uid(),type:'personal-recipe',name:x.name,portions:1,ingredients,preparation:x.preparation||[],estimatedMacros:{protein:x.protein,calories:x.calories,carbs:x.carbs,fat:x.fat},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:'companion-suggestion'});
  toast('Recette ajoutée à Mes recettes');await showNutritionRecipeDetail(i,backAction);
}

async function nutritionHistorySheet(year=null,month=null){
  const now=new Date(), y=year??state.nutritionCalendarYear??now.getFullYear(), m=month??state.nutritionCalendarMonth??now.getMonth();
  state.nutritionCalendarYear=y;state.nutritionCalendarMonth=m;
  const all=await LTDB.all('food');
  const daysWithFood=new Set(all.map(x=>x.date));
  const first=new Date(y,m,1), last=new Date(y,m+1,0), offset=(first.getDay()+6)%7;
  const cells=[];
  for(let i=0;i<offset;i++)cells.push('<span class="calendar-empty"></span>');
  for(let day=1;day<=last.getDate();day++){
    const key=dateKeyFromDate(new Date(y,m,day)),has=daysWithFood.has(key),today=key===todayKey();
    cells.push(`<button type="button" class="calendar-day${has?' has-food':''}${today?' is-today':''}" data-history-date="${key}"><span>${day}</span>${has?'<i></i>':''}</button>`);
  }
  const prev=new Date(y,m-1,1),next=new Date(y,m+1,1);
  return showSheet(`<div class="nutrition-page-head"><div><div class="card-kicker">Alimentation</div><h2>Historique</h2></div><button type="button" class="text-action" data-history-today>Aujourd’hui</button></div><section class="nutrition-calendar"><div class="calendar-nav"><button type="button" data-calendar-month="${prev.getFullYear()}-${prev.getMonth()}">‹</button><strong>${monthLabel(y,m)}</strong><button type="button" data-calendar-month="${next.getFullYear()}-${next.getMonth()}">›</button></div><div class="calendar-weekdays">${['L','M','M','J','V','S','D'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></section><p class="nutrition-safe-note">Les jours marqués contiennent des données alimentaires. Choisis une date pour revoir ou modifier ses repas.</p>`);
}
async function nutritionHistoryDaySheet(date){
  state.nutritionHistoryDate=date;
  const all=await LTDB.all('food'),food=all.filter(x=>x.date===date).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const total=mealSummary(food),target=state.profile.proteinTarget||170,mealOrder=['breakfast','lunch','snack','dinner'];
  const byMeal=Object.fromEntries(mealOrder.map(type=>[type,food.filter(x=>x.mealType===type)]));
  return showSheet(`<div class="nutrition-page-head"><div><div class="card-kicker">Historique</div><h2>${formatNutritionDate(date)}</h2></div><button type="button" class="text-action" data-history-back>Calendrier</button></div><section class="nutrition-day-summary"><div class="nutrition-day-top"><strong>${Math.round(total.calories)} kcal</strong><span>${Math.round(total.protein)} / ${target} g protéines</span></div><div class="nutrition-day-macros"><div><b>${Math.round(total.protein)} g</b><span>Protéines</span></div><div><b>${Math.round(total.carbs)} g</b><span>Glucides</span></div><div><b>${Math.round(total.fat)} g</b><span>Lipides</span></div></div></section><div class="history-meals">${mealOrder.map(type=>{const rows=byMeal[type],sum=mealSummary(rows);return `<section class="nutrition-meal-card"><div class="nutrition-meal-head"><div class="nutrition-meal-title"><span class="nutrition-meal-icon">${mealIcon(type)}</span><div><strong>${mealTypeLabel(type)}</strong><small>${rows.length?`${Math.round(sum.calories)} kcal · ${Math.round(sum.protein)} g prot.`:'Aucune saisie'}</small></div></div></div>${rows.length?`<div class="meal-items">${rows.map(x=>`<button type="button" class="meal-item-row" data-edit-food="${x.id}"><span>${escapeHtml(x.description||'Aliment')}</span><small>${x.calories?Math.round(x.calories)+' kcal':''}${x.protein?` · ${Math.round(x.protein)} g prot.`:''}</small><b>›</b></button>`).join('')}</div>`:''}</section>`}).join('')}</div>`);
}

async function nutritionHubSheet(){
  pendingNutritionMealType=null;
  const all=await LTDB.all('food');
  const food=all.filter(x=>x.date===todayKey()).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const total=mealSummary(food);
  const target=state.profile.proteinTarget||170;
  const calorieTarget=2250;
  const proteinPct=Math.min(100,target?total.protein/target*100:0);
  const caloriePct=Math.min(100,calorieTarget?total.calories/calorieTarget*100:0);
  const remain=Math.max(0,target-total.protein);
  const mealOrder=['breakfast','lunch','snack','dinner'];
  const byMeal=Object.fromEntries(mealOrder.map(type=>[type,food.filter(x=>x.mealType===type)]));
  const fluidityText=remain>0
    ? `<strong>${Math.round(remain)} g de protéines restantes.</strong><span>${remain>60?'Tu as encore de la marge pour compléter tranquillement.':remain>25?'La journée avance bien, complète au prochain repas.':'Tu es tout près de ton repère du jour.'}</span>`
    : `<strong>Repère protéines atteint.</strong><span>Pas besoin d’en faire plus : garde simplement ton équilibre.</span>`;
  return showSheet(`<div class="nutrition-page-head nutrition-page-head-v2"><div><div class="card-kicker">Alimentation</div><h2>Aujourd’hui</h2></div><div class="nutrition-head-actions"><span class="nutrition-date">${new Intl.DateTimeFormat('fr-CH',{weekday:'short',day:'numeric',month:'short'}).format(new Date())}</span><button type="button" class="nutrition-calendar-button" data-nutrition-history aria-label="Historique">▦</button></div></div>
    <section class="nutrition-day-summary nutrition-day-summary-v2">
      <div class="nutrition-calorie-ring" style="--progress:${caloriePct*3.6}deg"><div><strong>${Math.round(total.calories)}</strong><span>kcal</span><small>sur ${calorieTarget}</small></div></div>
      <div class="nutrition-v2-macros">
        <div><span>Protéines</span><b>${Math.round(total.protein)} <small>g</small></b><em>sur ${target} g</em><i><u style="width:${proteinPct}%"></u></i></div>
        <div><span>Glucides</span><b>${Math.round(total.carbs)} <small>g</small></b><em>aujourd’hui</em></div>
        <div><span>Lipides</span><b>${Math.round(total.fat)} <small>g</small></b><em>aujourd’hui</em></div>
      </div>
      <div class="nutrition-fluidity-note">${companionMark("companion-mark-mini")}<div>${fluidityText}</div></div>
    </section>
    <div class="nutrition-meals nutrition-meals-v2">${mealOrder.map(type=>nutritionMealCard(type,byMeal[type])).join('')}</div>
    <button type="button" class="nutrition-recipes-link" data-personal-recipes><span>▤</span><div><strong>Mes recettes</strong><small>Voir et gérer tes recettes</small></div><b>›</b></button>`);
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
    <label class="checkline nutrition-edit-favorite"><input type="checkbox" name="classic" ${x.classic?'checked':''}> Ajouter aux favoris</label>
    <div class="nutrition-edit-copy"><div class="field"><label>Copier vers un autre repas du jour</label><select id="foodCopyMealType">${mealTypeOptions(x.mealType||'')}</select></div><button class="action secondary" type="button" id="copyFoodToMeal">Copier cette ligne</button></div>
    <div class="edit-actions"><button class="action" type="submit">Enregistrer les modifications</button><button class="action danger" type="button" id="deleteFood">Supprimer</button></div>
  </form>`);
}
async function updateFood(e){
  e.preventDefault(); const f=new FormData(e.currentTarget); const old=await LTDB.get('food',f.get('id')); if(!old)return;
  await LTDB.put('food',{...old,date:f.get('date')||old.date||todayKey(),mealType:f.get('mealType')||old.mealType||'lunch',description:f.get('description')||'Repas',protein:num(f.get('protein')),calories:num(f.get('calories')),carbs:num(f.get('carbs')),fat:num(f.get('fat')),water:num(f.get('water')),classic:f.get('classic')==='on',updatedAt:new Date().toISOString()});
  toast('Repas modifié'); const editedDate=f.get('date')||old.date||todayKey(); if(editedDate===todayKey()) await nutritionHubSheet(); else await nutritionHistoryDaySheet(editedDate); render();
}
async function deleteFood(id){
  const old=await LTDB.get('food',id); await LTDB.del('food',id); toast('Repas supprimé'); if(old?.date&&old.date!==todayKey()) await nutritionHistoryDaySheet(old.date); else await nutritionHubSheet(); render();
}
async function copyFoodToMeal(id,mealType,button){
  const x=await LTDB.get('food',id); if(!x)return;
  const target=mealType||'snack';
  await LTDB.put('food',{...x,id:uid(),date:todayKey(),dateTime:new Date().toISOString(),mealType:target,source:'meal-copy',createdAt:new Date().toISOString(),updatedAt:null});
  if(button){button.disabled=true;button.textContent=`✓ Copié vers ${mealTypeLabel(target)}`;}
  toast(`Copié vers ${mealTypeLabel(target)}`); render();
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
  const muscles=workout.id==='recovery'?['Mobilité','Respiration','Core']:workout.id==='lower'?['Jambes','Fessiers','Core']:workout.id==='pull'?['Dos','Biceps','Arrière épaules']:['Pectoraux','Dos','Épaules'];
  showSheet(`<div class="force-v1-detail">
    <div class="force-v1-kicker">✦ &nbsp;DÉTAIL DE TA SÉANCE</div>
    <h2>${escapeHtml(workout.title)}</h2>
    <p class="force-v1-lead">Séance adaptée à ton état du jour et à ta progression.</p>
    <div class="force-v1-chips">${muscles.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div>
    <div class="force-v1-stats"><div><b>◷</b><strong>${parseInt(workout.subtitle)||40} min</strong><small>Durée</small></div><div><b>▥</b><strong>${workout.id==='recovery'?'Légère':'Modérée'}</strong><small>Intensité</small></div><div><b>◎</b><strong>${plan.length}</strong><small>Exercices</small></div></div>
    <div class="force-v1-note"><strong>♡ Pourquoi cette séance ?</strong><p>Fluidité conserve une charge de travail cohérente tout en te laissant ajuster chaque exercice si nécessaire.</p></div>
    <h3 class="force-v1-section-title">Ta séance</h3>
    <div class="force-v1-exercises">${plan.map((x,i)=>`<div class="force-v1-exercise"><div class="force-v1-num">${i+1}</div><button type="button" class="force-v1-exercise-main" data-technique="${escapeHtml(x.name)}"><strong>${escapeHtml(x.name)}</strong><span>${x.sets} × ${x.reps} · repos conseillé ${x.rest}</span>${x.last?`<small>Dernière fois : ${escapeHtml(x.last.performance||'enregistrée')}</small>`:'<small>Toucher pour voir la technique</small>'}</button><button class="force-v1-swap" type="button" data-swap-exercise="${i}" aria-label="Remplacer">↻</button></div>`).join('')}</div>
    <button class="action orange force-v1-start" id="startChosenWorkout">Démarrer la séance</button>
    <button class="action secondary" data-sheet="workoutIdeas">Choisir une autre séance</button>
  </div>`);
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
  return showSheet(`<div class="force-v1-active"><div class="force-v1-active-head"><div><div class="force-v1-kicker">✦ &nbsp;SÉANCE EN COURS</div><h2>${escapeHtml(w.title)}</h2><p>Entre simplement tes reps et ta charge.</p></div><span>${w.plan.length} exercices</span></div>
    <form id="workoutForm"><input type="hidden" name="name" value="${escapeHtml(w.title)}">${dateField('date',todayKey())}
    ${w.plan.map((x,i)=>dynamicExerciseInput(x,i)).join('')}
    <div class="force-v1-finish"><div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="${parseInt(w.subtitle)||40}"></div>${slider('effort','Ressenti de la séance','1','5','1','3','/5')}<button class="action orange" type="submit">Terminer la séance</button></div></form></div>`);
}
function dynamicExerciseInput(x,idx){
  const rows=Array.from({length:x.sets},(_,s)=>`<div class="force-v1-set"><span>${s+1}</span><input name="reps_${idx}_${s}" type="number" inputmode="numeric" value="${typeof x.reps==='number'?x.reps:''}" placeholder="${x.reps}"><input name="weight_${idx}_${s}" type="number" step="0.5" inputmode="decimal" placeholder="kg"></div>`).join('');
  return `<section class="force-v1-live-exercise"><div class="force-v1-live-title"><div><small>EXERCICE ${idx+1}</small><strong>${escapeHtml(x.name)}</strong><span>${x.sets} séries × ${x.reps} · repos conseillé ${x.rest}</span></div><button type="button" class="technique-btn" data-technique="${escapeHtml(x.name)}">Technique ›</button></div>${x.last?`<div class="force-v1-last">Dernière séance : ${escapeHtml(x.last.performance||'enregistrée')}</div>`:''}<div class="force-v1-set-head"><span>Série</span><span>Reps</span><span>Poids</span></div>${rows}</section>`;
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
  const guides={
    'Développé couché':{focus:'Pectoraux · Triceps · Épaules',steps:['Pieds stables au sol, omoplates serrées.','Descends la barre avec contrôle vers le bas des pectoraux.','Pousse sans décoller les épaules du banc.'],errors:['Coudes trop écartés','Rebond sur la poitrine','Épaules qui partent vers l’avant'],video:'développé couché technique'},
    'Tractions':{focus:'Dos · Biceps',steps:['Pars bras tendus avec les épaules actives.','Amène la poitrine vers la barre sans balancer.','Redescends sous contrôle jusqu’à l’extension.'],errors:['Élan des jambes','Amplitude raccourcie','Nuque projetée'],video:'tractions technique'},
    'Rowing':{focus:'Dos · Biceps',steps:['Garde le tronc stable et le dos neutre.','Tire les coudes vers l’arrière.','Contrôle le retour sans arrondir le dos.'],errors:['Dos arrondi','Élan du buste','Épaules remontées'],video:'rowing musculation technique'}
  };
  const g=guides[name]||{focus:'Mouvement contrôlé',steps:['Installe-toi dans une position stable.','Garde une amplitude confortable et contrôlée.','Expire pendant l’effort et conserve la maîtrise du retour.'],errors:['Charge trop lourde','Mouvement précipité','Amplitude forcée'],video:name+' technique musculation'};
  const q='https://www.youtube.com/results?search_query='+encodeURIComponent(g.video);
  showSheet(`<div class="force-v1-tech"><div class="force-v1-kicker">TECHNIQUE</div><h2>${escapeHtml(name)}</h2><p class="subtle">${escapeHtml(g.focus)}</p>
    <div class="force-v1-3d"><div class="force-v1-figure"><i></i><b></b><span></span></div><div><strong>Guide visuel 3D</strong><p>Repères de posture et trajectoire à consulter sans quitter ta séance.</p></div></div>
    <div class="force-v1-tech-card"><h3>Exécution</h3>${g.steps.map((x,i)=>`<div class="force-v1-tech-step"><b>${i+1}</b><span>${escapeHtml(x)}</span></div>`).join('')}</div>
    <div class="force-v1-tech-card danger"><h3>À éviter</h3>${g.errors.map(x=>`<p>× &nbsp;${escapeHtml(x)}</p>`).join('')}</div>
    <a class="action secondary force-v1-video" href="${q}" target="_blank" rel="noopener">▶ Voir une vidéo technique</a>
    <button class="action orange" type="button" data-force-back>Retour à la séance</button></div>`);
}

function bindSheet(){
  document.querySelectorAll('[data-sheet]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.sheet)));
  document.querySelectorAll('[data-meal-add]').forEach(b=>b.addEventListener('click',()=>{pendingNutritionMealType=b.dataset.mealAdd;openSheet('nutritionMealAdd')}));
  document.querySelectorAll('[data-copy-yesterday]').forEach(b=>b.addEventListener('click',()=>copyMealFromYesterday(b.dataset.copyYesterday)));

  $('[data-nutrition-history]')?.addEventListener('click',()=>nutritionHistorySheet());
  $('[data-history-today]')?.addEventListener('click',()=>nutritionHistoryDaySheet(todayKey()));
  $('[data-history-back]')?.addEventListener('click',()=>nutritionHistorySheet());
  document.querySelectorAll('[data-history-date]').forEach(b=>b.addEventListener('click',()=>nutritionHistoryDaySheet(b.dataset.historyDate)));
  document.querySelectorAll('[data-calendar-month]').forEach(b=>b.addEventListener('click',()=>{const [y,m]=b.dataset.calendarMonth.split('-').map(Number);nutritionHistorySheet(y,m)}));


  document.querySelectorAll('[data-food-favorites]').forEach(b=>b.addEventListener('click',foodFavoritesSheet));
  document.querySelectorAll('[data-use-food-favorite]').forEach(b=>b.addEventListener('click',()=>useFoodFavorite(b.dataset.useFoodFavorite)));
  document.querySelectorAll('[data-personal-recipes]').forEach(b=>b.addEventListener('click',personalRecipesSheet));
  $('[data-new-recipe]')?.addEventListener('click',()=>recipeEditorSheet());
  document.querySelectorAll('[data-edit-recipe]').forEach(b=>b.addEventListener('click',()=>recipeEditorSheet(b.dataset.editRecipe)));
  document.querySelectorAll('[data-use-recipe]').forEach(b=>b.addEventListener('click',()=>usePersonalRecipe(b.dataset.useRecipe)));

  document.querySelectorAll('[data-remove-recipe-row]').forEach(b=>b.addEventListener('click',()=>{syncRecipeEditorFromForm();state.recipeEditing.ingredients.splice(Number(b.dataset.removeRecipeRow),1);renderRecipeEditor()}));

  $('[data-add-recipe-ingredient]')?.addEventListener('click',()=>{syncRecipeEditorFromForm();state.recipeIngredientMode=true;openSheet('recipeIngredientAdd')});
  $('#recipeManualIngredientForm')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);addIngredientToCurrentRecipe({name:f.get('name'),qty:f.get('qty'),protein:f.get('protein'),calories:f.get('calories'),carbs:f.get('carbs'),fat:f.get('fat'),source:'manual'})});
  $('#recipeSearchConfirmForm')?.addEventListener('submit',saveRecipeSearchIngredient);
  $('#recipeSearchGrams')?.addEventListener('input',updateRecipeSearchPreview);
  if($('#recipeSearchConfirmForm')) updateRecipeSearchPreview();
  $('#recipeBarcodeConfirmForm')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),g=Number(f.get('grams'))||0;addIngredientToCurrentRecipe({name:f.get('name'),qty:g,calories:macroForPortion(f.get('pCalories'),g),protein:macroForPortion(f.get('pProtein'),g),carbs:macroForPortion(f.get('pCarbs'),g),fat:macroForPortion(f.get('pFat'),g),source:'barcode'})});
  $('#recipeAIConfirmForm')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);addIngredientToCurrentRecipe({name:f.get('name'),qty:f.get('qty'),protein:f.get('protein'),calories:f.get('calories'),carbs:f.get('carbs'),fat:f.get('fat'),source:'ai-photo'});pendingFoodImageData=null});

  $('#recipeForm')?.addEventListener('submit',savePersonalRecipe);
  $('[data-delete-recipe]')?.addEventListener('click',b=>confirmDeletePersonalRecipe(b.currentTarget.dataset.deleteRecipe));
  $('[data-confirm-delete-recipe]')?.addEventListener('click',b=>deletePersonalRecipe(b.currentTarget.dataset.confirmDeleteRecipe));
  $('[data-cancel-delete-recipe]')?.addEventListener('click',()=>renderRecipeEditor());
  $('#useRecipeForm')?.addEventListener('submit',addRecipeToMeal);

  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{stopBarcodeCamera();stopProgressCamera();if(sheetBackAction){const back=sheetBackAction;sheetBackAction=null;back();return;}$('#sheet').close()}));
  document.querySelectorAll('[data-workout-choice]').forEach(b=>b.addEventListener('click',()=>workoutDetailSheet(workoutById(b.dataset.workoutChoice))));
  document.querySelectorAll('[data-swap-exercise]').forEach(b=>b.addEventListener('click',()=>swapExerciseSheet(Number(b.dataset.swapExercise))));
  document.querySelectorAll('[data-exercise-replace]').forEach(b=>b.addEventListener('click',()=>{const [idx,name]=b.dataset.exerciseReplace.split('|');const i=Number(idx);if(state.pendingWorkout){state.pendingWorkout.plan[i]={...state.pendingWorkout.plan[i],name};workoutDetailSheet(state.pendingWorkout)}}));
  $('#startChosenWorkout')?.addEventListener('click',chosenWorkoutForm);
  $('[data-force-back]')?.addEventListener('click',chosenWorkoutForm);
  document.querySelectorAll('[data-pick-workout]').forEach(b=>b.addEventListener('click',()=>{openSheet('workout'); setTimeout(()=>{const f=$('#workoutForm'); if(f) f.elements.name.value=b.dataset.pickWorkout;},0)}));
  document.querySelectorAll('input[type="range"]').forEach(r=>r.addEventListener('input',()=>updateRange(r)));
  $('#goalEditForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),custom=String(f.get('customGoal')||'').trim(),goal=custom||String(f.get('goal')||'').trim();if(!goal)return;state.profile.goal=goal;await LTDB.put('profile',state.profile);$('#sheet').close();toast('Objectif mis à jour');render();});
  $('#checkinForm')?.addEventListener('submit',saveCheckin); $('#workoutForm')?.addEventListener('submit',saveWorkout); $('#cardioForm')?.addEventListener('submit',saveCardio); $('#cardioImportInput')?.addEventListener('change',handleCardioImport); $('#cardioImportConfirmForm')?.addEventListener('submit',saveImportedCardio); $('#fetchStravaActivities')?.addEventListener('click',e=>{e.currentTarget.__fluiditeHandled=true;fetchStravaActivities();setTimeout(()=>{if(e.currentTarget)e.currentTarget.__fluiditeHandled=false},0)}); $('#askSmartTraining')?.addEventListener('click',loadSmartTrainingSuggestion); $('#stravaConfirmForm')?.addEventListener('submit',saveStravaCardio); $('#hydrationQuickForm')?.addEventListener('submit',saveHydrationQuick); $('#foodForm')?.addEventListener('submit',saveFood); $('#foodSearchForm')?.addEventListener('submit',searchFoods); $('#foodSearchConfirmForm')?.addEventListener('submit',saveSearchedFood); $('#barcodeForm')?.addEventListener('submit',lookupBarcode); $('#startBarcodeCamera')?.addEventListener('click',startBarcodeCamera);  $('#barcodeConfirmForm')?.addEventListener('submit',saveBarcodeFood); $('#aiFoodConfirmForm')?.addEventListener('submit',saveAIFood);
  $('#foodPhotoInput')?.addEventListener('change',previewFoodPhoto);
  $('#foodLibraryInput')?.addEventListener('change',previewFoodPhoto);
  $('#openProgressCamera')?.addEventListener('click',openProgressCamera); $('#progressLibraryInput')?.addEventListener('click',rememberProgressPhotoMeta); $('#progressLibraryInput')?.addEventListener('change',prepareProgressPhoto);
  $('#barcodeGrams')?.addEventListener('input',updateBarcodePortion);
  $('#nextMealIdea')?.addEventListener('click',()=>{mealIdeaIndex++; mealIdeaSheet();});
  document.querySelectorAll('[data-technique]').forEach(b=>b.addEventListener('click',()=>showTechnique(b.dataset.technique)));
  document.querySelectorAll('[data-edit-food]').forEach(b=>b.addEventListener('click',()=>editFoodSheet(b.dataset.editFood)));
  document.querySelectorAll('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{const [kind,id]=b.dataset.editActivity.split(':'); editActivitySheet(kind,id);}));
  $('#foodEditForm')?.addEventListener('submit',updateFood);
  $('#copyFoodToMeal')?.addEventListener('click',()=>{const id=$('#foodEditForm')?.elements.id.value;const target=$('#foodCopyMealType')?.value;if(id&&target)copyFoodToMeal(id,target,$('#copyFoodToMeal'));});
  $('#activityEditForm')?.addEventListener('submit',updateActivity);
  $('#deleteFood')?.addEventListener('click',()=>{const id=$('#foodEditForm')?.elements.id.value;if(id)deleteFood(id);});
  $('#deleteActivity')?.addEventListener('click',()=>{const f=$('#activityEditForm');if(f)deleteActivity(f.elements.kind.value,f.elements.id.value);});
}

// V2.10.5.4 — safety net for dynamic sheet actions. One delegated listener avoids losing handlers after a sheet rerender.
document.addEventListener('click',e=>{
  const manual=e.target.closest?.('#toggleManualBarcode');
  if(manual){e.preventDefault();$('#barcodeForm')?.classList.toggle('hidden');return;}
  const strava=e.target.closest?.('#fetchStravaActivities');
  if(strava && !strava.dataset.boundFallback){
    // bindSheet normally handles this. If the dynamic handler was lost, this delegated fallback keeps the action alive.
    if(!strava.__fluiditeHandled){e.preventDefault();fetchStravaActivities();}
  }
},false);

function updateAllRanges(){ document.querySelectorAll('input[type="range"]').forEach(updateRange); }
function updateRange(r){ const out=document.querySelector(`[data-output="${r.name}"]`); if(out) out.value=`${r.value}${r.dataset.rangeUnit||''}`; }
async function saveCheckin(e){e.preventDefault(); const f=new FormData(e.currentTarget); const date=f.get('date')||todayKey(); const row={id:date,date,sleep:num(f.get('sleep')),energy:num(f.get('energy')),stress:num(f.get('stress')),recovery:num(f.get('recovery')),hunger:num(f.get('hunger')),weight:num(f.get('weight')),waist:num(f.get('waist')),source:'manual',updatedAt:new Date().toISOString()}; await LTDB.put('checkins',row); $('#sheet').close(); toast('Point du jour enregistré'); render();}
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
  const status=$('#stravaStatus'),box=$('#stravaActivities'),btn=$('#fetchStravaActivities');
  if(status)status.textContent='Connexion à Strava…';
  if(btn){btn.disabled=true;btn.textContent='Récupération…'}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch('/.netlify/functions/strava-activities?ts='+Date.now(),{credentials:'include',cache:'no-store',signal:controller.signal});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch(e){throw new Error('Réponse Strava invalide')}
    if(r.status===401){if(status)status.innerHTML='Connexion Strava expirée. <a href="/.netlify/functions/strava-auth-start">Reconnecter Strava</a>';return}
    if(!r.ok)throw new Error(data.detail||data.error||`Strava indisponible (${r.status})`);
    const existing=await LTDB.all('cardio'),imported=new Set(existing.map(x=>String(x.stravaId||'')).filter(Boolean));
    if(status)status.textContent=`${data.activities.length} activité${data.activities.length>1?'s':''} récente${data.activities.length>1?'s':''}.`;
    box.innerHTML=`<div class="strava-list">${data.activities.map(a=>`<button class="strava-activity-row" data-strava-id="${a.id}" ${imported.has(String(a.id))?'disabled':''}><div><strong>${escapeHtml(a.name||a.type||'Activité')}</strong><span>${formatPhotoDate(a.date)} · ${a.distance?Number(a.distance).toFixed(2)+' km · ':''}${formatDuration(a.durationSeconds||0)}</span></div><span class="pill">${imported.has(String(a.id))?'Déjà importée':'Prévisualiser'}</span></button>`).join('')||'<div class="empty">Aucune activité récente.</div>'}</div>`;
    document.querySelectorAll('[data-strava-id]').forEach(b=>b.addEventListener('click',()=>previewStravaActivity(b.dataset.stravaId)));
  }catch(err){
    console.error(err);
    if(status)status.textContent=err?.name==='AbortError'?'Strava ne répond pas. Réessaie ou reconnecte ton compte.':`Impossible de récupérer Strava : ${err.message||'erreur inconnue'}`;
  }finally{
    clearTimeout(timer);if(btn){btn.disabled=false;btn.textContent='Récupérer mes activités'}
  }
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
async function saveHydrationQuick(e){
  e.preventDefault();
  const f=new FormData(e.currentTarget),date=f.get('date')||todayKey(),water=num(f.get('water'));
  if(water<0)return;
  const rows=(await LTDB.all('food')).filter(x=>x.date===date&&(x.source==='hydration'||x.mealType==='hydration'));
  for(const row of rows) await LTDB.del('food',row.id);
  if(water>0) await LTDB.put('food',{id:uid(),date,dateTime:new Date().toISOString(),mealType:'hydration',description:'Eau',protein:0,calories:0,carbs:0,fat:0,water,classic:false,source:'hydration',createdAt:new Date().toISOString()});
  toast('Hydratation mise à jour');$('#sheet')?.close();render();
}
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
    let settled=false;
    const finish=(ok,value)=>{if(settled)return;settled=true;clearTimeout(timer);ok?resolve(value):reject(value)};
    const stale=document.querySelector('script[data-zxing]');
    if(stale) stale.remove();
    const script=document.createElement('script');
    script.dataset.zxing='1';
    script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js?fluidite=v21054';
    script.async=true;
    script.onload=()=>window.ZXingBrowser?finish(true,window.ZXingBrowser):finish(false,new Error('ZXING_NOT_READY'));
    script.onerror=()=>finish(false,new Error('ZXING_LOAD_FAILED'));
    const timer=setTimeout(()=>{try{script.remove()}catch(e){}finish(false,new Error('ZXING_TIMEOUT'))},8000);
    document.head.appendChild(script);
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
  if(status)status.textContent='Scanner indisponible. Tu peux saisir le code manuellement ci-dessous.';
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

async function foodFavoritesSheet(){
  const food=(await LTDB.all('food')).filter(x=>x.classic && x.mealType!=='hydration');
  const map=new Map();
  food.sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  food.forEach(x=>{const k=(x.sourceId||x.barcode||x.description||'').toLowerCase();if(k&&!map.has(k))map.set(k,x)});
  const fav=[...map.values()];
  showSheet(`<div class="nutrition-page-head"><div><div class="card-kicker">Alimentation</div><h2>Mes aliments favoris</h2></div></div>${fav.length?`<div class="food-result-list">${fav.map(x=>`<button class="food-result-row" type="button" data-use-food-favorite="${escapeHtml(x.id)}"><span class="food-result-placeholder">★</span><div><strong>${escapeHtml(x.description||'Aliment')}</strong><span>${Math.round(Number(x.calories)||0)} kcal · ${Number(x.protein||0).toFixed(1)} g prot. · dernière quantité</span></div><b>＋</b></button>`).join('')}</div>`:`<div class="empty">Aucun favori pour l’instant. Coche « Ajouter à mes favoris » lors de la confirmation d’un aliment.</div>`}`,()=>openSheet('nutritionMealAdd'));
}
async function useFoodFavorite(id){
  const x=await LTDB.get('food',id);if(!x)return;
  await LTDB.put('food',{...x,id:uid(),date:todayKey(),dateTime:new Date().toISOString(),mealType:pendingNutritionMealType||x.mealType||'lunch',source:'favorite-reuse',classic:true,createdAt:new Date().toISOString(),updatedAt:null});
  toast(`${x.description||'Aliment'} ajouté`);pendingNutritionMealType=null;await nutritionHubSheet();render();
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
  if(state.recipeIngredientMode){
    return showSheet(`<h2>Ajouter à la recette</h2><div class="identified-product">${x.image?`<img src="${escapeHtml(x.image)}" alt="">`:''}<div><div class="card-kicker">${escapeHtml(x.sourceLabel||'Base alimentaire')}</div><h3>${escapeHtml(x.name||'Aliment')}</h3><p>${escapeHtml(x.brand||'')}</p></div></div><form id="recipeSearchConfirmForm"><input type="hidden" name="name" value="${escapeHtml([x.name,x.brand].filter(Boolean).join(' · '))}"><input type="hidden" name="pCalories" value="${p.calories??0}"><input type="hidden" name="pProtein" value="${p.protein??0}"><input type="hidden" name="pCarbs" value="${p.carbs??0}"><input type="hidden" name="pFat" value="${p.fat??0}"><div class="field"><label>Quantité dans la recette (g)</label><input id="recipeSearchGrams" name="grams" type="number" min="1" step="1" value="${grams}"></div><section class="recipe-preview" id="recipeSearchPreview"></section><button class="action" type="submit">Ajouter l’ingrédient</button></form>`);
  }
  showSheet(`<h2>Confirmer l’aliment</h2><div class="identified-product">${x.image?`<img src="${escapeHtml(x.image)}" alt="">`:''}<div><div class="card-kicker">${escapeHtml(x.sourceLabel||'Base alimentaire')}</div><h3>${escapeHtml(x.name||'Aliment')}</h3><p>${escapeHtml(x.brand||'')}${x.quantity?` · ${escapeHtml(x.quantity)}`:''}</p></div></div><form id="foodSearchConfirmForm"><input type="hidden" name="source" value="${escapeHtml(x.source||'food-search')}"><input type="hidden" name="sourceId" value="${escapeHtml(String(x.id||''))}"><input type="hidden" name="pCalories" value="${p.calories??0}"><input type="hidden" name="pProtein" value="${p.protein??0}"><input type="hidden" name="pCarbs" value="${p.carbs??0}"><input type="hidden" name="pFat" value="${p.fat??0}">${dateField('date',todayKey())}<div class="field"><label>Moment</label><select name="mealType">${mealTypeOptions(state.foodSearchMealContext||'lunch')}</select></div><div class="field"><label>Aliment</label><input name="description" value="${escapeHtml([x.name,x.brand].filter(Boolean).join(' · '))}"></div><div class="field"><label>Quantité consommée (g)</label><input id="foodSearchGrams" name="grams" type="number" min="1" step="1" value="${grams}"></div><div class="range-row"><div class="field"><label>Protéines (g)</label><input id="foodSearchProtein" name="protein" type="number" step="0.1" value="${macroForPortion(p.protein,grams)}"></div><div class="field"><label>Calories</label><input id="foodSearchCalories" name="calories" type="number" value="${Math.round(macroForPortion(p.calories,grams))}"></div></div><div class="range-row"><div class="field"><label>Glucides (g)</label><input id="foodSearchCarbs" name="carbs" type="number" step="0.1" value="${macroForPortion(p.carbs,grams)}"></div><div class="field"><label>Lipides (g)</label><input id="foodSearchFat" name="fat" type="number" step="0.1" value="${macroForPortion(p.fat,grams)}"></div></div><label class="checkline"><input type="checkbox" name="classic"> Ajouter à mes favoris</label><div class="confidence-box"><strong>Source : ${escapeHtml(x.sourceLabel||'Base alimentaire')}</strong><span>Valeurs calculées pour la quantité indiquée. Tu peux tout corriger.</span></div><button class="action" type="submit">Confirmer et enregistrer</button></form>`);
  $('#foodSearchGrams')?.addEventListener('input',updateFoodSearchPortion);
}

function updateRecipeSearchPreview(){
  const f=$('#recipeSearchConfirmForm');if(!f)return;
  const g=Number(f.elements.grams.value)||0;
  const c=macroForPortion(f.elements.pCalories.value,g),p=macroForPortion(f.elements.pProtein.value,g),carb=macroForPortion(f.elements.pCarbs.value,g),fat=macroForPortion(f.elements.pFat.value,g);
  const box=$('#recipeSearchPreview');if(box)box.innerHTML=`<strong>Pour ${g} g</strong><div><span>${Math.round(c)} kcal</span><span>${p.toFixed(1)} g prot.</span><span>${carb.toFixed(1)} g gluc.</span><span>${fat.toFixed(1)} g lip.</span></div>`;
}
function saveRecipeSearchIngredient(e){
  e.preventDefault();const f=new FormData(e.currentTarget),g=Number(f.get('grams'))||0;
  addIngredientToCurrentRecipe({name:f.get('name')||'Aliment',qty:g,calories:macroForPortion(f.get('pCalories'),g),protein:macroForPortion(f.get('pProtein'),g),carbs:macroForPortion(f.get('pCarbs'),g),fat:macroForPortion(f.get('pFat'),g),source:'food-search'});
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
 try{const response=await fetch(`/.netlify/functions/product-lookup?code=${encodeURIComponent(code)}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'LOOKUP_FAILED');showBarcodeConfirmation(data,date,mealType)}
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
  if(state.recipeIngredientMode){
    return showSheet(`<h2>Ajouter à la recette</h2><div class="identified-product">${data.image?`<img src="${escapeHtml(data.image)}" alt="">`:''}<div><div class="card-kicker">Trouvé par code-barres</div><h3>${escapeHtml(data.name||'Produit')}</h3><p>${escapeHtml(data.brands||'')}</p></div></div><form id="recipeBarcodeConfirmForm"><input type="hidden" name="name" value="${escapeHtml(data.name||'Produit')}"><input type="hidden" name="pCalories" value="${p.calories??0}"><input type="hidden" name="pProtein" value="${p.protein??0}"><input type="hidden" name="pCarbs" value="${p.carbs??0}"><input type="hidden" name="pFat" value="${p.fat??0}"><div class="field"><label>Quantité dans la recette (g)</label><input name="grams" type="number" min="1" step="1" value="${grams}"></div><button class="action" type="submit">Ajouter l’ingrédient</button></form>`);
  }
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
  if(state.recipeIngredientMode){
    return showSheet(`<h2>Ajouter à la recette</h2><div class="ai-result-head"><div>${companionMark("companion-mark-large")}</div><div><div class="card-kicker">Photo analysée</div><h3>${escapeHtml(data.description||data.name||'Ingrédient')}</h3></div></div><form id="recipeAIConfirmForm"><div class="field"><label>Nom</label><input name="name" value="${escapeHtml(data.description||data.name||'Ingrédient')}"></div><div class="field"><label>Quantité estimée (g)</label><input name="qty" type="number" min="0" step="1" value="${Number(t.grams)||0}"></div><div class="range-row"><div class="field"><label>Protéines</label><input name="protein" type="number" step="0.1" value="${Number(t.protein)||0}"></div><div class="field"><label>Calories</label><input name="calories" type="number" step="1" value="${Math.round(Number(t.calories)||0)}"></div></div><div class="range-row"><div class="field"><label>Glucides</label><input name="carbs" type="number" step="0.1" value="${Number(t.carbs)||0}"></div><div class="field"><label>Lipides</label><input name="fat" type="number" step="0.1" value="${Number(t.fat)||0}"></div></div><button class="action" type="submit">Ajouter l’ingrédient</button></form>`);
  }
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
    openPhotoSensitiveSheet(`<h2>Prendre la photo</h2><div class="progress-live-camera"><video id="progressCameraVideo" playsinline muted autoplay></video><div class="body-guide"></div></div><div class="camera-help">Place-toi dans le cadre puis déclenche.</div><button class="action sticky-photo-action" id="captureProgressPhoto" type="button">Prendre la photo</button>`);
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
  openPhotoSensitiveSheet(`<h2>Recadrer</h2><p class="subtle">Glisse la photo dans le cadre et utilise le zoom.</p><div class="crop-stage" id="cropStage"><img id="cropImage" src="${progressCrop.src}" draggable="false"><div class="crop-guide"><i></i><i></i><i></i></div></div><div class="crop-control-card"><div class="slider-head"><label>Zoom</label><output id="cropZoomValue">100 %</output></div><input id="cropZoom" type="range" min="1" max="3" step="0.01" value="1"><div class="crop-reset-row"><button class="action secondary compact" id="resetCrop" type="button">Recentrer</button><span>${formatPhotoDate(date)} · ${escapeHtml(view)}</span></div></div><div class="sticky-photo-footer"><button class="action" id="saveProgressPhoto" type="button">Enregistrer la photo</button></div>`);
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
  if(!photoVaultUnlocked()){ensurePhotoVaultUnlocked(()=>renderPhotoComparison(dateA,dateB));return}
  touchPhotoVault();photoVaultSheetActive=true;
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
  openPhotoSensitiveSheet(`<h2>Comparaison</h2><div class="compare-head"><strong>${formatPhotoDate(dateA)}</strong><span>→</span><strong>${formatPhotoDate(dateB)}</strong></div><div class="compare-view-tabs">${available.map((v,i)=>`<button class="${i===0?'active':''}" data-compare-view="${v}">${v}</button>`).join('')}</div><div id="photoCompareStage"></div><div class="compare-ai-zone"><button class="action" id="analyzePhotoEvolution" type="button">${companionMark("choice-companion")}Analyser avec le Compagnon</button><div id="photoEvolutionAnalysis"></div></div><p class="compare-note">L’IA décrit les changements visibles et utilise uniquement les mesures réellement enregistrées.</p>`);
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
  if(!photoVaultUnlocked()){ensurePhotoVaultUnlocked(()=>viewProgressPhoto(id));return}
  touchPhotoVault();photoVaultSheetActive=true;
  const p=await LTDB.get('photos',id);if(!p)return;
  openPhotoSensitiveSheet(`<h2>${escapeHtml(p.view||'Photo')} · ${formatPhotoDate(p.date)}</h2><img class="progress-photo-large" src="${p.image}" alt="Photo évolution"><div class="edit-actions"><button class="action danger" type="button" id="deleteProgressPhoto">Supprimer</button></div>`);
  $('#deleteProgressPhoto')?.addEventListener('click',async()=>{await LTDB.del('photos',id);$('#sheet').close();toast('Photo supprimée');render()});
}

async function openCompanionEvolution(){
  if(!photoVaultUnlocked()){ensurePhotoVaultUnlocked(openCompanionEvolution,'Déverrouille le coffre pour voir tes photos depuis le Compagnon.');return}
  touchPhotoVault();photoVaultSheetActive=true;
  const photos=(await LTDB.all('photos')).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const recent=photos.slice(0,6);
  openPhotoSensitiveSheet(`<div class="companion-history-sheet"><div class="sheet-title-row"><div><div class="card-kicker">COMPAGNON · ÉVOLUTION</div><h2>Mes photos</h2></div></div><p class="subtle">Tes photos restent enregistrées dans Évolution. Ici, le Compagnon te donne un accès direct à la comparaison et à son analyse.</p>${recent.length?`<div class="companion-photo-strip">${recent.map(p=>`<button type="button" data-photo-view="${escapeHtml(p.id)}"><img src="${p.image}" alt="${escapeHtml(p.view||'Photo')}"><span>${escapeHtml(p.view||'Photo')} · ${formatPhotoDate(p.date)}</span></button>`).join('')}</div>`:'<div class="empty">Aucune photo enregistrée pour le moment.</div>'}<div class="card-actions companion-evolution-actions"><button class="action" type="button" id="companionComparePhotos">Comparer et analyser</button><button class="action secondary" type="button" id="companionAddPhoto">Ajouter une photo</button></div></div>`);
  document.querySelectorAll('[data-photo-view]').forEach(b=>b.addEventListener('click',()=>viewProgressPhoto(b.dataset.photoView)));
  $('#companionComparePhotos')?.addEventListener('click',()=>openSheet('photoCompare'));
  $('#companionAddPhoto')?.addEventListener('click',()=>openSheet('progressPhoto'));
}

async function openCompanionHistory(){
  const events=(await LTDB.all('events')).filter(x=>x.type==='CHAT'&&companionChatDay(x));
  const groups={};
  events.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).forEach(x=>{const day=companionChatDay(x);(groups[day]||(groups[day]=[])).push(x)});
  const days=Object.keys(groups).sort().reverse();
  showSheet(`<div class="companion-history-sheet"><div class="sheet-title-row"><div><div class="card-kicker">COMPAGNON</div><h2>Historique</h2></div><button class="sheet-x" data-close-sheet aria-label="Fermer">×</button></div>
    ${days.length?days.map(day=>{
      const ordered=groups[day].slice().sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
      const last=ordered[ordered.length-1];
      return `<button class="companion-history-day" data-history-day="${day}"><strong>${escapeHtml(companionHistoryLabel(day))}</strong><span>${escapeHtml(cleanCompanionText(last?.text||''))}</span></button>`;
    }).join(''):'<div class="empty">Aucune conversation précédente pour le moment.</div>'}
  </div>`);
  document.querySelectorAll('[data-history-day]').forEach(b=>b.addEventListener('click',()=>openCompanionHistoryDay(b.dataset.historyDay)));
}
async function openCompanionHistoryDay(day){
  const chat=(await LTDB.all('events')).filter(x=>x.type==='CHAT'&&companionChatDay(x)===day).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  showSheet(`<div class="companion-history-sheet"><div class="sheet-title-row"><button class="history-back" id="historyBack">‹ Historique</button><button class="sheet-x" data-close-sheet aria-label="Fermer">×</button></div><h2>${escapeHtml(companionHistoryLabel(day))}</h2>
    <div class="history-chat">${chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${escapeHtml(cleanCompanionText(x.text))}</div>`).join('')}</div>
  </div>`);
  document.querySelector('#historyBack')?.addEventListener('click',openCompanionHistory);
}
async function prepareCompanionAction(action){
  if(!action||!action.type)return;
  if(action.type==='prepare_workout'){
    const w=workoutById(action.workoutId);
    if(!w){toast('Séance indisponible');return}
    window.__companionPreparedWorkout=w.id;
    workoutDetailSheet(w);
    toast('Séance préparée · rien n’est enregistré sans ta validation');
    return;
  }
  if(action.type==='nutrition')navigate('nutrition');
  else if(action.type==='training')navigate('training');
  else if(action.type==='checkin')openSheet('checkin');
}
async function sendChat(){
  const input=$('#chatInput'),text=input?.value.trim();if(!text)return;
  input.disabled=true;$('#sendChat').disabled=true;
  // Le contexte conversationnel envoyé à l'IA exclut volontairement la question courante :
  // elle est transmise séparément pour éviter de la confondre avec une relance précédente.
  const priorHistory=(await LTDB.all('events')).filter(x=>x.type==='CHAT'&&companionChatDay(x)===todayKey()).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')).slice(-8).map(x=>({role:x.role,text:x.text}));
  await LTDB.put('events',{id:uid(),type:'CHAT',role:'user',text,createdAt:new Date().toISOString()});
  const snap=await companionSnapshot(); let answer=''; let companionAction=null;
  try{
    const r=await fetch('/.netlify/functions/companion-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,context:snap.context,history:priorHistory})});
    const data=await r.json(); if(!r.ok)throw new Error(data.detail||data.error||'IA indisponible'); answer=data.answer||'Je n’ai pas de réponse utile pour le moment.'; companionAction=data.action||null;
  }catch(err){
    console.error('COMPANION_REMOTE_FAILED',err);
    answer='Je n’ai pas réussi à analyser ta question. Réessaie dans un instant.';
    companionAction=null;
    toast(`Compagnon indisponible · ${String(err?.message||'erreur IA').slice(0,90)}`);
  }
  answer=cleanCompanionText(answer);
  // Les actions sont décidées par le Compagnon à partir de l'intention, jamais déduites d'un mot présent dans sa réponse.
  await LTDB.put('events',{id:uid(),type:'CHAT',role:'companion',text:answer,action:companionAction,createdAt:new Date().toISOString()});render();
}

async function localCompanion(text){
  const snap=await companionSnapshot(),b=snap.brief;
  return `${b.title} ${b.text}${b.note?' '+b.note:''}`;
}

function downloadBackupBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function bytesToB64(bytes){let out='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(out);}
function b64ToBytes(str){const raw=atob(str),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
async function deriveBackupKey(passphrase,salt,iterations=250000){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function encryptBackup(payload,passphrase){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=250000,key=await deriveBackupKey(passphrase,salt,iterations),plain=new TextEncoder().encode(JSON.stringify(payload)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));return {format:'fluidite-encrypted-backup',version:1,createdAt:new Date().toISOString(),kdf:{name:'PBKDF2',hash:'SHA-256',iterations,salt:bytesToB64(salt)},cipher:{name:'AES-GCM',iv:bytesToB64(iv),data:bytesToB64(cipher)}};}
async function decryptBackup(envelope,passphrase){if(envelope?.format!=='fluidite-encrypted-backup'||!envelope.kdf||!envelope.cipher)throw new Error('Sauvegarde chiffrée invalide');const salt=b64ToBytes(envelope.kdf.salt),iv=b64ToBytes(envelope.cipher.iv),data=b64ToBytes(envelope.cipher.data),key=await deriveBackupKey(passphrase,salt,Number(envelope.kdf.iterations)||250000);try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data);return JSON.parse(new TextDecoder().decode(plain));}catch(err){throw new Error('Mot de passe incorrect ou sauvegarde endommagée');}}
async function createManualSnapshot(){try{await LTDB.createSnapshot('manual');toast('Sauvegarde locale créée');render();}catch(err){console.error(err);toast('Sauvegarde locale impossible');}}
async function openLocalBackups(){const snaps=await LTDB.listSnapshots();if(!snaps.length)return showSheet('<h2>Sauvegardes locales</h2><p class="subtle">Aucun instantané n’est encore disponible.</p>');const reasonLabel={manual:'Manuelle','daily-auto':'Automatique','before-import':'Avant import','before-local-restore':'Avant restauration'};showSheet(`<h2>Sauvegardes locales</h2><p class="subtle">Elles protègent surtout contre une mauvaise manipulation ou un import raté sur cet appareil. Pour une perte/changement d’iPhone, utilise aussi l’export chiffré.</p><div class="list">${snaps.map(x=>`<button class="list-row history-button" data-restore-snapshot="${escapeHtml(x.id)}"><div><strong>${escapeHtml(reasonLabel[x.reason]||'Sauvegarde')}</strong><div class="status">${escapeHtml(new Date(x.createdAt).toLocaleString('fr-CH'))}</div></div><span class="pill">Restaurer</span></button>`).join('')}</div>`);document.querySelectorAll('[data-restore-snapshot]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées. Une copie de sécurité sera créée juste avant.'))return;try{await LTDB.restoreSnapshot(b.dataset.restoreSnapshot);state.profile=await LTDB.get('profile','me')||state.profile;$('#sheet').close();toast('Sauvegarde restaurée');render();}catch(err){console.error(err);toast('Restauration impossible');}}));}
async function exportEncryptedBackup(){if(!crypto?.subtle)return toast('Chiffrement non disponible sur cet appareil');const pass=prompt('Choisis un mot de passe pour chiffrer la sauvegarde. Il sera indispensable pour la restaurer.');if(!pass)return;if(pass.length<8)return toast('Utilise au moins 8 caractères');const confirmPass=prompt('Confirme le mot de passe de sauvegarde.');if(pass!==confirmPass)return toast('Les mots de passe ne correspondent pas');try{await LTDB.createSnapshot('manual');const dump=await LTDB.dump(),envelope=await encryptBackup(dump,pass),blob=new Blob([JSON.stringify(envelope)],{type:'application/octet-stream'});downloadBackupBlob(blob,`fluidite-${todayKey()}.fluidite`);toast('Sauvegarde chiffrée préparée');render();}catch(err){console.error(err);toast('Export chiffré impossible');}}
async function exportData(){const dump=await LTDB.dump();const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'});downloadBackupBlob(blob,`luis-transformation-${todayKey()}.json`);toast('Export JSON préparé');}
async function importData(e){const file=e.target.files?.[0];if(!file)return;try{let payload,parsed=JSON.parse(await file.text());if(parsed?.format==='fluidite-encrypted-backup'){const pass=prompt('Mot de passe de cette sauvegarde :');if(!pass)throw new Error('Import annulé');payload=await decryptBackup(parsed,pass);}else payload=parsed;const check=LTDB.validateBackup(payload);const count=check.total;if(!confirm(`Restaurer cette sauvegarde (${count} éléments) ? Les données actuelles seront remplacées. Une copie locale de sécurité sera créée avant.`))return;await LTDB.createSnapshot('before-import');await LTDB.restore(payload,{replace:true});state.profile=await LTDB.get('profile','me')||state.profile;toast('Restauration terminée');render();}catch(err){console.error(err);toast(err?.message==='Import annulé'?'Import annulé':(err?.message||'Import impossible'));}finally{e.target.value='';}}
function recoveryText(x){ if(x.energy&&x.energy<=2)return {title:'Une chose mérite ton attention.',text:'Ton énergie est basse aujourd’hui. Je garderais la journée simple et j’adapterais seulement si ton ressenti le confirme.'}; if(x.sleep&&x.sleep<6)return {title:'Nuit courte.',text:'Une seule nuit ne suffit pas à modifier ton programme. Je la garde simplement en contexte.'}; return null; }
function parseDuration(raw){ const s=String(raw||'').trim(); if(!s)return {seconds:null,label:''}; if(/^\d+$/.test(s)){const min=Number(s);return {seconds:min*60,label:`${min}:00`};} const p=s.split(':').map(Number); if(p.some(Number.isNaN)) return {seconds:null,label:s}; let sec=0; if(p.length===2)sec=p[0]*60+p[1]; else if(p.length===3)sec=p[0]*3600+p[1]*60+p[2]; else return {seconds:null,label:s}; const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=sec%60; return {seconds:sec,label:h?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${m}:${String(ss).padStart(2,'0')}`}; }
function daysAgo(date){return Math.floor((Date.now()-new Date(date+'T00:00:00').getTime())/86400000)}
function signed(n){return n>0?`+${n}`:`${n}`}
function num(v){return v===''||v===null?null:Number(v)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
init();
