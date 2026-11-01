(()=>{const $=s=>document.querySelector(s),fmt=(v,n=1)=>v==null?'—':Number(v).toFixed(n).replace('.',','),dayKey=iso=>String(iso).slice(0,10);let status=false, syncing=false;
async function getStatus(){try{const r=await fetch('/.netlify/functions/withings-status',{cache:'no-store'}),d=await r.json();status=!!d.connected;return status}catch{return false}}
let syncMessage='',syncFailed=false;
function paintSync(){
 document.querySelectorAll('[data-withings-sync],#withingsSyncNow').forEach(b=>{b.disabled=syncing;b.textContent=syncing?'Actualisation…':'Actualiser Withings';b.setAttribute('aria-busy',String(syncing));});
 document.querySelectorAll('[data-withings-feedback],#withingsSyncError').forEach(box=>{box.textContent=syncMessage;box.setAttribute('role',syncFailed?'alert':'status');});
}
async function sync(){
 if(syncing)return;
 syncing=true;syncFailed=false;syncMessage='Récupération des mesures Withings…';paintSync();
 const opened=!!document.querySelector('#withingsSyncNow');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const r=await fetch('/.netlify/functions/withings-measures?days=365',{cache:'no-store',credentials:'same-origin',signal:controller.signal});
  const d=await r.json().catch(()=>{throw new Error('Réponse serveur illisible (HTTP '+r.status+').');});
  if(!r.ok)throw new Error(d.error||'HTTP '+r.status);
  if(!Array.isArray(d.groups))throw new Error('Réponse Withings invalide : liste des mesures absente.');
  clearTimeout(timer);
  const previous=new Map((await LTDB.all('events')).filter(e=>e.type==='withings-measurement').map(e=>[e.id,e]));
  let changed=0,valid=0;
  for(const g of d.groups){
   if(g.id==null||!g.date||!Number.isFinite(new Date(g.date).getTime())||!g.values||!Object.values(g.values).some(v=>v!=null&&Number.isFinite(Number(v))))continue;
   valid++;const id=`withings-${g.id}`,old=previous.get(id);
   if(old?.measuredAt===g.date&&JSON.stringify(old.values)===JSON.stringify(g.values))continue;
   await LTDB.put('events',{id,type:'withings-measurement',date:window.FluiditeBodyData?.localDay(g.date)||dayKey(g.date),source:'Withings',measuredAt:g.date,values:g.values,createdAt:old?.createdAt||new Date().toISOString()});changed++;
  }
  window.FluiditeBodyData?.invalidate?.();
  const rows=await LTDB.all('checkins'),body=window.FluiditeBodyData?.summary(rows),weight=body?.metrics?.weightKg;
  syncMessage=valid?`${valid} mesure(s) reçue(s), ${changed} ajoutée(s) ou mise(s) à jour.${weight?` Dernier poids : ${fmt(weight.value)} kg, le ${displayDate(weight.date)}.`:' Aucun poids fourni dans ces mesures.'}`:d.groups.length?'Mesures reçues mais format inutilisable. Les données précédentes sont conservées.':'Withings ne renvoie aucune mesure sur les 12 derniers mois. Vérifie le profil Withings lié ; les données précédentes sont conservées.';
  await LTDB.put('settings',{id:'withings-last-sync',at:new Date().toISOString(),received:valid,changed,message:syncMessage});
  await render();if(opened)await history();
 }catch(e){
  syncFailed=true;
  syncMessage=e.name==='AbortError'?'Withings ne répond pas après 25 secondes. Réessaie dans un instant.':/WITHINGS_NOT_CONNECTED|WITHINGS_RECONNECT_REQUIRED|WITHINGS_TOKEN_/.test(e.message)?'Connexion Withings à renouveler : utilise Reconnecter Withings dans le Profil.':'Actualisation impossible : '+e.message;
 }finally{clearTimeout(timer);syncing=false;paintSync();toast(syncMessage);}
}
async function history(){const rows=(await LTDB.all('events')).filter(x=>x.type==='withings-measurement').sort((a,b)=>String(b.measuredAt).localeCompare(String(a.measuredAt)));showSheet(`<div class="card-kicker">SANTÉ · WITHINGS</div><h2>Composition corporelle</h2><p class="subtle">Les pesées restent séparées des données Garmin. Fluidité utilise les tendances plutôt qu’une mesure isolée.</p>${rows.length?`<div class="garmin-history-list">${rows.slice(0,40).map(x=>`<div class="garmin-history-row"><div><strong>${displayDate(x.date)}</strong><span>${fmt(x.values?.weightKg)} kg${x.values?.fatPercent!=null?` · ${fmt(x.values.fatPercent)} % MG`:''}</span><small>${x.values?.muscleMassKg!=null?`Muscle ${fmt(x.values.muscleMassKg)} kg · `:''}${x.values?.fatMassKg!=null?`Masse grasse ${fmt(x.values.fatMassKg)} kg`:''}${x.values?.fatFreeMassKg!=null?` · Masse maigre ${fmt(x.values.fatFreeMassKg)} kg`:''}${x.values?.hydrationKg!=null?` · Eau ${fmt(x.values.hydrationKg)} kg`:''}${x.values?.boneMassKg!=null?` · Os ${fmt(x.values.boneMassKg)} kg`:''}</small></div><span class="withings-source-pill">Withings ✓</span></div>`).join('')}</div>`:'<p class="subtle">Aucune mesure synchronisée pour le moment.</p>'}<p id="withingsSyncError" role="status" class="subtle"></p><div class="card-actions"><button class="action" id="withingsSyncNow">Synchroniser</button></div>`);$('#withingsSyncNow')?.addEventListener('click',sync)}
const base=window.renderProfile;window.renderProfile=async function(...args){const html=await base(...args);await getStatus();return `${html}<div class="card"><div class="card-kicker">Withings</div><h3>Poids & composition corporelle</h3><p class="subtle" data-withings-feedback role="status"></p><p class="subtle">${status?'Compte connecté. Fluidité peut importer tes mesures corporelles sans modifier tes données Withings.':'Connecte ton compte pour enrichir Évolution avec le poids et la composition corporelle.'}</p><div class="card-actions">${status?'<button class="action" data-withings-sync>Synchroniser</button><button class="action secondary" data-withings-history>Voir l’historique</button><a class="action secondary" href="/.netlify/functions/withings-auth-start">Reconnecter Withings</a>':'<a class="action" href="/.netlify/functions/withings-auth-start">Connecter Withings</a>'}</div></div>`};
document.addEventListener('click',e=>{if(e.target.closest('[data-withings-sync]')){e.preventDefault();e.stopImmediatePropagation();sync();return}if(e.target.closest('[data-withings-history]')){e.preventDefault();history()}},true);
const q=new URLSearchParams(location.search);if(q.get('withings')){const s=q.get('withings');setTimeout(()=>toast(s==='connected'?'Withings connecté ✓':s==='denied'?'Connexion Withings annulée':'Connexion Withings impossible'),500);window.history.replaceState({},'',location.pathname);if(s==='connected')setTimeout(sync,700)}
const oldRender=window.render;window.render=async function(...args){const result=await oldRender(...args);paintSync();return result;};window.FluiditeWithings={sync,history,getStatus,paintSync};})();
