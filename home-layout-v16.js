/* Daily summary: rearranges existing cards without changing stored data. */
(()=>{
 const old=renderToday;
 renderToday=async function(...args){
  const html=await old(...args);
  try{
   const root=document.createElement('div');root.innerHTML=html;
   const feel=root.querySelector('.today-wellbeing'),advice=root.querySelector('.today-companion-card'),recovery=root.querySelector('.recovery-v15'),health=root.querySelector('.garmin-health-card'),tip=root.querySelector('.proactive-v156');
   const fold=(label,node)=>{const d=document.createElement('details');d.className='home-details';const s=document.createElement('summary');s.textContent=label;d.append(s,node);return d;};
   if(advice){
    advice.querySelector('.companion-right')?.remove();
    const left=advice.querySelector('.companion-left');
    const level=recovery?.dataset.recoveryLevel;
    const titles={unknown:'Écoute ton ressenti aujourd’hui',caution:'Un signal invite à la prudence',adapt:'Adapte ta séance aujourd’hui',recover:'Privilégie la récupération'};
    if(feel&&args[0]&&titles[level]){
     left.querySelector('h2').textContent=titles[level];
     left.querySelector('p').textContent=level==='unknown'?'Ton ressenti guide la journée. Les données Garmin disponibles ne suffisent pas encore à confirmer ta récupération.':recovery.querySelector('p').textContent;
     left.querySelector('.session-mini')?.remove();
     left.querySelector('.companion-actions').innerHTML='<button class="action secondary" data-open="checkin">Réévaluer mon ressenti</button>';
    }else if(tip&&args[0]){
     left.querySelector('h2').textContent=tip.querySelector('h3').textContent;
     left.querySelector('p').textContent=tip.querySelector('p').textContent;
     left.querySelector('.session-mini')?.remove();
     const actions=left.querySelector('.companion-actions');if(actions)actions.replaceChildren(tip.querySelector('button'));
    }
    if(recovery){recovery.querySelector('.card-kicker')?.remove();left.append(fold('Pourquoi ce conseil ?',recovery));}
    const session=left.querySelector('.session-mini');if(session){const marker=document.createComment('session');session.before(marker);marker.replaceWith(fold('Voir la séance proposée',session));}
   }
   tip?.remove();
   const out=document.createElement('div');out.className='home-daily-summary';
   const date=document.createElement('p');date.className='home-date';date.textContent=new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long'});out.append(date);
   const sync=document.createElement('div');sync.id='garmin-personal-container';sync.dataset.compact='true';out.append(sync);
   for(const node of [feel,advice,root.querySelector('.today-accomplished'),root.querySelector('.today-evolution')])if(node)out.append(node);
   const quick=document.createElement('nav');quick.className='v16-shortcuts';quick.setAttribute('aria-label','Mes bilans');quick.innerHTML='<button class="v16-shortcut" data-home-view="evolution">Ma semaine <span aria-hidden="true">›</span></button><button class="v16-shortcut" data-home-view="evolution">Évolution <span aria-hidden="true">›</span></button>';out.append(quick);
   if(health)out.append(fold('Santé Garmin',health));
   if(recovery&&!advice)out.append(fold('Récupération',recovery));
   // Preserve any additional modules behind a secondary disclosure.
   if(root.children.length)out.append(fold('Autres informations',root));
   return out.outerHTML;
  }catch(e){console.warn('Daily summary unavailable',e);return html;}
 };
})();
