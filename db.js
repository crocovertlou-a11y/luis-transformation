const LTDB = (() => {
  const DB_NAME = 'luis-transformation';
  const DB_VERSION = 1;
  const stores = ['profile','checkins','workouts','cardio','food','memory','settings','events'];
  let dbPromise;

  function open(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        for(const name of stores){ if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:'id'}); }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }

  async function put(store,value){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete=()=>resolve(value); tx.onerror=()=>reject(tx.error);
    });
  }
  async function get(store,id){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(store).objectStore(store).get(id);
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function all(store){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(store).objectStore(store).getAll();
      req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
    });
  }
  async function del(store,id){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(id);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  }
  async function dump(){
    const out={schema:1,exportedAt:new Date().toISOString(),stores:{}};
    for(const s of stores) out.stores[s]=await all(s);
    return out;
  }
  async function restore(payload){
    if(!payload?.stores) throw new Error('Format de sauvegarde invalide');
    for(const s of stores){
      const rows=payload.stores[s]||[];
      for(const row of rows) await put(s,row);
    }
  }
  async function migrateLegacy(){
    const marker=await get('settings','legacy-migration');
    if(marker) return;
    const candidates=['luisTransformationData','luis-transformation-data','transformationData','appData'];
    const found=[];
    for(const key of candidates){
      try{const raw=localStorage.getItem(key); if(raw) found.push({key,data:JSON.parse(raw)});}catch(e){}
    }
    if(found.length){
      await put('events',{id:'legacy-'+Date.now(),type:'LEGACY_SNAPSHOT',createdAt:new Date().toISOString(),payload:found});
    }
    await put('settings',{id:'legacy-migration',done:true,found:found.length,at:new Date().toISOString()});
  }
  return {open,put,get,all,del,dump,restore,migrateLegacy};
})();
