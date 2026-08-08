exports.handler=async function(event){
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return{statusCode:503,body:JSON.stringify({error:'AI_NOT_CONFIGURED'})};
  const model='gemini-3-flash-preview';
  try{
    const body=JSON.parse(event.body||'{}'),view=String(body.view||'Face'),before=body.before||{},after=body.after||{};
    const strip=s=>String(s||'').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/,'');
    const mime=s=>(String(s||'').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)||[])[1]||'image/jpeg';
    if(!before.image||!after.image)return{statusCode:400,body:JSON.stringify({error:'TWO_IMAGES_REQUIRED'})};
    const prompt=`Compare ces deux photos d'évolution de la même personne, vue ${view}. Avant ${before.date}, mesures ${JSON.stringify(before.metrics||null)}. Après ${after.date}, mesures ${JSON.stringify(after.metrics||null)}. Réponds en français, 4 à 7 puces puis une conclusion. Décris seulement les différences visibles (silhouette, taille/abdomen, définition musculaire visible, posture/cadrage/lumière). N'invente jamais masse grasse, poids ou diagnostic. Si le cadrage/lumière limite la comparaison, dis-le.`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt},{text:'PHOTO AVANT'},{inline_data:{mime_type:mime(before.image),data:strip(before.image)}},{text:'PHOTO APRES'},{inline_data:{mime_type:mime(after.image),data:strip(after.image)}}]}]})});
    const data=await r.json();if(!r.ok)return{statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:data?.error?.message||'',model})};
    const analysis=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({analysis,model})};
  }catch(e){return{statusCode:500,body:JSON.stringify({error:'PHOTO_COMPARISON_FAILED',detail:e.message||''})}}
};