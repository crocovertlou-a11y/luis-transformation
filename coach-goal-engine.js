/* Fluidité: deterministic, versioned observations. No diagnosis or automatic restriction. */
(function(root){
 'use strict';
 const number=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const shift=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
 const GOALS={
  'Recomposition corporelle':{training:'Construire la force et suivre le tour de taille, sans rechercher une baisse rapide du poids.',nutrition:'Entretien ou léger déficit choisi, avec priorité à la récupération.',offset:150},
  'Abdos visibles':{training:'Préserver la force, travailler l’ensemble du corps et le gainage ; suivre les mensurations.',nutrition:'Déficit modéré uniquement si confirmé et compatible avec la récupération.',offset:250},
  'Progression Force':{training:'Consolider les répétitions et progresser sur les charges à partir des séries réalisées.',nutrition:'Priorité à des apports suffisants ; aucun déficit proposé par défaut.',offset:0},
  'Performance course':{training:'Priorité à la course, avec renforcement compatible avec les séances cardio récentes.',nutrition:'Soutenir les séances et leur récupération ; aucun déficit proposé par défaut.',offset:0},
  'Maintien':{training:'Entretenir une pratique régulière et équilibrée, selon tes préférences.',nutrition:'Repère d’entretien, sans déficit proposé.',offset:0}
 };
 function strategy(goal){return GOALS[goal]||{training:'Préciser ce cap avec le Compagnon avant de modifier les séances.',nutrition:'Conserver les repères existants ; objectif libre à clarifier.',offset:0};}
 function analyze(input){
  const {date,profile={},checkins=[],workouts=[],cardio=[],food=[],memory=[],recovery=null}=input;
  const inRange=(r,n=28)=>r.date>=shift(date,1-n)&&r.date<=date;
  const unique=rows=>[...new Map(rows.filter(r=>r.id&&r.date).map(r=>[r.id,r])).values()];
  const ws=unique(workouts).filter(w=>inRange(w)&&!['planned','cancelled'].includes(w.status));
  const cs=unique(cardio).filter(c=>inRange(c)&&!['planned','cancelled'].includes(c.status));
  // One observation per date, preserving different fields from imported/manual records.
  const days=new Map();
  for(const c of [...checkins].sort((a,b)=>String(a.updatedAt||a.createdAt||'').localeCompare(String(b.updatedAt||b.createdAt||'')))){
   if(!inRange(c))continue;const row=days.get(c.date)||{date:c.date};
   for(const k of ['weight','waist','energy','recovery','hunger','sleep'])if(number(c[k])!==null)row[k]=number(c[k]);days.set(c.date,row);
  }
  const ci=[...days.values()];
  function trend(field,min){
   const values=ci.filter(c=>number(c[field])!==null&&c[field]>0);
   const old=values.filter(c=>c.date<shift(date,-13)),recent=values.filter(c=>c.date>=shift(date,-13));
   const before=mean(old.map(c=>c[field])),after=mean(recent.map(c=>c[field]));
   return {before,after,oldDays:old.length,recentDays:recent.length,delta:old.length>=min&&recent.length>=min?after-before:null};
  }
  const weight=trend('weight',4),waist=trend('waist',2);
  const exerciseMap=new Map();let sets=0,recordedVolume=0;
  for(const w of ws)for(const e of w.exerciseEntries||[]){
   const series=(e.series||[]).filter(s=>number(s.reps)>0);
   sets+=series.length;recordedVolume+=series.reduce((s,x)=>s+(number(x.weight)>0?x.reps*x.weight:0),0);
   const key=String(e.name||'').trim().toLowerCase();
   if(!key||!series.length)continue;
   const list=exerciseMap.get(key)||[];list.push({date:w.date,name:e.name,effort:number(w.effort),series:series.map(s=>({reps:number(s.reps),weight:number(s.weight)}))});exerciseMap.set(key,list);
  }
  const exercises=[...exerciseMap.values()].map(list=>{
   list.sort((a,b)=>a.date.localeCompare(b.date));const first=list[0],last=list.at(-1);
   // Compare repetitions at exactly the same load, on different dates. No pooled tonnage claims.
   let comparison=null;
   if(first.date!==last.date){
    const loads=[...new Set(first.series.map(s=>s.weight).filter(w=>w!==null&&w>0))];
    for(const load of loads){const a=first.series.filter(s=>s.weight===load),b=last.series.filter(s=>s.weight===load);
     if(a.length&&b.length){comparison={load,before:Math.max(...a.map(s=>s.reps)),after:Math.max(...b.map(s=>s.reps)),from:first.date,to:last.date};break;}}
   }
   return {name:last.name,sessions:list.length,last,comparison};
  });
  const dailyFood=new Map();for(const f of food.filter(x=>inRange(x))){const r=dailyFood.get(f.date)||{date:f.date,calories:0,entries:0};r.calories+=Math.max(0,number(f.calories)||0);r.entries++;dailyFood.set(f.date,r);}
  const complete=new Set(memory.filter(m=>m.type==='coach-day-complete'&&m.complete===true).map(m=>m.date));
  const confirmedFood=[...dailyFood.values()].filter(d=>complete.has(d.date));
  const recentCI=ci.filter(c=>c.date>=shift(date,-6));
  const lowEnergy=recentCI.filter(c=>c.energy!=null&&c.energy<=2).length;
  const highHunger=recentCI.filter(c=>c.hunger!=null&&c.hunger>=4).length;
  const down=exercises.filter(e=>e.comparison&&e.comparison.after<e.comparison.before).length;
  const caution=['recover','adapt','caution'].includes(recovery?.level)||lowEnergy>=2||highHunger>=3||down>=2;
  const goal=profile.goal||'À définir',plan=strategy(goal),cfg=profile.goalCoach||{};
  const active=memory.filter(m=>m.type==='coach-adjustment'&&m.goal===goal&&m.status==='active').sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  const reviewed=memory.filter(m=>m.type==='coach-adjustment'&&m.goal===goal&&m.status==='reviewed').sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt))).slice(0,3);
  let advice={key:'observe',title:'Construisons une lecture fiable',text:'Poursuis le suivi du réalisé et précise les jours alimentaires complets avant de modifier la stratégie.',action:'Compléter le suivi pendant 14 jours',reviewDays:14};
  if(weight.delta!==null||waist.delta!==null)advice={key:'maintain',title:'Garde le cap et observe la tendance',text:'Les mesures deviennent comparables. Croisons-les avec les performances et ton ressenti avant de modifier les apports.',action:'Conserver la stratégie pendant 14 jours',reviewDays:14};
  if(waist.delta!==null&&waist.delta<=-0.5&&down===0)advice={key:'continue',title:'Une évolution encourageante',text:'Le tour de taille moyen diminue. Aucun recul comparable n’est identifié dans les exercices renseignés ; cela ne prouve pas à lui seul un gain musculaire.',action:'Conserver la stratégie pendant 14 jours',reviewDays:14};
  if(weight.delta!==null&&waist.delta!==null&&Math.abs(weight.delta)<0.3&&Math.abs(waist.delta)<0.5&&confirmedFood.length>=14)advice={key:'review',title:'Faisons le point sur la stratégie',text:'Les moyennes corporelles évoluent peu sur 28 jours malgré un suivi alimentaire plus complet. Vérifie d’abord les portions, la régularité et le travail réalisé ; aucune baisse calorique automatique.',action:'Vérifier le suivi et la stratégie pendant 7 jours',reviewDays:7};
  if(caution)advice={key:'recover',title:'Priorité à la récupération',text:'Des signaux de prudence sont présents. Je suspends le déficit du repère proposé et les nouvelles hausses de charge ; confirme ton ressenti avant la séance.',action:'Privilégier la récupération et réévaluer dans 3 jours',reviewDays:3};
  if(!active&&!caution&&reviewed[0]?.outcome==='difficult')advice={key:'simplify',title:'Adaptons la stratégie à ton quotidien',text:'Ton dernier bilan indique une difficulté à suivre la proposition. Identifie avec le Compagnon ce qui bloque avant d’augmenter les exigences.',action:'Choisir une seule habitude réalisable et faire le point dans 7 jours',reviewDays:7};
  if(active&&!caution)advice={key:'follow',title:date>=active.reviewDate?'Le point de suivi est arrivé':'Un ajustement est en cours',text:active.action,action:active.action,reviewDays:14};
  let calories=null;
  // Baseline includes sport: never add wearable or workout calories a second time.
  const baseline=number(cfg.maintenance);
  if(profile.nutritionEnabled!==false&&cfg.confirmed&&cfg.goal===goal&&baseline>=1800&&baseline<=6000){
   const requested=[0,150,250].includes(cfg.deficit)?cfg.deficit:0;
   const deficit=caution||plan.offset===0?0:Math.min(requested,plan.offset);
   calories={maintenance:baseline,target:baseline-deficit,deficit,estimated:true,source:'Repère d’entretien saisi et confirmé, activité incluse',suspended:caution&&requested>0};
  }
  const nutrition={closedDays:[...dailyFood.values()].filter(d=>d.date<date||complete.has(d.date)).length,daysLogged:dailyFood.size,completeDays:confirmedFood.length,averageComplete:mean(confirmedFood.map(d=>d.calories)),calories};
  return {version:'goal-coach-1',date,goal,goalDetail:cfg.goal===goal?(cfg.note||''):'',strategy:plan,weight,waist,force:{sessions:ws.length,sets,recordedVolume,exercises},cardio:{sessions:cs.length,distance:cs.reduce((s,c)=>s+Math.max(0,number(c.distance)||0),0),minutes:cs.reduce((s,c)=>s+Math.max(0,number(c.durationSeconds)||0)/60,0),recent:cs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(c=>({date:c.date,type:c.type,distance:c.distance??null,durationSeconds:c.durationSeconds??null,heartRateAvg:c.heartRateAvg??null,effort:c.effort??null}))},nutrition,recovery:{level:recovery?.level||'unknown',lowEnergyDays:lowEnergy,highHungerDays:highHunger,caution},advice,active,reviewed,coverage:{measurementDays:ci.length,comparableExercises:exercises.filter(e=>e.comparison).length},limits:['28 jours : comparaison des deux périodes de 14 jours. Seuils indicatifs de suivi, non diagnostiques.','Une absence de saisie ne prouve pas une absence de repas ou de séance.','Les séries enregistrées peuvent inclure des valeurs préremplies non corrigées.','Les calories sont des estimations ; les photos ne déterminent jamais un déficit.']};
 }
 const api={analyze,strategy,GOALS,shift,number};root.FluiditeGoalEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
