const id=cut=>({pageId:'page',frameId:'frame',shape:'U50',projectId:'project',part:23,cut});
function journal(){const ctx={sessionId:'S',batchId:'B',clockId:'clock',visitId:'visit',identity:id(100),captureId:'capture',analysisId:'analysis'};
 const make=(kind,ms,detail={})=>({type:'phase-timing',schema:1,timeOrigin:1000,eventId:String(Math.random()),...ctx,kind,ms,...detail});
 const point=(name,ms)=>make('point',ms,{point:name});
 const events=[make('batch',-10,{visitId:null,identity:null,point:'start',knownBoundary:true}),
  make('visit',0,{point:'open',navigationMs:0,navigationReason:'observed-target'}),point('capture-received',100),
  make('span',210,{label:'v46-pair-complete',fromMs:130,toMs:210,success:true,inputKind:'initial'}),
  make('span',240,{label:'v46-scientific',fromMs:200,toMs:240,success:true,inputKind:'initial'}),
  point('proposed',300),point('decision',350),point('pose-readback',1000),
  make('span',1100,{label:'after-state-read',fromMs:1050,toMs:1100}),point('after-read',1100),point('accepted',1500),
  point('next-observed',1600),make('batch',1610,{visitId:null,identity:null,point:'end',knownBoundary:true}),
  make('health',1611,{visitId:null,identity:null,visits:1,lost:0,emitted:13,requestsPending:0,finalSnapshot:true,instrumentationMs:1})];
 events.forEach((e,i)=>{e.batchSeq=i+1;e.seq=i+1;});return {state:{sessionId:'S',batch:{id:'B',sequence:[{identity:id(100)}]}},events};
}
module.exports={journal,id};
