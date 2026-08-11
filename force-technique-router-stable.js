/* Stable Force Technique Router — visual route only */
(() => {
  document.addEventListener('click', e => {
    const btn=e.target.closest('[data-technique],[data-fstep-tech]');
    if(!btn) return;
    const name=btn.dataset.technique || btn.dataset.fstepTech;
    if(!name || typeof window.forceTechniqueStep2!=='function') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.forceTechniqueStep2(name);
  }, true);
})();
