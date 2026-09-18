#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

function args(argv){
 const out={dataset:null,capsule:null,output:path.resolve('audit/gcv1-runtime-shadow-parity239.json')};
 for(let i=2;i<argv.length;i++){
  const a=argv[i];
  if(a==='--dataset')out.dataset=path.resolve(argv[++i]);
  else if(a==='--capsule')out.capsule=path.resolve(argv[++i]);
  else if(a==='--out'||a==='--output')out.output=path.resolve(argv[++i]);
  else throw Error('argument inconnu : '+a);
 }
 if(!out.dataset)throw Error('manque --dataset');
 if(!out.capsule)throw Error('manque --capsule');
 return out;
}
function num(a,b,tol=1e-12){
 if(a==null||b==null)return a==null&&b==null;
 return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol;
}
function delta(a,b,tol=1e-12){
 if(a==null||b==null)return a==null&&b==null;
 return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>num(x,b[i],tol));
}
function comparePub(label,got,exp,issues){
 for(const k of ['status','motif'])if((got?.[k]??null)!==(exp?.[k]??null))issues.push({field:label+'.'+k,got:got?.[k]??null,expected:exp?.[k]??null});
 if(!delta(got?.delta??null,exp?.delta??null))issues.push({field:label+'.delta',got:got?.delta??null,expected:exp?.delta??null});
 for(const k of ['loss','topRows','faceCount'])if(!num(got?.[k]??null,exp?.[k]??null))issues.push({field:label+'.'+k,got:got?.[k]??null,expected:exp?.[k]??null});
 if(!!got?.slopeLimited!==!!exp?.slopeLimited)issues.push({field:label+'.slopeLimited',got:!!got?.slopeLimited,expected:!!exp?.slopeLimited});
}
function main(){
 const a=args(process.argv);
 const root=path.resolve(__dirname,'..');
 const Shadow=require(path.join(root,'src/gcv1-shadow.js'));
 const cap=path.join(a.capsule,'replication/geometry-candidate-v1');
 const Next=require(path.join(cap,'pinned/tools/geometry-engine-next-v0.cjs'));
 const N=require(path.join(cap,'pinned/tools/materialized-native.cjs'));
 const lock=Next.loadLock239();
 const failure=new Set(lock.failureKeys),control=new Set(lock.controlKeys);
 const keys=[...lock.failureKeys,...lock.controlKeys];
 if(keys.length!==239)throw Error('lock != 239');
 const {base,docs,visits}=N.readVisits(a.dataset);
 const pack=Next.assembleKeys(visits,keys,docs,base);
 const assembled=pack.rails.filter(r=>r.assembled?.ready).length;
 if(assembled!==239)throw Error('population assemblee '+assembled+'/239');

 const rails=[],mismatches=[];
 for(const item of pack.rails){
  const role=failure.has(item.key)?'failure':control.has(item.key)?'control':'unknown';
  const expected=Next.analyseAssembled(item,role);
  const got=Shadow.scientificProposeBoth(item.assembled.capture).rails[item.side];
  const issues=[];
  if(!expected.ok)issues.push({field:'expected.ok',got:got?.ok??null,expected:false});
  if(!got?.ok)issues.push({field:'got.ok',got:got?.ok??null,expected:true,error:got?.error||got?.reason||null});
  if(expected.ok&&got?.ok){
   comparePub('v46',got.v46,expected.engine,issues);
   comparePub('astar',got.astar,expected.astar,issues);
   comparePub('next',got.next,expected.next,issues);
   for(const k of ['activated','changed','nClusters','nStrongCompetitive']){
    const gv=got.next?.[k]??null,ev=expected.next?.[k]??null;
    if(gv!==ev)issues.push({field:'next.'+k,got:gv,expected:ev});
   }
   if(!!got.s1Activated!==!!expected.s1Activated)issues.push({field:'s1Activated',got:!!got.s1Activated,expected:!!expected.s1Activated});
   if(!!got.s1Changed!==!!expected.s1Changed)issues.push({field:'s1Changed',got:!!got.s1Changed,expected:!!expected.s1Changed});
   if(!!got.publishedWeak!==!!expected.publishedWeak)issues.push({field:'publishedWeak',got:!!got.publishedWeak,expected:!!expected.publishedWeak});
  }
  const row={key:item.key,role,side:item.side,cut:item.cut,
    v46:got?.v46?.status||null,astar:got?.astar?.status||null,next:got?.next?.status||null,
    s1Activated:!!got?.s1Activated,s1Changed:!!got?.s1Changed,publishedWeak:!!got?.publishedWeak,
    issues};
  rails.push(row);
  if(issues.length)mismatches.push(row);
 }
 const counts={
  n:rails.length,
  failures:rails.filter(r=>r.role==='failure').length,
  controls:rails.filter(r=>r.role==='control').length,
  v46Candidate:rails.filter(r=>r.v46==='candidate').length,
  astarCandidate:rails.filter(r=>r.astar==='candidate').length,
  nextCandidate:rails.filter(r=>r.next==='candidate').length,
  recovered:rails.filter(r=>r.role==='failure'&&r.v46!=='candidate'&&r.next==='candidate').length,
  recoveredAstar:rails.filter(r=>r.role==='failure'&&r.v46!=='candidate'&&r.astar==='candidate').length,
  recoveredByS1AfterAstar:rails.filter(r=>r.role==='failure'&&r.astar!=='candidate'&&r.next==='candidate').length,
  controlsPublished:rails.filter(r=>r.role==='control'&&r.next==='candidate').length,
  s1Activated:rails.filter(r=>r.s1Activated).length,
  s1Changed:rails.filter(r=>r.s1Changed).length,
  publishedWeak:rails.filter(r=>r.publishedWeak).length,
  divergences:mismatches.length,
 };
 const gates={
  population:counts.n===239&&counts.failures===63&&counts.controls===176,
  candidateCounts:counts.v46Candidate===176&&counts.astarCandidate===197&&counts.nextCandidate===201,
  recoveries:counts.recovered===25&&counts.recoveredAstar===23&&counts.recoveredByS1AfterAstar===2,
  controls:counts.controlsPublished===176,
  s1:counts.s1Activated===42&&counts.s1Changed===4,
  weak:counts.publishedWeak===0,
  parity:counts.divergences===0,
 };
 const pass=Object.values(gates).every(Boolean);
 const report={format:'gcv1-runtime-shadow-parity239-v1',generatedAt:new Date().toISOString(),
  integration:{branch:'integration/gcv1-runtime-shadow-v1',candidate:Shadow.CONTRACT},
  reference:{capsule:path.resolve(a.capsule),dataset:path.resolve(a.dataset)},
  assembled,chunksLoaded:pack.chunksLoaded,chunksNeeded:pack.chunksNeeded,
  counts,gates,pass,mismatches:mismatches.slice(0,50)};
 fs.mkdirSync(path.dirname(a.output),{recursive:true});
 fs.writeFileSync(a.output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass,counts,gates,output:a.output},null,2));
 if(!pass)process.exitCode=2;
}
main();
