function extractText(payload){
  const parts=payload?.candidates?.[0]?.content?.parts || [];
  return parts.map(p=>p.text || '').filter(Boolean).join('\n').trim();
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify({error:'METHOD_NOT_ALLOWED'}) };
  }

  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey){
    return { statusCode:503, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify({error:'AI_NOT_CONFIGURED',message:'GEMINI_API_KEY is missing'}) };
  }

  try{
    const body=JSON.parse(event.body || '{}');
    const imageData=body.image;
    const match=String(imageData||'').match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if(!match){
      return { statusCode:400, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify({error:'INVALID_IMAGE'}) };
    }
    if(imageData.length > 2_800_000){
      return { statusCode:413, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify({error:'IMAGE_TOO_LARGE'}) };
    }

    const mimeType=`image/${match[1]}`;
    const base64=match[2];
    const prompt=`Tu analyses une photo alimentaire pour une application de suivi nutritionnel.
Détermine s'il s'agit plutôt d'un produit/aliment unique ou d'un repas composé.
Identifie uniquement ce qui est raisonnablement visible. Estime les portions en grammes avec prudence.
Retourne UNIQUEMENT un objet JSON valide, sans markdown, avec cette structure exacte:
{
  "kind":"product" ou "meal",
  "name":"nom court en français",
  "confidence": nombre entre 0 et 1,
  "items":[
    {"name":"aliment","estimated_grams":nombre,"calories":nombre,"protein":nombre,"carbs":nombre,"fat":nombre}
  ],
  "totals":{"calories":nombre,"protein":nombre,"carbs":nombre,"fat":nombre},
  "notes":"une phrase courte expliquant l'incertitude éventuelle"
}
Les nutriments sont estimés pour les quantités visibles, pas pour 100 g.
Si tu n'es pas assez sûr d'un aliment, signale-le dans notes au lieu d'inventer.`;

    const model='gemini-3-flash-preview';
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const response=await fetch(url,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-goog-api-key':apiKey
      },
      body:JSON.stringify({
        contents:[{
          parts:[
            {inlineData:{mimeType,data:base64}},
            {text:prompt}
          ]
        }],
        generationConfig:{
          responseMimeType:'application/json'
        }
      })
    });

    const payload=await response.json();
    if(!response.ok){
      console.error('Gemini error',JSON.stringify(payload));
      return {statusCode:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:payload?.error?.message||'',geminiStatus:response.status,model})};
    }

    const text=extractText(payload);
    let parsed;
    try{
      parsed=JSON.parse(text.replace(/^```json\s*/i,'').replace(/```$/,'').trim());
    }catch(err){
      console.error('Gemini parse error',text);
      return {statusCode:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'AI_INVALID_RESPONSE',detail:'Réponse Gemini non JSON',model})};
    }

    const safeNum=v=>Number.isFinite(Number(v)) ? Math.max(0,Number(v)) : 0;
    const items=Array.isArray(parsed.items) ? parsed.items.slice(0,12).map(i=>({
      name:String(i.name || 'Aliment').slice(0,80),
      estimated_grams:safeNum(i.estimated_grams),
      calories:safeNum(i.calories),
      protein:safeNum(i.protein),
      carbs:safeNum(i.carbs),
      fat:safeNum(i.fat)
    })) : [];

    const totals={
      calories:safeNum(parsed.totals?.calories),
      protein:safeNum(parsed.totals?.protein),
      carbs:safeNum(parsed.totals?.carbs),
      fat:safeNum(parsed.totals?.fat)
    };

    return {
      statusCode:200,
      headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
      body:JSON.stringify({
        kind:parsed.kind === 'product' ? 'product' : 'meal',
        name:String(parsed.name || 'Repas analysé').slice(0,100),
        confidence:Math.min(1,Math.max(0,safeNum(parsed.confidence))),
        items,totals,
        notes:String(parsed.notes || '').slice(0,300),
        source:'Compagnon IA · Gemini',model
      })
    };
  }catch(err){
    console.error(err);
    return {statusCode:500,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'AI_ANALYSIS_FAILED',detail:String(err?.message||err).slice(0,300)})};
  }
};
