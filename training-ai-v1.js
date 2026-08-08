exports.handler=async function(event){
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  const key=process.env.GEMINI_API_KEY;if(!key)return{statusCode:503,body:JSON.stringify({error:'AI_NOT_CONFIGURED'})};
  try{
    const body=JSON.parse(event.body||'{}'),context=body.context||{};
    const prompt=`Tu es le moteur de recommandation d'entraînement de Luis Transformation.
À partir du contexte JSON ci-dessous, propose UNE séance principalement orientée musculation/force, mais tiens compte du cardio récent, de la récupération et de l'alimentation.
Objectif général: recomposition corporelle, progression durable, séance autour de 40 minutes.
L'utilisateur reste libre: tu conseilles, tu ne décides pas.

Règles:
- Si les données sont insuffisantes, reste conservateur et dis-le.
- Ne pose aucun diagnostic médical.
- Ne déduis pas de fatigue ou blessure non déclarée.
- Évite de charger fortement les jambes si le cardio récent montre une charge importante/intense, sauf justification claire.
- Tiens compte des groupes musculaires/exercices travaillés récemment pour varier.
- L'alimentation sert uniquement de contexte: ne refuse jamais une séance sur cette base.
- Génère une séance cohérente et variée, pas seulement une séance d'une bibliothèque fixe.
- 4 à 6 exercices maximum.
- Chaque exercice: name, sets (2-5), reps (nombre OU chaîne courte), rest (ex: "90 s").
- Aucun chrono automatique.
- Retourne UNIQUEMENT du JSON valide, sans markdown.

Schéma:
{"reason":"justification courte","contextNote":"optionnel, une phrase","workout":{"id":"ai-generated","title":"...","subtitle":"~40 min · ...","goalLabel":"Force|Hypertrophie|Mixte|Récupération","plan":[{"name":"...","sets":4,"reps":8,"rest":"90 s"}]}}

CONTEXTE:
${JSON.stringify(context)}`;
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})});
    const data=await r.json();if(!r.ok)return{statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:data?.error?.message||''})};
    const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    let out=JSON.parse(text);
    if(!out?.workout?.title||!Array.isArray(out?.workout?.plan)||out.workout.plan.length<3)throw new Error('Réponse IA incomplète');
    out.workout.plan=out.workout.plan.slice(0,6).map((e,i)=>({name:String(e.name||`Exercice ${i+1}`),sets:Math.min(5,Math.max(2,Number(e.sets)||3)),reps:(typeof e.reps==='number'||typeof e.reps==='string')?e.reps:8,rest:String(e.rest||'90 s')}));
    out.workout.id='ai-generated';
    return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(out)};
  }catch(e){console.error(e);return{statusCode:500,body:JSON.stringify({error:'TRAINING_AI_FAILED',detail:e.message||''})}}
};