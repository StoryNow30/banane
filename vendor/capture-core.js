/* Banane 2.4: pure snapshot math. No writes to ESV objects or matrix caches. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BananeCaptureCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  const fail = s => { throw new Error(s); };
  const finite = Number.isFinite;
  const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const vector = v => {
    const a = Array.isArray(v) ? v.slice(0,3) : [v?.x,v?.y,v?.z];
    if (a.length !== 3 || !a.every(finite)) fail("Coordonnées absentes ou non finies.");
    return a;
  };
  const matrix = m => {
    const a = Array.from(m?.elements || m || []);
    if (a.length !== 16 || !a.every(finite)) fail("Matrice 4 × 4 absente ou non finie.");
    return a;
  };
  function affine(m) {
    const a = matrix(m);
    if (Math.max(Math.abs(a[3]),Math.abs(a[7]),Math.abs(a[11]),Math.abs(a[15]-1)) > 1e-12)
      fail("Transformation affine attendue.");
    return a;
  }
  function multiply(a,b) {
    const c = Array(16).fill(0);
    for(let j=0;j<4;j++) for(let i=0;i<4;i++)
      for(let k=0;k<4;k++) c[4*j+i] += a[4*k+i]*b[4*j+k];
    return c;
  }
  function inverse(m) {
    const a = matrix(m);
    const rows = Array.from({length:4},(_,i)=>[
      a[i],a[4+i],a[8+i],a[12+i],...Array.from({length:4},(_,j)=>Number(i===j))
    ]);
    for(let col=0;col<4;col++) {
      let p=col;
      for(let i=col+1;i<4;i++) if(Math.abs(rows[i][col])>Math.abs(rows[p][col])) p=i;
      if(Math.abs(rows[p][col])<1e-14) fail("Matrice singulière : repère non exploitable.");
      [rows[col],rows[p]]=[rows[p],rows[col]];
      const d=rows[col][col];
      for(let j=0;j<8;j++) rows[col][j]/=d;
      for(let i=0;i<4;i++) if(i!==col) {
        const v=rows[i][col];
        for(let j=0;j<8;j++) rows[i][j]-=v*rows[col][j];
      }
    }
    return Array.from({length:16},(_,i)=>rows[i%4][4+Math.floor(i/4)]);
  }
  function point(m,p) {
    const [x,y,z]=p, w=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(!finite(w)||Math.abs(w)<1e-15) fail("Projection non finie.");
    const out=[(m[0]*x+m[4]*y+m[8]*z+m[12])/w,
      (m[1]*x+m[5]*y+m[9]*z+m[13])/w,
      (m[2]*x+m[6]*y+m[10]*z+m[14])/w];
    if(!out.every(finite)) fail("Transformation non finie.");
    return out;
  }
  const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
  function translation(p) { const m=identity();m.splice(12,3,...p);return m; }
  function rebase(m,origin) {
    const a=affine(m);for(let i=0;i<3;i++) a[12+i]-=origin[i];return a;
  }
  function compose(o) {
    if(o.matrixAutoUpdate===false) return affine(o.matrix);
    const p=vector(o.position),s=vector(o.scale);
    const q=o.quaternion, x=q?.x,y=q?.y,z=q?.z,w=q?.w;
    if(![x,y,z,w].every(finite)||Math.abs(Math.hypot(x,y,z,w)-1)>1e-6)
      fail("Quaternion absent ou non unitaire.");
    const xx=x*x, yy=y*y, zz=z*z, xy=x*y, xz=x*z, yz=y*z, wx=w*x, wy=w*y, wz=w*z;
    return [(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,
      2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,
      2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,...p,1];
  }
  function worldMatrix(o, seen=new Set()) {
    if(!o || seen.has(o) || seen.size>80) fail("Hiérarchie 3D invalide.");
    seen.add(o);
    // Respect explicitly managed world matrices; never call updateMatrix*.
    if(o.matrixWorldAutoUpdate===false) return affine(o.matrixWorld);
    const local=compose(o);
    return o.parent ? multiply(worldMatrix(o.parent,seen),local) : local;
  }
  function rotation(o) {
    const e=o.rotation;
    if(![e?.x,e?.y,e?.z].every(finite)||typeof e.order!=="string")
      fail("Rotation Euler absente.");
    return [e.x,e.y,e.z,e.order];
  }
  function railState(o) {
    return {object:o,profile:o.children[1],railMatrix:worldMatrix(o),
      profileMatrix:worldMatrix(o.children[1]),rotation:rotation(o),
      profileRotation:rotation(o.children[1])};
  }
  function equalRails(a,b,tolerance=1e-9) {
    return a.length===b.length && a.every((r,i)=>r.object===b[i].object && r.profile===b[i].profile &&
      ["railMatrix","profileMatrix"].every(k=>r[k].every((v,j)=>Math.abs(v-b[i][k][j])<=tolerance)));
  }
  function serialRail(r,origin) {
    const rm=rebase(r.railMatrix,origin),pm=rebase(r.profileMatrix,origin);
    return {positionSceneRelative:point(rm,[0,0,0]),profileOriginSceneRelative:point(pm,[0,0,0]),
      profileAxisLengthsSceneUnits:[0,4,8].map(i=>Math.hypot(pm[i],pm[i+1],pm[i+2])),
      railLocalToSceneRelative:rm,profileLocalToSceneRelative:pm,
      sceneRelativeToProfileLocal:inverse(pm),rotation:r.rotation,profileRotation:r.profileRotation};
  }
  function reference(before,after,origin,meta) {
    const rails={};
    for(let i=0;i<2;i++) {
      const a=before[i], b=after[i], initial=serialRail(a,origin),corrected=serialRail(b,origin);
      const inv=initial.sceneRelativeToProfileLocal;
      const from=point(inv,initial.positionSceneRelative), to=point(inv,corrected.positionSceneRelative);
      const d=to.map((v,j)=>v-from[j]);
      rails[i===0?"left":"right"]={initial,corrected,initialLocal:from,correctedLocal:to,
        displacementLocal:d,displacementSceneMeters:distance(initial.positionSceneRelative,corrected.positionSceneRelative),
        initialRotation:a.rotation,correctedRotation:b.rotation,
        positionChanged:distance(initial.positionSceneRelative,corrected.positionSceneRelative)>1e-8,
        rotationChanged:JSON.stringify([a.rotation,a.profileRotation])!==JSON.stringify([b.rotation,b.profileRotation]),
        observation:"État observé aux deux captures ; une absence de déplacement ne prouve pas une validation opérateur."};
    }
    return {...meta,rails};
  }
  // Support standard and interleaved BufferAttributes without calling setters.
  function attribute(a) {
    if(!a||!Number.isInteger(a.count)||a.count<0||!Number.isInteger(a.itemSize)||a.itemSize<1)
      fail("Attribut géométrique non reconnu.");
    const src=a.array||a.data?.array, stride=a.isInterleavedBufferAttribute?a.data?.stride:a.itemSize;
    const offset=a.isInterleavedBufferAttribute?a.offset:0;
    if(!ArrayBuffer.isView(src)||!Number.isInteger(stride)||stride<a.itemSize||!Number.isInteger(offset)||offset<0)
      fail("Buffer de points non disponible en mémoire CPU.");
    if(a.count && (a.count-1)*stride+offset+a.itemSize>src.length) fail("Buffer de points incomplet.");
    // Float16's Uint16 backing data must be decoded by Three's accessors.
    const getters=["getX","getY","getZ","getW"];
    function get(i,k) {
      if(k<4 && typeof a[getters[k]]==="function") return a[getters[k]](i);
      let v=src[i*stride+offset+k];
      if(a.isFloat16BufferAttribute) fail("Float16 sans accesseur de décodage.");
      if(a.normalized) {
        const type=src.constructor.name;
        const max={Uint8Array:255,Uint8ClampedArray:255,Uint16Array:65535,Uint32Array:4294967295,
          Int8Array:127,Int16Array:32767,Int32Array:2147483647}[type];
        if(max) v=Math.max(-1,v/max);
      }
      return v;
    }
    const version=a.version, dataVersion=a.data?.version,count=a.count;
    return {count:a.count,itemSize:a.itemSize,get,point:i=>[get(i,0),get(i,1),get(i,2)],
      unchanged:()=>src===(a.array||a.data?.array)&&a.count===count &&
        a.version===version&&a.data?.version===dataVersion,
      metadata:{count:a.count,itemSize:a.itemSize,arrayType:src.constructor.name,
        normalized:!!a.normalized,interleaved:!!a.isInterleavedBufferAttribute,stride,offset,version:version??null}};
  }
  return {identity,vector,matrix,affine,multiply,inverse,point,distance,translation,rebase,
    worldMatrix,rotation,railState,equalRails,serialRail,reference,attribute};
});
