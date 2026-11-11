/* Robot Forge v3.0 — conservative 2-layer grid autorouter.
 * Supports F.Cu / B.Cu and through-hole vias. This is a draft router, NOT
 * KiCad's official DRC, interactive router, netclass or impedance solver.
 */
(function(scope){
"use strict";
const LAYERS=["F.Cu","B.Cu"],STEP=1,EDGE=1.5,VIA={diameter:1.4,drill:0.6};
const validLayer=s=>LAYERS.includes(s);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function distSeg(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,z=dx*dx+dy*dy;
 if(z<1e-9)return distance(p,a);
 const f=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/z));
 return Math.hypot(p.x-a.x-f*dx,p.y-a.y-f*dy);
}
function sections(trace,padPosition,board){
 if(Array.isArray(trace.sections))return trace.sections;
 const start=padPosition(trace.a,board),end=padPosition(trace.b,board);
 return start&&end?[{layer:trace.layer||"F.Cu",points:[start,end]}]:[];
}
function segments(trace,padPosition,board){
 return sections(trace,padPosition,board).flatMap(s=>s.points.slice(1).map((to,i)=>({
  id:trace.id,layer:s.layer,width:trace.width,start:s.points[i],end:to,a:trace.a,b:trace.b
 })));
}
function validRoute(trace,board,padPosition){
 if(!trace||!validLayer(trace.layer||"F.Cu")||typeof trace.id!=="string")return false;
 if(!trace.sections&&!trace.vias)return true;
 if(!Array.isArray(trace.sections)||trace.sections.length<1||trace.sections.length>4||
    !Array.isArray(trace.vias)||trace.vias.length>3)return false;
 const start=padPosition(trace.a,board),end=padPosition(trace.b,board);
 if(!start||!end)return false;
 let previous=null,changed=0;
 for(let i=0;i<trace.sections.length;i++){
  const section=trace.sections[i];
  if(!validLayer(section.layer)||!Array.isArray(section.points)||section.points.length<2||
     section.points.length>450)return false;
  if(previous){
   if(previous.layer===section.layer)return false;
   if(distance(previous.points.at(-1),section.points[0])>1e-5)return false;
   changed++;
  }
  for(const p of section.points){
   if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
      p.x<0||p.y<0||p.x>board.width||p.y>board.height)return false;
  }
  previous=section;
 }
 if(distance(start,trace.sections[0].points[0])>1e-5||
    distance(end,trace.sections.at(-1).points.at(-1))>1e-5)return false;
 if(changed!==trace.vias.length)return false;
 for(let i=0;i<trace.vias.length;i++){
  const via=trace.vias[i],cross=trace.sections[i].points.at(-1);
  if(!via||!Number.isFinite(via.x)||!Number.isFinite(via.y)||
     distance(via,cross)>1e-5||
     via.x<EDGE||via.y<EDGE||via.x>board.width-EDGE||via.y>board.height-EDGE||
     via.diameter!==VIA.diameter||via.drill!==VIA.drill)return false;
 }
 return true;
}
function heap(){
 const a=[];return {
  push(item){a.push(item);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=item.f)break;a[i]=a[p];i=p}a[i]=item},
  pop(){if(!a.length)return null;const first=a[0],last=a.pop();if(a.length){
   let i=0;while(true){let c=i*2+1;if(c>=a.length)break;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c}a[i]=last
  }return first},
  size(){return a.length}
 };
}
function candidate(board,from,to,ctx,options={}){
 const start=ctx.padPos(from,board),end=ctx.padPos(to,board);
 if(!start||!end)return {ok:false,reason:"시작 또는 끝 패드가 없습니다."};
 const width=options.width??0.5,allowVia=options.allowVia!==false;
 const preferred=validLayer(options.layer)?options.layer:"F.Cu",maxVia=allowVia?2:0;
 const w=Math.round(board.width),h=Math.round(board.height);
 const nx=w+1,ny=h+1,layerSize=nx*ny,stepCount=layerSize*2;
 const gStart={x:Math.max(0,Math.min(w,Math.round(start.x))),y:Math.max(0,Math.min(h,Math.round(start.y)))},
  gGoal={x:Math.max(0,Math.min(w,Math.round(end.x))),y:Math.max(0,Math.min(h,Math.round(end.y)))};
 const allPads=ctx.pads(board),routePads=new Set([from,to]);
 const declared=ctx.netPlan(board),signals=new Map();
 for(const n of declared)for(const p of n.pins)signals.set(p,n.name);
 if(signals.has(from)&&signals.has(to)&&signals.get(from)!==signals.get(to))
  return {ok:false,reason:"서로 다른 논리 신호를 배선할 수 없습니다."};
 const forbiddenPads=allPads.filter(p=>!routePads.has(p.ref)&&signals.get(p.ref)!==signals.get(from));
 // Other pads may be electrically unassigned and must remain isolated.
 const occupied=board.traces.flatMap(t=>segments(t,ctx.padPos,board));
 const viaObstacles=board.traces.flatMap(t=>(t.vias||[]));
 const key=(x,y,layer,vias)=>(((vias*2+layer)*ny+y)*nx+x);
 const unpack=id=>{
  const x=id%nx,r=Math.floor(id/nx),y=r%ny,s=Math.floor(r/ny);
  return{x,y,layer:s%2,vias:Math.floor(s/2)}
 };
 const target=(p,c)=>distance(p,c);
 const clearance=width/2+0.28;
 const blocked=(x,y,layer,forVia)=>{
  if(x<EDGE||y<EDGE||x>w-EDGE||y>h-EDGE)return true;
  const p={x,y};
  if(forbiddenPads.some(a=>target(p,a)<Math.max(1.15,clearance+0.85)+(forVia?VIA.diameter/2:0)))return true;
  for(const t of occupied){
   if(forVia||LAYERS[layer]===t.layer){
    const threshold=clearance+t.width/2+(forVia?VIA.diameter/2:0);
    if(distSeg(p,t.start,t.end)<threshold)return true;
   }
  }
  for(const v of viaObstacles)if(target(p,v)<clearance+v.diameter/2+0.3)return true;
  return false;
 };
 const cached=new Map();
 const clear=(x,y,l,v=false)=>{
  if(Math.abs(x-gStart.x)<=1&&Math.abs(y-gStart.y)<=1)return true;
  if(Math.abs(x-gGoal.x)<=1&&Math.abs(y-gGoal.y)<=1)return true;
  const k=x+"|"+y+"|"+l+"|"+v;
  if(!cached.has(k))cached.set(k,!blocked(x,y,l,v));
  return cached.get(k);
 };
 const canTransition=(x,y,l)=>!blocked(x,y,0,true)&&!blocked(x,y,1,true);
 if(!clear(gStart.x,gStart.y,LAYERS.indexOf(preferred)))return {ok:false,reason:"출발 패드 주변에 배선할 공간이 없습니다."};
 const root=key(gStart.x,gStart.y,LAYERS.indexOf(preferred),0),dist=new Map([[root,0]]),parent=new Map();
 const queue=heap(),h0=(x,y)=>Math.abs(x-gGoal.x)+Math.abs(y-gGoal.y);
 queue.push({id:root,f:h0(gStart.x,gStart.y),g:0});
 let endId=null,expanded=0;
 const LIMIT=Math.min(80000,Math.max(12000,w*h*3));
 while(queue.size()&&expanded<LIMIT){
  const next=queue.pop();if(next.g!==dist.get(next.id))continue;
  const p=unpack(next.id);expanded++;
  if(p.x===gGoal.x&&p.y===gGoal.y){endId=next.id;break}
  const moves=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const [dx,dy]of moves){
   const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>w||y>h||!clear(x,y,p.layer))continue;
   const id=key(x,y,p.layer,p.vias),cost=next.g+1+(p.layer===0?0:0.04);
   if(cost+1e-9<(dist.get(id)??Infinity)){
    dist.set(id,cost);parent.set(id,next.id);queue.push({id,g:cost,f:cost+h0(x,y)});
   }
  }
  if(p.vias<maxVia&&canTransition(p.x,p.y,p.layer)){
   const newL=1-p.layer,id=key(p.x,p.y,newL,p.vias+1),cost=next.g+18;
   if(cost+1e-9<(dist.get(id)??Infinity)){
    dist.set(id,cost);parent.set(id,next.id);queue.push({id,g:cost,f:cost+h0(p.x,p.y)});
   }
  }
 }
 if(endId===null)return {ok:false,reason:"간격을 지키는 경로를 찾지 못했습니다. 부품을 이동하거나 조건을 변경하세요.",expanded};
 const nodes=[];for(let x=endId;x!==undefined;x=parent.get(x)){nodes.push(unpack(x));if(x===root)break}
 nodes.reverse();
 const same=(a,b)=>Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9;
 const sectionList=[{layer:LAYERS[nodes[0].layer],points:[{...start}]}],vias=[];
 const insert=p=>{
  const list=sectionList.at(-1).points;
  if(!same(list.at(-1),p))list.push({x:p.x,y:p.y});
 };
 insert({x:nodes[0].x,y:nodes[0].y});
 for(let i=1;i<nodes.length;i++){
  const prev=nodes[i-1],now=nodes[i],coord={x:now.x,y:now.y};
  if(now.layer!==prev.layer){
   insert({x:prev.x,y:prev.y});
   vias.push({x:now.x,y:now.y,...VIA});
   sectionList.push({layer:LAYERS[now.layer],points:[{...coord}]});
  }else insert(coord);
 }
 insert({...end});
 // Collapse collinear orthogonal segments; keep pad-to-grid anchor.
 for(const section of sectionList){
  const points=section.points,compact=[];
  for(const p of points){
   while(compact.length>=2){
    const a=compact.at(-2),b=compact.at(-1),cross=(b.x-a.x)*(p.y-b.y)-(b.y-a.y)*(p.x-b.x);
    if(Math.abs(cross)<1e-8&&(b.x-a.x)*(p.x-b.x)+(b.y-a.y)*(p.y-b.y)>=-1e-8)compact.pop();
    else break;
   }
   compact.push(p);
  }
  section.points=compact;
 }
 if(sectionList.some(s=>s.points.length<2))return {ok:false,reason:"너무 짧은 경로로 비아 연결을 구성할 수 없습니다."};
 const trace={id:options.id||("A"+Date.now().toString(36)+"-"+Math.floor(Math.random()*100000).toString(36)),
 a:from,b:to,width,layer:preferred,sections:sectionList,vias};
 if(!validRoute(trace,board,ctx.padPos))return {ok:false,reason:"생성된 경로가 내부 구조 검사에서 거부됐습니다."};
 return {ok:true,trace,expanded,viaCount:vias.length};
}
function run(board,ctx,opts={}){
 const b=JSON.parse(JSON.stringify(board)),success=[],failed=[],plans=ctx.netPlan(b);
 const limit=Math.max(1,Math.min(24,Number(opts.maxRoutes)||24));
 let index=0;
 for(const net of plans){
  // Find independent connected groups as routes are added.
  const pinIds=net.pins.slice();
  for(let i=1;i<pinIds.length&&index<limit;i++){
   const groups=ctx.unionNets(b).netNames;
   const pair=new Set([pinIds[0],pinIds[i]]);
   if(groups.some(g=>[...pair].every(p=>g.pads.includes(p))))continue;
   const r=candidate(b,pinIds[0],pinIds[i],ctx,{width:opts.width??0.5,layer:opts.layer||"F.Cu",allowVia:opts.allowVia!==false,id:"AUTO"+(Date.now().toString(36))+"-"+index});
   index++;
   if(r.ok){b.traces.push(r.trace);success.push({net:net.name,pinA:pinIds[0],pinB:pinIds[i],viaCount:r.viaCount})}
   else failed.push({net:net.name,pinA:pinIds[0],pinB:pinIds[i],reason:r.reason});
  }
 }
 return {board:b,success,failed,allConnected:failed.length===0&&ctx.netPlan(b).every(n=>{
  const groups=ctx.unionNets(b).netNames;
  return groups.some(g=>n.pins.every(p=>g.pads.includes(p)));
 })};
}
scope.robotForgeRouter={LAYERS,VIA,validRoute,sections,segments,candidate,run,distSeg};
})(typeof window!=="undefined"?window:this);
