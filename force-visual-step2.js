
(() => {
  const esc=s=>escapeHtml(String(s||''));
  const key=name=>{
    const s=String(name||'').toLowerCase();
    if(s.includes('incliné')||s.includes('incline')) return 'incline';
    if(s.includes('couch')) return 'bench';
    if(s.includes('pompe')) return 'pushup';
    if(s.includes('dips')||s.includes('dip ')) return 'dips';
    if(s.includes('tirage vertical')) return 'verticalpull';
    if(s.includes('traction')) return 'pullup';
    if(s.includes('rowing')||s.includes('tirage horizontal')) return 'row';
    if(s.includes('développé épaules')||s.includes('developpe epaules')) return 'shoulder';
    if(s.includes('élévations latérales')||s.includes('elevations laterales')) return 'lateral';
    if(s.includes('face pull')) return 'facepull';
    if(s.includes('curl')) return 'curl';
    if(s.includes('triceps')) return 'triceps';
    if(s.includes('presse à cuisses')||s.includes('presse a cuisses')) return 'legpress';
    if(s.includes('squat')) return 'squat';
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
    if(type==='bench' || type==='incline'){
      const incline=type==='incline', barY=end?(incline?38:42):(incline?76:82);
      const tilt=incline?' transform="rotate(-17 137 125)"':'';
      art=`<g${tilt}><rect x="38" y="148" width="190" height="10" rx="5" fill="#313136"/><rect x="54" y="156" width="8" height="35" fill="#4a4a50"/><rect x="205" y="156" width="8" height="35" fill="#4a4a50"/>
      <ellipse cx="137" cy="123" rx="50" ry="22" fill="url(#body)"/><circle cx="193" cy="113" r="14" fill="url(#body)"/>
      <path d="M102 116 Q137 96 171 116 L161 134 Q137 122 112 134Z" fill="url(#muscle)"/>
      <path d="M111 116 L${end?101:88} ${barY+8}" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/><path d="M162 116 L${end?173:187} ${barY+8}" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/>
      <line x1="58" y1="${barY}" x2="218" y2="${barY}" stroke="#2d2d31" stroke-width="7"/><circle cx="72" cy="${barY}" r="21" fill="#252529"/><circle cx="204" cy="${barY}" r="21" fill="#252529"/></g>`;
    } else if(type==='pullup' || type==='verticalpull'){
      const pull=type==='pullup', headY=end?65:104, shoulderY=end?83:122;
      art=`${pull?`<line x1="42" y1="28" x2="230" y2="28" stroke="#29292d" stroke-width="9"/><line x1="54" y1="28" x2="54" y2="194" stroke="#38383d" stroke-width="7"/><line x1="218" y1="28" x2="218" y2="194" stroke="#38383d" stroke-width="7"/>`:`<line x1="52" y1="30" x2="220" y2="30" stroke="#29292d" stroke-width="8"/><line x1="136" y1="30" x2="136" y2="48" stroke="#38383d" stroke-width="4"/>`}
      <circle cx="136" cy="${pull?headY:82}" r="15" fill="url(#body)"/><path d="M105 ${pull?shoulderY:101} Q136 ${pull?shoulderY-14:88} 167 ${pull?shoulderY:101} L157 ${pull?shoulderY+58:159} Q136 ${pull?shoulderY+70:171} 115 ${pull?shoulderY+58:159}Z" fill="url(#body)"/>
      <path d="M111 ${pull?shoulderY+6:107} Q136 ${pull?shoulderY+18:119} 161 ${pull?shoulderY+6:107} L155 ${pull?shoulderY+46:147} Q136 ${pull?shoulderY+57:158} 117 ${pull?shoulderY+46:147}Z" fill="url(#muscle)"/>
      <line x1="109" y1="${pull?shoulderY+8:109}" x2="92" y2="${pull?34:(end?72:38)}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="163" y1="${pull?shoulderY+8:109}" x2="180" y2="${pull?34:(end?72:38)}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/>`;
    } else if(type==='row' || type==='rdl'){
      const row=type==='row', barY=row?(end?112:158):(end?112:160);
      art=`<circle cx="176" cy="61" r="14" fill="url(#body)"/><path d="M90 94 Q126 67 169 78 L158 115 Q126 105 84 120Z" fill="url(#body)"/>
      <path d="M96 92 Q128 78 162 82 L154 107 Q126 98 91 111Z" fill="url(#muscle)"/>${row?`<line x1="104" y1="108" x2="${end?120:105}" y2="${barY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="153" y1="103" x2="${end?160:173}" y2="${barY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/>`:`<line x1="105" y1="111" x2="108" y2="${barY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="153" y1="106" x2="164" y2="${barY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="112" y1="119" x2="92" y2="188" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/><line x1="150" y1="116" x2="176" y2="188" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/>`}<line x1="52" y1="${barY}" x2="226" y2="${barY}" stroke="#2d2d31" stroke-width="7"/><circle cx="64" cy="${barY}" r="19" fill="#252529"/><circle cx="214" cy="${barY}" r="19" fill="#252529"/>`;
    } else if(type==='shoulder'){
      const handY=end?34:80;
      art=`<circle cx="136" cy="55" r="18" fill="url(#body)"/><path d="M100 82 Q136 67 172 82 L160 151 Q136 164 112 151Z" fill="url(#body)"/><path d="M107 84 Q136 71 165 84 L158 111 Q136 101 114 111Z" fill="url(#muscle)"/><line x1="108" y1="91" x2="92" y2="${handY}" stroke="url(#body)" stroke-width="14" stroke-linecap="round"/><line x1="164" y1="91" x2="180" y2="${handY}" stroke="url(#body)" stroke-width="14" stroke-linecap="round"/><circle cx="84" cy="${handY}" r="8" fill="#333"/><circle cx="188" cy="${handY}" r="8" fill="#333"/>`;
    } else if(type==='lateral'){
      const handX=end?54:101, handX2=end?218:171, handY=end?95:137;
      art=`<circle cx="136" cy="48" r="19" fill="url(#body)"/><path d="M100 76 Q136 62 172 76 L160 150 Q136 162 112 150Z" fill="url(#body)"/><path d="M105 80 Q136 69 167 80 L160 105 Q136 96 112 105Z" fill="url(#muscle)"/><line x1="108" y1="88" x2="${handX}" y2="${handY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="164" y1="88" x2="${handX2}" y2="${handY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><circle cx="${handX-8}" cy="${handY}" r="7" fill="#333"/><circle cx="${handX2+8}" cy="${handY}" r="7" fill="#333"/>`;
    } else if(type==='facepull'){
      const handX=end?112:73, handX2=end?160:199, handY=end?70:92;
      art=`<line x1="25" y1="82" x2="65" y2="82" stroke="#444" stroke-width="5"/><circle cx="136" cy="51" r="18" fill="url(#body)"/><path d="M100 79 Q136 65 172 79 L160 151 Q136 163 112 151Z" fill="url(#body)"/><path d="M108 82 Q136 70 164 82 L158 107 Q136 98 114 107Z" fill="url(#muscle)"/><line x1="108" y1="92" x2="${handX}" y2="${handY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="164" y1="92" x2="${handX2}" y2="${handY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="65" y1="82" x2="${handX}" y2="${handY}" stroke="#555" stroke-width="3"/><line x1="65" y1="82" x2="${handX2}" y2="${handY}" stroke="#555" stroke-width="3"/>`;
    } else if(type==='curl' || type==='triceps'){
      const curl=type==='curl', handY=end?(curl?91:145):(curl?145:88);
      art=`<circle cx="136" cy="48" r="19" fill="url(#body)"/><path d="M101 76 Q136 63 171 76 L159 151 Q136 162 113 151Z" fill="url(#body)"/><path d="M109 86 Q136 72 163 86 L157 116 Q136 106 115 116Z" fill="url(#muscle)"/><line x1="111" y1="91" x2="105" y2="${handY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/><line x1="161" y1="91" x2="167" y2="${handY}" stroke="url(#body)" stroke-width="13" stroke-linecap="round"/>${curl?`<circle cx="101" cy="${handY+8}" r="7" fill="#333"/><circle cx="171" cy="${handY+8}" r="7" fill="#333"/>`:`<line x1="82" y1="${handY+8}" x2="190" y2="${handY+8}" stroke="#444" stroke-width="5"/>`}`;
    } else if(type==='squat' || type==='legpress' || type==='lunge'){
      if(type==='legpress'){
        const footX=end?201:183, kneeX=end?167:146;
        art=`<line x1="55" y1="177" x2="205" y2="35" stroke="#3b3b40" stroke-width="9"/><rect x="62" y="130" width="82" height="14" rx="6" transform="rotate(-43 103 137)" fill="#303035"/><circle cx="103" cy="104" r="16" fill="url(#body)"/><path d="M91 116 L128 143" stroke="url(#body)" stroke-width="18" stroke-linecap="round"/><line x1="128" y1="143" x2="${kneeX}" y2="120" stroke="url(#body)" stroke-width="17" stroke-linecap="round"/><line x1="${kneeX}" y1="120" x2="${footX}" y2="75" stroke="url(#body)" stroke-width="16" stroke-linecap="round"/><line x1="196" y1="48" x2="224" y2="76" stroke="#2d2d31" stroke-width="10"/>`;
      } else {
        const lunge=type==='lunge', hipY=end?118:91, knee1X=lunge?(end?112:126):112, knee1Y=end?157:135, foot1X=lunge?76:98, foot2X=lunge?206:174;
        art=`<circle cx="136" cy="43" r="18" fill="url(#body)"/><path d="M102 69 Q136 57 170 69 L158 117 Q136 128 114 117Z" fill="url(#body)"/><path d="M112 105 Q136 96 160 105 L155 126 Q136 132 117 126Z" fill="url(#muscle)"/><line x1="122" y1="115" x2="${knee1X}" y2="${knee1Y}" stroke="url(#body)" stroke-width="17" stroke-linecap="round"/><line x1="${knee1X}" y1="${knee1Y}" x2="${foot1X}" y2="190" stroke="url(#body)" stroke-width="16" stroke-linecap="round"/><line x1="151" y1="115" x2="${lunge?(end?169:158):(end?160:155)}" y2="${end?157:135}" stroke="url(#body)" stroke-width="17" stroke-linecap="round"/><line x1="${lunge?(end?169:158):(end?160:155)}" y1="${end?157:135}" x2="${foot2X}" y2="190" stroke="url(#body)" stroke-width="16" stroke-linecap="round"/>`;
      }
    } else if(type==='calf'){
      const heelY=end?174:190;
      art=`<circle cx="136" cy="44" r="18" fill="url(#body)"/><path d="M104 70 Q136 58 168 70 L158 130 Q136 142 114 130Z" fill="url(#body)"/><line x1="122" y1="127" x2="116" y2="${heelY}" stroke="url(#body)" stroke-width="17" stroke-linecap="round"/><line x1="150" y1="127" x2="156" y2="${heelY}" stroke="url(#body)" stroke-width="17" stroke-linecap="round"/><path d="M105 145 Q115 160 116 ${heelY}" stroke="url(#muscle)" stroke-width="8"/><path d="M167 145 Q157 160 156 ${heelY}" stroke="url(#muscle)" stroke-width="8"/><rect x="78" y="194" width="116" height="6" rx="3" fill="#39393e"/>`;
    } else if(type==='plank' || type==='pushup'){
      const push=type==='pushup', y=end?(push?119:104):(push?88:104);
      art=`<circle cx="206" cy="${y-18}" r="15" fill="url(#body)"/><path d="M84 ${y} Q135 ${y-22} 188 ${y-4} L181 ${y+20} Q135 ${y+4} 85 ${y+17}Z" fill="url(#body)"/><path d="M115 ${y-5} Q149 ${y-15} 181 ${y-3} L176 ${y+12} Q145 ${y+2} 116 ${y+10}Z" fill="url(#muscle)"/><line x1="92" y1="${y+10}" x2="43" y2="154" stroke="url(#body)" stroke-width="15" stroke-linecap="round"/><line x1="181" y1="${y+10}" x2="${push?190:175}" y2="154" stroke="url(#body)" stroke-width="14" stroke-linecap="round"/><line x1="181" y1="${y+10}" x2="${push?218:197}" y2="154" stroke="url(#body)" stroke-width="14" stroke-linecap="round"/>`;
    } else if(type==='dips'){
      const shoulderY=end?104:75;
      art=`<line x1="54" y1="112" x2="112" y2="112" stroke="#333" stroke-width="7"/><line x1="160" y1="112" x2="218" y2="112" stroke="#333" stroke-width="7"/><circle cx="136" cy="${shoulderY-30}" r="17" fill="url(#body)"/><path d="M105 ${shoulderY} Q136 ${shoulderY-12} 167 ${shoulderY} L158 ${shoulderY+55} Q136 ${shoulderY+65} 114 ${shoulderY+55}Z" fill="url(#body)"/><path d="M111 ${shoulderY+4} Q136 ${shoulderY-4} 161 ${shoulderY+4} L156 ${shoulderY+28} Q136 ${shoulderY+20} 116 ${shoulderY+28}Z" fill="url(#muscle)"/><line x1="111" y1="${shoulderY+8}" x2="101" y2="112" stroke="url(#body)" stroke-width="13"/><line x1="161" y1="${shoulderY+8}" x2="171" y2="112" stroke="url(#body)" stroke-width="13"/>`;
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
