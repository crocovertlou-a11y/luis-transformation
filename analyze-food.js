function extractOutputText(payload){
  if (typeof payload.output_text === 'string') return payload.output_text;
  const texts=[];
  for (const item of payload.output || []) {
    for (const c of item.content || []) {
      if (c.type === 'output_text' && typeof c.text === 'string') texts.push(c.text);
    }
  }
  return texts.join('\n');
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, body:JSON.stringify({error:'METHOD_NOT_ALLOWED'}) };
  }
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey){
    return { statusCode:503, body:JSON.stringify({error:'AI_NOT_CONFIGURED', message:'OPENAI_API_KEY is missing'}) };
  }

  try{
    const body=JSON.parse(event.body || '{}');
    const imageData=body.image;
    if(!imageData || !/^data:image\/(jpeg|png|webp);base64,/.test(imageData)){
      return { statusCode:400, body:JSON.stringify({error:'INVALID_IMAGE'}) };
    }
    if(imageData.length > 2_800_000){
      return { statusCode:413, body:JSON.stringify({error:'IMAGE_TOO_LARGE'}) };
    }

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

    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${apiKey}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || 'gpt-5-mini',
        input:[{
          role:'user',
          content:[
            {type:'input_text',text:prompt},
            {type:'input_image',image_url:imageData}
          ]
        }]
      })
    });

    const payload=await response.json();
    if(!response.ok){
      console.error('OpenAI error',payload);
      return {statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR'})};
    }

    const text=extractOutputText(payload);
    let parsed;
    try{
      const cleaned=text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
      parsed=JSON.parse(cleaned);
    }catch(err){
      console.error('AI parse error',text);
      return {statusCode:502,body:JSON.stringify({error:'AI_INVALID_RESPONSE'})};
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
        items, totals,
        notes:String(parsed.notes || '').slice(0,300),
        source:'Compagnon IA'
      })
    };
  }catch(err){
    console.error(err);
    return {statusCode:500,body:JSON.stringify({error:'AI_ANALYSIS_FAILED'})};
  }
};
