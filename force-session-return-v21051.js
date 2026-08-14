/* Fluidité V2.10.5.1 — restore an active Force workout after Technique/Video navigation. */
(() => {
  const KEY='fluidite.force.activeWorkout.v21051';

  function snapshot(){
    const form=document.querySelector('#workoutForm');
    if(!form || !state?.pendingWorkout) return;
    const values={};
    form.querySelectorAll('input,select,textarea').forEach(el=>{
      if(!el.name) return;
      values[el.name]=el.type==='checkbox'?!!el.checked:el.value;
    });
    const sheet=document.querySelector('#sheet');
    try{ sessionStorage.setItem(KEY,JSON.stringify({workout:state.pendingWorkout,values,scrollTop:sheet?.scrollTop||0,at:Date.now()})); }catch(_){}
  }

  function clear(){ try{sessionStorage.removeItem(KEY);}catch(_){} }

  function restore(){
    let saved=null;
    try{ saved=JSON.parse(sessionStorage.getItem(KEY)||'null'); }catch(_){}
    if(!saved?.workout || !saved?.values) return false;
    // Session snapshots are intentionally short-lived: they only bridge Technique/Video navigation.
    if(Date.now()-(saved.at||0)>6*60*60*1000){ clear(); return false; }
    state.pendingWorkout=saved.workout;
    if(typeof chosenWorkoutForm!=='function') return false;
    chosenWorkoutForm();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const form=document.querySelector('#workoutForm');
      if(!form) return;
      Object.entries(saved.values).forEach(([name,value])=>{
        const el=form.elements.namedItem(name); if(!el) return;
        if(el.type==='checkbox') el.checked=!!value; else el.value=value;
      });
      document.querySelectorAll('input[type="range"]').forEach(r=>{try{updateRange(r);}catch(_){}});
      const sheet=document.querySelector('#sheet'); if(sheet) sheet.scrollTop=saved.scrollTop||0;
    }));
    return true;
  }

  // Snapshot before leaving the active session for either Technique or the external video.
  document.addEventListener('click',e=>{
    if(e.target.closest('.coach-force-active [data-technique],.force-v1-active [data-technique],.fvis-video,.force-v1-video')) snapshot();
  },true);
  window.addEventListener('pagehide',snapshot);

  // If iOS has reloaded the PWA after returning from the video, reopen the live workout, not its description.
  window.addEventListener('pageshow',()=>{
    if(document.querySelector('#workoutForm')) return;
    let saved=null; try{saved=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(_){}
    if(saved?.workout) setTimeout(restore,0);
  });

  document.addEventListener('submit',e=>{ if(e.target?.id==='workoutForm') clear(); },true);
  document.addEventListener('click',e=>{
    if(e.target.closest('.bottom-nav [data-route], [data-action="quickAdd"]')) clear();
  },true);
})();
