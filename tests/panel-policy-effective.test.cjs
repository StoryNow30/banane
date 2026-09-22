/* POLITIQUE DE FAIBLE CONFIANCE — le select dit la DEMANDE, le texte dit l'EFFET.
 *
 * Dans un lot Pilote GCV1, `background.js` force `lowConfidence` à « tenter » et
 * ne garde le choix de l'opérateur que dans `scope.requestedLowConfidence`
 * (KI-033). Le panneau doit annoncer la politique EFFECTIVE sans jamais écrire
 * cette politique dans le contrôle : y recopier `lowConfidence` perdait la
 * préférence de l'opérateur pour le lot suivant, faussait le
 * `requestedLowConfidence` enregistré, faisait disparaître le message
 * explicatif, et dévoilait `brain-sanspause` alors que la pause avait été
 * demandée.
 *
 * Ces tests font tourner le VRAI `panel.js` dans un contexte `vm`, comme
 * `panel-presence.test.cjs` : ce ne sont pas des doublures de la logique.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const souffler=()=>new Promise(resolve=>setImmediate(resolve));

/* Un élément de formulaire minimal : il retient ce que le panneau y écrit. */
const element=()=>({value:'',disabled:false,hidden:false,checked:false,open:false,textContent:'',
  classList:{toggle(){},add(){},remove(){}},dataset:{},
  setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},click(){}});

/* Un lot en cours, tel que le moteur le rend dans `view().batch`. */
const lot=(scope,state='RUNNING')=>({state,scope,processed:[],skipped:[],deferred:[],manuallyCompleted:[]});
const vueDe=batch=>({current:{identity:{pageId:'p',frameId:'f',part:16,cut:9451,shape:'U50'}},
  batch,manual:null,native:null,busy:false,settings:{minConfidence:55},mode:'automatic-test'});

async function ouvrirPanneau({brainActif=false}={}){
  const elements=new Map(),appels=[];
  const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  let vue=vueDe(null);
  const document={body:{dataset:{window:'home'}},activeElement:null,
    querySelectorAll:()=>[],getElementById:$,createElement:()=>element()};
  const reponses={'list-tabs':()=>[],'view':()=>vue,
    'brain-state':()=>({actif:brainActif,autoriserSelectionSansPause:false,dernier:null}),
    'settings':()=>({}),'start':()=>vue};
  const chrome={runtime:{
    connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async message=>{appels.push({action:message.action,args:message.args});
      const r=reponses[message.action];
      if(!r)throw Error('action de fixture inconnue : '+message.action);
      return {result:r()};}}};
  const minuteries=[];
  const contexte={document,chrome,location:{hash:'#automatic'},addEventListener(){},console,
    setTimeout:fn=>fn,setInterval:fn=>{minuteries.push(fn);return minuteries.length;},URL:{createObjectURL:()=>'',revokeObjectURL(){}}};
  vm.createContext(contexte);
  vm.runInContext(SOURCE,contexte);
  for(let i=0;i<6;i++)await souffler();            // amorçage : discover + refresh + cerveau
  /* Le panneau se redessine sur sa minuterie d'une seconde. On la déclenche à
   * la main pour rendre un état précis, plutôt que d'attendre l'horloge. */
  const rendre=async nouvelle=>{vue=nouvelle;minuteries[0]();for(let i=0;i<6;i++)await souffler();};
  return {el:$,appels,rendre};
}

/* A. Pendant le lot : le select garde la DEMANDE, il est gelé, et le texte dit l'EFFET. */
test('A — pendant un lot GCV1, le select reste sur « pause » demandé, gelé, et le texte annonce « attempt »',async()=>{
  const {el,rendre}=await ouvrirPanneau();
  el('policy').value='pause';                       // choix de l'opérateur avant le lot
  await rendre(vueDe(null));
  assert.equal(el('policy').value,'pause','hors lot, le panneau ne touche pas au choix');
  assert.equal(el('policy').disabled,false,'hors lot, le réglage reste modifiable');

  await rendre(vueDe(lot({start:9451,end:9493,requestedLowConfidence:'pause',lowConfidence:'attempt',unresolvedPolicy:'defer'})));
  assert.equal(el('policy').value,'pause','le select porte la préférence DEMANDÉE, jamais la politique forcée');
  assert.equal(el('policy').disabled,true,'la politique d’un lot est figée à sa création, comme unresolved-policy');
  assert.equal(el('policy-effective').hidden,false);
  assert.equal(el('policy-effective').textContent,
    'Politique effective de ce lot : tenter la proposition expérimentale. Le lot Pilote GCV1 ne repasse pas ses '
    +'candidates dans le seuil de confiance V4.6 : le choix « mettre le lot en pause » ne s’y applique pas.');
});

