'use strict';
/* CH-064 : comparaison STRICTE de deux valeurs JS, sans normalisation (banc de parité, aller-retour VBA).
 * Égales seulement si : mêmes types ; nombres égaux par Object.is (−0, NaN) ; tableaux de même longueur, mêmes trous ;
 * objets de même prototype (simple ou nul), mêmes clés DANS LE MÊME ORDRE, clé absente ≠ clé à undefined ; erreurs de
 * même constructeur et même message. Rend la liste des écarts (chemin, raison), bornée à `max`. */
function ulp(a,b){if(!Number.isFinite(a)||!Number.isFinite(b))return null;const f=new Float64Array([a,b]),i=new BigInt64Array(f.buffer);
 const o=x=>x<0n?-(x&0x7fffffffffffffffn):x;const d=o(i[0])-o(i[1]);return Number(d<0n?-d:d);}
function comparer(a,b,{max=20}={}){
 const ecarts=[];
 const ecart=(chemin,raison)=>{ecarts.push({chemin:chemin||'(racine)',raison});return ecarts.length>=max;};
 function voir(x,y,chemin){
  if(typeof x!==typeof y)return ecart(chemin,'type '+typeof x+' ≠ '+typeof y);
  if(typeof x==='number'){if(!Object.is(x,y)){const u=ulp(x,y);return ecart(chemin,'nombre '+x+' ≠ '+y+(u!==null?' ('+u+' ulp)':''));}return false;}
  if(typeof x!=='object'||x===null||y===null){if(x!==y)return ecart(chemin,'valeur '+String(x).slice(0,60)+' ≠ '+String(y).slice(0,60));return false;}
  if(x instanceof Error||y instanceof Error){if(!(x instanceof Error&&y instanceof Error)||x.constructor!==y.constructor||x.message!==y.message)return ecart(chemin,'erreur '+(x&&x.constructor&&x.constructor.name)+':'+x.message+' ≠ '+(y&&y.constructor&&y.constructor.name)+':'+y.message);return false;}
  const ax=Array.isArray(x),ay=Array.isArray(y);
  if(ax!==ay)return ecart(chemin,'tableau ≠ objet');
  if(ax){if(x.length!==y.length)return ecart(chemin,'longueur '+x.length+' ≠ '+y.length);
   for(let i=0;i<x.length;i++){const hx=i in x,hy=i in y;if(hx!==hy){if(ecart(chemin+'['+i+']','trou ≠ élément'))return true;continue;}if(voir(x[i],y[i],chemin+'['+i+']'))return true;}
   const kx=Object.keys(x).length,ky=Object.keys(y).length;if(kx!==ky)return ecart(chemin,'propriétés non indicielles');return false;}
  if(Object.getPrototypeOf(x)!==Object.getPrototypeOf(y))return ecart(chemin,'prototype différent');
  const kx=Object.keys(x),ky=Object.keys(y);
  if(kx.length!==ky.length||kx.some((k,i)=>k!==ky[i]))return ecart(chemin,'clés '+JSON.stringify(kx).slice(0,120)+' ≠ '+JSON.stringify(ky).slice(0,120));
  for(const k of kx)if(voir(x[k],y[k],chemin+'.'+k))return true;
  return false;
 }
 voir(a,b,'');return ecarts;
}
module.exports={comparer,ulp};
