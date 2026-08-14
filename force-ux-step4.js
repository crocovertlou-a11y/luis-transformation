
(() => {
  const originalDetail = workoutDetailSheet;
  function polish(){
    document.querySelectorAll('.fstep-row[data-fstep-tech]').forEach(row=>{
      row.classList.add('fux-row');
      row.setAttribute('aria-label','Ouvrir la fiche technique de '+row.dataset.fstepTech);
      if(!row.querySelector('.fux-tech')) row.insertAdjacentHTML('beforeend','<span class="fux-tech"><i>◎</i><span>Technique</span><b>›</b></span>');
    });
    document.querySelectorAll('[data-fstep-all]').forEach(b=>{b.classList.add('fux-all');b.setAttribute('aria-label','Voir tous les exercices');});
  }
  workoutDetailSheet = async function(workout){ await originalDetail(workout); requestAnimationFrame(polish); };
  new MutationObserver(polish).observe(document.body,{childList:true,subtree:true});
  // V2.10.5.3: Technique back navigation is owned exclusively by force-technique-router-stable.js.
  polish();
})();
