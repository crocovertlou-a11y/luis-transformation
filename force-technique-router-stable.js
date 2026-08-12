/* Stable Force Technique Router — visual route only */
(() => {
  document.addEventListener('click', e => {
    const btn=e.target.closest('[data-technique],[data-fstep-tech]');
    if(!btn) return;
    const name=btn.dataset.technique || btn.dataset.fstepTech;
    if(!name || typeof window.forceTechniqueStep2!=='function') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const sheet=document.querySelector('#sheet');
    const content=document.querySelector('#sheetContent');
    const previous=(sheet?.open && content)?content.innerHTML:null;
    window.__forceTechniqueBack=previous?()=>{
      sheetBackAction=null;
      content.innerHTML=previous;
      bindSheet();
      updateAllRanges();
    }:null;
    window.forceTechniqueStep2(name);
  }, true);
})();
