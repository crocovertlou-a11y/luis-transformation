const DEFAULT_FOODS = [
  {id:'chicken',name:'Blanc de poulet',kcal:165,protein:31,carbs:0,fat:3.6},
  {id:'skyr',name:'Skyr nature',kcal:63,protein:11,carbs:4,fat:0.2},
  {id:'rice',name:'Riz basmati cuit',kcal:130,protein:2.7,carbs:28,fat:0.3},
  {id:'oats',name:"Flocons d’avoine",kcal:372,protein:13.5,carbs:58.7,fat:7},
  {id:'banana',name:'Banane',kcal:89,protein:1.1,carbs:22.8,fat:0.3},
  {id:'egg',name:'Œuf entier',kcal:143,protein:12.6,carbs:0.7,fat:9.5},
  {id:'salmon',name:'Saumon',kcal:208,protein:20,carbs:0,fat:13},
  {id:'whey',name:'Whey isolate',kcal:370,protein:84,carbs:3,fat:1.5},
  {id:'greek',name:'Yaourt grec 0%',kcal:59,protein:10.3,carbs:3.6,fat:0.4},
  {id:'pasta',name:'Pâtes cuites',kcal:157,protein:5.8,carbs:30.9,fat:0.9},
  {id:'oliveoil',name:"Huile d’olive",kcal:884,protein:0,carbs:0,fat:100},
  {id:'avocado',name:'Avocat',kcal:160,protein:2,carbs:8.5,fat:14.7}
];
const MEALS={breakfast:'Petit-déjeuner',lunch:'Déjeuner',snack:'Collation',dinner:'Dîner'};
const TARGETS={kcal:2400,protein:170};
const dayKey=()=>new Date().toISOString().slice(0,10);
const storageKey=()=>`luis-nutrition-${dayKey()}`;
let foods=JSON.parse(localStorage.getItem('luis-custom-foods')||'[]').concat(DEFAULT_FOODS);
let entries=JSON.parse(localStorage.getItem(storageKey())||'[]');
let selectedFood=null;

const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n*10)/10;
function save(){localStorage.setItem(storageKey(),JSON.stringify(entries));}
function totals(list=entries){return list.reduce((a,e)=>({kcal:a.kcal+e.kcal,protein:a.protein+e.protein,carbs:a.carbs+e.carbs,fat:a.fat+e.fat}),{kcal:0,protein:0,carbs:0,fat:0});}
function renderSummary(){const t=totals();$('kcalValue').textContent=Math.round(t.kcal);$('proteinValue').textContent=`${fmt(t.protein)} / ${TARGETS.protein} g`;$('carbValue').textContent=`${fmt(t.carbs)} g`;$('fatValue').textContent=`${fmt(t.fat)} g`;$('kcalBar').style.width=`${Math.min(100,t.kcal/TARGETS.kcal*100)}%`;const missing=Math.max(0,TARGETS.protein-t.protein);$('proteinHint').textContent=missing?`Il te manque ${Math.round(missing)} g de protéines.`:'Objectif protéines atteint ✅';}
function renderMeals(){const host=$('mealSections');host.innerHTML='';Object.entries(MEALS).forEach(([key,label])=>{const list=entries.filter(e=>e.meal===key),t=totals(list);const sec=document.createElement('section');sec.className='card';sec.innerHTML=`<div class="meal-head"><h2 class="meal-title">${label}</h2><span class="meal-total">${Math.round(t.kcal)} kcal · ${fmt(t.protein)} g prot.</span></div><div>${list.length?list.map(e=>`<div class="food-row"><div><strong>${e.name}</strong><small>${e.grams} g · ${Math.round(e.kcal)} kcal · ${fmt(e.protein)} g prot.</small></div><button class="delete" data-id="${e.entryId}">×</button></div>`).join(''):'<div class="empty">Aucun aliment</div>'}</div>`;host.appendChild(sec);});document.querySelectorAll('.delete').forEach(b=>b.onclick=()=>{entries=entries.filter(e=>e.entryId!==b.dataset.id);save();render();});}
function render(){renderSummary();renderMeals();}
function renderSearch(q=''){const normalized=q.trim().toLowerCase();const list=(normalized?foods.filter(f=>f.name.toLowerCase().includes(normalized)):foods.slice(0,6)).slice(0,12);$('searchResults').innerHTML=list.map(f=>`<div class="result-item" data-id="${f.id}"><div><strong>${f.name}</strong><small>pour 100 g</small></div><small>${f.kcal} kcal · ${f.protein} g prot.</small></div>`).join('');document.querySelectorAll('.result-item').forEach(el=>el.onclick=()=>openFood(foods.find(f=>f.id===el.dataset.id)));}
function openFood(food){selectedFood=food;$('dialogFoodName').textContent=food.name;$('dialogFoodMacros').textContent=`Pour 100 g : ${food.kcal} kcal · ${food.protein} g protéines · ${food.carbs} g glucides · ${food.fat} g lipides`;$('gramsInput').value=100;$('addDialog').showModal();}
$('confirmAdd').addEventListener('click',e=>{e.preventDefault();if(!selectedFood)return;const grams=Number($('gramsInput').value);if(!grams||grams<1)return;const ratio=grams/100;entries.push({entryId:crypto.randomUUID(),meal:$('mealSelect').value,name:selectedFood.name,grams,kcal:selectedFood.kcal*ratio,protein:selectedFood.protein*ratio,carbs:selectedFood.carbs*ratio,fat:selectedFood.fat*ratio});save();$('addDialog').close();render();});
$('searchInput').addEventListener('input',e=>renderSearch(e.target.value));
$('toggleCustom').onclick=()=>$('customForm').classList.toggle('hidden');
$('customForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target);const food={id:`custom-${Date.now()}`,name:fd.get('name'),kcal:Number(fd.get('kcal')),protein:Number(fd.get('protein')),carbs:Number(fd.get('carbs')),fat:Number(fd.get('fat'))};const custom=JSON.parse(localStorage.getItem('luis-custom-foods')||'[]');custom.unshift(food);localStorage.setItem('luis-custom-foods',JSON.stringify(custom));foods=[food,...foods];e.target.reset();e.target.classList.add('hidden');renderSearch(food.name);});
$('resetDay').onclick=()=>{if(confirm('Effacer toutes les données nutritionnelles du jour ?')){entries=[];save();render();}};
$('dateLabel').textContent=new Intl.DateTimeFormat('fr-CH',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
renderSearch();render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