/* B. Après le lot : la préférence survit et le contrôle est rendu. */
test('B — à la fin du lot, la préférence « pause » survit et le select redevient modifiable',async()=>{
  const {el,rendre}=await ouvrirPanneau();
  el('policy').value='pause';
  const scope={start:9451,end:9493,requestedLowConfidence:'pause',lowConfidence:'attempt',unresolvedPolicy:'defer'};
  await rendre(vueDe(lot(scope)));
  assert.equal(el('policy').disabled,true);

  await rendre(vueDe(lot(scope,'COMPLETED')));
  assert.equal(el('policy').value,'pause','le choix de l’opérateur n’a pas été écrasé par la politique effective');
  assert.equal(el('policy').disabled,false,'le lot est fini : le réglage est rendu à l’opérateur');
  assert.equal(el('policy-effective').hidden,true,'hors lot, aucune politique effective à annoncer');
  assert.equal(el('policy-effective').textContent,'');
});

/* C. Le lot SUIVANT repart sur la demande d'origine, sans geste de l'opérateur. */
test('C — un nouveau lot, sans action opérateur, demande encore « pause » au backend',async()=>{
  const {el,appels,rendre}=await ouvrirPanneau();
  el('policy').value='pause';
  const scope={start:9451,end:9493,requestedLowConfidence:'pause',lowConfidence:'attempt',unresolvedPolicy:'defer'};
  await rendre(vueDe(lot(scope)));
  await rendre(vueDe(lot(scope,'COMPLETED')));

  el('unresolved-policy').value='defer';
  el('start').value='9494';el('end').value='9530';el('confidence').value='55';
  appels.length=0;
  el('start-batch').onclick();
  for(let i=0;i<8;i++)await souffler();

  const demarrage=appels.find(a=>a.action==='start');
  assert.ok(demarrage,'le lot a bien été demandé');
  assert.equal(demarrage.args.lowConfidence,'pause',
    'sans geste de l’opérateur, le lot suivant repart sur la préférence d’origine');
  assert.equal(demarrage.args.geometryEngine,'geometry-candidate-v1');
});

/* D. Demande et effet identiques : message cohérent, aucune mutation parasite. */
test('D — quand la demande vaut déjà « attempt », le message est simple et rien n’est muté',async()=>{
  const {el,rendre}=await ouvrirPanneau();
  el('policy').value='attempt';
  const scope={start:9451,end:9493,requestedLowConfidence:'attempt',lowConfidence:'attempt',unresolvedPolicy:'defer'};
  await rendre(vueDe(lot(scope)));
  assert.equal(el('policy').value,'attempt');
  assert.equal(el('policy').disabled,true);
  assert.equal(el('policy-effective').textContent,
    'Politique effective de ce lot : tenter la proposition expérimentale.',
    'aucune clause GCV1 quand le choix de l’opérateur est bien celui qui s’applique');

  await rendre(vueDe(lot(scope,'COMPLETED')));
  assert.equal(el('policy').value,'attempt','la préférence reste celle de l’opérateur');
  assert.equal(el('policy').disabled,false);
});

/* E. La case d'essai du cerveau ne s'ouvre pas sur un « attempt » forcé. */
test('E — brain-sanspause reste masqué quand « attempt » est forcé alors que la pause était demandée',async()=>{
  const {el,rendre}=await ouvrirPanneau({brainActif:true});
  assert.equal(el('brain-toggle').checked,true,'le cerveau est allumé pour ce scénario');
  el('policy').value='pause';
  await rendre(vueDe(lot({start:9451,end:9493,requestedLowConfidence:'pause',lowConfidence:'attempt',unresolvedPolicy:'defer'})));
  assert.equal(el('brain-sanspause-box').hidden,true,
    'un « attempt » forcé par GCV1 ne doit pas dévoiler une action opérateur que la pause demandée gardait fermée');
  assert.equal(el('brain-policy').hidden,true);
  assert.equal(el('brain-sanspause').checked,false,'et rien n’a été coché au passage');
});

/* Garde de source : la régression corrigée ici est une ÉCRITURE. On l'interdit
 * au niveau du texte, pour qu'elle ne puisse pas revenir par une autre voie. */
test('aucune politique effective n’est jamais écrite dans un contrôle du panneau',()=>{
  const ecritures=SOURCE.split('\n')
    .map((ligne,index)=>({n:index+1,ligne}))
    .filter(({ligne})=>/\$\(['"][^'"]+['"]\)(\.\w+)*\.(value|checked)\s*=/.test(ligne)&&/scope\??\.lowConfidence/.test(ligne));
  assert.deepEqual(ecritures,[],
    'le panneau ne doit jamais recopier scope.lowConfidence dans un contrôle : le contrôle porte la DEMANDE');
});
