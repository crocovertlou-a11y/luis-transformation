'use strict';
const STORAGE_KEY='luis-transformation-v1';
const SCHEMA_VERSION=8;
const BACKUP_PREFIX='luis-transformation-backup-';
const TEMP_KEY='luis-transformation-write-temp';
const MAX_LOCAL_BACKUPS=3;
const DEFAULT_FOODS=[
{id:'chicken',name:'Blanc de poulet',kcal:165,protein:31,carbs:0,fat:3.6},{id:'skyr',name:'Skyr nature',kcal:63,protein:11,carbs:4,fat:.2},{id:'rice',name:'Riz basmati cuit',kcal:130,protein:2.7,carbs:28,fat:.3},{id:'oats',name:'Flocons d’avoine',kcal:372,protein:13.5,carbs:58.7,fat:7},{id:'banana',name:'Banane',kcal:89,protein:1.1,carbs:22.8,fat:.3},{id:'egg',name:'Œuf entier',kcal:143,protein:12.6,carbs:.7,fat:9.5},{id:'salmon',name:'Saumon',kcal:208,protein:20,carbs:0,fat:13},{id:'whey',name:'Whey isolate',kcal:370,protein:84,carbs:3,fat:1.5},{id:'greek',name:'Yaourt grec 0%',kcal:59,protein:10.3,carbs:3.6,fat:.4},{id:'pasta',name:'Pâtes cuites',kcal:157,protein:5.8,carbs:30.9,fat:.9},{id:'oliveoil',name:'Huile d’olive',kcal:884,protein:0,carbs:0,fat:100},{id:'avocado',name:'Avocat',kcal:160,protein:2,carbs:8.5,fat:14.7},{id:'bread',name:'Pain complet',kcal:247,protein:13,carbs:41,fat:4.2},{id:'beef',name:'Bœuf maigre',kcal:180,protein:27,carbs:0,fat:8},{id:'potato',name:'Pomme de terre cuite',kcal:87,protein:1.9,carbs:20,fat:.1}
];
const MEALS={breakfast:'Petit-déjeuner',lunch:'Déjeuner',snack:'Collation',dinner:'Dîner'};
const WORKOUT_PRESETS={
Push:{target:'Pectoraux · épaules · triceps',exercises:[
{name:'Développé couché barre',sets:4,reps:'6–8',rest:'2 min'},
{name:'Développé incliné haltères',sets:3,reps:'8–10',rest:'90 s'},
{name:'Développé épaules haltères',sets:3,reps:'8–10',rest:'90 s'},
{name:'Élévations latérales',sets:3,reps:'12–15',rest:'60 s'},
{name:'Dips ou pompes',sets:3,reps:'8–12',rest:'90 s'},
{name:'Extension triceps poulie',sets:3,reps:'10–15',rest:'60 s'},
{name:'Crunch à la poulie',sets:3,reps:'12–15',rest:'45 s',core:true},
{name:'Relevés de genoux suspendu',sets:3,reps:'8–12',rest:'45 s',core:true}]},
Pull:{target:'Dos · arrière d’épaules · biceps',exercises:[
{name:'Tractions assistées ou tirage vertical',sets:4,reps:'6–10',rest:'2 min'},
{name:'Rowing barre ou machine',sets:4,reps:'8–10',rest:'90 s'},
{name:'Tirage horizontal poulie',sets:3,reps:'10–12',rest:'90 s'},
{name:'Face pull',sets:3,reps:'12–15',rest:'60 s'},
{name:'Curl haltères',sets:3,reps:'8–12',rest:'60 s'},
{name:'Curl marteau',sets:2,reps:'10–12',rest:'60 s'},
{name:'Relevés de jambes suspendu',sets:3,reps:'8–12',rest:'45 s',core:true},
{name:'Gainage latéral',sets:3,reps:'30–45 s / côté',rest:'30 s',core:true}]},
Legs:{target:'Quadriceps · ischios · fessiers · mollets',exercises:[
{name:'Squat',sets:4,reps:'6–8',rest:'2 min'},
{name:'Presse à cuisses',sets:3,reps:'8–12',rest:'90 s'},
{name:'Soulevé de terre roumain',sets:3,reps:'8–10',rest:'90 s'},
{name:'Fentes marchées',sets:3,reps:'10 / jambe',rest:'75 s'},
{name:'Leg curl',sets:3,reps:'10–15',rest:'60 s'},
{name:'Mollets debout',sets:3,reps:'12–20',rest:'60 s'},
{name:'Ab wheel',sets:3,reps:'6–12',rest:'45 s',core:true},
{name:'Planche',sets:3,reps:'40–60 s',rest:'30 s',core:true}]},
'Haut du corps':{target:'Pectoraux · dos · épaules · bras',exercises:[
{name:'Développé couché',sets:4,reps:'6–8',rest:'2 min'},
{name:'Tirage vertical',sets:4,reps:'8–10',rest:'90 s'},
{name:'Développé épaules',sets:3,reps:'8–10',rest:'90 s'},
{name:'Rowing assis',sets:3,reps:'8–12',rest:'90 s'},
{name:'Superset biceps / triceps',sets:3,reps:'10–12',rest:'60 s'},
{name:'Crunch poulie',sets:3,reps:'12–15',rest:'45 s',core:true},
{name:'Pallof press',sets:3,reps:'10–12 / côté',rest:'30 s',core:true}]},
'Bas du corps':{target:'Jambes · fessiers · gainage',exercises:[
{name:'Squat ou hack squat',sets:4,reps:'6–10',rest:'2 min'},
{name:'Soulevé de terre roumain',sets:3,reps:'8–10',rest:'90 s'},
{name:'Presse à cuisses',sets:3,reps:'10–12',rest:'90 s'},
{name:'Leg curl',sets:3,reps:'10–15',rest:'60 s'},
{name:'Gainage',sets:3,reps:'40–60 s',rest:'45 s',core:true},
{name:'Ab wheel',sets:3,reps:'6–12',rest:'45 s',core:true}]},
'Full body':{target:'Corps entier',exercises:[
{name:'Squat',sets:3,reps:'6–8',rest:'2 min'},
{name:'Développé couché',sets:3,reps:'6–8',rest:'2 min'},
{name:'Tirage vertical',sets:3,reps:'8–10',rest:'90 s'},
{name:'Soulevé de terre roumain',sets:3,reps:'8–10',rest:'90 s'},
{name:'Développé épaules',sets:2,reps:'8–12',rest:'75 s'},
{name:'Circuit abdos',sets:3,reps:'12 crunchs · 10 genoux · 40 s planche',rest:'45 s',core:true}]}}
let activeWorkoutExercises=[];
function latestExerciseWeight(name){for(const w of [...data.strength].sort((a,b)=>b.date.localeCompare(a.date))){const ex=(w.workoutExercises||[]).find(x=>x.name===name&&num(x.weight)>0);if(ex)return num(ex.weight)}return ''}
function renderWorkoutPreset(){const type=$('strengthType').value,preset=WORKOUT_PRESETS[type]||WORKOUT_PRESETS.Push;$('workoutTitle').textContent=`Séance ${type}`;$('workoutTarget').textContent=preset.target;activeWorkoutExercises=preset.exercises.map((e,i)=>({...e,weight:latestExerciseWeight(e.name),done:false,index:i}));$('exerciseRows').innerHTML=activeWorkoutExercises.map((e,i)=>`<article class="exercise-row ${e.core?'core-card':''}"><div class="exercise-main"><span class="exercise-tag">${e.core?'ABDOS':'EXERCICE'}</span><strong>${escapeHtml(e.name)}</strong><small>${e.sets} séries × ${e.reps} · repos ${e.rest}</small></div><div class="exercise-actions"><label class="weight-field"><span>${e.reps.includes('s')?'Charge':'Poids'}</span><div><input type="number" step="0.5" min="0" inputmode="decimal" data-exercise-weight="${i}" value="${e.weight}" placeholder="kg"><b>kg</b></div></label><a class="technique-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(e.name+' technique exercice musculation')}" target="_blank" rel="noopener">▶ Technique</a></div></article>`).join('')}
function collectWorkoutExercises(){return activeWorkoutExercises.map((e,i)=>({...e,weight:num(document.querySelector(`[data-exercise-weight="${i}"]`)?.value)}))}

