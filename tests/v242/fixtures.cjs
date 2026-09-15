const C=require('../capture-core.js');
function object(position=[0,0,0],type='Object3D',angle=0,scale=[1,1,1]) {
  const o={type,visible:true,position:{x:position[0],y:position[1],z:position[2]},
    scale:{x:scale[0],y:scale[1],z:scale[2]},quaternion:{x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)},
    rotation:{x:0,y:0,z:angle,order:'ZYX'},matrixAutoUpdate:true,children:[],parent:null,
    updateMatrix(){throw Error('Unexpected scene write');},updateWorldMatrix(){throw Error('Unexpected scene write');},
    updateMatrixWorld(){throw Error('Unexpected scene write');}};
  o.matrixWorld={elements:C.worldMatrix(o)};return o;
}
function add(parent,child){parent.children.push(child);child.parent=parent;child.matrixWorld={elements:C.worldMatrix(child)};return child;}
function buffer(rows) {
  const itemSize=rows[0]?.length||3,array=Float32Array.from(rows.flat());
  return {array,itemSize,count:rows.length,version:0,normalized:false};
}
function rail(y,origin=[513237,6638161,60],angle=.25) {
  const r=object([origin[0],origin[1]+y,origin[2]],'Object3D',angle);
  add(r,object([0,0,0],'Mesh'));
  const p=add(r,object([0,0,0]));
  const line=add(p,object([0,0,0],'Line'));
  line.geometry={attributes:{position:buffer([[0,0,0],[0,.035,0],[0,.035,-.05]])}};
  return r;
}
function scene() {
  const left=rail(0),right=rail(1.435),root=object([0,0,0],'Scene');add(root,left);add(root,right);
  const camera=object([513237,6638161,63],'OrthographicCamera');
  camera.projectionMatrix={elements:C.identity()};
  const mesh=object([513237,6638161,60],'Points');mesh.isPoints=true;
  mesh.geometry={attributes:{position:buffer([[0,.01,.02],[.1,-.03,-.06],[0,1.4,.03],[.1,1.42,0],[100,100,100]])},drawRange:{start:0,count:Infinity}};
  const pc=object([0,0,0],'PointCloudOctree');pc.visibleNodes=[{sceneNode:mesh}];pc.material={clipBoxes:[],clipTask:0,clipMethod:0};
  const viewer={scene:{scene:root,pointclouds:[pc],getActiveCamera:()=>camera},renderer:{domElement:{getBoundingClientRect:()=>({left:10,top:20,width:800,height:600})}}};
  const markers=[0,1.435].map((y,i)=>{
    const m=object([513237,6638161+y,60],'Mesh');m.geometry={type:'SphereGeometry',parameters:{radius:.0015}};
    m.material={color:{getHex:()=>[16302520,10606282][i]}};add(root,m);return m;
  });
  return {viewer,left,right,root,mesh,pc,camera,markers};
}
const enums={ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}};
module.exports={object,add,buffer,rail,scene,enums};
