
/* Fluidité Nutrition resilience layer.
   Keeps stable app.js untouched. Uses Netlify Functions first, then local/direct fallbacks. */
(() => {
  const LOCAL = [
    {name:'Skyr nature',aliases:'skyr yaourt yogurt',per100:{calories:63,protein:11,carbs:4,fat:0.2}},
    {name:'Blanc de poulet, cuit',aliases:'poulet chicken blanc volaille',per100:{calories:165,protein:31,carbs:0,fat:3.6}},
    {name:'Œuf entier',aliases:'oeuf œuf œufs egg',per100:{calories:143,protein:12.6,carbs:0.7,fat:9.5}},
    {name:'Banane',aliases:'banane banana',per100:{calories:89,protein:1.1,carbs:22.8,fat:0.3}},
    {name:'Pomme',aliases:'pomme apple',per100:{calories:52,protein:0.3,carbs:13.8,fat:0.2}},
    {name:'Riz basmati cuit',aliases:'riz basmati rice',per100:{calories:121,protein:3.5,carbs:25.2,fat:0.4}},
    {name:'Flocons d’avoine',aliases:'avoine flocons oats oatmeal',per100:{calories:379,protein:13.2,carbs:67.7,fat:6.5}},
    {name:'Saumon cuit',aliases:'saumon salmon',per100:{calories:206,protein:22.1,carbs:0,fat:12.4}},
    {name:'Thon au naturel',aliases:'thon tuna',per100:{calories:116,protein:25.5,carbs:0,fat:0.8}},
    {name:'Fromage blanc 0%',aliases:'fromage blanc quark',per100:{calories:46,protein:8,carbs:4,fat:0.2}},
    {name:'Brocoli cuit',aliases:'brocoli broccoli',per100:{calories:35,protein:2.4,carbs:7.2,fat:0.4}},
    {name:'Courgette cuite',aliases:'courgette zucchini',per100:{calories:17,protein:1.2,carbs:3.1,fat:0.3}},
    {name:'Lentilles cuites',aliases:'lentilles lentil',per100:{calories:116,protein:9,carbs:20.1,fat:0.4}},
    {name:'Avocat',aliases:'avocat avocado',per100:{calories:160,protein:2,carbs:8.5,fat:14.7}}
  ];

  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const localSearch=q=>{
    const terms=norm(q).split(/\s+/).filter(Boolean);
    let rows=LOCAL.filter(x=>terms.every(t=>norm(x.name+' '+x.aliases).includes(t)));
    if(!rows.length) rows=LOCAL.filter(x=>terms.some(t=>t.length>2 && norm(x.name+' '+x.aliases).includes(t)));
    return rows.slice(0,8).map((x,i)=>({
      id:'local-'+i+'-'+x.name, source:'local-reference', sourceLabel:'Référence intégrée',
      name:x.name, brand:'', quantity:'', image:'', servingGrams:100, per100:x.per100
    }));
  };

  async function robustSearchFoods(e){
    state.foodSearchMealContext=$('#foodSearchMealContext')?.value||'';
    e.preventDefault();
    const q=String(new FormData(e.currentTarget).get('query')||'').trim();
    const status=$('#foodSearchStatus'),box=$('#foodSearchResults');
    if(q.length<2)return;
    if(status)status.textContent='Recherche…';
    if(box)box.innerHTML='';
    let results=[];
    try{
      const r=await fetch(`/.netlify/functions/food-search?q=${encodeURIComponent(q)}`,{cache:'no-store'});
      if(r.ok){
        const data=await r.json();
        results=Array.isArray(data.results)?data.results:[];
      }
    }catch(err){ console.warn('food-search function unavailable',err); }
    if(!results.length) results=localSearch(q);
    if(status)status.textContent=results.length?`${results.length} résultat${results.length>1?'s':''}`:'Aucun résultat';
    if(!box)return;
    box.innerHTML=`<div class="food-result-list">${results.map((x,i)=>`<button class="food-result-row" data-food-result="${i}" type="button">${x.image?`<img src="${escapeHtml(x.image)}" alt="">`:'<span class="food-result-placeholder">◒</span>'}<div><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.brand||x.sourceLabel||'Aliment')} · ${Math.round(Number(x.per100?.calories)||0)} kcal · ${Number(x.per100?.protein||0).toFixed(1)} g prot. / 100 g</span></div><b>›</b></button>`).join('')||'<div class="empty">Aucun résultat. Essaie la photo ou la saisie manuelle.</div>'}</div>`;
    state.foodSearchResults=results;
    document.querySelectorAll('[data-food-result]').forEach(b=>b.addEventListener('click',()=>showFoodSearchConfirm(results[Number(b.dataset.foodResult)])));
  }

  async function directOFFBarcode(code){
    const fields='code,product_name,product_name_fr,brands,quantity,serving_size,serving_quantity,image_front_url,nutriments';
    const url=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(fields)}`;
    const r=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!r.ok) throw new Error('PRODUCT_SERVICE_ERROR');
    const data=await r.json();
    const p=data.product;
    if(!p) throw new Error('PRODUCT_NOT_FOUND');
    const n=p.nutriments||{};
    const num=v=>Number.isFinite(Number(v))?Number(v):null;
    return {
      found:true, code:p.code||code, name:p.product_name_fr||p.product_name||'Produit',
      brands:p.brands||'', quantity:p.quantity||'', servingSize:p.serving_size||'',
      servingGrams:num(p.serving_quantity), image:p.image_front_url||'',
      per100:{calories:num(n['energy-kcal_100g']),protein:num(n.proteins_100g),carbs:num(n.carbohydrates_100g),fat:num(n.fat_100g)},
      source:'Open Food Facts'
    };
  }

  async function robustBarcode(code,date=todayKey(),mealType='lunch'){
    let data=null;
    try{
      const r=await fetch(`/.netlify/functions/product-lookup?code=${encodeURIComponent(code)}`,{cache:'no-store'});
      if(r.ok) data=await r.json();
    }catch(err){ console.warn('product-lookup function unavailable',err); }
    if(!data){
      try{ data=await directOFFBarcode(code); }
      catch(err){
        console.error(err);
        toast(err.message==='PRODUCT_NOT_FOUND'?'Produit non trouvé':'Recherche produit impossible');
        const form=$('#barcodeForm');
        if(form){form.classList.remove('hidden');form.elements.barcode.value=code}
        const status=$('#barcodeScanStatus');if(status)status.textContent='Vérifie ou saisis le code manuellement.';
        return;
      }
    }
    showBarcodeConfirmation(data,date,mealType);
  }

  // Override only the two nutrition network functions.
  searchFoods=robustSearchFoods;
  lookupBarcodeCode=robustBarcode;
})();
