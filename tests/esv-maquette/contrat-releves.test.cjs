'use strict';
/* CH-029 — CONTRAT DE LA MAQUETTE AVEC LES RELEVÉS RÉELS. La maquette ESV doit reproduire ce que trois séances sur un vrai ESV ont mesuré
 * (tests/fixtures/esv-releves-reels.json : comptes, formes, délais, jamais d'identifiant ni de numéro de cut) : sélecteur de parties (structure,
 * libellés, absence intermittente), boutons, forme du compteur, changement de partie (durée, page vide pendant le chargement, ouverture de la partie
 * suivante), refus de « Next non validated cut » tant qu'il reste des cuts à valider. Un écart est un essai rouge : on corrige la maquette.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=300000 tests/esv-maquette/contrat-releves.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const N=require('./navigateur.cjs');
const F=JSON.parse(fs.readFileSync(path.join(N.racine,'tests/fixtures/esv-releves-reels.json'),'utf8'));
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const sel=async env=>JSON.parse(JSON.stringify((await env.appel('ping',[{contrat:true}])).result.selecteurParties));
const dom=env=>env.page.evaluate(()=>({boutons:[...document.querySelectorAll('header button[id^="O2N3DCut"]')].map(b=>b.id).filter(i=>!/R?LRClick|RRClick/.test(i)),entrees:document.querySelectorAll('#maquette-parties a').length}));

test('fixture : les faits réels attendus sont là (garde-fou de l’extraction)',()=>{
  assert.equal(F.format,'ariane-esv-releves-reels-v1');
  assert.ok(F.selecteur.resume.ok>0&&F.selecteur.resume.absent>0&&F.selecteur.resume.absentSansRechargement>0&&F.selecteur.resume.absentPageRechargee>0);
  assert.ok(F.changementsResume.ok>=5&&F.changementsResume.refus>=1);
  assert.ok(F.changements.filter(c=>c.issue==='ok').every(c=>c.ouvreAuCut===1&&c.sansDecision===true));
});

test('sélecteur présent : libellés nus de 0 à n − 1, une seule entrée courante, n dans la plage réelle',opts,async()=>{
  const lus=F.selecteur.releves.filter(r=>r.etat==='ok');
  assert.ok(lus.every(r=>r.libellesNus&&r.numerosConsecutifsDepuis0&&r.entreesCourantes===1&&r.courantDansListe));
  for(const n of F.selecteur.resume.nEntrees){
    const env=await N.ouvrir({maquette:{cuts:4,latence:10,part:4,parties:2,partiesAffichees:n}});
    try{await env.injecter();const s=await sel(env);
      assert.equal(s.status,'ok');assert.equal(s.parts.length,n);
      assert.deepEqual(s.parts.map(p=>p.part),Array.from({length:n},(_,i)=>i),'numéros consécutifs depuis 0');
      assert.ok(s.parts.every(p=>p.label===String(p.part)),'libellés nus');
      assert.equal(s.parts.filter(p=>p.current).length,1);assert.equal(s.current,4);
    }finally{await env.fermer();}}
  const env=await N.ouvrir({maquette:{cuts:4,latence:10}});
  try{await env.injecter();const s=await sel(env),[mini,maxi]=[Math.min(...F.selecteur.resume.nEntrees),Math.max(...F.selecteur.resume.nEntrees)];
    assert.ok(s.parts.length>=mini&&s.parts.length<=maxi,'défaut dans la plage réelle '+mini+'–'+maxi);}
  finally{await env.fermer();}
});

test('sélecteur absent : forme réelle, y compris avec les six boutons présents (chargement), puis présent',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,selecteurRetard:1500}});
  try{await env.injecter();
    assert.deepEqual(await sel(env),{status:'absent',current:null,parts:[]},'forme réelle de l’absence : current null, n 0, parts vide');
    assert.equal(F.selecteur.resume.absentForme.n,0);
    assert.equal((await dom(env)).boutons.length,F.contratEsv.normal.boutons.length,'absent alors que les boutons sont là (2 relevés réels)');
    await dormir(1800);assert.equal((await sel(env)).status,'ok');
  }finally{await env.fermer();}
});

test('contrat : les six boutons, leurs titres, les classes des rails, les cinq écouteurs',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10}});
  try{await env.injecter();const r=await env.appel('ping',[{contrat:true}]),c=JSON.parse(JSON.stringify(r.result.contrat));
    assert.deepEqual(c.detail.boutons,F.contratEsv.normal.boutons);assert.deepEqual(c.detail.rails,F.contratEsv.normal.rails);
    assert.deepEqual(Object.keys(c.detail.ecouteurs),F.contratEsv.normal.ecouteurs);assert.ok(Object.values(c.detail.ecouteurs).every(Boolean));
    const titres=await env.page.evaluate(ids=>Object.fromEntries(ids.map(i=>[i,document.getElementById(i).title])),F.contratEsv.normal.boutons);
    assert.deepEqual(titres,F.contratEsv.normal.titres);
  }finally{await env.fermer();}
});

test('compteur : « N on M treated », N ≤ M, entiers',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10}});
  try{const t=await env.page.evaluate(()=>document.getElementById('maquette-compteur').textContent.replace(/\s+/g,' ').trim());
    const m=/^(\d+) on (\d+) treated$/.exec(t);assert.ok(m,t);assert.ok(Number(m[1])<=Number(m[2]));
    assert.equal(F.compteur.traitesInferieurOuEgalTotal,true);
  }finally{await env.fermer();}
});

/* Changement de partie : durée réelle, page vide pendant le chargement, ouverture au premier cut, refus tant qu'il reste des cuts. */
const reel=F.changementsResume.dureeMs;
async function changer({mode,statut1}){
  const env=await N.ouvrir({maquette:{cuts:5,debut:100,latence:10,parties:2,partie2:4,delaiPartie:'reel',...(statut1?{statut1}:{})}});
  await env.injecter();
  if(mode==='suivant-dernier')await env.page.evaluate(()=>document.dispatchEvent(new CustomEvent('maquette:goto',{detail:{cut:104}})));
  const avant=await env.etat(),t0=Date.now();
  const r=await env.appel('changerPartie',[{part:avant.part+1,mode}]);
  return {env,avant,t0,r};
}
async function attendrePartie(env,part,borne=20000){const t=Date.now();
  while(Date.now()-t<borne){const e=await env.etat().catch(()=>null);if(e&&e.part===part&&e.railsPrets)return Date.now();await dormir(100);}return null;}

