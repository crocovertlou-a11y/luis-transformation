exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({error:'METHOD_NOT_ALLOWED'}) };
  }
  const code = String(event.queryStringParameters?.code || '').replace(/\D/g,'');
  if (!code || code.length < 8 || code.length > 14) {
    return { statusCode: 400, body: JSON.stringify({error:'INVALID_BARCODE'}) };
  }

  const fields = [
    'code','product_name','product_name_fr','brands','quantity','serving_size','serving_quantity',
    'image_front_url','nutriments'
  ].join(',');

  try {
    const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?fields=${encodeURIComponent(fields)}`;
    const response = await fetch(url, {
      headers: {'User-Agent':'LuisTransformation/0.6 (Netlify nutrition lookup)'}
    });
    if (!response.ok) {
      return { statusCode: 502, body: JSON.stringify({error:'PRODUCT_SERVICE_ERROR'}) };
    }
    const data = await response.json();
    const p = data.product;
    if (!p) return { statusCode: 404, body: JSON.stringify({error:'PRODUCT_NOT_FOUND'}) };

    const n = p.nutriments || {};
    const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
    const per100 = {
      calories: num(n['energy-kcal_100g']),
      protein: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g)
    };

    return {
      statusCode: 200,
      headers: {'Content-Type':'application/json','Cache-Control':'public, max-age=3600'},
      body: JSON.stringify({
        found:true,
        code:p.code || code,
        name:p.product_name_fr || p.product_name || 'Produit',
        brands:p.brands || '',
        quantity:p.quantity || '',
        servingSize:p.serving_size || '',
        servingGrams:num(p.serving_quantity),
        image:p.image_front_url || '',
        per100,
        source:'Open Food Facts'
      })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({error:'LOOKUP_FAILED'}) };
  }
};
