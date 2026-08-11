const MODEL='gemini-3-flash-preview';

function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function compactContext(input){
  const c=input&&typeof input==='object'?input:{};
  return {
    date:c.date||null,
    profile:{goal:c.profile?.goal||null,proteinTarget:c.profile?.proteinTarget||null,nutritionEnabled:c.profile?.nutritionEnabled!==false},
    today:c.today||{},
    recent:{
      recovery7d:Array.isArray(c.recent?.recovery7d)?c.recent.recovery7d.slice(0,7):[],
      force14d:Array.isArray(c.recent?.force14d)?c.recent.force14d.slice(0,12):[],
      cardio14d:Array.isArray(c.recent?.cardio14d)?c.recent.cardio14d.slice(0,15):[],
      nutrition3d:Array.isArray(c.recent?.nutrition3d)?c.recent.nutrition3d.slice(0,30):[]
    }
  };
}

exports.handler=async function(event){
  if(event.httpMethod!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return json(503,{error:'AI_NOT_CONFIGURED'});
  try{
    const body=JSON.parse(event.body||'{}');
    const question=String(body.question||'').trim().slice(0,1200);
    if(!question)return json(400,{error:'QUESTION_REQUIRED'});
    const context=compactContext(body.context);
    const prompt=`Tu es Coach Fluidité, le compagnon personnel d'une application de forme, entraînement et alimentation.
Tu réponds en français, avec chaleur, précision et sobriété.

PRINCIPE CENTRAL
- Recommande la meilleure prochaine action, pas le maximum d'actions.
- L'utilisateur garde toujours la décision. Ne prétends jamais avoir modifié son programme, ses données ou son alimentation.
- Base-toi UNIQUEMENT sur le contexte JSON fourni. Si une donnée manque, dis-le sans l'inventer.
- Distingue une tendance de plusieurs jours d'une variation isolée.
- Ne diagnostique jamais une blessure, maladie ou trouble. Si la question décrit des symptômes préoccupants, conseille un professionnel de santé sans dramatiser.
- Ne recommande pas de restriction alimentaire agressive, de compensation après un repas, ni d'entraînement punitif.
- Pour l'entraînement, tiens compte du ressenti, du sommeil et de la charge récente, mais reste conservateur si les données sont incomplètes.
- Pour l'alimentation, utilise les calories/macros comme repères contextuels, jamais comme une obligation de manger ou de ne pas manger.
- Ne donne pas une fausse précision à partir d'estimations.

STYLE
- 2 à 5 phrases, sauf si l'utilisateur demande explicitement plus de détail.
- Commence directement par la lecture utile, sans formule générique.
- Termine par 1 action concrète maximum, éventuellement 2 si elles sont indissociables.
- Ton positif, jamais culpabilisant.

CONTEXTE JSON:
${JSON.stringify(context)}

QUESTION:
${question}`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:420}})
    });
    const data=await r.json();
    if(!r.ok)return json(502,{error:'AI_SERVICE_ERROR',detail:data?.error?.message||'',model:MODEL});
    const answer=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    if(!answer)return json(502,{error:'AI_EMPTY_RESPONSE',model:MODEL});
    return json(200,{answer,model:MODEL,coachVersion:'2.1'});
  }catch(e){console.error('companion-v2-1',e);return json(500,{error:'COMPANION_V21_FAILED',detail:e?.message||''})}
};
