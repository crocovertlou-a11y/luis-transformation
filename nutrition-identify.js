const JSON_HEADERS={"Content-Type":"application/json","Cache-Control":"no-store"};

function outputText(response){
  if(typeof response.output_text==='string')return response.output_text;
  for(const item of response.output||[]){
    if(item.type==='message')for(const content of item.content||[]){
      if(content.type==='output_text'&&content.text)return content.text;
    }
  }
  return '';
}

const schema={
  type:'object',additionalProperties:false,
  properties:{
    name:{type:'string'},brand:{type:'string'},barcode:{type:'string'},portionGrams:{type:'number'},
    kcal100:{type:'number'},protein100:{type:'number'},carbs100:{type:'number'},fat100:{type:'number'},fiber100:{type:'number'},
    confidence:{type:'string',enum:['haute','moyenne','faible']},sourceLabel:{type:'string'},notes:{type:'string'}
  },
  required:['name','brand','barcode','portionGrams','kcal100','protein100','carbs100','fat100','fiber100','confidence','sourceLabel','notes']
};

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return{statusCode:405,headers:JSON_HEADERS,body:JSON.stringify({error:'Méthode non autorisée'})};
  if(!process.env.OPENAI_API_KEY)return{statusCode:503,headers:JSON_HEADERS,body:JSON.stringify({error:'OPENAI_API_KEY manque dans Netlify.'})};
  try{
    const {query='',imageDataUrl='',locale='fr-CH'}=JSON.parse(event.body||'{}');
    if(!query&&!imageDataUrl)return{statusCode:400,headers:JSON_HEADERS,body:JSON.stringify({error:'Ajoute un nom ou une photo.'})};
    if(imageDataUrl&&imageDataUrl.length>5_500_000)return{statusCode:413,headers:JSON_HEADERS,body:JSON.stringify({error:'Photo trop volumineuse.'})};
    const content=[{type:'input_text',text:`Identifie précisément ce produit alimentaire pour une application de journal nutritionnel en Suisse (${locale}). Description utilisateur: ${query||'aucune'}. Priorité: 1) lire l'étiquette visible, 2) code-barres et informations officielles du fabricant, 3) sources web fiables, 4) estimation seulement en dernier recours. Retourne les valeurs pour 100 g ou 100 ml et la portion totale probable. Ne jamais inventer une certitude. Mets 0 si une valeur est réellement introuvable et explique-le dans notes. sourceLabel doit indiquer clairement: étiquette photographiée, fabricant/base produit, ou estimation IA.`}];
    if(imageDataUrl)content.push({type:'input_image',image_url:imageDataUrl,detail:'high'});
    const payload={
      model:process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||'gpt-5-mini',
      reasoning:{effort:'low'},
      tools:[{type:'web_search'}],tool_choice:'auto',
      input:[{role:'user',content}],
      text:{format:{type:'json_schema',name:'food_identification',strict:true,schema}},
      max_output_tokens:900
    };
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const json=await response.json();
    if(!response.ok)throw new Error(json.error?.message||'Erreur OpenAI');
    const text=outputText(json);
    if(!text)throw new Error('Réponse vide');
    const food=JSON.parse(text);
    return{statusCode:200,headers:JSON_HEADERS,body:JSON.stringify({food})};
  }catch(error){
    console.error('nutrition-identify',error);
    return{statusCode:500,headers:JSON_HEADERS,body:JSON.stringify({error:'Identification momentanément indisponible. Réessaie avec une photo nette de la face avant et de l’étiquette.'})};
  }
};
