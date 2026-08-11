/* Fluidité V2.1 IA — Unified Coach Decision
   Home and Force now consume the same existing fluidityEngine decision.
   No mutation of workout history or saved set data. */
(() => {
  const previousChosenWorkoutForm=chosenWorkoutForm;

  async function currentDecision(){
    const today=todayKey();
    const [checkins,workouts,cardio,food]=await Promise.all([
      LTDB.all('checkins'),LTDB.all('workouts'),LTDB.all('cardio'),LTDB.all('food')
    ]);
    const checkin=checkins.find(x=>x.date===today)||null;
    const todayWorkout=workouts.find(x=>x.date===today)||null;
    const todayCardio=cardio.filter(x=>x.date===today);
    return {
      checkin,
      decision:fluidityEngine(checkin,todayWorkout,todayCardio,workouts,cardio,food)
    };
  }

  function label(d){
    if(d.decision==='adapted_session') return {level:'moderate',pct:45};
    if(d.decision==='recovery') return {level:'low',pct:25};
    if(d.decision==='alternative_session') return {level:'moderate',pct:55};
    if(d.decision==='day_complete') return {level:'high',pct:90};
    return {level:'high',pct:75};
  }

  function renderContext(x){
    const host=document.querySelector('.coach-force-active .coach-intro');
    if(!host||document.querySelector('.v21-context')) return;
    const d=x.decision,l=label(d);
    const c=x.checkin;
    const signals=c?[
      `énergie ${c.energy??'—'}/5`,`récupération ${c.recovery??'—'}/5`,
      `${c.sleep??'—'} h de sommeil`,`stress ${c.stress??'—'}/5`
    ]:[];
    host.insertAdjacentHTML('afterend',`
      <section class="v21-context v21-${l.level}">
        <div class="v21-context-head"><div><small>✦ FLUIDITÉ · DÉCISION DU JOUR</small><strong>${escapeHtml(d.title)}</strong></div><b>${l.pct}%</b></div>
        <div class="v21-meter"><i style="width:${l.pct}%"></i></div>
        <p>${escapeHtml(d.message)}</p>
        ${signals.length?`<div class="v21-signals">${signals.map(v=>`<span>${escapeHtml(v)}</span>`).join('')}</div>`:''}
      </section>`);
  }

  chosenWorkoutForm=async function(){
    const ctx=currentDecision();
    const r=await previousChosenWorkoutForm();
    const x=await ctx;
    requestAnimationFrame(()=>renderContext(x));
    return r;
  };
  window.FluiditeV21Decision={currentDecision};
})();