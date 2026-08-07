exports.handler=async function(event){
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return{statusCode:503,body:JSON.stringify({error:'AI_NOT_CONFIGURED'})};
  try{
    const {question,context}=JSON.parse(event.body||'{}');
    const model='gemini-3-flash-preview';
    const prompt=`Tu es le Compagnon de Luis Transformation. Tu aides à interpréter des données de forme, entraînement et alimentation.
Réponds en français, en 2 à 5 phrases maximum, chaleureux mais précis. Donne au maximum 1 ou 2 actions concrètes.
Ne prétends jamais savoir une donnée absente. Ne pose pas de diagnostic médical. Ne donne pas de certitude à partir d'une variation isolée.
Contexte JSON: ${JSON.stringify(context)}
Question: ${String(question||'')}`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
    const data=await r.json();if(!r.ok)return{statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:data?.error?.message||'',model})};
    const answer=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({answer,model})};
  }catch(e){console.error(e);return{statusCode:500,body:JSON.stringify({error:'COMPANION_FAILED'})}}
};