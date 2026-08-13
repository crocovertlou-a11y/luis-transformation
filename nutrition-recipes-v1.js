exports.handler=async function(event){
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'METHOD_NOT_ALLOWED'})};
  const key=process.env.GEMINI_API_KEY;if(!key)return{statusCode:503,body:JSON.stringify({error:'AI_NOT_CONFIGURED'})};
  try{
    const {context}=JSON.parse(event.body||'{}');
    const prompt=`Tu es le moteur de propositions alimentaires de Fluidité.
Propose exactement 3 repas simples et réalistes à partir du contexte fourni.

Règles:
- Le repère protéines est un objectif de contexte, jamais une obligation de manger si la faim ne le justifie pas.
- Tiens compte de l'heure: ne cherche pas à combler artificiellement tout le déficit trop tôt dans la journée.
- Si cardio aujourd'hui, une proposition peut inclure une source de glucides adaptée à la récupération.
- Aucun diagnostic, aucune restriction extrême, aucun supplément.
- Les macros sont des ESTIMATIONS plausibles.
- Favorise des ingrédients courants et des recettes faisables.
- Si une recette personnelle du contexte correspond bien, tu peux la proposer en indiquant son nom, mais n'invente pas ses ingrédients.
- Retourne uniquement du JSON valide.

Schéma:
{"suggestions":[{"name":"...","mealType":"breakfast|lunch|snack|dinner","ingredients":["quantité + ingrédient", "..."],"preparation":["étape courte", "..."],"protein":45,"calories":600,"carbs":55,"fat":18,"reason":"phrase courte"}]}

CONTEXTE:
${JSON.stringify(context||{})}`;
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})});
    const data=await r.json();if(!r.ok)return{statusCode:502,body:JSON.stringify({error:'AI_SERVICE_ERROR',detail:data?.error?.message||''})};
    const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim(),out=JSON.parse(text);
    if(!Array.isArray(out.suggestions)||out.suggestions.length<3)throw new Error('Propositions incomplètes');
    const suggestions=out.suggestions.slice(0,3).map(x=>({
      name:String(x.name||'Repas proposé').slice(0,80),mealType:['breakfast','lunch','snack','dinner'].includes(x.mealType)?x.mealType:'dinner',
      ingredients:Array.isArray(x.ingredients)?x.ingredients.slice(0,10).map(v=>String(v).slice(0,100)):[],
      preparation:Array.isArray(x.preparation)?x.preparation.slice(0,8).map(v=>String(v).slice(0,180)):[],
      protein:Math.max(0,Math.min(100,Number(x.protein)||0)),calories:Math.max(0,Math.min(1500,Number(x.calories)||0)),
      carbs:Math.max(0,Math.min(250,Number(x.carbs)||0)),fat:Math.max(0,Math.min(100,Number(x.fat)||0)),reason:String(x.reason||'').slice(0,160)
    }));
    return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({suggestions,version:'2.6'})};
  }catch(e){console.error(e);return{statusCode:500,body:JSON.stringify({error:'NUTRITION_SUGGESTIONS_FAILED',detail:e.message||''})}}
};