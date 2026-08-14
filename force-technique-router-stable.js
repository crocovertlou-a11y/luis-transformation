/* Stable Force Technique Router — V2.10.5.2: preserve LIVE workout across Technique. */
(() => {
  function captureLiveWorkout(){
    const form=document.querySelector('#workoutForm');
    if(!form) return null;
    const values={};
    form.querySelectorAll('input,select,textarea').forEach(el=>{
      if(!el.name) return;
      values[el.name]=el.type==='checkbox'?!!el.checked:el.value;
    });
    return {values,scrollTop:document.querySelector('#sheet')?.scrollTop||0};
  }
  function restoreLiveWorkout(draft){
    if(!draft || typeof chosenWorkoutForm!=='function') return;
    chosenWorkoutForm();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const form=document.querySelector('#workoutForm');
      if(!form) return;
      Object.entries(draft.values||{}).forEach(([name,value])=>{
        const el=form.elements.namedItem(name); if(!el) return;
        if(el.type==='checkbox') el.checked=!!value; else el.value=value;
      });
      document.querySelectorAll('input[type="range"]').forEach(r=>{try{updateRange(r);}catch(_){}});
      const sheet=document.querySelector('#sheet'); if(sheet) sheet.scrollTop=draft.scrollTop||0;
    }));
  }
  document.addEventListener('click', e => {
    const btn=e.target.closest('[data-technique],[data-fstep-tech]');
    if(!btn) return;
    const name=btn.dataset.technique || btn.dataset.fstepTech;
    if(!name || typeof window.forceTechniqueStep2!=='function') return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const liveDraft=captureLiveWorkout();
    const sheet=document.querySelector('#sheet');
    const content=document.querySelector('#sheetContent');
    const previous=(sheet?.open && content)?content.innerHTML:null;

    // Critical rule: if Technique was opened from a LIVE workout, never restore the preview HTML.
    // Rebuild the live workout and restore the user's draft instead.
    if(liveDraft){
      window.__forceTechniqueBack=()=>{
        sheetBackAction=null;
        restoreLiveWorkout(liveDraft);
      };
    }else{
      window.__forceTechniqueBack=previous?()=>{
        sheetBackAction=null;
        content.innerHTML=previous;
        bindSheet();
        updateAllRanges();
      }:null;
    }
    window.forceTechniqueStep2(name);
  }, true);
})();