const initialData={daily:{},supplements:{},nutrition:{},strength:[],running:[],customFoods:[],photos:[],profile:{name:"Luis Sanchez",age:41,height:189,initialWeight:81.5,initialWaist:92,proteinGoal:170,calorieGoal:2400,creatineGoal:5}};
let data=loadData(),selectedFood=null,deferredPrompt=null,selectedPhotoFile=null,selectedPhotoPreviewUrl='',selectedGarminFile=null,selectedGarminPreview=null,activeRunMap=null,activeRunMapLayer=null,cropImage=null,cropScale=1,cropOffsetX=0,cropOffsetY=0,cropDragging=false,cropDragStart=null;
const $=id=>document.getElementById(id),today=()=>{const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`},num=(v,fb=0)=>Number.isFinite(Number(v))?Number(v):fb,fmt=n=>Math.round(n*10)/10;
function clone(v){return JSON.parse(JSON.stringify(v))}
function normalizeData(raw={}){const p=raw&&typeof raw==='object'?raw:{};return {...clone(initialData),...p,schemaVersion:SCHEMA_VERSION,daily:p.daily&&typeof p.daily==='object'?p.daily:{},supplements:p.supplements&&typeof p.supplements==='object'?p.supplements:{},nutrition:p.nutrition&&typeof p.nutrition==='object'?p.nutrition:{},strength:Array.isArray(p.strength)?p.strength:[],running:Array.isArray(p.running)?p.running:[],customFoods:Array.isArray(p.customFoods)?p.customFoods:[],photos:Array.isArray(p.photos)?p.photos:[],profile:{...initialData.profile,...(p.profile||{})}}}
function parseStored(key){const raw=localStorage.getItem(key);if(!raw)return null;const parsed=JSON.parse(raw);return normalizeData(parsed)}
function backupKeys(){return Object.keys(localStorage).filter(k=>k.startsWith(BACKUP_PREFIX)).sort().reverse()}
function loadData(){try{const primary=parseStored(STORAGE_KEY);if(primary)return primary}catch(e){console.warn('Données principales illisibles',e)}for(const key of backupKeys()){try{const backup=parseStored(key);if(backup){localStorage.setItem(STORAGE_KEY,JSON.stringify(backup));return backup}}catch(e){console.warn('Sauvegarde illisible',key,e)}}return normalizeData(initialData)}
function rotateBackups(){const keys=backupKeys();keys.slice(MAX_LOCAL_BACKUPS).forEach(k=>localStorage.removeItem(k))}
function save(){try{const previous=localStorage.getItem(STORAGE_KEY);if(previous){const stamp=new Date().toISOString().replace(/[:.]/g,'-');localStorage.setItem(`${BACKUP_PREFIX}${stamp}`,previous)}data=normalizeData(data);const payload=JSON.stringify(data);localStorage.setItem(TEMP_KEY,payload);JSON.parse(localStorage.getItem(TEMP_KEY));localStorage.setItem(STORAGE_KEY,payload);localStorage.removeItem(TEMP_KEY);rotateBackups();renderAll();return true}catch(e){console.error('Échec de sauvegarde',e);try{localStorage.removeItem(TEMP_KEY)}catch{};alert('La sauvegarde a échoué. N’efface pas les données Safari et effectue un export complet.');return false}}
function toast(m){$('toast').textContent=m;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2000)}
function fmtDate(d){return new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'))}
function setDefaults(force=false){const current=today();['dailyDate','supplementDate','nutritionDate','strengthDate','runDate','photoDate'].forEach(id=>{const input=$(id);if(input&&(force||!input.value))input.value=current})}
function profileInitials(name){const parts=String(name||"Luis").trim().split(/\s+/).filter(Boolean);return (parts.slice(0,2).map(x=>x[0]).join("")||"L").toUpperCase()}
function renderProfile(){const p=data.profile||{};const name=String(p.name||"Luis Sanchez").trim();const first=name.split(/\s+/)[0]||"Luis";const initials=profileInitials(name);if($("profileDisplayName"))$("profileDisplayName").textContent=first;if($("profileInitials"))$("profileInitials").textContent=initials;if($("settingsInitials"))$("settingsInitials").textContent=initials;if($("profileName"))$("profileName").value=name;if($("profileAge"))$("profileAge").value=p.age||41;if($("profileHeight"))$("profileHeight").value=p.height||189;if($("profileCalories"))$("profileCalories").value=p.calorieGoal||2400;if($("profileProtein"))$("profileProtein").value=p.proteinGoal||170}
function showView(name){setDefaults();document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.target===name));$('pageTitle').textContent={dashboard:'Tableau de bord',daily:'Saisie quotidienne',nutrition:'Nutrition',supplements:'Compléments',strength:'Musculation',running:'Course',history:'Historique',photos:'Photos progression',settings:'Plus'}[name]||'Luis Transformation';$('moreSheet').classList.add('hidden');if(name==='nutrition')renderNutrition();if(name==='history')drawChart();if(name==='photos')renderPhotos();if(name==='settings')renderProfile();scrollTo(0,0)}
function nutritionDay(date=today()){const n=data.nutrition[date];if(!n)return {entries:[]};if(Array.isArray(n.entries))return n;const legacyProtein=num(n.protein);return legacyProtein?{...n,entries:[],legacyProtein}:{...n,entries:[]}}
function totals(date=today(),meal=null){const n=nutritionDay(date);const list=meal?n.entries.filter(e=>e.meal===meal):n.entries;const t=list.reduce((a,e)=>({kcal:a.kcal+num(e.kcal),protein:a.protein+num(e.protein),carbs:a.carbs+num(e.carbs),fat:a.fat+num(e.fat)}),{kcal:0,protein:0,carbs:0,fat:0});if(!meal&&n.legacyProtein&&!t.protein)t.protein=n.legacyProtein;return t}
function renderNutrition(){const date=$('nutritionDate').value||today(),t=totals(date);$('nutKcal').textContent=Math.round(t.kcal);$('nutProtein').textContent=fmt(t.protein);$('nutCarbs').textContent=fmt(t.carbs);$('nutFat').textContent=fmt(t.fat);$('kcalBar').style.width=`${Math.min(100,t.kcal/data.profile.calorieGoal*100)}%`;$('proteinHint').textContent=t.protein>=data.profile.proteinGoal?'Objectif protéines atteint ✅':`Il te manque ${Math.ceil(data.profile.proteinGoal-t.protein)} g de protéines.`;const host=$('mealSections');host.innerHTML='';Object.entries(MEALS).forEach(([key,label])=>{const n=nutritionDay(date),list=n.entries.filter(e=>e.meal===key),mt=totals(date,key),sec=document.createElement('section');sec.className='card section-card';sec.innerHTML=`<div class="meal-head"><h2 class="meal-title">${label}</h2><span class="meal-total">${Math.round(mt.kcal)} kcal · ${fmt(mt.protein)} g prot.</span></div>${list.length?list.map(e=>`<div class="food-row"><div><strong>${escapeHtml(e.name)}</strong><small>${e.grams} g · ${Math.round(e.kcal)} kcal · ${fmt(e.protein)} g prot.</small></div><button class="delete" data-food-delete="${e.id}">×</button></div>`).join(''):'<div class="empty">Aucun aliment</div>'}`;host.appendChild(sec)});renderFoodSearch($('foodSearch').value)}
function foods(){return [...data.customFoods,...DEFAULT_FOODS]}function renderFoodSearch(q=''){const s=q.trim().toLowerCase(),list=(s?foods().filter(f=>f.name.toLowerCase().includes(s)):foods().slice(0,7)).slice(0,12);$('foodResults').innerHTML=list.map(f=>`<div class="food-result" data-food="${f.id}"><div><strong>${escapeHtml(f.name)}</strong><small>pour 100 g</small></div><small>${f.kcal} kcal · ${f.protein} g prot.</small></div>`).join('')}
function openFood(f){selectedFood=f;$('dialogFoodName').textContent=f.name;$('dialogFoodMacros').textContent=`Pour 100 g : ${f.kcal} kcal · ${f.protein} g protéines · ${f.carbs} g glucides · ${f.fat} g lipides`;$('gramsInput').value=100;$('foodDialog').showModal()}
function latestDaily(field,fallback){const r=Object.entries(data.daily).filter(([,v])=>v[field]!==''&&v[field]!=null).sort(([a],[b])=>b.localeCompare(a));return r.length?num(r[0][1][field],fallback):fallback}
function getWeekBounds(){const d=new Date(),day=(d.getDay()+6)%7,start=new Date(d);start.setDate(d.getDate()-day);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(start.getDate()+6);return{start,end}}function inCurrentWeek(ds){const d=new Date(ds+'T12:00:00'),{start,end}=getWeekBounds();return d>=start&&d<=end}
function renderDashboard(){const date=today(),daily=data.daily[date]||{},sup=data.supplements[date]||{},t=totals(date),weight=latestDaily('weight',data.profile.initialWeight),waist=latestDaily('waist',data.profile.initialWaist);$('todayLabel').textContent=new Intl.DateTimeFormat('fr-CH',{weekday:'long',day:'numeric',month:'long'}).format(new Date());$('currentWeight').textContent=`${weight.toFixed(1).replace('.',',')} kg`;$('currentWaist').textContent=`${waist.toFixed(1).replace('.',',')} cm`;$('weightDelta').textContent=`${(weight-data.profile.initialWeight).toFixed(1)} kg`;$('waistDelta').textContent=`${(waist-data.profile.initialWaist).toFixed(1)} cm`;$('caloriesToday').textContent=`${Math.round(t.kcal)} / ${data.profile.calorieGoal}`;$('calorieStatus').textContent=t.kcal>=data.profile.calorieGoal*.9?'Bien avancé':'À compléter';$('proteinToday').textContent=`${fmt(t.protein)} / ${data.profile.proteinGoal} g`;$('proteinStatus').textContent=t.protein>=data.profile.proteinGoal?'Objectif atteint':'À compléter';const creatine=sup.creatineTaken?num(sup.creatineAmount,5):0;let checks=0;if(daily.weight)checks++;if(daily.waist)checks++;if(daily.sleep)checks++;if(daily.water)checks++;if(t.protein>=data.profile.proteinGoal)checks++;if(creatine>=5)checks++;if(data.strength.some(x=>x.date===date)||data.running.some(x=>x.date===date))checks++;$('dayScore').textContent=Math.round(checks/7*100);const strength=data.strength.filter(x=>inCurrentWeek(x.date)).length,runs=data.running.filter(x=>inCurrentWeek(x.date)).length,creatineDays=Object.entries(data.supplements).filter(([d,v])=>inCurrentWeek(d)&&v.creatineTaken&&num(v.creatineAmount)>=5).length;$('strengthProgress').value=Math.min(strength,4);$('runProgress').value=Math.min(runs,3);$('creatineProgress').value=Math.min(creatineDays,7);$('strengthCount').textContent=`${strength}/4`;$('runCount').textContent=`${runs}/3`;$('creatineCount').textContent=`${creatineDays}/7`;const {start,end}=getWeekBounds();$('weekRange').textContent=`${start.getDate()}–${end.getDate()}`;const pc=$('photoCount');if(pc)pc.textContent=`${(data.photos||[]).length} photo${(data.photos||[]).length>1?'s':''}`;const rows=Object.entries(data.daily).filter(([,v])=>num(v.weight)>0||num(v.waist)>0).sort(([a],[b])=>a.localeCompare(b));const first=rows[0]?.[1]||{},last=rows.at(-1)?.[1]||{};const wd=num(last.weight||data.profile.initialWeight)-num(first.weight||data.profile.initialWeight),wa=num(last.waist||data.profile.initialWaist)-num(first.waist||data.profile.initialWaist);$('totalWeightDelta').textContent=`${wd>0?'+':''}${fmt(wd)} kg`;$('totalWaistDelta').textContent=`${wa>0?'+':''}${fmt(wa)} cm`;$('totalWorkouts').textContent=data.strength.length;$('totalRuns').textContent=`${fmt(data.running.reduce((s,r)=>s+num(r.distance),0))} km`;$('progressMessage').textContent=rows.length<2?'Commence par enregistrer régulièrement tes mesures. Chaque étape compte.':wa<-.5?`Excellent rythme : ${Math.abs(fmt(wa))} cm en moins. Continue ainsi.`:wd<-.3?`Belle progression : ${Math.abs(fmt(wd))} kg en moins. Garde cette régularité.`:'Ta constance construit le résultat. Les progrès deviennent visibles semaine après semaine.'}
function fillDaily(d){const v=data.daily[d]||{};['weight','waist','sleep','water'].forEach(k=>$(k).value=v[k]??'');$('stress').value=v.stress??3;$('energy').value=v.energy??3;$('hunger').value=v.hunger??3;$('dailyNote').value=v.note??'';updateRanges()}function fillSupp(d){const v=data.supplements[d]||{};$('creatineTaken').checked=!!v.creatineTaken;$('creatineAmount').value=v.creatineAmount??5;$('proteinPowderTaken').checked=!!v.proteinPowderTaken;$('proteinPowderAmount').value=v.proteinPowderAmount??30;$('otherSupplements').value=v.other??''}
function updateRanges(){['stress','energy','hunger','strengthRpe','runRpe'].forEach(id=>{const o=$(id+'Out');if(o)o.textContent=`${$(id).value}/${$(id).max}`})}function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function paceText(distance,duration){if(!distance||!duration)return '—';const p=duration/distance,m=Math.floor(p),s=Math.round((p-m)*60);return `${m}:${String(s).padStart(2,'0')} /km`}
function runCard(x){const stats=[['Distance',`${fmt(x.distance)} km`],['Durée',`${Math.round(num(x.duration))} min`],['Allure',paceText(num(x.distance),num(x.duration))],['FC moy.',x.hr?`${Math.round(x.hr)} bpm`:'—'],['Dénivelé',x.elevation?`${Math.round(x.elevation)} m`:'—'],['Cadence',x.cadence?`${Math.round(x.cadence)} ppm`:'—'],['Calories',x.calories?`${Math.round(x.calories)} kcal`:'—']];return `<article class="run-card card" data-run-open="${x.id}" role="button" tabindex="0"><div class="run-card-head"><div><span class="eyebrow">${escapeHtml(x.type||'Course')}</span><h3>${fmt(x.distance)} km · ${paceText(num(x.distance),num(x.duration))}</h3><small>${fmtDate(x.date)}</small></div><button class="delete-entry" data-delete="running" data-id="${x.id}" aria-label="Supprimer">×</button></div><div class="run-stats">${stats.map(([a,b])=>`<div><strong>${b}</strong><span>${a}</span></div>`).join('')}</div><div class="run-open-hint">${x.route?.length?'🗺️ Ouvrir la carte et les détails':'Ouvrir les détails'}</div></article>`}
function renderLists(){const mk=(x,type)=>{const detail=type==='strength'&&x.workoutExercises?.length?x.workoutExercises.map(e=>`${e.name} · ${e.sets}×${e.reps} · ${e.weight||0} kg`).join('\n'):escapeHtml(x.exercises||x.note||'');return `<article class="entry"><div class="entry-head"><div><h4>${escapeHtml(x.type)}</h4><span class="muted">${fmtDate(x.date)}</span></div><button class="delete-entry" data-delete="${type}" data-id="${x.id}">×</button></div><p>${type==='strength'&&x.workoutExercises?.length?escapeHtml(detail):detail}</p></article>`};$('strengthList').innerHTML=[...data.strength].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>mk(x,'strength')).join('');$('runList').innerHTML=[...data.running].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(runCard).join('')||'<div class="empty card">Aucune course enregistrée.</div>';$('historyList').innerHTML=Object.entries(data.daily).sort(([a],[b])=>b.localeCompare(a)).slice(0,12).map(([d,v])=>`<article class="entry"><h4>${fmtDate(d)}</h4><div class="entry-meta">${v.weight?`<span class="chip">${v.weight} kg</span>`:''}${v.waist?`<span class="chip">${v.waist} cm</span>`:''}</div></article>`).join('')}
function openRunDetails(id){const r=data.running.find(x=>x.id===id);if(!r)return;const dlg=$('runDetailDialog');$('runDetailTitle').textContent=`${r.type||'Course'} · ${fmt(r.distance)} km`;$('runDetailDate').textContent=fmtDate(r.date);const stats=[['Distance',`${fmt(r.distance)} km`],['Durée',`${Math.round(num(r.duration))} min`],['Allure',paceText(num(r.distance),num(r.duration))],['FC moyenne',r.hr?`${Math.round(r.hr)} bpm`:'—'],['FC max',r.maxHr?`${Math.round(r.maxHr)} bpm`:'—'],['Dénivelé +',r.elevation?`${Math.round(r.elevation)} m`:'—'],['Cadence',r.cadence?`${Math.round(r.cadence)} pas/min`:'—'],['Calories',r.calories?`${Math.round(r.calories)} kcal`:'—']];$('runDetailStats').innerHTML=stats.map(([a,b])=>`<div><strong>${b}</strong><span>${a}</span></div>`).join('');$('runDetailNote').textContent=r.note||'';dlg.showModal();setTimeout(()=>{if(activeRunMap){activeRunMap.remove();activeRunMap=null}const host=$('runDetailMap');host.innerHTML='';if(r.route?.length&&window.L){activeRunMap=L.map(host,{zoomControl:true});const pts=r.route.map(p=>[p.lat,p.lon]);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(activeRunMap);L.polyline(pts,{weight:5}).addTo(activeRunMap);activeRunMap.fitBounds(pts,{padding:[20,20]});setTimeout(()=>activeRunMap.invalidateSize(),150)}else host.innerHTML='<div class="photo-missing">Aucun tracé GPS disponible pour cette session.</div>'},100)}
function drawChart(){const metric=$('chartMetric').value;let rows;if(['protein','calories'].includes(metric))rows=Object.keys(data.nutrition).map(date=>({date,value:metric==='protein'?totals(date).protein:totals(date).kcal}));else rows=Object.entries(data.daily).map(([date,v])=>({date,value:num(v[metric],NaN)}));rows=rows.filter(x=>Number.isFinite(x.value)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);const c=$('progressChart'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);$('chartEmpty').classList.toggle('hidden',rows.length>=2);if(rows.length<2)return;const vals=rows.map(x=>x.value),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1,p={l:55,r:20,t:25,b:35};ctx.strokeStyle='#79e6a3';ctx.lineWidth=5;ctx.beginPath();rows.forEach((r,i)=>{const x=p.l+(w-p.l-p.r)*i/(rows.length-1),y=p.t+(max-r.value)/range*(h-p.t-p.b);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}

async function lookupBarcode(code){
  const clean=String(code||'').replace(/\D/g,'');
  if(!clean)return toast('Code-barres invalide');
  toast('Recherche du produit…');
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json`);
    const j=await r.json();
    if(j.status!==1)throw new Error('not found');
    const p=j.product||{},n=p.nutriments||{};
    const food={id:`barcode-${clean}`,barcode:clean,name:p.product_name_fr||p.product_name||`Produit ${clean}`,kcal:num(n['energy-kcal_100g']),protein:num(n.proteins_100g),carbs:num(n.carbohydrates_100g),fat:num(n.fat_100g)};
    if(!food.kcal&&!food.protein)throw new Error('missing nutrition');
    const existing=data.customFoods.findIndex(x=>x.id===food.id);if(existing>=0)data.customFoods[existing]=food;else data.customFoods.unshift(food);save();openFood(food);
  }catch(e){toast('Produit introuvable — ajoute-le manuellement')}
}
async function startBarcodeScan(){
  if(!('BarcodeDetector' in window)){const code=prompt('La caméra de scan n’est pas disponible sur cet iPhone. Saisis les chiffres du code-barres :');if(code)lookupBarcode(code);return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}),video=$('barcodeVideo'),dlg=$('barcodeDialog');video.srcObject=stream;dlg.showModal();await video.play();
    const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});let stopped=false;
    const stop=()=>{stopped=true;stream.getTracks().forEach(t=>t.stop());if(dlg.open)dlg.close()};$('closeBarcode').onclick=stop;
    const loop=async()=>{if(stopped)return;try{const codes=await detector.detect(video);if(codes[0]){const raw=codes[0].rawValue;stop();lookupBarcode(raw);return}}catch{}requestAnimationFrame(loop)};loop();
  }catch{const code=prompt('Autorisation caméra impossible. Saisis le code-barres :');if(code)lookupBarcode(code)}
}
function parseDuration(v){if(!v)return 0;const p=String(v).trim().split(':').map(Number);return p.length===3?p[0]*60+p[1]+p[2]/60:p.length===2?p[0]+p[1]/60:num(v)}
function xmlText(doc,names){for(const n of names){const el=doc.getElementsByTagName(n)[0]||doc.getElementsByTagNameNS('*',n)[0];if(el?.textContent)return el.textContent}return ''}
function setOperationStatus(id,message,type='working'){
  const el=$(id);if(!el)return;
  el.textContent=message;el.className=`operation-status ${type}`;
  if(!message)el.classList.add('hidden');
}
function parseLocaleNumber(value){
  if(value===null||value===undefined)return 0;
  let s=String(value).trim().replace(/\s/g,'').replace(/[^0-9,.-]/g,'');
  if(s.includes(',')&&!s.includes('.'))s=s.replace(',','.');
  else if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  return num(s);
}
function xmlNodes(doc,name){return [...doc.getElementsByTagName(name),...doc.getElementsByTagNameNS('*',name)]}
function average(values){const v=values.filter(n=>Number.isFinite(n)&&n>0);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function elevationGain(values){let gain=0;for(let i=1;i<values.length;i++){const d=values[i]-values[i-1];if(d>1)gain+=d}return gain}
function nodeNumber(node,names){return parseLocaleNumber(xmlText(node,names))}
async function analyzeGarminFile(file){
  if(!file)throw new Error('Aucun fichier sélectionné');const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='fit')throw new Error('Le FIT brut doit être exporté en GPX ou TCX depuis Garmin Connect');if(!['gpx','tcx','csv'].includes(ext))throw new Error('Format non pris en charge');
  let run={id:crypto.randomUUID(),type:'Garmin',rpe:6,note:`Import Garmin · ${file.name}`,sourceFile:file.name,route:[],hr:0,maxHr:0,elevation:0,cadence:0,calories:0};
  if(['gpx','tcx'].includes(ext)){
    const text=await file.text();if(!text.trim())throw new Error('Fichier vide');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('XML invalide');const time=xmlText(doc,['Time','time']);run.date=(time||today()).slice(0,10);
    let points=[];if(ext==='gpx'){points=xmlNodes(doc,'trkpt').map(n=>({lat:+n.getAttribute('lat'),lon:+n.getAttribute('lon'),ele:nodeNumber(n,['ele']),time:Date.parse(xmlText(n,['time'])),hr:nodeNumber(n,['hr']),cad:nodeNumber(n,['cad'])})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));}else{points=xmlNodes(doc,'Trackpoint').map(n=>({lat:nodeNumber(n,['LatitudeDegrees']),lon:nodeNumber(n,['LongitudeDegrees']),ele:nodeNumber(n,['AltitudeMeters']),time:Date.parse(xmlText(n,['Time'])),hr:nodeNumber(n,['HeartRateBpm','Value']),cad:nodeNumber(n,['RunCadence','Cadence'])})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat&&p.lon)}
    run.route=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/900))===0).map(p=>({lat:p.lat,lon:p.lon}));let dist=nodeNumber(doc,['DistanceMeters'])/1000;if(!dist&&points.length>1){dist=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180,q=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;dist+=2*R*Math.asin(Math.sqrt(q))}}run.distance=fmt(dist);
    let sec=nodeNumber(doc,['TotalTimeSeconds']);if(!sec){const times=points.map(p=>p.time).filter(Number.isFinite);if(times.length>1)sec=(Math.max(...times)-Math.min(...times))/1000}run.duration=fmt(sec/60);
    const hrs=points.map(p=>p.hr);run.hr=nodeNumber(doc,['AverageHeartRateBpm'])||average(hrs);run.maxHr=nodeNumber(doc,['MaximumHeartRateBpm'])||Math.max(0,...hrs);const elevations=points.map(p=>p.ele).filter(Number.isFinite);run.elevation=nodeNumber(doc,['ElevationGain','TotalAscent'])||elevationGain(elevations);const cads=points.map(p=>p.cad);run.cadence=nodeNumber(doc,['AverageRunCadence','AvgRunCadence','AverageCadence'])||average(cads);run.calories=nodeNumber(doc,['Calories','TotalCalories']);
  }else{
    const text=await file.text();const lines=text.split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw new Error('CSV vide ou sans activité');const candidates=[';',',','\t'];const sep=candidates.sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];const split=line=>line.split(sep).map(x=>x.replace(/^"|"$/g,'').trim());const h=split(lines[0]).map(x=>x.toLowerCase());const v=split(lines[1]);const get=(...keys)=>{const i=h.findIndex(x=>keys.some(k=>x.includes(k)));return i>=0?v[i]:''};run.date=(get('date','début','start time')||today()).slice(0,10);run.distance=parseLocaleNumber(get('distance'));if(run.distance>1000)run.distance/=1000;run.duration=parseDuration(get('temps','time','durée','duration'));run.hr=parseLocaleNumber(get('fréquence cardiaque moyenne','avg hr','fc moyenne','average heart rate'));run.maxHr=parseLocaleNumber(get('fréquence cardiaque max','max hr','fc max','maximum heart rate'));run.elevation=parseLocaleNumber(get('dénivelé','elevation gain','gain altitude','total ascent'));run.cadence=parseLocaleNumber(get('cadence moyenne','average cadence','avg cadence','cadence'));run.calories=parseLocaleNumber(get('calories','kcal'));
  }
  if(!run.distance||run.distance<=0)throw new Error('Distance introuvable dans le fichier');return run;
}
function showGarminPreview(run,file){
  selectedGarminPreview=run;
  $('garminPreviewDate').value=run.date||today();$('garminPreviewType').value=run.type||'Garmin';$('garminPreviewDistance').value=run.distance||'';$('garminPreviewDuration').value=run.duration||'';$('garminPreviewHr').value=run.hr||'';$('garminPreviewElevation').value=run.elevation||'';$('garminPreviewCadence').value=run.cadence||'';$('garminPreviewCalories').value=run.calories||'';$('garminPreviewMaxHr').value=run.maxHr||'';$('garminPreviewNote').value=run.note||'';
  $('garminRouteSummary').textContent=run.route?.length?`${run.route.length} points GPS détectés · la carte sera accessible en ouvrant la session enregistrée`:'Aucun tracé GPS détecté dans ce fichier';
  $('garminParsedPreview').classList.remove('hidden');
  setOperationStatus('garminImportStatus',`Résumé prêt pour ${file.name}. Vérifie puis confirme l’enregistrement.`,'success');
}
function clearGarminSelection(){selectedGarminFile=null;selectedGarminPreview=null;$('garminImport').value='';$('garminFilePreview').classList.add('hidden');$('garminParsedPreview').classList.add('hidden')}

