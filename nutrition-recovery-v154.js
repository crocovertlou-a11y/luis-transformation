/* Fluidité V15.4 - isolated nutrition recovery advice */
(()=>{
 const safe=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 async function insight(){
  const [health,checkins,cardio,workouts]=await Promise.all(['health','checkins','cardio','workouts'].map(k=>LTDB.all(k)));
  const date=todayKey(),record=health.find(h=>h.date===date&&h.confirmed);
  if(!record)return {state:'missing',message:'Confirme ta capsule Garmin pour personnaliser tes conseils alimentaires.'};
  const r=window.FluiditeRecoveryV15?.assess(record,health,checkins.find(c=>c.date===date)||null,[...cardio,...workouts]);
  if(!r||r.level==='unknown')return {state:'unknown',message:'Historique de récupération encore incomplet : garde une alimentation équilibrée sans ajustement calorique automatique.'};
  if(['recover','adapt','caution'].includes(r.level))return {state:r.level,message:'Récupération à surveiller : conserve des repas réguliers avec protéines, glucides et une hydratation adaptée. Évite de réduire fortement tes apports.'};
  const active=cardio.some(c=>c.date===date&&/run|course|bike|vélo|swim|natation/i.test(String(c.type||'')));
  return active?{state:'activity',message:'Activité cardio enregistrée : prévois protéines et glucides pour soutenir la récupération.'}:{state:'usual',message:'Poursuis tes repas équilibrés et ton objectif de protéines habituel.'};
 }
 const previousContext=nutritionProposalContext;
 nutritionProposalContext=async function(...args){
  const context=await previousContext(...args);
  try{const r=await insight();context.recoveryGuidance={...r,advisoryOnly:true};}catch(e){console.warn('V15.4 context',e)}
  return context;
 };
 const previousHub=nutritionHubSheet;
 nutritionHubSheet=async function(...args){
  const result=await previousHub(...args);
  try{
   const r=await insight(),head=document.querySelector('#sheetContent .nutrition-page-head');
   if(head&&!document.querySelector('#nutrition-recovery-v154')){
    const box=document.createElement('section');box.id='nutrition-recovery-v154';box.className='nutrition-recovery-v154';
    box.innerHTML='<div class="card-kicker">COMPAGNON · ALIMENTATION</div><strong>Nutrition & récupération</strong><p>'+safe(r.message)+'</p><small>Conseil indicatif. Aucune donnée ni cible modifiée automatiquement.</small>';
    head.insertAdjacentElement('afterend',box);
   }
  }catch(e){console.warn('V15.4 panel',e)}
  return result;
 };
 window.FluiditeNutritionV154={insight};
})();