const GENERIC=[
{name:'Blanc de poulet, cuit',aliases:'poulet chicken blanc volaille',p:{calories:165,protein:31,carbs:0,fat:3.6}},
{name:'Œuf entier',aliases:'oeuf œufs egg',p:{calories:143,protein:12.6,carbs:0.7,fat:9.5}},
{name:'Banane',aliases:'banane banana',p:{calories:89,protein:1.1,carbs:22.8,fat:0.3}},
{name:'Pomme',aliases:'pomme apple',p:{calories:52,protein:0.3,carbs:13.8,fat:0.2}},
{name:'Riz basmati cuit',aliases:'riz basmati rice',p:{calories:121,protein:3.5,carbs:25.2,fat:0.4}},
{name:'Pâtes cuites',aliases:'pates pâtes pasta',p:{calories:158,protein:5.8,carbs:30.9,fat:0.9}},
{name:'Pomme de terre cuite',aliases:'pomme terre patate potato',p:{calories:87,protein:1.9,carbs:20.1,fat:0.1}},
{name:'Flocons d’avoine',aliases:'avoine flocons oats oatmeal',p:{calories:379,protein:13.2,carbs:67.7,fat:6.5}},
{name:'Saumon cuit',aliases:'saumon salmon',p:{calories:206,protein:22.1,carbs:0,fat:12.4}},
{name:'Thon au naturel',aliases:'thon tuna',p:{calories:116,protein:25.5,carbs:0,fat:0.8}},
{name:'Skyr nature',aliases:'skyr yaourt yogurt',p:{calories:63,protein:11,carbs:4,fat:0.2}},
{name:'Fromage blanc 0%',aliases:'fromage blanc quark',p:{calories:46,protein:8,carbs:4,fat:0.2}},
{name:'Brocoli cuit',aliases:'brocoli broccoli',p:{calories:35,protein:2.4,carbs:7.2,fat:0.4}},
{name:'Courgette cuite',aliases:'courgette zucchini',p:{calories:17,protein:1.2,carbs:3.1,fat:0.3}},
{name:'Lentilles cuites',aliases:'lentilles lentil',p:{calories:116,protein:9,carbs:20.1,fat:0.4}},
{name:'Avocat',aliases:'avocat avocado',p:{calories:160,protein:2,carbs:8.5,fat:14.7}}
];
const n=v=>Number.isFinite(Number(v))?Number(v):0;
function generic(q){const terms=q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').split(/\s+/).filter(Boolean);const hay=x=>(x.name+' '+x.aliases).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');let rows=GENERIC.filter(x=>terms.every(t=>hay(x).includes(t)));if(!rows.length&&terms.length>1)rows=GENERIC.filter(x=>terms.some(t=>t.length>2&&hay(x).includes(t)));return rows.slice(0,5).map((x,i)=>({id:'generic-'+i+'-'+x.name,source:'generic-reference',sourceLabel:'Référence générique',name:x.name,brand:'',quantity:'',image:'',servingGrams:100,per100:x.p}))}
exports.handler=async function(event){
 const q=String(event.queryStringParameters?.q||'').trim();if(q.length<2)return{statusCode:400,body:JSON.stringify({error:'QUERY_TOO_SHORT'})};
 try{
  const search=async term=>{const url='https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(term)+'&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,brands,quantity,image_front_small_url,nutriments,serving_quantity';const r=await fetch(url,{headers:{'User-Agent':'LuisTransformation/0.9.1'}});return r.ok?await r.json():{products:[]}};
  let d=await search(q);
  if(!(d.products||[]).length){const relaxed=q.split(/\s+/).filter(x=>x.length>2)[0];if(relaxed&&relaxed.toLowerCase()!==q.toLowerCase())d=await search(relaxed)}
  const branded=(d.products||[]).filter(x=>x.product_name&&x.nutriments).map(x=>({id:x.code||'',source:'open-food-facts-search',sourceLabel:'Open Food Facts',name:x.product_name,brand:x.brands||'',quantity:x.quantity||'',image:x.image_front_small_url||'',servingGrams:n(x.serving_quantity)||100,per100:{calories:n(x.nutriments['energy-kcal_100g']),protein:n(x.nutriments.proteins_100g),carbs:n(x.nutriments.carbohydrates_100g),fat:n(x.nutriments.fat_100g)}})).filter(x=>x.per100.calories||x.per100.protein||x.per100.carbs||x.per100.fat).slice(0,8);
  const gens=generic(q);const results=[...branded,...gens].slice(0,12);
  return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'},body:JSON.stringify({results})};
 }catch(e){console.error(e);const results=generic(q);return{statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({results})}}
};