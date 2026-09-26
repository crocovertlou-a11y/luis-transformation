/* V16 UX: one primary companion card, quick access to weekly insights. Read-only. */
(()=>{
 const old=renderToday;
 renderToday=async function(...args){
   const html=await old(...args);
   try{
     const wrapper=document.createElement('div');
     wrapper.innerHTML=html;
     const proactive=wrapper.querySelector('.proactive-v156');
     const recovery=wrapper.querySelector('.recovery-v15');
     // Avoid competing primary advice: keep proactive summary, put detail in collapsible section.
     if(proactive&&recovery){
       const detail=document.createElement('details');
       detail.className='v16-recovery-details';
       detail.innerHTML='<summary>Comprendre mon conseil de récupération</summary>';
       detail.appendChild(recovery);
       proactive.appendChild(detail);
     }
     const quick=document.createElement('section');
     quick.className='v16-shortcuts';
     quick.setAttribute('aria-label','Accès rapides à mes progrès');
     quick.innerHTML=`<button type="button" class="v16-shortcut" data-home-view="evolution"><span class="v16-shortcut-icon">▦</span><span><strong>Ma semaine</strong><small>Bilan et tendances</small></span><span aria-hidden="true">›</span></button><button type="button" class="v16-shortcut" data-home-view="evolution"><span class="v16-shortcut-icon">↗</span><span><strong>Évolution</strong><small>Progression détaillée</small></span><span aria-hidden="true">›</span></button>`;
     // After the daily companion if present; otherwise below the welcome.
     const anchor=proactive||wrapper.querySelector('.recovery-v15')||wrapper.firstElementChild;
     if(anchor)anchor.insertAdjacentElement('afterend',quick);
     else wrapper.prepend(quick);
     // Retain the existing evolution card and all existing data/actions further down.
     return wrapper.innerHTML;
   }catch(e){console.warn('V16 layout unavailable',e);return html;}
 };
})();