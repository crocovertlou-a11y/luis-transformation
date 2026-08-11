
/* Fluidité Coach Force V1 — Phase 1
   Deterministic, explainable set-by-set recommendations.
   Isolated layer: app.js, Nutrition, Cardio and validated Force visuals are untouched. */
(() => {
  const coreChosenWorkoutForm = chosenWorkoutForm;
  const coreSaveWorkout = saveWorkout;
  let coachSession = null;

  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const roundTo=(v,step)=>Math.round(v/step)*step;
  const escape=window.escapeHtml || (s=>String(s));

  function loadStep(name){
    const s=String(name||'').toLowerCase();
    if(/élévation|elevation|curl|triceps|face pull|mollet/.test(s)) return 1;
    return 2.5;
  }

  function bodyweight(name){
    const s=String(name||'').toLowerCase();
    return /traction|pompe|dips|gainage/.test(s);
  }

  function historyFor(name,workouts){
    const rows=[];
    for(const w of workouts){
      const e=(w.exerciseEntries||[]).find(x=>x.name===name);
      if(e) rows.push({workout:w,entry:e});
    }
    return rows;
  }

  function sessionWeight(entry){
    const vals=(entry?.series||[]).map(x=>n(x.weight)).filter(v=>v!=null && v>0);
    if(vals.length) return vals[Math.floor(vals.length/2)];
    const w=n(entry?.weight);
    return w!=null && w>0?w:null;
  }

  function completion(entry,target){
    if(typeof target!=='number') return {hit:true,miss:0};
    const reps=(entry?.series||[]).map(x=>n(x.reps)).filter(v=>v!=null);
    if(!reps.length) return {hit:false,miss:target};
    const miss=reps.reduce((a,r)=>a+Math.max(0,target-r),0);
    return {hit:miss===0,miss};
  }

  function recommendExercise(spec,workouts){
    const hist=historyFor(spec.name,workouts).slice(0,3);
    const target=typeof spec.reps==='number'?spec.reps:null;
    const count=Number(spec.sets)||3;
    const empty={name:spec.name,confidence:'learning',reason:'Je manque encore d’historique sur cet exercice. Je garde les répétitions cibles et tu confirmes la charge.',sets:Array.from({length:count},()=>({reps:target,weight:null}))};
    if(!hist.length) return empty;

    const last=hist[0],lastWeight=sessionWeight(last.entry);
    const lastLearning=last.workout?.coach?.learning?.exercises?.find(x=>x.name===spec.name)||null;
    if(lastWeight==null && bodyweight(spec.name)){
      return {name:spec.name,confidence:'medium',reason:'Je garde le travail au poids du corps et je consolide les répétitions avant d’ajouter de la charge.',sets:Array.from({length:count},()=>({reps:target,weight:null}))};
    }
    if(lastWeight==null) return empty;

    const lastComp=completion(last.entry,target);
    const prevComp=hist[1]?completion(hist[1].entry,target):null;
    const effort=n(last.workout?.effort);
    const step=loadStep(spec.name);
    let weight=lastWeight,reason='',confidence=hist.length>=2?'high':'medium';

    if(lastLearning?.signal==='below'){
      weight=lastWeight;
      reason=`La dernière fois, tu as ajusté la proposition à la baisse pendant la séance. Je garde ${lastWeight} kg comme référence et je consolide avant de reproposer une hausse.`;
      confidence=hist.length>=2?'high':'medium';
    }else if(lastLearning?.signal==='above' && lastComp.hit && (effort==null || effort<=3)){
      weight=roundTo(lastWeight+step,0.5);
      reason=`La dernière fois, tu as dépassé la proposition tout en atteignant la cible. Je prends ce réalisé comme nouveau signal et je propose ${weight} kg.`;
      confidence=hist.length>=2?'high':'medium';
    }else if(lastComp.hit && prevComp?.hit && (effort==null || effort<=3)){
      weight=roundTo(lastWeight+step,0.5);
      reason=`Tes deux dernières exécutions ont atteint la cible${effort!=null?` avec un ressenti ${effort}/5`:''}. Je propose une petite progression de ${step} kg.`;
    }else if(lastComp.hit){
      weight=lastWeight;
      reason=`La cible a été atteinte à ${lastWeight} kg. Je consolide cette charge avant de monter.`;
    }else{
      const prevMiss=hist[1]?completion(hist[1].entry,target).miss:0;
      if((lastComp.miss>=3 && prevMiss>=3) || effort===5){
        weight=Math.max(0,roundTo(lastWeight-step,0.5));
        reason=`Les répétitions cibles n’ont pas encore été consolidées. Je réduis légèrement la charge pour retrouver un mouvement propre.`;
      }else{
        weight=lastWeight;
        reason=`Il manquait ${lastComp.miss} répétition${lastComp.miss>1?'s':''} à la cible. Je garde ${lastWeight} kg et je cherche d’abord à compléter les séries.`;
      }
    }
    return {name:spec.name,confidence,reason,sets:Array.from({length:count},()=>({reps:target,weight}))};
  }

  function applyDailyMode(spec,rec,workouts,mode){
    if(!rec || !['adapted_session','recovery'].includes(mode)) return rec;
    const hist=historyFor(spec.name,workouts).slice(0,1);
    const lastWeight=hist.length?sessionWeight(hist[0].entry):null;
    const sets=(rec.sets||[]).map(x=>({...x}));

    // Adapted day: never push a new load progression beyond the last mastered load.
    if(mode==='adapted_session' && lastWeight!=null){
      let capped=false;
      sets.forEach(x=>{
        if(x.weight!=null && x.weight>lastWeight){
          x.weight=lastWeight;
          capped=true;
        }
      });
      return {
        ...rec,
        sets,
        dailyMode:mode,
        reason:capped
          ? `Mode adapté aujourd’hui : je bloque la hausse de charge et je reste à ${lastWeight} kg. L’objectif est une exécution propre, pas un record.`
          : `Mode adapté aujourd’hui : je conserve une proposition prudente et je privilégie la qualité du mouvement. ${rec.reason}`
      };
    }

    // Recovery mode: if the user still chooses Force, lower one normal load step rather than chase performance.
    if(mode==='recovery' && lastWeight!=null && !bodyweight(spec.name)){
      const step=loadStep(spec.name);
      const reduced=Math.max(0,roundTo(lastWeight-step,0.5));
      sets.forEach(x=>{ if(x.weight!=null) x.weight=Math.min(x.weight,reduced); });
      return {
        ...rec,
        sets,
        dailyMode:mode,
        reason:`Mode récupération : si tu maintiens cet exercice, je propose ${reduced} kg maximum aujourd’hui et je privilégie le contrôle.`
      };
    }
    return {
      ...rec,
      dailyMode:mode,
      reason:`${mode==='recovery'?'Mode récupération':'Mode adapté'} : ${rec.reason}`
    };
  }

  async function buildCoachSession(workout){
    const [workouts,checkins,cardio,food]=await Promise.all([
      LTDB.all('workouts'),LTDB.all('checkins'),LTDB.all('cardio'),LTDB.all('food')
    ]);
    workouts.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const today=todayKey();
    let dailyDecision=null;
    try{
      const todayCheckin=checkins.find(x=>x.date===today)||null;
      const todayWorkout=workouts.find(x=>x.date===today)||null;
      const todayCardio=cardio.filter(x=>x.date===today);
      dailyDecision=fluidityEngine(todayCheckin,todayWorkout,todayCardio,workouts,cardio,food,checkins);
    }catch(err){
      console.warn('Coach Force daily mode unavailable; using validated progression only',err);
    }
    const mode=dailyDecision?.decision||'planned_session';
    return {
      createdAt:new Date().toISOString(),
      workoutTitle:workout.title,
      dailyDecision:dailyDecision||null,
      exercises:workout.plan.map(x=>applyDailyMode(x,recommendExercise(x,workouts),workouts,mode))
    };
  }

  function coachExerciseInput(x,idx,rec){
    const rows=Array.from({length:x.sets},(_,s)=>{
      const r=rec?.sets?.[s]||{};
      const repsValue=typeof r.reps==='number'?r.reps:(typeof x.reps==='number'?x.reps:'');
      const weightValue=r.weight!=null?r.weight:'';
      return `<div class="coach-set-row">
        <span class="coach-set-n">${s+1}</span>
        <div><small>Proposé</small><b>${typeof x.reps==='number'?(r.reps??x.reps):x.reps}</b></div>
        <input name="reps_${idx}_${s}" type="number" inputmode="numeric" value="${repsValue}" placeholder="${x.reps}">
        <div><small>Proposé</small><b>${weightValue!==''?weightValue+' kg':'à confirmer'}</b></div>
        <input name="weight_${idx}_${s}" type="number" step="0.5" inputmode="decimal" value="${weightValue}" placeholder="kg">
      </div>`;
    }).join('');
    const badge=rec?.confidence==='high'?'Historique solide':rec?.confidence==='medium'?'Historique partiel':'Apprentissage';
    return `<section class="force-v1-live-exercise coach-exercise">
      <div class="force-v1-live-title"><div><small>EXERCICE ${idx+1}</small><strong>${escape(x.name)}</strong><span>${x.sets} séries × ${x.reps} · repos conseillé ${x.rest}</span></div><button type="button" class="technique-btn" data-technique="${escape(x.name)}">Technique ›</button></div>
      <div class="coach-why"><span>✦ ${badge}</span><p>${escape(rec?.reason||'Je te propose une base prudente à confirmer.')}</p></div>
      <div class="coach-set-head"><span>Série</span><span>Cible</span><span>Réalisé</span><span>Charge cible</span><span>Réalisé</span></div>
      ${rows}
    </section>`;
  }

  chosenWorkoutForm = async function(){
    const w=state.pendingWorkout;
    if(!w) return;
    try{ coachSession=await buildCoachSession(w); }
    catch(err){ console.error(err); coachSession={createdAt:new Date().toISOString(),workoutTitle:w.title,exercises:w.plan.map(x=>({name:x.name,confidence:'learning',reason:'Historique indisponible : je conserve les objectifs de base.',sets:Array.from({length:x.sets},()=>({reps:typeof x.reps==='number'?x.reps:null,weight:null}))}))}; }

    return showSheet(`<div class="force-v1-active coach-force-active">
      <div class="force-v1-active-head"><div><div class="force-v1-kicker">✦ &nbsp;COACH FORCE</div><h2>${escape(w.title)}</h2><p>Fluidité a préparé chaque série. Les valeurs sont proposées, jamais imposées.</p></div><span>${w.plan.length} exercices</span></div>
      <div class="coach-intro"><strong>Proposé → réalisé → appris</strong><span>Modifie librement une valeur : ce que tu réalises réellement restera la référence.</span></div>
      <form id="workoutForm"><input type="hidden" name="name" value="${escape(w.title)}">${dateField('date',todayKey())}
      ${w.plan.map((x,i)=>coachExerciseInput(x,i,coachSession.exercises[i])).join('')}
      <div class="force-v1-finish"><div class="field"><label>Durée totale (min)</label><input name="durationMin" type="number" inputmode="numeric" value="${parseInt(w.subtitle)||40}"></div>${slider('effort','Ressenti de la séance','1','5','1','3','/5')}<button class="action orange" type="submit">Terminer la séance</button></div>
      </form></div>`);
  };

  function buildLearningSummary(saved,proposal){
    const actualByName=new Map((saved?.exerciseEntries||[]).map(x=>[x.name,x]));
    const items=(proposal?.exercises||[]).map(p=>{
      const actual=actualByName.get(p.name);
      const proposedSets=p.sets||[];
      const actualSets=actual?.series||[];
      let repDelta=0,weightDelta=0,comparedReps=0,comparedWeights=0;
      for(let i=0;i<Math.max(proposedSets.length,actualSets.length);i++){
        const ps=proposedSets[i]||{},as=actualSets[i]||{};
        const pr=n(ps.reps),ar=n(as.reps),pw=n(ps.weight),aw=n(as.weight);
        if(pr!=null&&ar!=null){repDelta+=ar-pr;comparedReps++;}
        if(pw!=null&&aw!=null){weightDelta+=aw-pw;comparedWeights++;}
      }
      let signal='matched';
      if((comparedReps&&repDelta<0)||(comparedWeights&&weightDelta<0)) signal='below';
      if((comparedReps&&repDelta>0)||(comparedWeights&&weightDelta>0)) signal='above';
      return {name:p.name,signal,repDelta,weightDelta,comparedReps,comparedWeights};
    });
    const below=items.filter(x=>x.signal==='below').length;
    const above=items.filter(x=>x.signal==='above').length;
    const matched=items.filter(x=>x.signal==='matched').length;
    return {
      version:'v2.1-learning-1',
      createdAt:new Date().toISOString(),
      effort:n(saved?.effort),
      summary:{below,matched,above,total:items.length},
      exercises:items
    };
  }

  // Preserve the coach proposal next to the real workout, without changing the validated core save logic.
  saveWorkout = async function(e){
    const form=e.currentTarget;
    const proposal=coachSession?JSON.parse(JSON.stringify(coachSession)):null;
    const pending=state.pendingWorkout?JSON.parse(JSON.stringify(state.pendingWorkout)):null;
    const date=form?.elements?.date?.value||todayKey();
    const name=form?.elements?.name?.value||pending?.title||'Force';
    await coreSaveWorkout(e);
    if(!proposal) return;
    try{
      const rows=(await LTDB.all('workouts')).filter(w=>w.date===date && (w.name===name || w.name===pending?.title)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
      const saved=rows[0];
      if(saved){
        const learning=buildLearningSummary(saved,proposal);
        saved.coach={version:'force-v2.1-learning',proposal,learning,recordedAt:new Date().toISOString()};
        await LTDB.put('workouts',saved);
      }
    }catch(err){ console.error('Coach proposal persistence failed',err); }
  };

  window.FluiditeCoachForceV1={buildCoachSession,recommendExercise,buildLearningSummary};
})();
