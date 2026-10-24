/* Garmin Personal bridge UI — additive, requires configured server endpoint. No Garmin keys in browser. */
(()=>{
  const endpoint='/.netlify/functions/garmin-personal-sync-function';
  function message(container,text,error=false){const p=container.querySelector('[data-garmin-personal-status]');if(p){p.textContent=text;p.style.color=error?'#a43333':'';}}
  function mount(compact=false){
    const box=document.createElement('section');box.className='card garmin-personal-connector';
    box.innerHTML='<div class="card-kicker">GARMIN · CONNEXION PERSONNELLE</div><h3>Synchronisation Garmin</h3><p class="subtle">Connexion officielle en lecture seule. Ta clé Garmin reste sur le serveur ; la synchronisation ne sauvegarde aucune donnée avant ta confirmation.</p><label class="field" data-garmin-pass-wrap hidden>Code privé (une seule fois par appareil)<input data-garmin-personal-pass type="password" autocomplete="off" placeholder="Code configuré sur Netlify"></label><div class="card-actions"><button type="button" class="action" data-garmin-personal-sync>Récupérer depuis Garmin</button><button type="button" class="action secondary" data-garmin-personal-import>Importer un JSON</button></div><p class="subtle" data-garmin-personal-status aria-live="polite">Ton code privé sera demandé uniquement si cet appareil n’est pas reconnu.</p>';
    if(compact){
      box.classList.add('home-garmin-sync');
      box.querySelector('.card-kicker').remove();box.querySelector('h3').remove();box.querySelector('p.subtle').remove();
      box.querySelector('[data-garmin-personal-sync]').textContent='Actualiser mes données Garmin';
      box.querySelector('[data-garmin-personal-status]').textContent='Importe puis confirme les données de ta journée.';
      LTDB.all('health').then(rows=>{const latest=rows.filter(x=>x.confirmed).sort((a,b)=>b.date.localeCompare(a.date))[0];if(latest&&box.isConnected)message(box,'Dernières données confirmées : '+latest.date.split('-').reverse().join('.'));}).catch(()=>{});
    }
    box.querySelector('[data-garmin-personal-import]').addEventListener('click',()=>window.FluiditeGarmin?.openImport());
    box.querySelector('[data-garmin-personal-sync]').addEventListener('click',async()=>{
      const btn=box.querySelector('[data-garmin-personal-sync]');const pass=box.querySelector('[data-garmin-personal-pass]').value;

      btn.disabled=true;message(box,'Lecture des données en cours…');
      try{
        const response=await fetch(endpoint,{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...(pass?{'X-Fluidite-Sync-Code':pass}:{})},body:JSON.stringify({date:new Date().toLocaleDateString('en-CA')})});
        const json=await response.json().catch(()=>({error:'Réponse du serveur non reconnue'}));
        if(!response.ok){if(response.status===401&&json.code==='SYNC_CODE_REQUIRED'){box.querySelector('[data-garmin-pass-wrap]').hidden=false;box.querySelector('[data-garmin-personal-pass]').focus();throw new Error('Saisis ton code privé une fois, puis relance la récupération.')}throw new Error(json.error||`Erreur ${response.status}`);}
        box.querySelector('[data-garmin-pass-wrap]').hidden=true;
        window.FluiditeGarmin.normalize(json); // Validation avant prévisualisation.
        window.FluiditeGarmin.openImport();
        const field=document.querySelector('#garminCapsuleText');
        if(field){field.value=JSON.stringify(json,null,2);document.querySelector('#garminParseCapsule')?.click();message(box,'Données récupérées. Vérifie les valeurs puis confirme.');}
        else message(box,'Données reçues ; ouvre l’import JSON pour les confirmer.');
      }catch(e){message(box,String(e.message||e),true)}finally{btn.disabled=false;box.querySelector('[data-garmin-personal-pass]').value=''}
    });
    return box;
  }
  // Existing module decorates renderProfile before this script runs.
  const old=renderProfile;
  renderProfile=async function(...args){return `${await old(...args)}<div id="garmin-personal-container"></div>`};
  const observer=new MutationObserver(()=>{const slot=document.getElementById('garmin-personal-container');if(slot&&!slot.dataset.mounted){slot.dataset.mounted='1';slot.appendChild(mount(slot.dataset.compact==='true'))}});
  observer.observe(document.getElementById('main'),{childList:true,subtree:true});
})();
