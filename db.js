const LTDB = (() => {
  const DB_NAME = 'luis-transformation';
  const DB_VERSION = 3;
  const dataStores = ['profile','checkins','workouts','cardio','food','memory','settings','events','photos'];
  const systemStores = ['backups'];
  const stores = [...dataStores,...systemStores];
  const BACKUP_LIMIT = 7;
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
    const out={schema:2,app:'Luis Transformation / Fluidité',exportedAt:new Date().toISOString(),stores:{}};
    for(const s of dataStores) out.stores[s]=await all(s);
    return out;
  }
  function validateBackup(payload){
    if(!payload || typeof payload!=='object' || !payload.stores || typeof payload.stores!=='object') throw new Error('Format de sauvegarde invalide');
    if(payload.schema!=null && ![1,2].includes(Number(payload.schema))) throw new Error('Version de sauvegarde non prise en charge');
    let total=0;
    for(const s of dataStores){
      const rows=payload.stores[s]||[];
      if(!Array.isArray(rows)) throw new Error(`Données invalides : ${s}`);
      total+=rows.length;
      if(rows.length>25000) throw new Error(`Trop de lignes dans ${s}`);
      for(const row of rows){ if(!row || typeof row!=='object' || row.id===undefined || row.id===null) throw new Error(`Entrée invalide dans ${s}`); }
    }
    return {schema:Number(payload.schema||1),total,counts:Object.fromEntries(dataStores.map(s=>[s,(payload.stores[s]||[]).length]))};
  }
  async function restore(payload,{replace=true}={}){
    validateBackup(payload);
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(dataStores,'readwrite');
      try{
        for(const s of dataStores){
          const os=tx.objectStore(s);
          if(replace) os.clear();
          for(const row of (payload.stores[s]||[])) os.put(row);
        }
      }catch(err){ try{tx.abort();}catch(_){} reject(err); return; }
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error||new Error('Restauration impossible'));
      tx.onabort=()=>reject(tx.error||new Error('Restauration annulée'));
    });
  }
  async function createSnapshot(reason='manual'){
    const payload=await dump();
    const row={id:'backup-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString(),reason,payload};
    await put('backups',row);
    const allBackups=(await all('backups')).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    for(const old of allBackups.slice(BACKUP_LIMIT)) await del('backups',old.id);
    return row;
  }
  async function listSnapshots(){
    return (await all('backups')).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(x=>({id:x.id,createdAt:x.createdAt,reason:x.reason,counts:Object.fromEntries(dataStores.map(s=>[s,(x.payload?.stores?.[s]||[]).length]))}));
  }
  async function restoreSnapshot(id){
    const snap=await get('backups',id); if(!snap?.payload) throw new Error('Sauvegarde locale introuvable');
    await createSnapshot('before-local-restore');
    return restore(snap.payload,{replace:true});
  }
  async function autoSnapshot(){
    const today=new Date().toISOString().slice(0,10);
    const recent=(await all('backups')).some(x=>String(x.createdAt||'').slice(0,10)===today && x.reason==='daily-auto');
    if(recent) return false;
    await createSnapshot('daily-auto');
    return true;
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
  return {open,put,get,all,del,dump,restore,validateBackup,createSnapshot,listSnapshots,restoreSnapshot,autoSnapshot,migrateLegacy};
})();
