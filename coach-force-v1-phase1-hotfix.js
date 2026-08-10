
/* Coach Force V1 Phase 1.1 — mobile UX + technique routing hotfix.
   Loaded last. Does not modify core app, nutrition, cardio, or coach logic. */
(() => {
  // During an active workout, force every Technique button through the validated visual renderer.
  // STEP5 draft capture runs earlier on the same click and preserves entered values.
  document.addEventListener('click', e => {
    const btn=e.target.closest('.coach-force-active [data-technique]');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const name=btn.dataset.technique;
    if(window.forceTechniqueStep2) window.forceTechniqueStep2(name);
    else if(window.showTechnique) window.showTechnique(name);
  }, true);
})();