const PHOTO_DB='luis-transformation-photos';
function photoDB(){return new Promise((ok,no)=>{const r=indexedDB.open(PHOTO_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function storePhoto(meta,file){
  const db=await photoDB();
  const dataUrl=typeof file==='string'?file:await compressImageToDataURL(file,1600,.86);
  const rec={...meta,dataUrl,mimeType:'image/jpeg',savedAt:new Date().toISOString()};
  await new Promise((ok,no)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(rec);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});
}
async function getPhoto(id){const db=await photoDB();return new Promise((ok,no)=>{const r=db.transaction('photos').objectStore('photos').get(id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function deletePhoto(id){const db=await photoDB();await new Promise((ok,no)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
async function renderPhotos(){
  const host=$('photoGrid');if(!host)return;
  host.innerHTML='<div class="empty">Chargement…</div>';
  const items=[...(data.photos||[])].sort((a,b)=>b.date.localeCompare(a.date));
  if(!items.length){host.innerHTML='<div class="empty card">Ajoute ta première photo pour créer ton avant/après.</div>';return}
  const cards=[];
  for(const m of items){
    try{
      const r=await getPhoto(m.id);
      const url=r?.dataUrl||(r?.blob?URL.createObjectURL(r.blob):'');
      const media=url?`<button class="photo-open" data-photo-open="${m.id}" aria-label="Ouvrir la photo en grand"><img src="${url}" alt="Progression ${m.date}" loading="lazy"></button>`:`<div class="photo-missing"><span>🖼️</span><strong>Photo indisponible sur cet appareil</strong><small>Les mesures sont conservées. Réimporte une sauvegarde complète ou ajoute de nouveau la photo.</small></div>`;
      cards.push(`<article class="photo-card card">${media}<div><strong>${fmtDate(m.date)} · ${escapeHtml(m.pose)}</strong><small>${m.weight||'—'} kg · ${m.waist||'—'} cm</small><p>${escapeHtml(m.note||'')}</p><button class="delete-photo danger-text" data-photo-delete="${m.id}">Supprimer</button></div></article>`)
    }catch(err){console.warn('Photo illisible',m.id,err);cards.push(`<article class="photo-card card"><div class="photo-missing"><span>⚠️</span><strong>Photo non lisible</strong><small>${fmtDate(m.date)} · ${escapeHtml(m.pose)}</small></div></article>`)}
  }
  host.innerHTML=cards.join('');
}

async function renderPhotoAnalysis(){
  const host=$('photoAnalysis');if(!host)return;
  const pose=$('comparePose')?.value||'Face';
  const items=[...(data.photos||[])].filter(x=>x.pose===pose).sort((a,b)=>a.date.localeCompare(b.date));
  if(items.length<2){host.innerHTML='<p class="muted">Ajoute deux photos de la même pose pour obtenir une comparaison.</p>';return}
  const first=items[0],last=items.at(-1);
  try{
    const [a,b]=await Promise.all([getPhoto(first.id),getPhoto(last.id)]);
    const au=a?.dataUrl||(a?.blob?URL.createObjectURL(a.blob):'');
    const bu=b?.dataUrl||(b?.blob?URL.createObjectURL(b.blob):'');
    const dw=num(last.weight)-num(first.weight),dc=num(last.waist)-num(first.waist);
    host.innerHTML=`<div class="before-after-grid"><div>${au?`<img src="${au}" alt="Avant">`:'<div class="photo-missing">Photo avant indisponible</div>'}<strong>Avant · ${fmtDate(first.date)}</strong></div><div>${bu?`<img src="${bu}" alt="Après">`:'<div class="photo-missing">Photo après indisponible</div>'}<strong>Après · ${fmtDate(last.date)}</strong></div></div><div class="progress-summary"><span>${dw>0?'+':''}${fmt(dw)} kg</span><span>${dc>0?'+':''}${fmt(dc)} cm</span><p>${dc<-.5?'Belle évolution du tour de taille. Continue avec la même régularité.':dw<-.3?'Le poids évolue dans le bon sens. Garde ce rythme.':'La régularité fera ressortir les changements semaine après semaine.'}</p></div>`;
  }catch(e){host.innerHTML='<p class="muted">Comparaison indisponible pour le moment.</p>'}
}

function renderAll(){renderProfile();renderDashboard();renderLists();if(document.querySelector('[data-view="nutrition"]').classList.contains('active'))renderNutrition();if(document.querySelector('[data-view="photos"]').classList.contains('active'))renderPhotos()}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>b.classList.contains('more-button')?$('moreSheet').classList.remove('hidden'):showView(b.dataset.target)));document.querySelectorAll('[data-go]').forEach(el=>{
  el.addEventListener('click',()=>showView(el.dataset.go));
  if(el.getAttribute('role')==='button') el.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();showView(el.dataset.go)}
  });
});$('closeSheet').onclick=()=>$('moreSheet').classList.add('hidden');['stress','energy','hunger','strengthRpe','runRpe'].forEach(id=>$(id).oninput=updateRanges);$('strengthType').onchange=renderWorkoutPreset;if($('comparePose'))$('comparePose').onchange=renderPhotoAnalysis;
$('dailyDate').onchange=e=>fillDaily(e.target.value);$('supplementDate').onchange=e=>fillSupp(e.target.value);$('nutritionDate').onchange=renderNutrition;$('foodSearch').oninput=e=>renderFoodSearch(e.target.value);$('toggleCustomFood').onclick=()=>$('customFoodForm').classList.toggle('hidden');
$('dailyForm').onsubmit=e=>{e.preventDefault();const d=$('dailyDate').value;data.daily[d]={weight:$('weight').value,waist:$('waist').value,sleep:$('sleep').value,water:$('water').value,stress:num($('stress').value),energy:num($('energy').value),hunger:num($('hunger').value),note:$('dailyNote').value.trim()};save();toast('Journée enregistrée')};
$('supplementForm').onsubmit=e=>{e.preventDefault();const d=$('supplementDate').value;data.supplements[d]={creatineTaken:$('creatineTaken').checked,creatineAmount:num($('creatineAmount').value),proteinPowderTaken:$('proteinPowderTaken').checked,proteinPowderAmount:num($('proteinPowderAmount').value),other:$('otherSupplements').value.trim()};save();toast('Compléments enregistrés')};
$('strengthForm').onsubmit=e=>{e.preventDefault();const workoutExercises=collectWorkoutExercises();data.strength.push({id:crypto.randomUUID(),date:$('strengthDate').value,type:$('strengthType').value,duration:num($('strengthDuration').value),workoutExercises,exercises:workoutExercises.map(x=>`${x.name}: ${x.sets}×${x.reps} à ${x.weight||0} kg`).join('\n'),rpe:num($('strengthRpe').value),note:$('strengthNote').value.trim()});save();renderWorkoutPreset();toast('Séance enregistrée')};$('runForm').onsubmit=e=>{e.preventDefault();data.running.push({id:crypto.randomUUID(),date:$('runDate').value,type:$('runType').value,distance:num($('runDistance').value),duration:num($('runDuration').value),hr:num($('runHr').value),maxHr:num($('runMaxHr')?.value),elevation:num($('runElevation')?.value),cadence:num($('runCadence')?.value),calories:num($('runCalories')?.value),rpe:num($('runRpe').value),note:$('runNote').value.trim()});save();toast('Sortie ajoutée')};
$('foodResults').onclick=e=>{const el=e.target.closest('[data-food]');if(el)openFood(foods().find(f=>f.id===el.dataset.food))};$('confirmFood').onclick=e=>{e.preventDefault();const grams=num($('gramsInput').value);if(!selectedFood||grams<1)return;const d=$('nutritionDate').value,n=nutritionDay(d),r=grams/100;n.entries.push({id:crypto.randomUUID(),meal:$('mealSelect').value,name:selectedFood.name,grams,kcal:selectedFood.kcal*r,protein:selectedFood.protein*r,carbs:selectedFood.carbs*r,fat:selectedFood.fat*r});data.nutrition[d]=n;save();$('foodDialog').close();toast('Aliment ajouté')};
$('customFoodForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),food={id:`custom-${Date.now()}`,name:f.get('name'),kcal:num(f.get('kcal')),protein:num(f.get('protein')),carbs:num(f.get('carbs')),fat:num(f.get('fat'))};data.customFoods.unshift(food);save();e.target.reset();e.target.classList.add('hidden');toast('Aliment créé')};
$('mealSections').onclick=e=>{const b=e.target.closest('[data-food-delete]');if(!b)return;const d=$('nutritionDate').value,n=nutritionDay(d);n.entries=n.entries.filter(x=>x.id!==b.dataset.foodDelete);data.nutrition[d]=n;save()};$('copyYesterday').onclick=()=>{const d=new Date(($('nutritionDate').value||today())+'T12:00:00');d.setDate(d.getDate()-1);const prev=d.toISOString().slice(0,10),src=nutritionDay(prev);if(!src.entries.length)return toast('Aucun repas la veille');data.nutrition[$('nutritionDate').value]={entries:src.entries.map(x=>({...x,id:crypto.randomUUID()}))};save();toast('Journée copiée')};
document.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;data[b.dataset.delete]=data[b.dataset.delete].filter(x=>x.id!==b.dataset.id);save()});$('scanBarcodeBtn').onclick=startBarcodeScan;$('barcodeManualBtn').onclick=()=>{const c=prompt('Saisis les chiffres du code-barres :');if(c)lookupBarcode(c)};
$('garminImport').onchange=async e=>{
  const f=e.target.files?.[0];selectedGarminFile=f||null;selectedGarminPreview=null;
  if(!f){$('garminFilePreview').classList.add('hidden');$('garminParsedPreview').classList.add('hidden');return}
  const ext=(f.name.split('.').pop()||'').toUpperCase();$('garminFileName').textContent=f.name;$('garminFileMeta').textContent=`${ext||'Fichier'} · ${Math.max(1,Math.round(f.size/1024))} Ko`;$('garminFilePreview').classList.remove('hidden');$('garminParsedPreview').classList.add('hidden');
  setOperationStatus('garminImportStatus',`Analyse de ${f.name}…`,'working');
  try{const run=await analyzeGarminFile(f);showGarminPreview(run,f)}catch(err){console.error(err);setOperationStatus('garminImportStatus',`Analyse impossible : ${err.message}.`,'error')}
};
$('confirmGarminImport').onclick=()=>{if(!selectedGarminPreview)return setOperationStatus('garminImportStatus','Choisis et analyse d’abord un fichier.','error');const run={...selectedGarminPreview,date:$('garminPreviewDate').value||today(),type:$('garminPreviewType').value||'Garmin',distance:num($('garminPreviewDistance').value),duration:num($('garminPreviewDuration').value),hr:num($('garminPreviewHr').value),maxHr:num($('garminPreviewMaxHr').value),elevation:num($('garminPreviewElevation').value),cadence:num($('garminPreviewCadence').value),calories:num($('garminPreviewCalories').value),note:$('garminPreviewNote').value.trim()};if(!run.distance)return setOperationStatus('garminImportStatus','La distance doit être renseignée.','error');data.running.push(run);if(save()){setOperationStatus('garminImportStatus',`Session enregistrée : ${fmt(run.distance)} km · ${Math.round(run.duration||0)} min.`,'success');toast('Course enregistrée');clearGarminSelection()}};
$('cancelGarminImport').onclick=()=>{clearGarminSelection();setOperationStatus('garminImportStatus','')};
function dataURLtoFile(dataUrl,name='photo-recadrée.jpg'){const [head,body]=dataUrl.split(',');const mime=(head.match(/:(.*?);/)||[])[1]||'image/jpeg',bin=atob(body);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new File([arr],name,{type:mime})}
function drawCrop(){const c=$('cropCanvas');if(!c||!cropImage)return;const ctx=c.getContext('2d'),size=c.width;ctx.clearRect(0,0,size,size);const base=Math.max(size/cropImage.width,size/cropImage.height),scale=base*cropScale,w=cropImage.width*scale,h=cropImage.height*scale,x=(size-w)/2+cropOffsetX,y=(size-h)/2+cropOffsetY;ctx.drawImage(cropImage,x,y,w,h)}
function openCropEditor(file){const reader=new FileReader();reader.onload=()=>{cropImage=new Image();cropImage.onload=()=>{cropScale=1;cropOffsetX=0;cropOffsetY=0;$('cropZoom').value='1';drawCrop();$('photoCropDialog').showModal()};cropImage.src=reader.result};reader.readAsDataURL(file)}
$('cropZoom').oninput=e=>{cropScale=num(e.target.value,1);drawCrop()};$('cropCanvas').onpointerdown=e=>{cropDragging=true;cropDragStart={x:e.clientX,y:e.clientY,ox:cropOffsetX,oy:cropOffsetY};$('cropCanvas').setPointerCapture(e.pointerId)};$('cropCanvas').onpointermove=e=>{if(!cropDragging)return;cropOffsetX=cropDragStart.ox+e.clientX-cropDragStart.x;cropOffsetY=cropDragStart.oy+e.clientY-cropDragStart.y;drawCrop()};$('cropCanvas').onpointerup=()=>cropDragging=false;$('cancelCrop').onclick=()=>$('photoCropDialog').close();$('applyCrop').onclick=()=>{const dataUrl=$('cropCanvas').toDataURL('image/jpeg',.9);selectedPhotoFile=dataURLtoFile(dataUrl,selectedPhotoFile?.name||'photo-recadrée.jpg');if(selectedPhotoPreviewUrl)URL.revokeObjectURL(selectedPhotoPreviewUrl);selectedPhotoPreviewUrl=dataUrl;$('photoPreviewImage').src=dataUrl;$('photoPreview').classList.remove('hidden');$('photoPreviewMeta').textContent=`Photo recadrée · ${Math.max(1,Math.round(selectedPhotoFile.size/1024))} Ko`;$('photoCropDialog').close();setOperationStatus('photoImportStatus','Recadrage appliqué. Vérifie l’aperçu puis enregistre.','success')};
$('editCropPhoto').onclick=()=>{if(selectedPhotoFile)openCropEditor(selectedPhotoFile)};

$('runList').addEventListener('click',e=>{if(e.target.closest('[data-delete]'))return;const card=e.target.closest('[data-run-open]');if(card)openRunDetails(card.dataset.runOpen)});$('runList').addEventListener('keydown',e=>{const card=e.target.closest('[data-run-open]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openRunDetails(card.dataset.runOpen)}});$('closeRunDetail').onclick=()=>$('runDetailDialog').close();$('closePhotoLightbox').onclick=()=>$('photoLightboxDialog').close();
$('photoForm').onsubmit=async e=>{
  e.preventDefault();const file=selectedPhotoFile;if(!file)return toast('Choisis une photo');
  const id=crypto.randomUUID(),meta={id,date:$('photoDate').value||today(),pose:$('photoPose').value,weight:$('photoWeight').value,waist:$('photoWaist').value,note:$('photoNote').value.trim()};
  const submit=e.submitter||e.target.querySelector('button[type="submit"],button:not([type])');if(submit){submit.disabled=true;submit.textContent='Sauvegarde…'}
  try{
    setOperationStatus('photoImportStatus','Compression et sauvegarde de la photo…','working');
    await storePhoto(meta,file);const check=await getPhoto(id);if(!check?.dataUrl&&!check?.blob)throw new Error('Vérification du fichier impossible');data.photos=[...(data.photos||[]),meta];if(!save())throw new Error('Données non enregistrées');
    e.target.reset();$('photoDate').value=today();clearProgressPhotoSelection();await renderPhotos();setOperationStatus('photoImportStatus','Photo enregistrée et vérifiée.','success');toast('Photo enregistrée et vérifiée');
  }catch(err){console.error('Photo save',err);toast('Impossible d’enregistrer la photo')}
  finally{if(submit){submit.disabled=false;submit.textContent='Enregistrer la photo'}}
};
$('photoGrid').onclick=async e=>{const open=e.target.closest('[data-photo-open]');if(open){const rec=await getPhoto(open.dataset.photoOpen);const meta=data.photos.find(x=>x.id===open.dataset.photoOpen);const url=rec?.dataUrl||(rec?.blob?URL.createObjectURL(rec.blob):'');if(url){$('photoLightboxImage').src=url;$('photoLightboxTitle').textContent=meta?`${fmtDate(meta.date)} · ${meta.pose}`:'Photo';$('photoLightboxDialog').showModal()}return}const b=e.target.closest('[data-photo-delete]');if(!b)return;await deletePhoto(b.dataset.photoDelete);data.photos=(data.photos||[]).filter(x=>x.id!==b.dataset.photoDelete);save();renderPhotos()};
function blobToDataURL(blob){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(blob)})}
function dataURLToBlob(url){const [head,body]=url.split(',');const mime=(head.match(/data:(.*?);/)||[])[1]||'image/jpeg';const bin=atob(body),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime})}
async function fullBackupPayload(){
  const payload={format:'luis-transformation-full-backup',schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),origin:location.origin,data:normalizeData(data),photoFiles:[]};
  for(const meta of payload.data.photos||[]){
    try{const rec=await getPhoto(meta.id);const dataUrl=rec?.dataUrl||(rec?.blob?await blobToDataURL(rec.blob):'');if(dataUrl)payload.photoFiles.push({id:meta.id,type:rec?.mimeType||rec?.blob?.type||'image/jpeg',dataUrl})}
    catch(e){console.warn('Photo non exportée',meta.id,e)}
  }
  return payload;
}

function clearProgressPhotoSelection(){
  selectedPhotoFile=null;selectedPhotoPreviewUrl='';
  $('photoCameraFile').value='';$('photoLibraryFile').value='';$('photoPreviewImage').removeAttribute('src');$('photoPreview').classList.add('hidden');setOperationStatus('photoImportStatus','');
}
function selectProgressPhoto(file){
  if(!file)return;
  const looksImage=(file.type||'').startsWith('image/')||/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||'');
  if(!looksImage){setOperationStatus('photoImportStatus','Ce fichier ne semble pas être une image.','error');return}
  selectedPhotoFile=file;setOperationStatus('photoImportStatus',`Chargement de ${file.name||'la photo'}…`,'working');
  const reader=new FileReader();
  reader.onload=()=>{selectedPhotoPreviewUrl=String(reader.result||'');$('photoPreviewImage').src=selectedPhotoPreviewUrl;$('photoPreviewMeta').textContent=`${file.name||'Photo'} · ${Math.max(1,Math.round(file.size/1024))} Ko`;$('photoPreview').classList.remove('hidden');setOperationStatus('photoImportStatus','Photo prête. Vérifie l’aperçu puis confirme l’enregistrement.','success');$('photoPreview').scrollIntoView({behavior:'smooth',block:'center'})};
  reader.onerror=()=>setOperationStatus('photoImportStatus','Impossible de lire cette photo. Essaie une image JPEG ou PNG.','error');
  reader.readAsDataURL(file);
}
$('photoCameraFile').onchange=e=>selectProgressPhoto(e.target.files[0]);$('photoLibraryFile').onchange=e=>selectProgressPhoto(e.target.files[0]);$('clearProgressPhoto').onclick=clearProgressPhotoSelection;$('openProgressOverview').onclick=()=>showView('history');
function coachBubble(role,text){const el=document.createElement('div');el.className='coach-bubble '+role;el.textContent=text;$('coachMessages').appendChild(el)}
$('nutritionCoachForm').onsubmit=async e=>{e.preventDefault();const message=$('nutritionCoachInput').value.trim();if(!message)return;coachBubble('user',message);$('nutritionCoachInput').value='';const btn=e.target.querySelector('button');btn.disabled=true;try{const t=totals($('nutritionDate').value);const r=await fetch('/.netlify/functions/nutrition-coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,context:{profile:data.profile,todayTotals:t}})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Coach indisponible');coachBubble('assistant',j.answer)}catch(err){coachBubble('assistant',err.message)}finally{btn.disabled=false}};
$('chartMetric').onchange=drawChart;
async function downloadFullBackup(){
  const status='backupStatus';setOperationStatus(status,'Préparation de la sauvegarde complète…');
  try{
    save();const payload=await fullBackupPayload();
    payload.stats={dailyDays:Object.keys(payload.data.daily||{}).length,nutritionDays:Object.keys(payload.data.nutrition||{}).length,strengthSessions:payload.data.strength.length,runs:payload.data.running.length,photos:payload.photoFiles.length};
    const json=JSON.stringify(payload);if(!json||json.length<50)throw new Error('Sauvegarde vide');
    const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`luis-transformation-backup-complet-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    localStorage.setItem('luis-transformation-last-export',new Date().toISOString());
    setOperationStatus(status,`Sauvegarde créée : ${payload.stats.strengthSessions} séance(s), ${payload.stats.runs} course(s), ${payload.stats.photos} photo(s).`,'success');
  }catch(e){console.error(e);setOperationStatus(status,`Échec de la sauvegarde : ${e.message||'erreur inconnue'}.`,'error')}
}
async function restoreFullBackup(file){
  const status='backupStatus';if(!file)return;
  setOperationStatus(status,`Lecture de ${file.name}…`);
  const previousData=clone(data);
  try{
    if(file.size>80*1024*1024)throw new Error('Fichier trop volumineux pour Safari');
    const text=await file.text();if(!text.trim())throw new Error('Fichier vide');
    const parsed=JSON.parse(text);const incoming=parsed?.format==='luis-transformation-full-backup'?parsed.data:parsed;
    if(!incoming||typeof incoming!=='object')throw new Error('Structure de sauvegarde invalide');
    const restored=normalizeData(incoming);
    const useful=Object.keys(restored.daily).length+Object.keys(restored.nutrition).length+restored.strength.length+restored.running.length+restored.photos.length;
    if(!useful&&!confirm('Cette sauvegarde ne contient aucun historique. Continuer ?'))throw new Error('Import annulé');
    // Sauvegarder les données principales d’abord : elles ne dépendent pas des photos.
    data=restored;if(!save())throw new Error('Impossible d’enregistrer les données restaurées');
    const photos=Array.isArray(parsed.photoFiles)?parsed.photoFiles:[];let photoOk=0,photoFail=0;
    for(let i=0;i<photos.length;i++){
      setOperationStatus(status,`Données restaurées. Photos ${i+1}/${photos.length}…`);
      const item=photos[i],meta=(data.photos||[]).find(x=>x.id===item.id);
      if(!meta||!item.dataUrl)continue;
      try{await storePhoto(meta,dataURLToBlob(item.dataUrl));photoOk++}catch(e){console.warn('Photo non restaurée',item.id,e);photoFail++}
    }
    renderAll();
    const msg=`Import terminé : ${data.strength.length} séance(s), ${data.running.length} course(s), ${photoOk} photo(s) restaurée(s)${photoFail?`, ${photoFail} en échec`:''}.`;
    setOperationStatus(status,msg,photoFail?'working':'success');toast('Sauvegarde restaurée');
  }catch(err){console.error('Import global',err);data=previousData;save();setOperationStatus(status,`Import impossible : ${err.message||'fichier invalide'}. Les données actuelles ont été conservées.`,'error')}
}
$('exportBtn').onclick=downloadFullBackup;
$('importInput').onchange=async e=>{const file=e.target.files?.[0];try{await restoreFullBackup(file)}finally{e.target.value=''}};
$('clearAllBtn').onclick=()=>{if(confirm('Effacer toutes les données de suivi ? Une sauvegarde complète est recommandée avant.')){data=clone(initialData);save()}};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});$('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}};if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
document.addEventListener('DOMContentLoaded',()=>{setDefaults();fillDaily(today());fillSupp(today());updateRanges();renderWorkoutPreset();renderAll()});

/* Luis Transformation v9 — ajout alimentaire assisté par IA */
let aiFoodPhotoFile=null;
let aiFoodPhotoDataUrl='';
let aiFoodCandidate=null;

function setAiFoodPhoto(file){
  if(!file)return;
  if(!file.type.startsWith('image/'))return toast('Choisis une image');
  aiFoodPhotoFile=file;
  const url=URL.createObjectURL(file);
  $('aiFoodPreviewImage').src=url;
  $('aiFoodPreview').classList.remove('hidden');
}

function clearAiFoodPhoto(){
  aiFoodPhotoFile=null;aiFoodPhotoDataUrl='';
  $('aiFoodCamera').value='';$('aiFoodLibrary').value='';
  $('aiFoodPreviewImage').removeAttribute('src');
  $('aiFoodPreview').classList.add('hidden');
}

function compressImageToDataURL(file,maxSide=1280,quality=.82){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      try{
        const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg',quality));
      }catch(e){URL.revokeObjectURL(url);reject(e)}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image illisible'))};
    img.src=url;
  });
}

function confidenceLabel(value){
  const v=String(value||'moyenne').toLowerCase();
  return v==='haute'?'Confiance élevée':v==='faible'?'À vérifier':'Confiance moyenne';
}

function fillAiFoodDialog(food){
  aiFoodCandidate=food;
  $('aiConfirmName').value=food.name||'';
  $('aiConfirmBrand').value=food.brand||'';
  $('aiConfirmPortion').value=Math.max(1,num(food.portionGrams)||100);
  $('aiConfirmKcal').value=num(food.kcal100);
  $('aiConfirmProtein').value=num(food.protein100);
  $('aiConfirmCarbs').value=num(food.carbs100);
  $('aiConfirmFat').value=num(food.fat100);
  $('aiConfirmFiber').value=num(food.fiber100);
  $('aiConfirmBarcode').value=food.barcode||'';
  $('aiFoodConfidence').textContent=confidenceLabel(food.confidence);
  $('aiFoodSource').textContent=food.sourceLabel||'Estimation IA à vérifier';
  $('aiFoodNotes').textContent=food.notes||'';
  if(aiFoodPhotoDataUrl){
    $('aiConfirmPhotoImage').src=aiFoodPhotoDataUrl;
    $('aiConfirmPhoto').classList.remove('hidden');
  }else $('aiConfirmPhoto').classList.add('hidden');
  $('aiFoodDialog').showModal();
}

async function identifyFoodWithAI(query){
  const btn=$('identifyFoodBtn');btn.disabled=true;btn.textContent='Analyse en cours…';
  try{
    aiFoodPhotoDataUrl=aiFoodPhotoFile?await compressImageToDataURL(aiFoodPhotoFile):'';
    if(!query&&!aiFoodPhotoDataUrl)throw new Error('Ajoute un nom ou une photo du produit.');
    const res=await fetch('/.netlify/functions/nutrition-identify',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({query,imageDataUrl:aiFoodPhotoDataUrl,locale:'fr-CH'})
    });
    const json=await res.json();
    if(!res.ok)throw new Error(json.error||'Identification indisponible');
    fillAiFoodDialog(json.food);
  }catch(err){toast(err.message||'Impossible d’identifier le produit')}
  finally{btn.disabled=false;btn.textContent='✨ Identifier et préremplir'}
}

$('aiFoodCamera').onchange=e=>setAiFoodPhoto(e.target.files[0]);
$('aiFoodLibrary').onchange=e=>setAiFoodPhoto(e.target.files[0]);
$('removeAiFoodPhoto').onclick=clearAiFoodPhoto;
$('aiFoodForm').onsubmit=e=>{e.preventDefault();identifyFoodWithAI($('aiFoodQuery').value.trim())};
$('confirmAiFood').onclick=e=>{
  e.preventDefault();
  const portion=Math.max(1,num($('aiConfirmPortion').value));
  const food={
    id:`ai-${Date.now()}`,name:$('aiConfirmName').value.trim(),brand:$('aiConfirmBrand').value.trim(),
    barcode:$('aiConfirmBarcode').value.trim(),kcal:num($('aiConfirmKcal').value),
    protein:num($('aiConfirmProtein').value),carbs:num($('aiConfirmCarbs').value),fat:num($('aiConfirmFat').value),
    fiber:num($('aiConfirmFiber').value),source:aiFoodCandidate?.sourceLabel||'IA confirmée',createdBy:'ai'
  };
  if(!food.name)return toast('Renseigne le nom de l’aliment');
  const d=$('nutritionDate').value||today(),n=nutritionDay(d),ratio=portion/100;
  n.entries.push({id:crypto.randomUUID(),meal:$('aiConfirmMeal').value,name:[food.brand,food.name].filter(Boolean).join(' · '),grams:portion,kcal:food.kcal*ratio,protein:food.protein*ratio,carbs:food.carbs*ratio,fat:food.fat*ratio,source:'ai-confirmed'});
  data.nutrition[d]=n;
  const existing=(data.customFoods||[]).findIndex(x=>food.barcode&&x.barcode===food.barcode);
  if(existing>=0)data.customFoods[existing]={...data.customFoods[existing],...food};else data.customFoods.unshift(food);
  save();$('aiFoodDialog').close();$('aiFoodQuery').value='';clearAiFoodPhoto();toast('Aliment confirmé et ajouté');
};

if($("profileShortcut"))$("profileShortcut").onclick=()=>showView("settings");
if($("profileForm"))$("profileForm").onsubmit=e=>{e.preventDefault();data.profile={...data.profile,name:$("profileName").value.trim()||"Luis",age:num($("profileAge").value)||41,height:num($("profileHeight").value)||189,calorieGoal:num($("profileCalories").value)||2400,proteinGoal:num($("profileProtein").value)||170};save();renderAll();toast("Profil enregistré");showView("dashboard")};
