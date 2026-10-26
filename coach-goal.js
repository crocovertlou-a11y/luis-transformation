/* Shared goal context, local follow-up and explicit photo consent. */
(()=>{
'use strict';
const E=FluiditeGoalEngine,esc=escapeHtml;
let revision=0,cached=null,pending=null;
const invalidate=()=>{revision++;cached=null;};
// Only successful writes invalidate the analysis; a render never writes data.
for(const name of ['put','del','restore']){const base=LTDB[name];LTDB[name]=async function(...args){const out=await base.apply(this,args);invalidate();return out;};}
const put=LTDB.put;
LTDB.put=async function(store,value){const out=await put(store,value);if(store==='food'){const marker=await LTDB.get('memory','coach-food-'+value.date);if(marker?.complete)await put('memory',{...marker,complete:false});}return out;};
const oldDel=LTDB.del;
LTDB.del=async function(store,id){const food=store==='food'?await LTDB.get(store,id):null;const out=await oldDel(store,id);if(food){const marker=await LTDB.get('memory','coach-food-'+food.date);if(marker?.complete)await put('memory',{...marker,complete:false});}if(store==='photos')for(const m of await LTDB.all('memory'))if(m.type==='coach-photo'&&m.photoIds?.includes(id))await oldDel('memory',m.id);return out;};
async function snapshot(){
 const key=revision+'|'+todayKey()+'|'+JSON.stringify(state.profile?.goalCoach||{})+'|'+state.profile?.goal;
 if(cached?.key===key)return cached.value;
 if(pending?.key===key)return pending.promise;
 const promise=(async()=>{
  const [checkins,workouts,cardio,food,memory,health]=await Promise.all(['checkins','workouts','cardio','food','memory','health'].map(s=>LTDB.all(s)));
  const date=todayKey(),current=health.find(h=>h.date===date&&h.confirmed);
  const recovery=window.FluiditeRecoveryV15?.assess(current,health,checkins.find(c=>c.date===date),[...workouts,...cardio]);
  const value=E.analyze({date,profile:state.profile,checkins,workouts,cardio,food,memory,recovery});
  // Consented textual interpretations only; never attach raw photos automatically.
  value.photoObservations=memory.filter(m=>m.type==='coach-photo'&&m.consent===true&&m.goal===value.goal&&m.date<=date&&m.date>=E.shift(date,-60)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(m=>({date:m.date,from:m.from,to:m.to,view:m.view,analysis:m.analysis,kind:'Interprétation visuelle IA, non mesure objective'}));
  cached={key,value};return value;
 })();pending={key,promise};try{return await promise;}finally{if(pending?.key===key)pending=null;}
}
function signed(n,unit){return n===null?'Recul insuffisant':(n>0?'+':'')+n.toFixed(1)+' '+unit;}
function overview(s,full=false){
 const calories=s.nutrition.calories;
 return `<section class="card goal-coach" aria-label="Ton cap et ton suivi"><div class="card-kicker">TON CAP ET TON SUIVI</div><h3>${esc(s.advice.title)}</h3><p>${esc(s.advice.text)}</p><p class="goal-caption">${esc(s.goal)} · analyse du ${esc(s.date)}</p><details ${full?'open':''}><summary>Comprendre et ajuster</summary><p>${esc(s.strategy.training)}</p><p>${esc(s.strategy.nutrition)}</p><div class="goal-stats"><div><strong>${signed(s.weight.delta,'kg')}</strong><small>Poids moyen</small></div><div><strong>${signed(s.waist.delta,'cm')}</strong><small>Tour de taille moyen</small></div><div><strong>${s.force.sessions} / ${s.cardio.sessions}</strong><small>Force / cardio enregistrés · 28 j</small></div><div><strong>${s.nutrition.completeDays} / 28</strong><small>Jours alimentaires confirmés complets</small></div></div><p>${calories?`Repère estimé : <strong>${Math.round(calories.target)} kcal/j</strong> · entretien saisi ${calories.maintenance}, déficit ${calories.deficit} kcal.${calories.suspended?' Déficit suspendu pour privilégier la récupération.':''}`:'Repère calorique à configurer : aucun déficit chiffré déduit des saisies incomplètes.'}</p><p class="subtle">${s.photoObservations.length?'Une comparaison photo autorisée enrichit le contexte du Compagnon.':'Les photos peuvent compléter ce bilan après une comparaison autorisée dans le coffre.'}</p><div class="card-actions"><button class="action secondary" data-goal-action="settings">Configurer mon cap</button><button class="action secondary" data-goal-action="detail">Travail réalisé et suivi</button><button class="action secondary" data-goal-action="photos">Comparer mes photos</button></div></details></section>`;
}
for(const name of ['renderToday','renderEvolution','renderProfile']){
 const base=window[name];window[name]=async function(...args){const html=await base(...args);try{return overview(await snapshot())+html;}catch(e){console.warn('Goal coach unavailable',e);return html;}};
}
const training=renderTraining;
renderTraining=async function(...args){const html=await training(...args);try{const s=await snapshot();return `<div class="goal-training-note"><strong>${esc(s.goal)}</strong><p>${esc(s.strategy.training)}</p>${s.recovery.caution?'<p>Récupération prioritaire : conserve une séance adaptée.</p>':''}</div>`+html;}catch{return html;}};
const suggestion=suggestWorkout;
suggestWorkout=function(workouts){
 const base=suggestion(workouts),goal=state.profile?.goal;
 const clone={...base,plan:base.plan.map(e=>({...e})),reason:base.reason+' '+E.strategy(goal).training};
 // The existing recovery engine can still replace this suggestion afterward.
 if(goal==='Progression Force')clone.plan=clone.plan.map(e=>({...e,reps:typeof e.reps==='number'?Math.min(e.reps,8):e.reps,rest:typeof e.reps==='number'?'120 s':e.rest}));
 if(goal==='Maintien')clone.plan=clone.plan.map(e=>({...e,sets:Math.min(e.sets,3)}));
 if(goal==='Performance course')clone.plan=clone.plan.map(e=>({...e,sets:Math.min(e.sets,3)}));
 return clone;
};
const nutrition=fluidityNutritionTargets;
fluidityNutritionTargets=async function(...args){const old=await nutrition(...args),s=await snapshot(),c=s.nutrition.calories;
 if(!c)return {...old,goal:s.goal,goalStrategy:s.strategy.nutrition,calorieTarget:null};
 const carbs=Math.round((c.target-old.protein*4-old.fatTarget*9)/4);
 if(carbs<100)return {...old,goal:s.goal,calorieTarget:null,goalStrategy:'Le repère saisi est incompatible avec les macros actuelles : revoir les paramètres.'};
 return {...old,carbs,calorieTarget:c.target,deficit:c.deficit,goal:s.goal,goalStrategy:s.strategy.nutrition};
};
const smart=smartTrainingContext;
smartTrainingContext=async function(...args){const c=await smart(...args),s=await snapshot();return {...c,goal:s.goal,goalCoach:s,constraints:{...c.constraints,primaryFocus:s.strategy.training}};};
const meal=nutritionProposalContext;
nutritionProposalContext=async function(...args){return {...await meal(...args),goalCoach:await snapshot()};};
const companion=companionSnapshot;
companionSnapshot=async function(...args){const c=await companion(...args);c.context.goalCoach=await snapshot();return c;};
async function settings(){
 const s=await snapshot(),cfg=state.profile.goalCoach||{};
 showSheet(`<h2>Mon cap et mes repères</h2><form id="goalCoachSettings"><label>Objectif principal<select name="goal">${Object.keys(E.GOALS).map(g=>`<option ${s.goal===g?'selected':''}>${esc(g)}</option>`).join('')}<option value="custom" ${!E.GOALS[s.goal]?'selected':''}>Objectif personnalisé</option></select></label><label>Précision / objectif personnalisé<input name="custom" maxlength="240" value="${esc(E.GOALS[s.goal]?(cfg.note||''):s.goal)}"></label><details><summary>Repère alimentaire facultatif</summary><p>Renseigne ton entretien quotidien estimé, activité sportive déjà incluse. Fluidité ne rajoute pas les calories Garmin. Laisse vide si tu ne le connais pas ; le coach conservera un accompagnement qualitatif.</p><label>Entretien estimé (kcal/j)<input name="maintenance" type="number" min="1800" max="6000" step="10" value="${cfg.maintenance||''}"></label><label>Déficit souhaité pour un objectif corporel<select name="deficit">${[0,150,250].map(n=>`<option value="${n}" ${cfg.deficit===n?'selected':''}>${n===0?'Aucun':n+' kcal/j maximum'}</option>`).join('')}</select></label><p class="subtle">Maximum proposé : 150 pour recomposition, 250 pour abdos visibles ; aucun pour force, course, maintien ou objectif libre. Il est suspendu en présence de signaux de récupération. Ce repère ne mesure pas ton déficit réel.</p><label class="checkline"><input name="confirmed" type="checkbox" ${cfg.confirmed?'checked':''}>Je confirme ce repère d’entretien, activité incluse.</label></details><button class="action" type="submit">Enregistrer mon cap</button></form>`);
 $('#goalCoachSettings').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{
  const f=new FormData(e.currentTarget),selected=String(f.get('goal')),note=String(f.get('custom')||'').trim(),goal=selected==='custom'?note:selected;if(!goal)throw Error('Précise ton objectif.');
  const maintenance=E.number(f.get('maintenance'));if(maintenance!==null&&(maintenance<1800||maintenance>6000))throw Error('Vérifie le repère d’entretien.');
  const profile={...state.profile,goal,goalCoach:{goal,note,maintenance,deficit:Number(f.get('deficit')),confirmed:f.has('confirmed')&&maintenance!==null,updatedAt:new Date().toISOString()}};
  await LTDB.put('profile',profile);state.profile=profile;$('#sheet').close();await render();toast('Cap enregistré : recommandations actualisées');
 }catch(err){toast(err.message);}finally{b.disabled=false;}});
}
async function detail(){
 const s=await snapshot(),m=await LTDB.all('memory'),confirmed=m.find(x=>x.id==='coach-food-'+todayKey())?.complete===true;
 const comparisons=s.force.exercises.map(e=>`<li><strong>${esc(e.name)}</strong> · ${e.sessions} séance(s)${e.comparison?` · à ${e.comparison.load} kg : ${e.comparison.before} → ${e.comparison.after} répétitions au meilleur set (${e.comparison.from} → ${e.comparison.to})`:' · pas encore de comparaison à charge identique'}</li>`).join('');
 const history=m.filter(x=>x.type==='coach-adjustment').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
 showSheet(`<h2>Travail réalisé et suivi</h2><p>${esc(s.goal)} · 28 derniers jours</p><details open><summary>Ce que les données montrent</summary><p>${s.force.sets} séries avec répétitions renseignées · ${Math.round(s.cardio.minutes)} min de cardio enregistrées.</p><ul>${comparisons||'<li>Pas encore de séries exploitables.</li>'}</ul><p>Alimentation : ${s.nutrition.daysLogged} jours renseignés, ${s.nutrition.completeDays} confirmés complets.${s.nutrition.averageComplete!==null?' Moyenne de ces jours : '+Math.round(s.nutrition.averageComplete)+' kcal.':''}</p><label class="checkline"><input type="checkbox" id="goalFoodComplete" ${confirmed?'checked':''}>Tous mes repas du ${todayKey()} sont renseignés</label><label>Confirmer un autre jour<input type="date" id="goalFoodDate" max="${todayKey()}" value="${todayKey()}"></label><p class="subtle">Décoche si tu ajoutes ou corriges encore des repas. Une saisie manquante n’est pas interprétée comme un repas sauté.</p></details><details open><summary>Prochaine action</summary><p>${esc(s.advice.text)}</p>${s.active?`<p>Suivi démarré le ${s.active.date} · point prévu le ${s.active.reviewDate}</p><p>${esc(reviewComparison(s,s.active.baseline))}</p><form id="goalReview"><label>Ton retour<select name="outcome"><option value="uncertain">Pas encore concluant</option><option value="helpful">Cela m’aide</option><option value="difficult">Difficile à suivre</option></select></label><label>Ce qui a changé<textarea name="note" maxlength="600"></textarea></label><button class="action" type="submit">Enregistrer le bilan</button></form>`:`<p>${esc(s.advice.action)}</p><button class="action" data-goal-action="accept">Suivre cette action</button>`}</details><details><summary>Ajustements précédents</summary>${history.map(h=>`<p><strong>${h.date} · ${esc(h.goal)}</strong><br>${esc(h.action)}<br>${h.status==='reviewed'?esc(({helpful:'Utile selon ton retour',difficult:'Difficile à suivre',uncertain:'Résultat incertain'})[h.outcome]||'Bilan enregistré'):'Suivi en cours'}${h.note?'<br>'+esc(h.note):''}</p>`).join('')||'<p>Aucun ajustement enregistré.</p>'}</details><details><summary>Fiabilité de cette lecture</summary><ul>${s.limits.map(l=>'<li>'+esc(l)+'</li>').join('')}</ul></details><details><summary>Confidentialité du suivi photo</summary><p>Une synthèse photo autorisée peut être utilisée dans le Compagnon même lorsque le coffre est fermé. Les images restent dans le coffre et ne sont envoyées que lors d’une comparaison demandée.</p><button class="action secondary" data-goal-action="revokePhotos">Retirer les synthèses photo du suivi</button></details>`);
 const dateInput=$('#goalFoodDate'),check=$('#goalFoodComplete');
 dateInput.addEventListener('change',async()=>{check.checked=(await LTDB.get('memory','coach-food-'+dateInput.value))?.complete===true;});
 check.addEventListener('change',async()=>{try{if(!dateInput.value||dateInput.value>todayKey())return;await LTDB.put('memory',{id:'coach-food-'+dateInput.value,type:'coach-day-complete',date:dateInput.value,complete:check.checked});toast('Complétude du journal enregistrée');}catch{toast('Enregistrement impossible');}});
 $('#goalReview')?.addEventListener('submit',async e=>{e.preventDefault();e.submitter.disabled=true;try{const f=new FormData(e.currentTarget);await LTDB.put('memory',{...s.active,status:'reviewed',reviewedAt:new Date().toISOString(),outcome:String(f.get('outcome')),note:String(f.get('note')||''),result:baseline(s)});await detail();render();}catch{toast('Bilan non enregistré');e.submitter.disabled=false;}});
}
function baseline(s){return {date:s.date,weight:s.weight.after,waist:s.waist.after,forceSessions:s.force.sessions,cardioMinutes:s.cardio.minutes};}
function reviewComparison(s,b){if(!b)return 'Point de départ indisponible.';const pieces=[];for(const [key,value,unit] of [['weight',s.weight.after,'kg'],['waist',s.waist.after,'cm']])if(value!==null&&b[key]!==null&&b[key]!==undefined)pieces.push(signed(value-b[key],unit));return pieces.length?'Depuis le point de départ, écart des moyennes récentes : '+pieces.join(' ; ')+'. Les fenêtres peuvent se chevaucher ; aucun effet causal n’est démontré.':'Pas encore assez de mesures pour comparer au point de départ.';}
let busy=false;
document.addEventListener('click',async e=>{
 const button=e.target.closest?.('[data-goal-action]');if(!button||busy)return;
 e.preventDefault();busy=true;button.disabled=true;
 try{switch(button.dataset.goalAction){
 case 'settings':await settings();break;
 case 'detail':await detail();break;
 case 'photos':await openSheet('photoCompare');break;
 case 'accept':{const s=await snapshot();if(s.active)break;await LTDB.put('memory',{id:'coach-adjustment-'+uid(),type:'coach-adjustment',date:s.date,goal:s.goal,action:s.advice.action,key:s.advice.key,status:'active',reviewDate:E.shift(s.date,s.advice.reviewDays),baseline:baseline(s)});await detail();render();break;}
 case 'revokePhotos':for(const m of await LTDB.all('memory'))if(m.type==='coach-photo')await LTDB.del('memory',m.id);toast('Synthèses photo retirées du suivi');await detail();render();break;
 }}catch(err){console.error(err);toast('Action non enregistrée. Réessaie.');}finally{busy=false;button.disabled=false;}
});
async function photoContext(from,to){const s=await snapshot();return {...s,photoObservations:[],photoPeriod:{from,to},instruction:'Les tendances couvrent les 28 jours avant la date du bilan, pas forcément la période des photos. Ne pas confondre ces périodes.'};}
function offerPhoto(result,record){
 if(!photoVaultUnlocked()||!result.isConnected)return;
 const button=document.createElement('button');button.className='action secondary';button.textContent='Autoriser cette synthèse dans mon suivi';
 const note=document.createElement('p');note.className='subtle';note.textContent='Seul ce texte sera conservé pour le suivi et pourra être envoyé au Compagnon hors du coffre. Aucun changement de calories ne sera fondé sur la photo.';
 result.append(note,button);
 button.addEventListener('click',async()=>{if(!photoVaultUnlocked())return;button.disabled=true;try{await LTDB.put('memory',{id:'coach-photo-'+record.photoIds.join('-'),type:'coach-photo',consent:true,goal:state.profile.goal,date:todayKey(),...record,analysis:String(record.analysis).slice(0,6000)});button.textContent='Synthèse intégrée au suivi';toast('Synthèse autorisée pour le suivi');}catch{button.disabled=false;toast('Synthèse non enregistrée');}});
}
window.FluiditeGoalCoach={snapshot,invalidate,photoContext,offerPhoto,settings,detail};
})();
