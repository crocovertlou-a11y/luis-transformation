const {JSDOM}=require(process.env.FLUIDITE_JSDOM||'jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.FLUIDITE_ROOT||path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://fluidite.test/',runScripts:'dangerously',pretendToBeVisual:true});
const w=dom.window,d=w.document;let failures=[];w.addEventListener('error',e=>failures.push(e.message));
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.openCount=(this.openCount||0)+1};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
const rows={};w.LTDB={all:async k=>{await new Promise(r=>setTimeout(r,30));return rows[k]||[]},get:async()=>null,put:async(k,v)=>{rows[k]??=[];rows[k].push(v)},listSnapshots:async()=>[]};
function script(s){const el=d.createElement('script');el.textContent=s;d.body.append(el)}
function load(name){script(fs.readFileSync(path.join(root,name),'utf8').replace(/init\(\);\s*$/,''))}
load('app.js');script("state.profile={id:'me',firstName:'Test',initials:'T',nutritionEnabled:true};");
for(const name of ['force-visual-step2.js','force-detail-step1.js','force-session-guard-step5.js','coach-force-v1-phase1.js','coach-force-v1-phase1-hotfix.js','force-technique-router-stable.js','force-session-return-v21051.js'])load(name);
function click(s){assert.ok(d.querySelector(s),s);d.querySelector(s).click()}
async function waitFor(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10))}throw Error('timeout')}
(async()=>{
 d.querySelector('#main').innerHTML='<button data-open="workoutIdeas">Choisir moi-même</button>';
 script('bindPage();');
 click('[data-open="workoutIdeas"]');assert.ok(d.querySelector('[data-workout-choice]'));console.log('PASS dynamic manual workout selection');
 click('[data-workout-choice="upper"]');await waitFor(()=>d.querySelector('[data-fstep-start]'));
 // Preview Technique must return to the preview, without starting a workout.
 click('[data-fstep-tech]');assert.ok(d.querySelector('.fvis-tech'));
 click('[data-fvis-back]');assert.ok(d.querySelector('[data-fstep-start]'));assert.equal(d.querySelector('#workoutForm'),null);console.log('PASS preview Technique and return');
 click('[data-fstep-start]');await waitFor(()=>d.querySelector('#workoutForm'));
 const weight=d.querySelector('[name="weight_0_0"]');weight.value='42.5';weight.focus();assert.equal(d.activeElement,weight);
 d.querySelector('[name="reps_0_0"]').value='7';d.querySelector('#sheetContent').scrollTop=175;
 click('#workoutForm [data-technique]');assert.ok(d.querySelector('.fvis-tech'));
 click('[data-fvis-back]');await waitFor(()=>d.querySelector('#workoutForm'));
 assert.equal(d.querySelector('[name="weight_0_0"]').value,'42.5');assert.equal(d.querySelector('[name="reps_0_0"]').value,'7');assert.equal(d.querySelector('#sheetContent').scrollTop,175);console.log('PASS delayed rebuild preserves weights, reps and scroll');
 assert.equal(d.querySelector('#sheet').openCount,1);console.log('PASS no repeated modal opening during transitions');
 d.querySelector('#workoutForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>rows.workouts?.length);
 assert.equal(rows.workouts[0].exerciseEntries[0].series[0].weight,42.5);assert.equal(rows.workouts[0].exerciseEntries[0].series[0].reps,7);console.log('PASS save actual workout values');
 script("showSheet('<p>Première fiche</p>'); showSheet('<p>Deuxième fiche</p>');");click('#sheet [data-close]');assert.equal(d.querySelector('#sheet').open,false);console.log('PASS close after content replacement');
 script("window.backCalls=0;showSheet('<p>Retour</p>',()=>{window.backCalls++});bindSheet();bindSheet();");click('#sheet [data-close]');assert.equal(w.backCalls,1);console.log('PASS back action runs once after repeated binding');
 await new Promise(r=>setTimeout(r,250));assert.deepEqual(failures,[]);dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
