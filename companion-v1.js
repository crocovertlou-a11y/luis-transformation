exports.handler=async function(event){
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return{statusCode:503,body:JSON.stringify({error:'AI_NOT_CONFIGURED'})};
  try{
    const {question,context,history}=JSON.parse(event.body||'{}');
    const model='gemini-3-flash-preview';
    const prompt=`Tu es le Compagnon de Fluidité V2.7. Tu réponds d'abord à la question réellement posée, puis seulement aux données utiles.

HIÉRARCHIE OBLIGATOIRE
1. Comprends la QUESTION ACTUELLE.
2. Si c'est une relance courte SANS nouveau sujet explicite (ex: « T'es sûr ? », « Pourquoi ? », « Et donc ? »), rattache-la au DERNIER échange de l'HISTORIQUE. Dès que la question nomme un nouveau sujet (abdos, objectif, alimentation, cardio, etc.), traite-la comme une NOUVELLE question autonome.
3. Détermine l'intention: conversation/follow-up, progression-tendances, cardio, force, alimentation, ressenti, ou autre.
4. Sélectionne uniquement les données pertinentes du CONTEXTE.
5. Réponds directement. La recommandation générale du jour n'est qu'un recours secondaire, jamais une réponse par défaut.
6. Propose une action uniquement si elle répond directement à la demande.

RÈGLES DE CONVERSATION
- Français naturel, chaleureux, précis. 2 à 4 phrases, environ 80 mots maximum.
- Aucun Markdown.
- Ne répète pas mécaniquement la décision du jour.
- Une relance comme « T'es sûr ? » doit expliquer/nuancer la réponse précédente à partir des mêmes données, et reconnaître l'incertitude si nécessaire.
- « Est-ce que je dois faire plus d'abdos ? » est une nouvelle question Force/abdos, jamais une relance.
- « Tu crois que je vais atteindre mon objectif ? » est une nouvelle question progression-tendances, jamais une relance.
- Si la question porte sur les abdos, réponds sur les abdos; ne bascule pas vers une séance haut du corps sauf si cela répond explicitement à la question.
- N'invente jamais de données, de causalité, d'exercice ou de séance.

TENDANCES / OBJECTIF
- Pour « est-ce que je progresse ? », « vais-je atteindre mon objectif ? », « suis-je sur la bonne voie ? », « mes tendances » et équivalents, utilise context.trends (7/14/30 jours), recentCheckins, recentForce et recentCardio.
- Distingue variation ponctuelle et tendance. N'annonce pas qu'un objectif sera atteint avec certitude.
- Si les données sont insuffisantes, dis-le clairement et précise quel recul manque.
- Croise au maximum 2 ou 3 signaux significatifs. Un seul point d'attention maximum.
- Pour une question de tendance/progression, action=null.

CARDIO
- Reste léger. Pour équilibre Force/Cardio, observe les fréquences et la dernière activité. Pas de séance de course inventée. action=null.

FORCE
- Une action prepare_workout n'est permise que si l'utilisateur demande réellement une séance, quoi entraîner, ou accepte explicitement une proposition de séance.
- Pour une séance, choisis uniquement un workoutId de context.availableWorkouts.

ALIMENTATION
- Si l'utilisateur demande quoi manger, une idée de repas ou une recette, tu peux proposer action recipe.

ACTIONS
Types autorisés: prepare_workout, recipe, training, nutrition, checkin. Sinon action=null.
Tu ne modifies jamais les données toi-même.

Retourne UNIQUEMENT du JSON:
{"answer":"...","action":null}
ou
{"answer":"...","action":{"type":"prepare_workout|recipe|training|nutrition|checkin","label":"...","workoutId":"..."}}

CONTEXTE:
${JSON.stringify(context||{})}
HISTORIQUE (ancien vers récent):
${JSON.stringify(Array.isArray(history)?history.slice(-8):[])}
QUESTION ACTUELLE:
${String(question||'')}`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})});
    const data=await r.json();if(!r.ok)return{statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:data?.error?.message||'',model})};
    const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();const out=JSON.parse(text);if(!out?.answer)throw new Error('Réponse vide');
    const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
    const q=norm(question), hist=Array.isArray(history)?history:[];
    const explicitTopic=/(abdo|gainage|cardio|force|muscu|seance|entrain|aliment|repas|recette|manger|poids|tour de taille|sommeil|stress|energie|faim|objectif|progress|evolu|tendance|transformation|trajectoire|recomposition|photo)/.test(q);
    const shortFollowup=/^(t es sur|tu es sur|vraiment|pourquoi|comment ca|et pourquoi|et donc|tu penses|certain|sure|sur)$/.test(q)||/^(et|mais) (ca|donc|pourquoi)$/.test(q);
    const followup=shortFollowup&&!explicitTopic;
    const trend=/(tendance|progress|evolu|objectif|bonne voie|atteindre|transformation|trajectoire|sur la voie|resultat|recomposition)/.test(q);
    const cardio=/(equilibre.*(cardio|force)|(cardio|force).*(equilibre)|(cardio.*force|force.*cardio)|mon cardio|cote cardio)/.test(q);
    const recipe=/(recette|repas|manger|mange|dejeuner|diner|collation|alimentation|alimentaire|quoi.*(manger|privilegier)|idee.*(repas|manger))/.test(q);
    const workoutRequest=/(quelle|quel|quoi|faire|prepar|propos|seance|entrain).*(force|muscu|entrain|seance|haut|bas|full|push|pull|jamb)|(?:force|muscu|seance).*(quelle|quel|quoi|faire|prepar|propos)/.test(q);
    let action=out.action||null;const allowed=new Set(['prepare_workout','recipe','training','nutrition','checkin']);if(action&&!allowed.has(action.type))action=null;
    if(trend||cardio||followup)action=null;
    if(recipe&&!trend&&!followup&&action?.type!=='prepare_workout')action={type:'recipe',label:'Voir une recette adaptée'};
    if(action?.type==='prepare_workout'){
      if(!workoutRequest){action=null}else{const ids=new Set((context?.availableWorkouts||[]).map(w=>String(w.id)));if(!ids.has(String(action.workoutId||'')))action=null;}
    }
    if(action)action={type:action.type,label:String(action.label||'Ouvrir').slice(0,60),workoutId:action.workoutId?String(action.workoutId):''};
    return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({answer:String(out.answer),action,model,version:'2.7-conversation'})};
  }catch(e){console.error(e);return{statusCode:500,body:JSON.stringify({error:'COMPANION_FAILED',detail:e.message||''})}}
};
