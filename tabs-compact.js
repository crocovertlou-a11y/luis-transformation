/* Compact views: preserve existing controls, IDs, handlers and stored data. */
(()=>{
 const fold=(title,nodes,note='')=>{
  const d=document.createElement('details');d.className='compact-menu';
  const s=document.createElement('summary'),name=document.createElement('strong');name.textContent=title;s.append(name);
  if(note){const small=document.createElement('small');small.textContent=note;s.append(small);}
  const body=document.createElement('div');body.className='compact-menu-body';
  nodes.filter(Boolean).forEach(n=>body.append(n));d.append(s,body);return d;
 };
 const parse=html=>{const root=document.createElement('div');root.innerHTML=html;return root;};
 const training=renderTraining;
 renderTraining=async function(...args){
  const html=await training(...args);
  try{
   const root=parse(html),out=document.createElement('div');out.className='compact-tabs compact-training';
   const hero=root.querySelector('.hero'),feature=root.querySelector('.training-v2-feature'),cardio=root.querySelector('.cardio-advisor-v153');
   if(hero)out.append(hero);
   let library;
   if(feature){
    const actions=feature.querySelector('.card-actions'),choose=feature.querySelector('[data-open="workoutIdeas"]'),refine=feature.querySelector('#askSmartTraining');
    if(actions&&choose&&refine)actions.insertBefore(choose,refine);
    library=feature.querySelector('[data-open="exerciseLibrary"]');if(library)library.remove();
    const note=feature.querySelector('.smart-fallback-note');
    if(note)feature.querySelector('#smartTrainingSuggestion').append(fold('Comment cette séance est proposée',[note]));
    out.append(feature);
   }
   if(cardio){
    const ul=cardio.querySelector('ul'),detail=cardio.querySelector('p.subtle');
    const first=ul?.firstElementChild;
    if(first&&/sur 7 jours/.test(first.textContent)){const recap=document.createElement('p');recap.className='compact-cardio-recap';recap.textContent=first.textContent;cardio.querySelector('h3').after(recap);first.remove();}
    if(ul||detail)cardio.append(fold('Comprendre le conseil Cardio',[ul,detail]));
    out.append(cardio);
   }
   const histories=[...root.querySelectorAll('.compact-history-card')];let imports;
   for(const card of histories){
    const title=card.querySelector('.card-kicker')?.textContent||'Historique';
    const stat=card.querySelector('.history-mini-stat')?.textContent.replace(/\s+/g,' ').trim()||'';
    const latest=card.querySelector('h3')?.textContent||'';
    const actions=card.querySelector('.history-card-actions');
    if(actions){
     const history=actions.querySelector('[data-open="cardioHistory"]');if(history)card.append(history);
     imports=fold('Ajouter / importer une activité',[actions],'Saisie manuelle · Garmin · GPX / TCX / FIT · Strava');
    }
    out.append(fold(title,[card],[stat,latest].filter(Boolean).join(' · ')));
   }
   root.querySelector('.training-history-grid')?.remove();
   if(imports)out.append(imports);
   if(library)out.append(fold('Bibliothèque d’exercices',[library]));
   if(root.children.length)out.append(fold('Autres informations',[root]));
   return out.outerHTML;
  }catch(e){console.warn('Compact training unavailable',e);return html;}
 };
 const profile=renderProfile;
 renderProfile=async function(...args){
  const html=await profile(...args);
  try{
   const root=parse(html),out=document.createElement('div');out.className='compact-tabs compact-profile';
   const hero=root.querySelector('.hero');if(hero)out.append(hero);
   const goal=root.querySelector('[data-open="goalEdit"]')?.closest('.card');
   const food=root.querySelector('#nutritionToggle')?.closest('.card');
   // Keep the existing nutrition preference row together with its toggle.
   const foodRow=goal?.querySelector('.list-row:not(button)');if(foodRow&&food)food.prepend(foodRow);
   const photos=[...root.querySelectorAll('.photo-privacy-card,.photo-privacy-settings')];
   const backup=root.querySelector('.backup-card');const last=backup?.querySelector('.backup-status span')?.textContent||'';
   const links=[...root.children].filter(n=>n.id==='garmin-personal-container'||/^(Garmin|Withings)$/i.test(n.querySelector('.card-kicker')?.textContent.trim()||''));
   if(goal)out.append(fold('Mon objectif et mes préférences',[goal]));
   if(food)out.append(fold('Alimentation',[food],food.querySelector('#nutritionToggle').checked?'Activée':'Désactivée'));
   if(links.length)out.append(fold('Connexions et imports',links,'Garmin · Capsules · Withings'));
   if(photos.length)out.append(fold('Confidentialité des photos',photos,photos[0].querySelector('.backup-status small')?.textContent||''));
   if(backup)out.append(fold('Sauvegardes et données',[backup],last?'Dernière sauvegarde locale : '+last:''));
   const version=root.querySelector('.version');if(version)version.remove();
   if(root.children.length)out.append(fold('Autres paramètres',[root]));
   if(version)out.append(version);
   return out.outerHTML;
  }catch(e){console.warn('Compact profile unavailable',e);return html;}
 };
})();
