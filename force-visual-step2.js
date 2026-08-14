
(() => {
  const esc=s=>escapeHtml(String(s||''));
  const key=name=>{
    const s=String(name||'').toLowerCase();
    if(s.includes('couch')) return 'bench';
    if(s.includes('traction')) return 'pullup';
        if(s.includes('dead bug')) return 'deadbug';
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
    if(s.includes('gainage')||s.includes('pallof')||s.includes('mountain climber')) return 'plank';
    if(s.includes('pompes')||s.includes('poitrine élastique')) return 'bench';
    if(s.includes('tirage vertical')) return 'pullup';
    if(s.includes('rowing élastique')) return 'row';
    if(s.includes('squat au poids')||s.includes('squat avec')) return 'squat';
    if(s.includes('fentes march')) return 'lunge';
    if(s.includes('face pull élastique')) return 'facepull';
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
    deadbug:{focus:'Core · Stabilité lombo-pelvienne',primary:'Abdominaux profonds',secondary:'Fléchisseurs de hanche · Stabilisateurs',steps:['Allonge-toi sur le dos, hanches et genoux à 90°, bras vers le plafond.','Étends lentement une jambe et le bras opposé sans creuser le bas du dos.','Reviens au centre puis alterne de côté en gardant le contrôle.'],tip:'Réduis l’amplitude dès que le bas du dos commence à se décoller.'},
    mobility:{focus:'Mobilité · Respiration · Récupération',primary:'Mobilité',secondary:'Respiration · Core · Hanches · Colonne',steps:['Installe-toi sans douleur dans une position stable.','Effectue le mouvement lentement en respirant régulièrement.','Reste dans une amplitude confortable et relâche progressivement les tensions.'],tip:'Ici, la qualité et la respiration priment sur l’amplitude.'},
    generic:{focus:'Mouvement contrôlé',primary:'Zone principale',secondary:'Muscles stabilisateurs',
      steps:['Adopte une position stable et confortable.','Exécute le mouvement avec une amplitude contrôlée.','Garde la maîtrise de la phase de retour.'],
      tip:'Privilégie toujours la qualité d’exécution.'}
  };

  window.forceVisualThumb=()=>'';

  window.forceTechniqueStep2=name=>{
    const k=key(name),d=DATA[k]||DATA.generic;
    const youtube='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' technique musculation');
    showSheet(`<div class="fvis-tech"><div class="fvis-head"><div><div class="fstep-top">TECHNIQUE</div><h2>${esc(name)}</h2><p>${esc(d.focus)}</p></div><span>${esc(d.primary)}</span></div>
    <section class="fvis-muscles"><div><strong>MUSCLES SOLLICITÉS</strong><p><i></i><b>Principal</b><br>${esc(d.primary)}</p><p><i class="secondary"></i><b>Secondaires</b><br>${esc(d.secondary)}</p></div></section>
    <section class="fvis-exec"><strong>COMMENT EXÉCUTER</strong>${d.steps.map((x,i)=>`<div><b>${i+1}</b><span>${esc(x)}</span></div>`).join('')}</section>
    <section class="fvis-tip"><strong>💡 &nbsp; CONSEIL</strong><p>${esc(d.tip)}</p></section>
    <a class="action secondary fvis-video" href="${youtube}" target="_blank" rel="noopener">▶ Voir la vidéo</a>
    <button class="action orange" type="button" data-fvis-back>Retour à la séance</button></div>`);
  };

  document.addEventListener('click',e=>{const b=e.target.closest('[data-fvis-back]');if(b){e.preventDefault();e.stopPropagation();const back=window.__forceTechniqueBack;window.__forceTechniqueBack=null;if(typeof back==='function')back();else chosenWorkoutForm();}},true);
})();