for(const mode of ['invalide-suivant','suivant-dernier']){
  test(`changement de partie « ${mode} » : durée réelle, page vide pendant le chargement, ouverture au cut ${F.changements.find(c=>c.issue==='ok').ouvreAuCut}`,opts,async()=>{
    const {env,avant,t0,r}=await changer({mode,statut1:mode==='invalide-suivant'?'valid':undefined});
    try{assert.equal(r.result?.ok,true,JSON.stringify(r));
      const reload=F.changements.filter(c=>c.issue==='ok').map(c=>c.pageRechargeeApresMs);
      await dormir(Math.max(...reload)+250);
      const vide=await dom(env);assert.deepEqual(vide.boutons,[],'plus aucun bouton pendant le chargement');assert.equal(vide.entrees,0,'ni sélecteur');
      assert.equal((await sel(env)).status,'absent');
      const fin=await attendrePartie(env,avant.part+1);assert.ok(fin,'la partie suivante s’ouvre');
      const duree=fin-t0;assert.ok(duree>=reel.min-300&&duree<=reel.max+300,`durée ${duree} ms hors de ${reel.min}–${reel.max}`);
      const e=await env.etat();assert.equal(e.cut,F.changements.find(c=>c.issue==='ok').ouvreAuCut,'ouverte au premier cut');
      assert.equal((await dom(env)).boutons.length,6);assert.equal((await sel(env)).current,avant.part+1);
      assert.equal(env.serveur.journal.ecritures.length,0,'aucune validation ni SKIP');
    }finally{await env.fermer();}
  });
}

test('« Next non validated cut » refusé tant qu’il reste des cuts à valider : rien cliqué, partie inchangée',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:5,debut:100,latence:10,parties:2,partie2:4}});
  try{await env.injecter();const avant=await env.etat(),m=/^(\d+) on (\d+)/.exec(avant.compteur);assert.ok(Number(m[1])<Number(m[2]));
    const r=await env.appel('changerPartie',[{part:avant.part+1,mode:'invalide-suivant'}]);
    assert.equal(r.result.ok,false);assert.equal(r.result.raison,'reste-a-valider');
    await dormir(800);assert.equal((await env.etat()).part,avant.part);
    const refus=F.changements.filter(c=>c.raison==='reste-a-valider');assert.ok(refus.length&&refus.every(c=>c.compteurToutTraite===false&&c.restants>0));
  }finally{await env.fermer();}
});
