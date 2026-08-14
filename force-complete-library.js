/* Fluidité Force — complete library patch. Isolated: no Nutrition changes. */
(() => {
  const GROUPS={
    'Push':['Développé couché','Développé incliné','Développé épaules','Élévations latérales','Extensions triceps','Dips','Pompes'],
    'Pull':['Tractions','Rowing','Tirage horizontal','Tirage vertical','Face pull','Curl biceps'],
    'Jambes':['Squat','Presse à cuisses','Fentes','Soulevé de terre roumain','Mollets'],
    'Gainage':['Gainage','Dead bug','Mountain climbers','Pallof press'],
    'Récupération active':['Respiration 90/90','Cat-Cow','Rotation thoracique','Étirement fléchisseur de hanche'],
    'Élastiques':['Rowing élastique','Squat avec élastique','Développé poitrine élastique','Face pull élastique'],
    'Sans matériel':['Pompes','Squat au poids du corps','Fentes marchées','Gainage']
  };
  const esc=s=>escapeHtml(String(s||''));
  window.fluiditeForceGroups=GROUPS;
  window.openForceLibrary=()=>showSheet(`<div class="force-library-complete"><div class="fstep-top">BIBLIOTHÈQUE D’EXERCICES</div><h2>Choisis ton mouvement</h2><p class="subtle">${new Set(Object.values(GROUPS).flat()).size} exercices · fiche technique accessible pour chaque mouvement.</p>${Object.entries(GROUPS).map(([g,names])=>`<section class="flc-group"><h3>${esc(g)}</h3><div class="flc-grid">${names.map(n=>`<button type="button" class="flc-item" data-technique="${esc(n)}"><span><strong>${esc(n)}</strong><small>Voir la technique ›</small></span></button>`).join('')}</div></section>`).join('')}</div>`);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-force-library]');if(b){e.preventDefault();window.openForceLibrary();}},true);
})();
(() => { const add=()=>{const h=[...document.querySelectorAll('h1,h2')].find(x=>x.textContent.trim()==='Entraînement');if(!h)return;const root=h.closest('main')||document.querySelector('#main');if(root&&!root.querySelector('[data-force-library]')){const b=document.createElement('button');b.type='button';b.className='action secondary';b.dataset.forceLibrary='1';b.textContent='Bibliothèque d’exercices';const card=root.querySelector('.training-v2-card,.training-suggestion-card');(card||h.parentElement).appendChild(b);}};new MutationObserver(add).observe(document.body,{subtree:true,childList:true});add();})();
