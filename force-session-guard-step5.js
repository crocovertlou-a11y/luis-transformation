/* Fluidité STEP 5 — Force session guard only. Keeps active workout state across Technique/Video. */
(() => {
  let draft = null;

  function captureWorkoutDraft(){
    const form = document.querySelector('#workoutForm');
    if(!form) return;
    const values = {};
    form.querySelectorAll('input,select,textarea').forEach(el=>{
      if(!el.name) return;
      values[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    draft = { values, scrollY: document.querySelector('#sheet')?.scrollTop || 0, at: Date.now() };
  }

  function restoreWorkoutDraft(){
    if(!draft) return;
    const form = document.querySelector('#workoutForm');
    if(!form) return;
    Object.entries(draft.values).forEach(([name,value])=>{
      const el = form.elements.namedItem(name);
      if(!el) return;
      if(el.type === 'checkbox') el.checked = !!value;
      else el.value = value;
    });
    document.querySelectorAll('input[type="range"]').forEach(r=>{ try{ updateRange(r); }catch(_){} });
    requestAnimationFrame(()=>{ const sh=document.querySelector('#sheet'); if(sh) sh.scrollTop=draft.scrollY||0; });
  }

  // Capture BEFORE any technique renderer replaces the active workout form.
  document.addEventListener('click', e=>{
    if(e.target.closest('[data-technique],[data-fstep-tech]')) captureWorkoutDraft();
  }, true);

  // Opening a video is a temporary resource: never alter the draft.
  document.addEventListener('click', e=>{
    if(e.target.closest('.fvis-video,.force-v1-video')) captureWorkoutDraft();
  }, true);

  // V2.10.5.3: do not intercept [data-fvis-back]. The stable Technique router owns that transition.

  // Clear only when the workout is really submitted.
  document.addEventListener('submit', e=>{
    if(e.target?.id === 'workoutForm') draft=null;
  }, true);
})();
