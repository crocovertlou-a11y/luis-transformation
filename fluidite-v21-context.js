
/* Fluidité V2.1 IA — Phase 1: Context Coach
   Isolated experience layer. It does NOT change the validated Coach Force progression engine.
   It reads today's check-in + recent cardio and adds an explainable context card. */
(() => {
  const previousChosenWorkoutForm = chosenWorkoutForm;

  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const dateDiffDays=(a,b)=>{
    const A=new Date(a+'T12:00:00'),B=new Date(b+'T12:00:00');
    return Math.round((A-B)/86400000);
  };

  async function buildContext(){
    const today=todayKey();
    const [checkins,cardio,workouts]=await Promise.all([
      LTDB.all('checkins'),LTDB.all('cardio'),LTDB.all('workouts')
    ]);
    const c=checkins.find(x=>x.date===today)||null;
    const recentCardio=cardio
      .filter(x=>x.date && dateDiffDays(today,x.date)>=0 && dateDiffDays(today,x.date)<=2)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const recentForce=workouts
      .filter(x=>x.date && dateDiffDays(today,x.date)>=0 && dateDiffDays(today,x.date)<=2)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)));

    let score=3, signals=[], blockers=[];
    if(c){
      const recovery=n(c.recovery),energy=n(c.energy),stress=n(c.stress),sleep=n(c.sleep);
      if(recovery!=null){score+=(recovery-3)*0.45;signals.push(`récupération ${recovery}/5`)}
      if(energy!=null){score+=(energy-3)*0.35;signals.push(`énergie ${energy}/5`)}
      if(stress!=null){score-=(stress-3)*0.25;signals.push(`stress ${stress}/5`)}
      if(sleep!=null){
        if(sleep<6) score-=0.7;
        else if(sleep>=7.5) score+=0.3;
        signals.push(`${sleep} h de sommeil`);
      }
    } else {
      blockers.push("pas encore de ressenti aujourd’hui");
    }

    if(recentCardio.length){
      const x=recentCardio[0];
      const km=n(x.distanceKm ?? x.distance);
      const mins=n(x.durationSeconds)?Math.round(Number(x.durationSeconds)/60):null;
      if(km!=null && km>=10) score-=0.45;
      else if(mins!=null && mins>=60) score-=0.35;
      signals.push(`cardio récent${km!=null?` ${km.toFixed(1)} km`:''}`);
    }

    if(recentForce.length){
      signals.push(`Force récente ${recentForce[0].date===today?'aujourd’hui':'≤ 48 h'}`);
    }

    score=Math.max(1,Math.min(5,score));
    let level='stable',title='Plan maintenu',message='Ton contexte du jour ne justifie pas de modifier le plan. Je garde les objectifs proposés et j’observe le réalisé.';
    if(score<2.35){
      level='low';
      title='Priorité au contrôle';
      message='Ta récupération semble limitée. Je garde les charges proposées visibles, mais aujourd’hui la priorité est la qualité : réduis une charge si le mouvement se dégrade.';
    }else if(score<3){
      level='moderate';
      title='Séance maîtrisée';
      message='Le contexte est correct sans être optimal. Je privilégie une séance propre et régulière plutôt qu’une progression agressive.';
    }else if(score>=4){
      level='high';
      title='Bon contexte pour progresser';
      message='Les signaux du jour sont favorables. Si les séries proposées restent propres, la progression prévue est cohérente.';
    }

    return {score,level,title,message,signals,blockers};
  }

  function renderContext(ctx){
    const host=document.querySelector('.coach-force-active .coach-intro');
    if(!host || document.querySelector('.v21-context')) return;
    const pct=Math.round((ctx.score/5)*100);
    const signals=ctx.signals.slice(0,4).map(x=>`<span>${escapeHtml(x)}</span>`).join('');
    const missing=ctx.blockers.length?`<button type="button" class="v21-context-checkin" data-open="checkin">Renseigner mon état</button>`:'';
    host.insertAdjacentHTML('afterend',`
      <section class="v21-context v21-${ctx.level}">
        <div class="v21-context-head">
          <div><small>✦ FLUIDITÉ · CONTEXTE DU JOUR</small><strong>${escapeHtml(ctx.title)}</strong></div>
          <b>${pct}%</b>
        </div>
        <div class="v21-meter"><i style="width:${pct}%"></i></div>
        <p>${escapeHtml(ctx.message)}</p>
        ${signals?`<div class="v21-signals">${signals}</div>`:''}
        ${missing}
      </section>`);
  }

  chosenWorkoutForm = async function(){
    const ctxPromise=buildContext().catch(err=>{
      console.warn('V2.1 context unavailable',err);
      return {score:3,level:'stable',title:'Plan maintenu',message:'Je conserve le plan proposé et j’apprends de ce que tu réalises.',signals:[],blockers:[]};
    });
    const result=await previousChosenWorkoutForm();
    const ctx=await ctxPromise;
    requestAnimationFrame(()=>renderContext(ctx));
    return result;
  };

  window.FluiditeV21Context={buildContext};
})();
