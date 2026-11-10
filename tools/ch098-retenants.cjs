#!/usr/bin/env node
'use strict';
/* CH-098 — retenants d'un instantané du tas (fichier .heapsnapshot du protocole de débogage, écrit par tools/ch098-memoire.cjs --brut).
 * Pour chaque gros nœud (taille propre ≥ --min octets, 64 Ko par défaut) et pour l'ensemble des tableaux internes, remonte le premier chemin
 * de rétention vers une racine (arêtes faibles ignorées) et regroupe les octets par chemin résumé (« constructeur.propriété » sur 6 étages).
 *   node tools/ch098-retenants.cjs INSTANTANE.heapsnapshot [--min 65536] [--n 20] */
const fs=require('node:fs');
const a=process.argv.slice(2),fichier=a[0],opt=k=>{const i=a.indexOf('--'+k);return i>=0?Number(a[i+1]):null;};
const MIN=opt('min')??65536,TOP=opt('n')??20;
const s=JSON.parse(fs.readFileSync(fichier,'utf8')),m=s.snapshot.meta,NF=m.node_fields.length,EF=m.edge_fields.length;
const iT=m.node_fields.indexOf('type'),iN=m.node_fields.indexOf('name'),iS=m.node_fields.indexOf('self_size'),iE=m.node_fields.indexOf('edge_count');
const eT=m.edge_fields.indexOf('type'),eN=m.edge_fields.indexOf('name_or_index'),eTo=m.edge_fields.indexOf('to_node');
const nTypes=m.node_types[0],eTypes=m.edge_types[0],N=s.nodes.length/NF;
const premier=new Uint32Array(N+1);for(let i=0,e=0;i<N;i++){premier[i]=e;e+=s.nodes[i*NF+iE]*EF;}premier[N]=s.edges.length;
/* Retenant : pour chaque nœud, un parent (première arête forte rencontrée en largeur depuis la racine 0) → plus court chemin. */
const parent=new Int32Array(N).fill(-1),arete=new Int32Array(N).fill(-1),file=new Int32Array(N);let t=0,q=0;file[q++]=0;parent[0]=0;
while(t<q){const i=file[t++];for(let e=premier[i];e<premier[i+1];e+=EF){const ty=eTypes[s.edges[e+eT]];if(ty==='weak'||ty==='shortcut')continue;
 const j=s.edges[e+eTo]/NF;if(parent[j]<0){parent[j]=i;arete[j]=e;file[q++]=j;}}}
const nom=i=>{const ty=nTypes[s.nodes[i*NF+iT]];return ty==='object'||ty==='native'||ty==='closure'?s.strings[s.nodes[i*NF+iN]].slice(0,40):'('+ty+')';};
const nomArete=e=>{const ty=eTypes[s.edges[e+eT]],v=s.edges[e+eN];return ty==='element'||ty==='hidden'?'['+v+']':String(s.strings[v]).slice(0,30);};
function chemin(i,etages=6){const out=[];let k=i;for(let n=0;n<etages&&k>0&&parent[k]>=0&&parent[k]!==k;n++){out.push(nomArete(arete[k]).replace(/^\[\d+\]$/,'[i]'));k=parent[k];out.push(nom(k));}return out.reverse().join(' > ');}
const gros=[],groupes=new Map();
for(let i=0;i<N;i++){const o=s.nodes[i*NF+iS];const ty=nTypes[s.nodes[i*NF+iT]];
 if(o>=MIN)gros.push({i,o});if(ty==='array'||o>=MIN){const c=chemin(i,4);const g=groupes.get(c)||{o:0,n:0};g.o+=o;g.n++;groupes.set(c,g);}}
console.log(`# nœuds ${N}, joignables ${q}`);
console.log('## plus gros nœuds');for(const x of gros.sort((a,b)=>b.o-a.o).slice(0,TOP))console.log(Math.round(x.o/1024)+' Ko',nom(x.i),'←',chemin(x.i));
console.log('## octets par chemin de rétention (tableaux internes et gros nœuds)');for(const [c,g] of [...groupes].sort((a,b)=>b[1].o-a[1].o).slice(0,TOP))console.log(Math.round(g.o/1024)+' Ko',g.n,c);
