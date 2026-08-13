function jsonResponse(statusCode,payload){
  return {statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(payload)};
}
function extractText(data){
  return (data?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||'').join('').trim();
}
function parseStructured(text){
  const raw=String(text||'').trim();
  if(!raw) throw new Error('Réponse IA vide');
  const cleaned=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(cleaned)}catch(_){
    const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');
    if(a>=0&&b>a) return JSON.parse(cleaned.slice(a,b+1));
    throw new Error('JSON IA invalide');
  }
}
async function callGemini(apiKey,model,prompt,structured=true){
  const generationConfig=structured?{responseMimeType:'application/json'}:{};
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const e=new Error(data?.error?.message||`Gemini HTTP ${r.status}`);e.httpStatus=r.status;throw e;
  }
  const text=extractText(data);
  if(!text){
    const reason=data?.candidates?.[0]?.finishReason||data?.promptFeedback?.blockReason||'EMPTY';
    throw new Error(`Réponse Gemini vide (${reason})`);
  }
  return text;
}
exports.handler=async function(event){
  if(event.httpMethod!=='POST')return jsonResponse(405,{error:'METHOD_NOT_ALLOWED'});
  const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return jsonResponse(503,{error:'AI_NOT_CONFIGURED'});
  try{
    const {question,context,history}=JSON.parse(event.body||'{}');
    const q=String(question||'').trim();
    if(!q)return jsonResponse(400,{error:'QUESTION_REQUIRED'});
    const model='gemini-3-flash-preview';
    const prompt=`Tu es le Compagnon de Fluidité. Réponds à la question actuelle, pas à une recommandation générique de la journée.

PRIORITÉS
1. La QUESTION ACTUELLE est toujours prioritaire. Si elle nomme un sujet (abdos, alimentation, cardio, objectif, sommeil, poids, etc.), réponds à CE sujet.
2. Une relance très courte comme « t'es sûr ? », « pourquoi ? », « et donc ? » reprend le dernier échange de l'historique et doit réellement le réévaluer, pas le recopier.
3. Utilise uniquement les faits utiles du contexte. context.dailyDecision est seulement un fait parmi d'autres : ne le récite jamais par défaut.
4. Pour objectif/progression/tendances, utilise context.trends 7/14/30 jours et indique clairement si la couverture est insuffisante.
5. Pour un groupe musculaire précis, utilise recentForce, availableWorkouts et allowedExercises; réponds d'abord à la question musculaire.
6. Pour l'alimentation, utilise nutritionToday et proteinTarget. Si la demande porte sur quoi manger/une recette, une action recipe peut être utile.
7. Pour le cardio, reste léger et observe l'équilibre/récupération; n'invente pas de séance de course.

STYLE
Français naturel, chaleureux, direct, 2 à 5 phrases en général. Varie le vocabulaire et la structure. Pas de Markdown, pas de réponse formatée en gabarit. Ne cite un chiffre que s'il aide réellement. N'invente rien. Pas de diagnostic ni de certitude excessive.

ACTIONS
Une action est exceptionnelle et doit être demandée ou directement utile.
prepare_workout seulement si l'utilisateur demande une séance et avec un workoutId exact de context.availableWorkouts.
recipe si l'utilisateur demande quoi manger, une idée de repas ou une recette.
training/nutrition/checkin uniquement si ouvrir cet écran répond directement à la demande.
Pour objectif/tendances/pilotage, relance conversationnelle ou « dois-je faire plus d'abdos ? », action=null sauf demande explicite.

Retourne UNIQUEMENT un objet JSON valide :
{"answer":"réponse naturelle","action":null}
ou
{"answer":"réponse naturelle","action":{"type":"prepare_workout|recipe|training|nutrition|checkin","label":"...","workoutId":"..."}}

CONTEXTE FACTUEL:\n${JSON.stringify(context||{})}\nHISTORIQUE AVANT LA QUESTION ACTUELLE:\n${JSON.stringify(Array.isArray(history)?history.slice(-8):[])}\nQUESTION ACTUELLE:\n${q}`;

    let out;
    try{
      out=parseStructured(await callGemini(apiKey,model,prompt,true));
    }catch(firstErr){
      // Deuxième tentative plus tolérante : même question/contexte, sans mode JSON forcé.
      const retryPrompt=`${prompt}\n\nIMPORTANT: réponds maintenant avec UNIQUEMENT le JSON demandé, sans balises ni commentaire.`;
      try{ out=parseStructured(await callGemini(apiKey,model,retryPrompt,false)); }
      catch(secondErr){
        return jsonResponse(502,{error:'AI_SERVICE_ERROR',detail:secondErr.message||firstErr.message||'Erreur Gemini',firstAttempt:firstErr.message||'',version:'2.9-pilotage'});
      }
    }
    if(!out?.answer)throw new Error('Réponse sans answer');
    let action=out.action||null;
    const allowed=new Set(['prepare_workout','recipe','training','nutrition','checkin']);
    if(action&&!allowed.has(action.type))action=null;
    if(action?.type==='prepare_workout'){
      const ids=new Set((context?.availableWorkouts||[]).map(w=>String(w.id)));
      if(!ids.has(String(action.workoutId||'')))action=null;
    }
    if(action)action={type:action.type,label:String(action.label||'Ouvrir').slice(0,60),workoutId:action.workoutId?String(action.workoutId):''};
    return jsonResponse(200,{answer:String(out.answer),action,model,version:'2.9-pilotage'});
  }catch(e){
    console.error('COMPANION_FAILED',e);
    return jsonResponse(500,{error:'COMPANION_FAILED',detail:e.message||'Erreur inconnue',version:'2.9-pilotage'});
  }
};
