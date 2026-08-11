/* Fluidité V2.1 — Coach foundations.
   Additive layer: app.js remains untouched. */
(()=>{
  'use strict';

  const V='2.1';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dayDiff=date=>{
    if(!date)return 9999;
    const t=new Date(`${date}T12:00:00`).getTime();
    return Number.isFinite(t)?Math.floor((Date.now()-t)/86400000):9999;
  };
  const recent=(rows,days)=>rows.filter(x=>dayDiff(x.date)<=days).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const totals=rows=>rows.reduce((a,x)=>({
    calories:a.calories+(Number(x.calories)||0),
    protein:a.protein+(Number(x.protein)||0),
    carbs:a.carbs+(Number(x.carbs)||0),
    fat:a.fat+(Number(x.fat)||0),
    water:a.water+(Number(x.water)||0)
  }),{calories:0,protein:0,carbs:0,fat:0,water:0});

  async function buildContext(){
    const [profile,checkins,workouts,cardio,food]=await Promise.all([
      LTDB.get('profile','me'), LTDB.all('checkins'), LTDB.all('workouts'), LTDB.all('cardio'), LTDB.all('food')
    ]);
    const today=typeof todayKey==='function'?todayKey():new Date().toISOString().slice(0,10);
    const todayCheckin=checkins.find(x=>x.date===today)||null;
    const todayFood=food.filter(x=>x.date===today);
    const todayNutrition=totals(todayFood);
    const force14=recent(workouts,14).slice(0,12);
    const cardio14=recent(cardio,14).slice(0,15);
    const recovery7=recent(checkins,7).slice(0,7);
    const food3=profile?.nutritionEnabled===false?[]:recent(food,3).slice(0,30);

    return {
      version:V,
      date:today,
      profile:{
        goal:profile?.goal||null,
        proteinTarget:Number(profile?.proteinTarget)||170,
        nutritionEnabled:profile?.nutritionEnabled!==false
      },
      today:{
        checkin:todayCheckin?{
          sleep:todayCheckin.sleep??null,stress:todayCheckin.stress??null,energy:todayCheckin.energy??null,
          recovery:todayCheckin.recovery??null,hunger:todayCheckin.hunger??null,weight:todayCheckin.weight??null,waist:todayCheckin.waist??null
        }:null,
        nutrition:profile?.nutritionEnabled===false?{calories:0,protein:0,carbs:0,fat:0,water:0,entries:0}:{...todayNutrition,entries:todayFood.length},
        force:workouts.filter(x=>x.date===today).length,
        cardio:cardio.filter(x=>x.date===today).length
      },
      recent:{
        recovery7d:recovery7.map(x=>({date:x.date,sleep:x.sleep??null,stress:x.stress??null,energy:x.energy??null,recovery:x.recovery??null,hunger:x.hunger??null})),
        force14d:force14.map(w=>({date:w.date,name:w.name||null,duration:w.durationLabel||null,effort:w.effort??null,exercises:(w.exerciseEntries||[]).slice(0,8).map(e=>({name:e.name||null,performance:e.performance||null}))})),
        cardio14d:cardio14.map(c=>({date:c.date,type:c.type||null,distance:c.distance??null,duration:c.durationLabel||null,heartRateAvg:c.heartRateAvg??null,cadenceAvg:c.cadenceAvg??null,elevationGain:c.elevationGain??null,calories:c.calories??null})),
        nutrition3d:food3.map(f=>({date:f.date,mealType:f.mealType||null,description:f.description||null,protein:f.protein??null,calories:f.calories??null,carbs:f.carbs??null,fat:f.fat??null}))
      }
    };
  }

  function contextBadges(c){
    const r=[];
    if(c.today.checkin)r.push('Ressenti du jour');
    if(c.recent.force14d.length)r.push(`Force · ${c.recent.force14d.length} séance${c.recent.force14d.length>1?'s':''}`);
    if(c.recent.cardio14d.length)r.push(`Cardio · ${c.recent.cardio14d.length} activité${c.recent.cardio14d.length>1?'s':''}`);
    if(c.profile.nutritionEnabled&&c.today.nutrition.entries)r.push(`Alimentation · ${c.today.nutrition.entries} saisie${c.today.nutrition.entries>1?'s':''}`);
    return r;
  }

  function fallbackAnswer(c){
    if(!c.today.checkin && !c.recent.force14d.length && !c.recent.cardio14d.length){
      return "Je n’ai pas encore assez de contexte pour te conseiller proprement. Renseigne ton ressenti du jour et je pourrai commencer par une recommandation simple.";
    }
    const parts=[];
    if(c.today.checkin?.energy!=null)parts.push(`énergie ${c.today.checkin.energy}/5`);
    if(c.today.checkin?.stress!=null)parts.push(`stress ${c.today.checkin.stress}/5`);
    if(c.today.checkin?.sleep!=null)parts.push(`${c.today.checkin.sleep} h de sommeil`);
    const intro=parts.length?`Je garde en contexte ${parts.join(', ')}.`:'Je garde ton activité récente en contexte.';
    return `${intro} L’IA est indisponible pour le moment, donc je reste volontairement prudent : suis le plan prévu si tes sensations sont bonnes, sinon allège sans chercher à compenser.`;
  }

  async function v21RenderCompanion(){
    const messages=await LTDB.all('events');
    const chat=messages.filter(x=>x.type==='CHAT').slice(-12);
    const c=await buildContext();
    const badges=contextBadges(c);
    const headline=c.today.checkin
      ? 'Je relie ton ressenti, tes entraînements et ta journée.'
      : 'Je peux t’aider davantage dès que ton ressenti du jour est renseigné.';
    return `<section class="hero companion-v21-hero"><div class="companion-page-mark">${typeof companionMark==='function'?companionMark('companion-mark-large'):''}</div><div class="hello">Coach Fluidité</div><div class="subtle">Une recommandation à la fois, basée uniquement sur les données utiles que tu as enregistrées.</div></section>
      <section class="card primary-card companion-v21-context">
        <div class="attention">${typeof companionMark==='function'?companionMark('companion-mark-large'):''}<div><div class="v21-eyebrow">CONTEXTE DU JOUR</div><h3>${esc(headline)}</h3><p>Je n’invente pas les données manquantes et je ne modifie rien sans ton action.</p></div></div>
        <div class="v21-context-badges">${badges.length?badges.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>Contexte à compléter</span>'}</div>
        <button type="button" class="v21-context-toggle" id="v21ContextToggle" aria-expanded="false">Voir ce que le Coach utilise</button>
        <div class="v21-context-detail" id="v21ContextDetail" hidden>
          <div><strong>Aujourd’hui</strong><span>${c.today.checkin?'Ressenti disponible':'Ressenti non renseigné'} · ${c.today.force} Force · ${c.today.cardio} Cardio</span></div>
          ${c.profile.nutritionEnabled?`<div><strong>Alimentation</strong><span>${Math.round(c.today.nutrition.calories)} kcal · ${Math.round(c.today.nutrition.protein)} g protéines · ${c.today.nutrition.entries} saisie${c.today.nutrition.entries>1?'s':''}</span></div>`:''}
          <div><strong>Historique récent</strong><span>7 j de ressenti · 14 j d’entraînement · 3 j d’alimentation</span></div>
          <p>Aucune photo n’est envoyée au Coach conversationnel V2.1.</p>
        </div>
      </section>
      <section class="v21-quick-prompts" aria-label="Questions rapides">
        <button type="button" data-v21-prompt="Que me conseilles-tu pour aujourd’hui ?">Aujourd’hui</button>
        <button type="button" data-v21-prompt="Est-ce que je devrais maintenir, adapter ou alléger mon entraînement aujourd’hui ?">Entraînement</button>
        ${c.profile.nutritionEnabled?'<button type="button" data-v21-prompt="Que devrais-je privilégier pour le reste de ma journée côté alimentation ?">Alimentation</button>':''}
        <button type="button" data-v21-prompt="Qu’est-ce qui ressort de mes derniers jours et quelle est ma meilleure prochaine action ?">Tendance</button>
      </section>
      <div class="card chat companion-v21-chat" id="chat">${chat.length?chat.map(x=>`<div class="bubble ${x.role==='user'?'user':'companion'}">${esc(x.text)}</div>`).join(''):'<div class="bubble companion"><strong>Je suis prêt.</strong><br>Tu peux me demander quoi privilégier aujourd’hui, si ta séance mérite d’être adaptée, ou ce qui ressort de tes derniers jours.</div>'}</div>
      <div class="chatbar companion-v21-chatbar"><input id="chatInput" autocomplete="off" placeholder="Demande au Coach…"><button id="sendChat" type="button">Envoyer</button></div>
      <p class="v21-footnote">Le Coach conseille. Tu gardes toujours la décision.</p>`;
  }

  async function v21SendChat(forcedText){
    const input=document.querySelector('#chatInput');
    const text=String(forcedText??input?.value??'').trim();
    if(!text)return;
    if(input){input.value=text;input.disabled=true;}
    const send=document.querySelector('#sendChat');if(send)send.disabled=true;
    await LTDB.put('events',{id:typeof uid==='function'?uid():`evt-${Date.now()}-${Math.random()}`,type:'CHAT',role:'user',text,createdAt:new Date().toISOString(),coachVersion:V});
    const context=await buildContext();
    let answer='';
    try{
      const r=await fetch('/.netlify/functions/companion-v2-1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,context})});
      const data=await r.json();
      if(!r.ok)throw new Error(data?.detail||data?.error||'IA indisponible');
      answer=String(data?.answer||'').trim()||fallbackAnswer(context);
    }catch(err){
      console.error('Fluidité Coach V2.1 fallback',err);
      answer=fallbackAnswer(context);
    }
    await LTDB.put('events',{id:typeof uid==='function'?uid():`evt-${Date.now()}-${Math.random()}`,type:'CHAT',role:'companion',text:answer,createdAt:new Date().toISOString(),coachVersion:V});
    if(typeof render==='function')await render();
  }

  // Install only after the legacy layer exists. No mutation of app.js required.
  if(typeof window.renderCompanion==='function') window.renderCompanion=v21RenderCompanion;
  if(typeof window.sendChat==='function') window.sendChat=v21SendChat;

  if(typeof window.bindPage==='function'){
    const legacyBindPage=window.bindPage;
    window.bindPage=function(){
      legacyBindPage();
      document.querySelectorAll('[data-v21-prompt]').forEach(btn=>{
        btn.addEventListener('click',()=>v21SendChat(btn.dataset.v21Prompt));
      });
      const toggle=document.querySelector('#v21ContextToggle');
      const detail=document.querySelector('#v21ContextDetail');
      if(toggle&&detail)toggle.addEventListener('click',()=>{
        const open=detail.hidden;
        detail.hidden=!open;
        toggle.setAttribute('aria-expanded',String(open));
        toggle.textContent=open?'Masquer les données utilisées':'Voir ce que le Coach utilise';
      });
    };
  }

  window.FluiditeCoachV21={version:V,buildContext,send:v21SendChat};
})();
