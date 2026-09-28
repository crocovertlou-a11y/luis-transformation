/* Fluidité V16.4 — photo vault comfort settings */
(()=>{
 const opts=[['0','Immédiat'],['1','1 min'],['5','5 min'],['15','15 min']];
 const base=window.renderProfile;
 window.renderProfile=async function(...args){
   const html=await base(...args),cfg=photoPrivacyConfig(),current=String([0,1,5,15].includes(Number(cfg.relockMinutes))?Number(cfg.relockMinutes):5);
   return `${html}<div class="card photo-privacy-settings"><div class="card-kicker">CONFIDENTIALITÉ · PHOTOS</div><h3>Reverrouillage automatique</h3><p class="subtle">Après déverrouillage, le coffre reste accessible tant que tu l’utilises. Le délai repart après chaque activité. Les photos sont masquées dès que Fluidité passe en arrière-plan.</p><div class="field"><label for="photoRelockDelay">Délai après inactivité</label><select id="photoRelockDelay">${opts.map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')}</select></div><p class="photo-setting-note">5 min est le réglage conseillé pour éviter les déverrouillages répétés tout en gardant une protection courte.</p></div>`;
 };
 document.addEventListener('change',e=>{if(e.target?.id!=='photoRelockDelay')return;const v=Number(e.target.value);if(![0,1,5,15].includes(v))return;const cfg=photoPrivacyConfig();savePhotoPrivacyConfig({...cfg,relockMinutes:v});if(photoVaultSession.unlocked)touchPhotoVault();toast(v===0?'Photos : verrouillage immédiat':`Photos : reverrouillage après ${v} min d’inactivité`)});
})();
