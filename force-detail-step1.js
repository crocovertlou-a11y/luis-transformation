
/* Fluidité Force Step 1 — isolated detail layer.
   No nutrition/cardio/global bindSheet changes. */
(() => {
  function muscleFor(name){
    const s=String(name||'').toLowerCase();
    if(s.includes('couch')||s.includes('pompe')||s.includes('incliné')) return 'Pectoraux';
    if(s.includes('traction')||s.includes('rowing')||s.includes('tirage')) return 'Dos';
    if(s.includes('épaule')||s.includes('latérale')) return 'Épaules';
    if(s.includes('triceps')||s.includes('dip')) return 'Triceps';
    if(s.includes('curl')) return 'Biceps';
    if(s.includes('squat')||s.includes('fente')||s.includes('presse')) return 'Jambes';
    if(s.includes('gainage')) return 'Core';
    return 'Force';
  }

  function thumb(name){
    const m=muscleFor(name);
    const cls=m==='Pectoraux'?'chest':m==='Dos'?'back':m==='Épaules'?'shoulders':m==='Jambes'?'legs':'core';
    return `<span class="fstep-thumb ${cls}" aria-hidden="true"><i></i><b></b><em></em></span>`;
  }

  async function detail(workout){
    const history=(await LTDB.all('workouts')).sort((a,b)=>b.date.localeCompare(a.date));
    const plan=workout.plan.map(x=>({...x,last:lastExercisePerformance(x.name,history)}));
    state.pendingWorkout={...workout,plan};
    const isLower=workout.id==='lower';
    const why=isLower
      ? 'Ta disponibilité du jour permet une séance structurée tout en gardant une intensité maîtrisée.'
      : 'Fluidité te propose un travail de qualité sur le haut du corps, avec une intensité modérée et une charge cohérente.';
    const preview=plan.slice(0,4);

    showSheet(`<div class="fstep-detail">
      <div class="fstep-top"><span>✦ &nbsp;DÉTAIL DE TA SÉANCE</span></div>
      <section class="fstep-hero">
        <div class="fstep-title">
          <div>
            <span class="fstep-type">◉ &nbsp; FORCE</span>
            <h2>${escapeHtml(workout.title)}</h2>
            <p>${isLower?'Stimuler le bas du corps avec une intensité contrôlée.':'Stimuler le haut du corps pour développer force & volume, tout en restant dans une intensité modérée.'}</p>
          </div>
          <div class="fstep-anatomy" aria-label="Zones musculaires"><i></i><b></b><em></em></div>
        </div>

        <div class="fstep-metrics">
          <div><span>◷</span><small>Durée</small><strong>${parseInt(workout.subtitle)||40} min</strong></div>
          <div><span>▥</span><small>Intensité</small><strong>Modérée<br>6/10</strong></div>
          <div><span>◎</span><small>Objectif</small><strong>Force &<br>Volume</strong></div>
          <div><span>♨</span><small>Calories est.</small><strong>${isLower?'400–500':'350–450'}<br>kcal</strong></div>
        </div>

        <div class="fstep-why"><strong>☆ &nbsp; POURQUOI AUJOURD’HUI ?</strong><p>${why}</p></div>

        <div class="fstep-preview-head"><strong>APERÇU DES EXERCICES</strong><button type="button" data-fstep-all>Voir tout (${plan.length}) ›</button></div>
        <div class="fstep-list">${preview.map((x,i)=>`
          <button type="button" class="fstep-row" data-fstep-tech="${escapeHtml(x.name)}">
            ${thumb(x.name)}
            <span class="fstep-copy"><b>${i+1}. ${escapeHtml(x.name)}</b><small>${x.sets} séries · ${x.reps} reps · Repos ${x.rest}</small></span>
            <em>${muscleFor(x.name)}</em>
          </button>`).join('')}</div>
        ${plan.length>4?`<button type="button" class="fstep-more" data-fstep-all>+ ${plan.length-4} exercices supplémentaires</button>`:''}
        <button class="action orange fstep-start" type="button" data-fstep-start>▶ &nbsp; DÉMARRER LA SÉANCE</button>
      </section>
      <button type="button" class="fstep-tip" data-fstep-tech="${escapeHtml(plan[0]?.name||'Développé couché')}"><span>▣</span><div><strong>Conseil du jour</strong><small>Reste concentré sur la qualité d’exécution.</small></div><b>›</b></button>
    </div>`);
  }

  function allExercises(){
    const w=state.pendingWorkout;
    if(!w) return;
    showSheet(`<div class="fstep-all">
      <div class="fstep-top"><span>✦ &nbsp;TA SÉANCE</span></div>
      <h2>${escapeHtml(w.title)}</h2>
      <p class="subtle">Touche un exercice pour consulter sa fiche technique.</p>
      <div class="fstep-list">${w.plan.map((x,i)=>`
        <button type="button" class="fstep-row" data-fstep-tech="${escapeHtml(x.name)}">
          ${thumb(x.name)}
          <span class="fstep-copy"><b>${i+1}. ${escapeHtml(x.name)}</b><small>${x.sets} séries · ${x.reps} reps · Repos ${x.rest}</small></span>
          <em>${muscleFor(x.name)}</em>
        </button>`).join('')}</div>
      <button class="action orange fstep-start" type="button" data-fstep-start>Démarrer la séance</button>
    </div>`);
  }

  // Override only this Force view. Existing app handlers call this global binding.
  workoutDetailSheet = detail;

  // One delegated listener, independent from bindSheet and therefore from Nutrition.
  document.addEventListener('click', e => {
    const tech=e.target.closest('[data-fstep-tech]');
    if(tech){ e.preventDefault(); e.stopPropagation(); showTechnique(tech.dataset.fstepTech); return; }
    const all=e.target.closest('[data-fstep-all]');
    if(all){ e.preventDefault(); e.stopPropagation(); allExercises(); return; }
    const start=e.target.closest('[data-fstep-start]');
    if(start){ e.preventDefault(); e.stopPropagation(); chosenWorkoutForm(); return; }
  }, true);
})();
