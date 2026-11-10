/* CH-101 : photographie chaque cadre d'une page de comparaison (proposition × état × taille × thème) et mesure
 * débordements, troncatures et contrastes (seuil 4,5:1, éléments désactivés exclus).
 * Usage : node maquettes/ui-ch101/outils/voir3.cjs DOSSIER_HORS_DEPOT [numéros]   (DOSSIER contient tour3.html et un sous-dossier v3/) */
const {chromium}=require('playwright');const S=process.argv[2],SEUL=process.argv[3]||'';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:2700,height:1000},deviceScaleFactor:1});const err=[];p.on('pageerror',e=>err.push(e.message));
await p.goto('file://'+S+'/tour3.html');await p.addStyleTag({content:'.page{max-width:none!important}.rang-p{overflow:visible!important}'});await p.waitForTimeout(500);const bilan=[];
for(const th of ['clair','sombre'])for(const ta of [360,600]){await p.click('#th-'+th);await p.click('#ta-'+ta);await p.waitForTimeout(250);
 for(const id of ['pret','cours','pause','toi','panne','rattrapage','relecture','fin'])for(const n of [1,2,3]){if(SEUL&&!SEUL.includes(String(n)))continue;
  const c=await p.$(`#etat-${id} .r${n}`);await c.screenshot({path:`${S}/v3/p${n}-${th}-${ta}-${id}.png`});}
 const r=await p.evaluate(()=>{
  const rgb=c=>{const s=String(c).match(/color\(srgb ([^)]+)\)/);if(s){const v=s[1].split(/[ \/]+/).filter(Boolean).map(Number);return {r:v[0]*255,g:v[1]*255,b:v[2]*255,a:v.length>3?v[3]:1};}const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1};};
  const lum=({r,g,b})=>{const t=x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4;};return .2126*t(r)+.7152*t(g)+.0722*t(b);};
  const fond=e=>{const pile=[];for(let x=e;x;x=x.parentElement){const c=rgb(getComputedStyle(x).backgroundColor);if(c&&c.a>0){pile.push(c);if(c.a>=1)break;}}
   let r=pile.pop()||{r:255,g:255,b:255,a:1};while(pile.length){const c=pile.pop();r={r:c.r*c.a+r.r*(1-c.a),g:c.g*c.a+r.g*(1-c.a),b:c.b*c.a+r.b*(1-c.a),a:1};}return r;};
  const out=[];
  for(const P of document.querySelectorAll('.cadre .p')){const R=P.getBoundingClientRect(),nom=P.className.split(' ')[1]+'/'+P.dataset.etat;
   for(const e of P.querySelectorAll('*')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();if(!r.width)continue;
    if(r.right>R.right+.5||r.bottom>R.bottom+.5||r.left<R.left-.5)out.push(nom+' SORT '+(e.className.baseVal??e.className??e.tagName)+' '+Math.round(r.right-R.right)+','+Math.round(r.bottom-R.bottom));
    if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible')out.push(nom+' TRONQUE '+e.className);
    const par=e.parentElement.getBoundingClientRect();if(e.tagName!=='svg'&&!e.closest('svg')&&(r.right>par.right+1)&&getComputedStyle(e).position!=='absolute')out.push(nom+' DEPASSE '+(e.className||e.tagName)+' de '+Math.round(r.right-par.right));
    if(e.closest('svg')||e.disabled||e.closest('[disabled]'))continue;
    if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const c=rgb(getComputedStyle(e).color),f=fond(e);const [a,b2]=[lum(c),lum(f)].sort((x,y)=>y-x);const k=(a+.05)/(b2+.05);
    if(k<4.5)out.push(nom+' CONTRASTE '+(e.className||e.tagName)+' '+k.toFixed(2));}
   /* chevauchements verticaux entre frères du corps */
   const corps=P.querySelector('[class$="-corps"]');if(corps&&corps.scrollHeight>corps.clientHeight+1)out.push(nom+' CORPS TROP HAUT de '+(corps.scrollHeight-corps.clientHeight));
   }
  return [...new Set(out)];});
 bilan.push(`== ${th} ${ta} : ${r.length?'\n  '+r.join('\n  '):'rien'}`);}
console.log('erreurs',err);console.log(bilan.join('\n'));await b.close();})();
