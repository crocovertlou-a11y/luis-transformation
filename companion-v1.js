exports.handler=async function(event){
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return{statusCode:503,body:JSON.stringify({error:'AI_NOT_CONFIGURED'})};
  try{
    const {question,context,history}=JSON.parse(event.body||'{}');
    const model='gemini-3-flash-preview';
    const prompt=`Tu es le Compagnon Action de Luis Transformation V2.4.
Tu aides à interpréter uniquement les données du contexte: ressenti, récupération, force, cardio, alimentation et objectif.

RÈGLES
- Français, chaleureux et précis. Réponse courte: 2 ou 3 phrases maximum, environ 55 mots maximum.
- Aucun Markdown: pas de **, #, listes ou titres.
- Ne répète pas une recommandation déjà formulée dans l'historique; apporte une précision ou demande quelle contrainte ajuster.
- N'invente jamais une donnée absente, un exercice ou une séance.
- context.dailyDecision est la décision centrale du jour: ne la contredis pas sans nouvelle donnée explicite.
- Pour une séance, choisis uniquement un workoutId présent dans context.availableWorkouts.
- Si tu recommandes explicitement une séance existante, action DOIT être prepare_workout avec son vrai workoutId et un libellé court comme « Préparer Haut du corps ».
- Pour un exercice, utilise uniquement context.allowedExercises.
- Si l'utilisateur précise une contrainte (temps, sans matériel, élastique, récupération), sélectionne le programme disponible qui correspond le mieux.
- Utilise context.continuity pour tenir compte des derniers jours sans culpabiliser ni surinterpréter.\n- CARDIO : reste volontairement léger. Observe surtout l'équilibre récent Force/Cardio, la dernière activité Cardio et, lorsqu'elles existent, ses données de durée/distance/FC. Ne transforme pas une absence de cardio en injonction et n'invente jamais une séance de course.\n- Si l'utilisateur demande son cardio : si Force domine nettement et que le cardio est peu sollicité, signale doucement qu'une activité cardio tranquille peut compléter la semaine et demande si quelque chose est prévu; si le cardio récent est déjà régulier, valorise l'équilibre sans pousser à en faire plus; si une activité cardio est enregistrée aujourd'hui, reconnais qu'elle est faite et privilégie récupération/équilibre. Si les données ne montrent rien d'utile, dis simplement que l'équilibre paraît cohérent ou que tu manques encore de recul.\n- Pour un conseil Cardio, action doit rester null : pas de bouton, pas de séance inventée, pas de popup.\n- Pas de diagnostic médical. Une variation isolée n'est jamais une certitude.
- Si une information manque, dis ce qui manque.
- L'utilisateur reste libre.

Tu peux proposer UN bouton d'action si cela aide réellement:
prepare_workout = préparer une séance existante pour validation; recipe = proposer une recette adaptée dans une fiche dédiée; training = écran entraînement; nutrition = écran alimentation; checkin = ressenti. Si l'utilisateur demande quoi manger, une idée de repas ou une recette, privilégie action recipe avec un libellé comme « Voir la recette ».\nTu ne modifies et n'enregistres JAMAIS une donnée utilisateur toi-même. Toute action reste une proposition à valider.
Sinon action=null.

Retourne UNIQUEMENT du JSON:
{"answer":"...","action":null}
ou
{"answer":"...","action":{"type":"prepare_workout|recipe|training|nutrition|checkin","label":"...","workoutId":"id uniquement pour open_workout"}}

CONTEXTE:
${JSON.stringify(context||{})}
HISTORIQUE:
${JSON.stringify(Array.isArray(history)?history.slice(-6):[])}
QUESTION:
${String(question||'')}`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})
    });
    const data=await r.json();
    if(!r.ok)return{statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:data?.error?.message||'',model})};
    const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    const out=JSON.parse(text);
    if(!out?.answer)throw new Error('Réponse vide');
    let action=out.action||null;
    const allowedTypes=new Set(['prepare_workout','recipe','training','nutrition','checkin']);
    if(action&&!allowedTypes.has(action.type))action=null;
    const normQuestion=String(question||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const cardioBalanceIntent=/(equilibre.*(cardio|force)|(cardio|force).*(equilibre)|(cardio.*force|force.*cardio)|mon cardio|cote cardio)/.test(normQuestion);
    const recipeIntent=/(recette|repas|manger|mange|dejeuner|diner|collation|alimentation|alimentaire|quoi.*(manger|privilegier)|idee.*(repas|manger))/.test(normQuestion);
    // Cardio/Force balance is an observation-only intent: never attach a workout or other action.
    if(cardioBalanceIntent) action=null;
    else if(recipeIntent && action?.type!=='prepare_workout') action={type:'recipe',label:'Voir une recette adaptée'};
    if(action?.type==='prepare_workout'){
      const ids=new Set((context?.availableWorkouts||[]).map(w=>String(w.id)));
      if(!ids.has(String(action.workoutId||'')))action=null;
    }
    if(!action){
      const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
      const answerNorm=norm(out.answer);
      const match=(context?.availableWorkouts||[]).find(w=>{
        const title=norm(w.title),id=norm(w.id);
        return (title.length>=4&&answerNorm.includes(title))||(id.length>=4&&answerNorm.includes(id));
      });
      if(match)action={type:'prepare_workout',label:`Préparer ${match.title}`,workoutId:String(match.id)};
    }
    if(action)action={type:action.type,label:String(action.label||'Ouvrir').slice(0,60),workoutId:action.workoutId?String(action.workoutId):''};
    return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({answer:String(out.answer),action,model,version:'2.6.3.1'})};
  }catch(e){console.error(e);return{statusCode:500,body:JSON.stringify({error:'COMPANION_FAILED',detail:e.message||''})}}
};