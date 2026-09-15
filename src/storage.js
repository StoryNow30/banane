/* Extension-origin IndexedDB stores large clouds once; chrome.storage stores only state. */
class BananeStorage3{
 async open(){if(this.db)return this.db;this.db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('banane-test-v3',1);request.onupgradeneeded=()=>{for(const n of ['clouds','events','records'])request.result.createObjectStore(n);};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return this.db;}
 async transaction(name,mode,fn){const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction(name,mode),req=fn(tx.objectStore(name));let result;
   req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Stockage annulé.'));});}
 async getState(){return (await chrome.storage.local.get('banane3State')).banane3State||null;}
 async setState(s){await chrome.storage.local.set({banane3State:s});}
 async putCloud(id,data){return this.transaction('clouds','readwrite',s=>s.put(data,id));}
 async getCloud(id){return this.transaction('clouds','readonly',s=>s.get(id));}
 /* Un nuage acquitté et écrit sur disque est retiré de la base : sans cela la
  * session ne repart jamais de zéro après un vidage automatique. La liste
  * complète des identifiants reste déclarée dans la session, donc un segment
  * manquant à la fusion est signalé plutôt que perdu. */
 async deleteCloud(id){return this.transaction('clouds','readwrite',s=>s.delete(id));}
 async clearAll(){for(const n of ['clouds','events','records'])await this.transaction(n,'readwrite',s=>s.clear());}
 async putEvent(e){return this.transaction('events','readwrite',s=>s.put(e,e.eventId));}
 async deleteEvent(id){return this.transaction('events','readwrite',s=>s.delete(id));}
 async putRecord(r){return this.transaction('records','readwrite',s=>s.put(r,r.recordId||r.id));}
 async deleteRecord(id){return this.transaction('records','readwrite',s=>s.delete(id));}
 async all(name){return this.transaction(name,'readonly',s=>s.getAll());}
 async keys(name){return this.transaction(name,'readonly',s=>s.getAllKeys());}
}
globalThis.BananeStorage3=BananeStorage3;
