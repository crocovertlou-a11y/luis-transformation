
(() => {
  const esc=s=>escapeHtml(String(s||''));
  const key=name=>{
    const s=String(name||'').toLowerCase();
    if(s.includes('couch')) return 'bench';
    if(s.includes('traction')) return 'pullup';
    if(s.includes('rowing')||s.includes('tirage horizontal')) return 'row';
    if(s.includes('développé épaules')||s.includes('developpe epaules')) return 'shoulder';
    if(s.includes('élévations latérales')||s.includes('elevations laterales')) return 'lateral';
    if(s.includes('face pull')) return 'facepull';
    if(s.includes('curl')) return 'curl';
    if(s.includes('triceps')) return 'triceps';
    if(s.includes('squat')||s.includes('presse à cuisses')) return 'squat';
    if(s.includes('fentes')) return 'lunge';
    if(s.includes('soulevé de terre roumain')||s.includes('souleve de terre roumain')) return 'rdl';
    if(s.includes('mollets')) return 'calf';
    if(s.includes('gainage')) return 'plank';
    return 'generic';
  };
  const DATA={
    bench:{focus:'Pectoraux · Triceps · Deltoïdes antérieurs',primary:'Pectoraux',secondary:'Triceps · Deltoïdes antérieurs',
      steps:['Pieds bien ancrés, omoplates serrées et épaules basses.','Descends la barre sous contrôle vers le bas des pectoraux.','Pousse la barre en gardant les poignets alignés et les épaules stables.'],
      tip:'Garde la trajectoire régulière et privilégie la qualité du mouvement à la charge.'},
    pullup:{focus:'Grand dorsal · Biceps · Rhomboïdes',primary:'Grand dorsal',secondary:'Biceps · Rhomboïdes · Trapèzes',
      steps:['Suspends-toi bras tendus, épaules actives et corps gainé.','Tire la poitrine vers la barre sans balancer les jambes.','Redescends lentement jusqu’à retrouver une amplitude complète.'],
      tip:'Pense à tirer les coudes vers le bas plutôt qu’à monter le menton.'},
    row:{focus:'Grand dorsal · Rhomboïdes · Biceps',primary:'Grand dorsal',secondary:'Rhomboïdes · Trapèzes · Biceps',
      steps:['Incline le buste avec le dos neutre et le gainage actif.','Tire la barre vers le nombril en rapprochant les omoplates.','Contrôle la descente sans arrondir le dos ni donner d’élan.'],
      tip:'Le buste reste stable du début à la fin du mouvement.'},
    shoulder:{focus:'Épaules · Triceps',primary:'Deltoïdes',secondary:'Triceps · Haut des pectoraux',steps:['Assieds-toi stable, gainage actif et haltères au niveau des épaules.','Pousse au-dessus de la tête sans cambrer excessivement.','Redescends sous contrôle jusqu’à la position de départ.'],tip:'Garde les côtes basses et évite de transformer le mouvement en développé incliné.'},
    lateral:{focus:'Deltoïdes latéraux',primary:'Deltoïdes latéraux',secondary:'Trapèzes · Supra-épineux',steps:['Tiens les haltères près du corps avec les coudes légèrement fléchis.','Élève les bras jusqu’à environ la hauteur des épaules.','Redescends lentement sans laisser tomber les charges.'],tip:'Une charge modérée et un mouvement propre valent mieux qu’un élan du buste.'},
    facepull:{focus:'Arrière d’épaules · Haut du dos',primary:'Deltoïdes postérieurs',secondary:'Rhomboïdes · Trapèzes · Rotateurs externes',steps:['Place la poulie à hauteur du visage et saisis la corde.','Tire vers le visage en ouvrant les mains et en rapprochant les omoplates.','Reviens lentement sans perdre la position des épaules.'],tip:'Les coudes restent hauts et le mouvement vient du haut du dos.'},
    curl:{focus:'Biceps · Avant-bras',primary:'Biceps',secondary:'Brachial · Brachio-radial',steps:['Garde les coudes près du corps et le buste immobile.','Fléchis les coudes sans avancer les épaules.','Contrôle complètement la descente.'],tip:'Évite l’élan : si le buste bouge, réduis la charge.'},
    triceps:{focus:'Triceps',primary:'Triceps',secondary:'Stabilisateurs des épaules',steps:['Stabilise les coudes près du corps.','Étends les avant-bras sans déplacer les bras.','Reviens lentement sans laisser les coudes partir vers l’avant.'],tip:'Garde les bras fixes pour concentrer le travail sur les triceps.'},
    squat:{focus:'Quadriceps · Fessiers',primary:'Quadriceps',secondary:'Fessiers · Adducteurs · Core',steps:['Place les pieds stables et crée de la tension dans le tronc.','Descends en contrôlant genoux et bassin tout en gardant le dos neutre.','Pousse le sol pour remonter sans laisser les genoux s’effondrer vers l’intérieur.'],tip:'Choisis une amplitude que tu peux contrôler sans perdre ta position.'},
    lunge:{focus:'Quadriceps · Fessiers',primary:'Quadriceps',secondary:'Fessiers · Ischio-jambiers · Core',steps:['Fais un pas suffisamment long pour rester stable.','Descends verticalement en contrôlant le genou avant.','Repousse le sol avec la jambe avant pour revenir.'],tip:'Cherche d’abord l’équilibre et le contrôle avant d’augmenter la charge.'},
    rdl:{focus:'Ischio-jambiers · Fessiers',primary:'Ischio-jambiers',secondary:'Fessiers · Érecteurs du rachis',steps:['Garde les genoux légèrement fléchis et le dos neutre.','Recule les hanches en gardant la charge proche des jambes.','Remonte en poussant les hanches vers l’avant sans hyperextension.'],tip:'Le mouvement vient des hanches, pas d’un arrondi du dos.'},
    calf:{focus:'Mollets',primary:'Gastrocnémiens',secondary:'Soléaire',steps:['Place l’avant du pied stable sur le support.','Monte sur la pointe en contrôlant la cheville.','Redescends lentement jusqu’à sentir l’étirement du mollet.'],tip:'Marque une courte pause en haut et évite les rebonds.'},
    plank:{focus:'Sangle abdominale · Stabilisateurs',primary:'Core',secondary:'Fessiers · Épaules',steps:['Place les coudes sous les épaules et allonge le corps.','Contracte abdominaux et fessiers en gardant le bassin neutre.','Respire normalement tout en maintenant la position.'],tip:'Arrête la série lorsque tu ne peux plus conserver un alignement propre.'},
    generic:{focus:'Mouvement contrôlé',primary:'Zone principale',secondary:'Muscles stabilisateurs',
      steps:['Adopte une position stable et confortable.','Exécute le mouvement avec une amplitude contrôlée.','Garde la maîtrise de la phase de retour.'],
      tip:'Privilégie toujours la qualité d’exécution.'}
  };

  function mannequin(type,phase='start',mini=false){
    const end=phase==='end';
    let art='';
    if(type==='bench'){
      const barY=end?42:82;
      art=`<rect x="38" y="148" width="190" height="10" rx="5" fill="#313136"/><rect x="54" y="156" width="8" height="35" fill="#4a4a50"/><rect x="205" y="156" width="8" height="35" fill="#4a4a50"/>
      <ellipse cx="137" cy="123" rx="50" ry="22" fill="url(#body)"/><circle cx="193" cy="113" r="14" fill="url(#body)"/>
      <path d="M102 116 Q137 96 171 116 L161 134 Q137 122 112 134Z" fill="url(#muscle)"/>
      <path d="M111 116 L${end?101:88} ${barY+8}" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/><path d="M162 116 L${end?173:187} ${barY+8}" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/>
      <line x1="58" y1="${barY}" x2="218" y2="${barY}" stroke="#2d2d31" stroke-width="7"/><circle cx="72" cy="${barY}" r="21" fill="#252529"/><circle cx="204" cy="${barY}" r="21" fill="#252529"/>`;
    } else if(type==='pullup'){
      const headY=end?65:104, shoulderY=end?83:122;
      art=`<line x1="42" y1="28" x2="230" y2="28" stroke="#29292d" stroke-width="9"/><line x1="54" y1="28" x2="54" y2="194" stroke="#38383d" stroke-width="7"/><line x1="218" y1="28" x2="218" y2="194" stroke="#38383d" stroke-width="7"/>
      <circle cx="136" cy="${headY}" r="15" fill="url(#body)"/><path d="M105 ${shoulderY} Q136 ${shoulderY-14} 167 ${shoulderY} L157 ${shoulderY+58} Q136 ${shoulderY+70} 115 ${shoulderY+58}Z" fill="url(#body)"/>
      <path d="M111 ${shoulderY+6} Q136 ${shoulderY+18} 161 ${shoulderY+6} L155 ${shoulderY+46} Q136 ${shoulderY+57} 117 ${shoulderY+46}Z" fill="url(#muscle)"/>
      <line x1="109" y1="${shoulderY+8}" x2="92" y2="34" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="163" y1="${shoulderY+8}" x2="180" y2="34" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/>`;
    } else if(type==='row'){
      const barY=end?112:158;
      art=`<circle cx="176" cy="61" r="14" fill="url(#body)"/><path d="M90 94 Q126 67 169 78 L158 115 Q126 105 84 120Z" fill="url(#body)"/>
      <path d="M96 92 Q128 78 162 82 L154 107 Q126 98 91 111Z" fill="url(#muscle)"/><line x1="104" y1="108" x2="${end?120:105}" y2="${barY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/>
      <line x1="153" y1="103" x2="${end?160:173}" y2="${barY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="52" y1="${barY}" x2="226" y2="${barY}" stroke="#2d2d31" stroke-width="7"/>
      <circle cx="64" cy="${barY}" r="19" fill="#252529"/><circle cx="214" cy="${barY}" r="19" fill="#252529"/>`;
    } else {
      art=`<circle cx="136" cy="48" r="21" fill="url(#body)"/><path d="M98 76 Q136 60 174 76 L161 145 Q136 158 111 145Z" fill="url(#body)"/><path d="M108 82 Q136 69 164 82 L156 111 Q136 101 116 111Z" fill="url(#muscle)"/>`;
    }
    return `<svg class="fvis-svg ${mini?'mini':''}" viewBox="0 0 280 210"><defs><linearGradient id="body" x1="0" x2="1"><stop stop-color="#e7e7e7"/><stop offset=".55" stop-color="#bcbcbc"/><stop offset="1" stop-color="#8d8d8d"/></linearGradient><linearGradient id="muscle" x1="0" x2="1"><stop stop-color="#ff8058"/><stop offset="1" stop-color="#e95232"/></linearGradient></defs>${art}</svg>`;
  }

  window.forceVisualThumb=name=>`<span class="fstep-thumb fvis-thumb">${mannequin(key(name),'start',true)}</span>`;

  window.forceTechniqueStep2=name=>{
    const k=key(name),d=DATA[k]||DATA.generic;
    const youtube='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' technique musculation');
    showSheet(`<div class="fvis-tech"><div class="fvis-head"><div><div class="fstep-top">TECHNIQUE</div><h2>${esc(name)}</h2><p>${esc(d.focus)}</p></div><span>${esc(d.primary)}</span></div>
    <div class="fvis-positions"><section><strong><b>1</b>DÉPART</strong>${mannequin(k,'start')}</section><section><strong><b>2</b>ARRIVÉE</strong>${mannequin(k,'end')}</section></div>
    <section class="fvis-muscles"><div class="fvis-muscle-model">${mannequin(k,'end',true)}</div><div><strong>MUSCLES SOLLICITÉS</strong><p><i></i><b>Principal</b><br>${esc(d.primary)}</p><p><i class="secondary"></i><b>Secondaires</b><br>${esc(d.secondary)}</p></div></section>
    <section class="fvis-exec"><strong>COMMENT EXÉCUTER</strong>${d.steps.map((x,i)=>`<div><b>${i+1}</b><span>${esc(x)}</span></div>`).join('')}</section>
    <section class="fvis-tip"><strong>💡 &nbsp; CONSEIL</strong><p>${esc(d.tip)}</p></section>
    <a class="action secondary fvis-video" href="${youtube}" target="_blank" rel="noopener">▶ Voir la vidéo</a>
    <button class="action orange" type="button" data-fvis-back>Retour à la séance</button></div>`);
  };

  document.addEventListener('click',e=>{const back=e.target.closest('[data-fvis-back]');if(back){e.preventDefault();e.stopPropagation();chosenWorkoutForm();}},true);
})();
