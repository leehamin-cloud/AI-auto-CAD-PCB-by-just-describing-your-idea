
"use strict";
/* Robot Forge static workspace: local browser mesh sandbox. Not a cloud CAD kernel. */
const KEY="robotforge.workspace.v1.9";
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=(x,n=1)=>Number(x).toLocaleString("en-US",{maximumFractionDigits:n});
const density={aluminum:2.7,petg:1.27,steel:7.85};
const limits={
 arm:[["link1","Upper link length",40,500,1,"mm"],["link2","Forearm length",40,500,1,"mm"],["base","Base diameter (approx.)",45,220,1,"mm"],["width","Link width",8,90,1,"mm"],["thickness","Link thickness",4,60,1,"mm"],["angle1","Shoulder angle",-160,160,1,"°"],["angle2","Elbow angle",-160,160,1,"°"],["payload","Payload",0,1500,10,"g"]],
 plate:[["length","Plate length",50,450,1,"mm"],["width","Plate width",40,400,1,"mm"],["thickness","Thickness",2,80,1,"mm"],["hole_count","Mounting holes",0,4,1,"개"],["hole_diameter","Hole diameter",3,24,.5,"mm"],["offset_x","Hole inset X",8,90,1,"mm"],["offset_y","Hole inset Y",8,90,1,"mm"]],
 block:[["length","Block length",20,450,1,"mm"],["width","Block width",20,400,1,"mm"],["height","Block height",10,200,1,"mm"]],
 bracket:[["length","Bracket base length",30,400,1,"mm"],["width","Bracket width",20,200,1,"mm"],["height","Bracket height",25,350,1,"mm"],["thickness","Wall thickness",3,50,1,"mm"]],
 shaft:[["length","Shaft length",20,450,1,"mm"],["diameter","Shaft diameter",5,150,1,"mm"]]
};
const defaults={
 arm:{link1:128,link2:104,base:80,width:24,thickness:12,angle1:34,angle2:-28,payload:200},
 plate:{length:160,width:100,thickness:8,hole_count:4,hole_diameter:8,offset_x:20,offset_y:20},
 block:{length:100,width:65,height:48},
 bracket:{length:100,width:55,height:78,thickness:9},
 shaft:{length:135,diameter:22}
};
const modelNames={arm:"2-DOF Research Arm",plate:"Drilled Mounting Plate",block:"Parametric Solid Block",bracket:"L Mounting Bracket",shaft:"Solid Round Shaft"};
const modelSubtitles={arm:"2 revolute joints · visual mesh",plate:"Parametric through-holes · closed mesh",block:"Simple rectangular volume",bracket:"90° solid L bracket · closed mesh",shaft:"Round solid shaft · closed mesh"};
const colors=["#67b8ef","#86cdf6","#c7e8ff","#4c99ce","#9dd8f7","#72aed9","#7aaec9"];
function makeProject(name){
 const model="arm", params=clone(defaults.arm), material="aluminum";
 const initial={model,params:clone(params),material,label:"Initial state",time:Date.now()};
 return {id:"rf-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),name:String(name||"Untitled project").slice(0,70),model,params,material,hiddenParts:[],history:[initial],cursor:0};
}
let projects=[],activeId="",panel="cad",inspect="properties",cam={yaw:-0.95,pitch:0.46,zoom:1.1,panX:0,panY:0},grid=true,edges=false,selectedPart=null,activeBottom="events",events=[],parts=[],toastTimer,dragging=false,downPoint=null,dragMoved=false;
function safeProject(obj){
 if(!obj||typeof obj!=="object"||!Object.hasOwn(limits,obj.model))throw Error("Unsupported project format");
 const p=makeProject(obj.name||"Imported project");p.model=obj.model;p.params={};
 for(const [name,,min,max] of limits[p.model]){const v=Number(obj.params?.[name]);p.params[name]=Number.isFinite(v)&&v>=min&&v<=max&&(name!=="hole_count"||[0,1,2,4].includes(v))?v:defaults[p.model][name]}
 if(validateDesign(p.model,p.params))p.params=clone(defaults[p.model]);
 p.material=Object.hasOwn(density,obj.material)?obj.material:"aluminum";
 p.history=[{model:p.model,params:clone(p.params),material:p.material,label:"Imported scene",time:Date.now()}];p.cursor=0;
 return p;
}
function load(){
 try{const data=JSON.parse(localStorage.getItem(KEY)||"null");if(data&&Array.isArray(data.projects)){projects=data.projects.slice(0,30).map(safeProject);for(let i=0;i<projects.length;i++){const saved=data.projects[i];const p=projects[i];if(saved?.id&&typeof saved.id==="string")p.id=saved.id.slice(0,90);if(Array.isArray(saved?.history)){const cleaned=[];for(const h of saved.history.slice(-30)){try{const v=safeProject(h);cleaned.push({model:v.model,params:v.params,material:v.material,label:String(h.label||"Revision").slice(0,90),time:Number(h.time)||Date.now()})}catch{}}if(cleaned.length){p.history=cleaned;p.cursor=Math.max(0,Math.min(Number(saved.cursor)||0,cleaned.length-1));const snap=p.history[p.cursor];p.model=snap.model;p.params=clone(snap.params);p.material=snap.material;}}p.hiddenParts=Array.isArray(saved?.hiddenParts)?saved.hiddenParts.filter(x=>typeof x==="string").slice(0,50):[];}
 activeId=projects.some(p=>p.id===data.activeId)?data.activeId:projects[0]?.id;
 }}catch(e){console.warn("Local project cache reset",e.message)}
 if(!projects.length){const p=makeProject("나의 첫 로봇");projects=[p];activeId=p.id}
}
function current(){return projects.find(p=>p.id===activeId)||projects[0]}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({activeId,projects}));$("#saveState").textContent="● Saved locally";return true}catch(e){$("#saveState").textContent="● Storage blocked";notify("Browser storage is unavailable. Export a JSON backup.",true);return false}}
function stamp(){return new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function log(kind,message,warning=false){events.unshift({time:stamp(),kind,message,warning});events=events.slice(0,100);renderLogs();$("#statusMessage").textContent=message}
function notify(message,error=false){const el=$("#toast");el.textContent=message;el.classList.toggle("error",error);el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3300)}
function snapshot(label){const p=current();return {model:p.model,params:clone(p.params),material:p.material,label,time:Date.now()}}
function mutate(fn,label){const p=current();fn(p);p.history=p.history.slice(0,p.cursor+1);p.history.push(snapshot(label));if(p.history.length>30)p.history.shift();p.cursor=p.history.length-1;p.hiddenParts=[];selectedPart=null;persist();refresh();log("EDIT",label)}
function restore(index){const p=current();if(index<0||index>=p.history.length)return;const h=p.history[index];p.cursor=index;p.model=h.model;p.params=clone(h.params);p.material=h.material;p.hiddenParts=[];selectedPart=null;persist();refresh();log("HISTORY","Restored: "+h.label)}
function undo(){const p=current();if(p.cursor>0){restore(p.cursor-1);notify("Reverted to previous revision")}else notify("Already at the first revision")}
function redo(){const p=current();if(p.cursor<p.history.length-1){restore(p.cursor+1);notify("Reapplied revision")}else notify("No newer revision")}
function newProject(name){const p=makeProject(name);projects.push(p);activeId=p.id;selectedPart=null;persist();refresh();log("PROJECT","Created "+p.name);notify("New local project created");return p}
function renderLogs(){const el=$("#eventLog");el.innerHTML=events.map(x=>'<div class="event-row'+(x.warning?' warn':'')+'"><span class="event-time">'+esc(x.time)+'</span><span class="event-kind">'+esc(x.kind)+'</span><span class="event-text">'+esc(x.message)+'</span></div>').join("");$("#activityCount").textContent=String(events.length)}
function renderChecks(){const isArm=current().model==="arm";const rows=[
 ["삼각형 메시 생성","생성됨"],["메시 닫힘·면 방향",meshDiagnostics(parts).closed?"검사 통과":"추가 점검 필요"],["치수 범위 검사","완료"],["STL 메시 저장","가능"],["B-rep / STEP kernel","NOT CONNECTED"],["PCB ERC / DRC","NOT EXECUTED"],["Physical engineering safety","UNVERIFIED"]
 ];if(isArm)rows.splice(3,0,["Two-joint gravity model","ANALYTIC ONLY"]);
 $("#checkList").innerHTML=rows.map(x=>'<div class="check-row"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join("")}
const add3=(a,b)=>a.map((v,i)=>v+b[i]);
const sub3=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{let L=Math.hypot(...v)||1;return v.map(x=>x/L)};
function tri(v0,v1,v2){return [v0,v1,v2]}
function boxPart(id,label,center,size,angle,color){
 const [L,W,H]=size, hx=L/2,hy=W/2,hz=H/2,cs=Math.cos(angle),sn=Math.sin(angle);
 const raw=[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]];
 const vertices=raw.map(([x,y,z])=>[center[0]+x*cs+z*sn,center[1]+y,center[2]-x*sn+z*cs]);
 const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 const triangles=[];for(const f of faces){triangles.push(tri(vertices[f[0]],vertices[f[1]],vertices[f[2]]),tri(vertices[f[0]],vertices[f[2]],vertices[f[3]]))}
 return {id,label,color,triangles,volume:L*W*H};
}
function cylinderPart(id,label,center,r,length,color,segments=20){
 const triangles=[],y0=center[1]-length/2,y1=center[1]+length/2;
 for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,p0=[center[0]+r*Math.cos(a),y0,center[2]+r*Math.sin(a)],p1=[center[0]+r*Math.cos(b),y0,center[2]+r*Math.sin(b)],q0=[p0[0],y1,p0[2]],q1=[p1[0],y1,p1[2]];
 triangles.push(tri(p0,q1,p1),tri(p0,q0,q1),tri([center[0],y0,center[2]],p0,p1),tri([center[0],y1,center[2]],q1,q0));
 }return {id,label,color,triangles,volume:Math.PI*r*r*length};
}

/* Feature-aware closed triangle meshes (browser preview; not an OCC B-rep). */
function validateDesign(model,a){
 if(!Object.hasOwn(limits,model))return "지원하지 않는 형상입니다.";
 if(!Object.values(a).every(Number.isFinite))return "모든 치수는 유효한 숫자여야 합니다.";
 if(model==="bracket"&&a.thickness>=Math.min(a.height,a.length)/2)return "ㄱ자 브래킷의 두께가 너무 큽니다. 길이·높이의 절반보다 작게 설정하세요.";
 if(model==="plate"){
  if(![0,1,2,4].includes(a.hole_count))return "구멍 수는 0, 1, 2, 4개 중에서 선택하세요.";
  if(a.hole_count>0){
   const r=a.hole_diameter/2,web=2;
   if(a.hole_count===1){
    if(a.length/2<=r+web||a.width/2<=r+web)return "판이 구멍 크기에 비해 너무 작습니다.";
   }else{
    if(a.offset_x<=r+web||a.length/2-a.offset_x<=r+web)return "구멍이 판의 가로나 중앙에 너무 가깝습니다. 좌우 여백을 늘려주세요.";
    if(a.hole_count===4&&(a.offset_y<=r+web||a.width/2-a.offset_y<=r+web))return "구멍이 판의 세로나 중앙에 너무 가깝습니다. 위아래 여백을 늘려주세요.";
    if(a.hole_count===2&&a.width/2<=r+web)return "판의 세로 폭을 더 크게 설정하세요.";
   }
  }
 }
 return null;
}
function meshPlatePart(a){
 const L=a.length,W=a.width,H=a.thickness,N=a.hole_count,r=a.hole_diameter/2,segments=12;
 if(N===0)return boxPart("plate","Mounting plate (no holes)",[0,0,H/2],[L,W,H],0,colors[0]);
 const xs=N===1?[-L/2,L/2]:[-L/2,0,L/2],ys=N===4?[-W/2,0,W/2]:[-W/2,W/2];
 const triangles=[],circleCenters=[];
 function T(p,q,v,z){return tri([p[0],p[1],z],[q[0],q[1],z],[v[0],v[1],z])}
 function capTriangle(p,q,v){
  triangles.push(T(p,q,v,H),T(v,q,p,0));
 }
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const x0=xs[i],x1=xs[i+1],y0=ys[j],y1=ys[j+1];
  const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const cx=N===1?0:(i===0?-1:1)*(L/2-a.offset_x);
  const cy=N===4?(j===0?-1:1)*(W/2-a.offset_y):0;
  circleCenters.push([cx,cy]);
  const angles=corners.map(([x,y])=>Math.atan2(y-cy,x-cx));
  for(let k=1;k<angles.length;k++)while(angles[k]<=angles[k-1])angles[k]+=2*Math.PI;
  for(let q=0;q<4;q++){
   const a0=angles[q],a1=q===3?angles[0]+2*Math.PI:angles[q+1];
   const c0=corners[q],c1=corners[(q+1)%4],verts=[c0,c1];
   for(let k=segments;k>=0;k--){const angle=a0+(a1-a0)*k/segments;verts.push([cx+r*Math.cos(angle),cy+r*Math.sin(angle)])}
   for(let k=1;k<verts.length-1;k++)capTriangle(verts[0],verts[k],verts[k+1]);
   for(let k=0;k<segments;k++){
    const t0=a0+(a1-a0)*k/segments,t1=a0+(a1-a0)*(k+1)/segments;
    const aP=[cx+r*Math.cos(t0),cy+r*Math.sin(t0)],bP=[cx+r*Math.cos(t1),cy+r*Math.sin(t1)];
    // Bore normals point inward, toward the material void.
    triangles.push(tri([aP[0],aP[1],0],[aP[0],aP[1],H],[bP[0],bP[1],H]));
    triangles.push(tri([aP[0],aP[1],0],[bP[0],bP[1],H],[bP[0],bP[1],0]));

   }
  }
  // Vertical faces only at the external perimeter; never across internal cells.
  for(let q=0;q<4;q++){
   const outer=[j===0,i===xs.length-2,j===ys.length-2,i===0][q];
   if(!outer)continue;
   const c0=corners[q],c1=corners[(q+1)%4];
   triangles.push(tri([c0[0],c0[1],0],[c1[0],c1[1],0],[c1[0],c1[1],H]));
   triangles.push(tri([c0[0],c0[1],0],[c1[0],c1[1],H],[c0[0],c0[1],H]));
  }
 }
 // Nominal cylinder volume estimate; exported bore walls use tessellated circles.
 const polygonRemovedArea=circleCenters.length*Math.PI*r*r;
 return {id:"plate",label:"Mounting plate with "+N+" through-holes",color:colors[0],triangles,volume:(L*W-polygonRemovedArea)*H};
}
function earClip2d(poly){
 const ids=poly.map((_,i)=>i),faces=[];
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const inside=(p,a,b,c)=>orient(a,b,p)>=-1e-7&&orient(b,c,p)>=-1e-7&&orient(c,a,p)>=-1e-7;
 let guard=0;
 while(ids.length>3&&guard++<100){
  let found=false;
  for(let i=0;i<ids.length;i++){
   const ia=ids[(i+ids.length-1)%ids.length],ib=ids[i],ic=ids[(i+1)%ids.length];
   if(orient(poly[ia],poly[ib],poly[ic])<1e-9)continue;
   if(ids.some(d=>d!==ia&&d!==ib&&d!==ic&&inside(poly[d],poly[ia],poly[ib],poly[ic])))continue;
   faces.push([ia,ib,ic]);ids.splice(i,1);found=true;break;
  }
  if(!found)throw Error("L bracket cap could not be triangulated");
 }
 if(ids.length===3)faces.push(ids);
 return faces;
}
function meshBracketPart(a){
 const {length:L,width:W,height:H,thickness:T}=a;
 const poly=[[-L/2,0],[L/2,0],[L/2,H],[L/2-T,H],[L/2-T,T],[-L/2,T]];
 const faces=earClip2d(poly),triangles=[],y0=-W/2,y1=W/2;
 const v=(i,y)=>[poly[i][0],y,poly[i][1]];
 for(const [a,b,c] of faces){triangles.push(tri(v(a,y0),v(b,y0),v(c,y0)));triangles.push(tri(v(c,y1),v(b,y1),v(a,y1)))}
 for(let i=0;i<poly.length;i++){
  const j=(i+1)%poly.length;
  triangles.push(tri(v(i,y0),v(i,y1),v(j,y1)));
  triangles.push(tri(v(i,y0),v(j,y1),v(j,y0)));
 }
 return {id:"bracket",label:"90-degree solid L bracket",color:colors[0],triangles,volume:(L*T+(H-T)*T)*W};
}
function meshDiagnostics(items){
 const report={partCount:0,triangles:0,degenerate:0,boundaryEdges:0,nonManifoldEdges:0,reversedEdges:0,closed:true};
 function key(p){return p.map(n=>Math.abs(n)<0.000005?"0.00000":Number(n).toFixed(5)).join(",")}
 for(const part of items){
  if(!part.triangles?.length)continue;report.partCount++;
  const edges=new Map();
  for(const face of part.triangles){
   report.triangles++;
   const a=sub3(face[1],face[0]),b=sub3(face[2],face[0]);
   if(Math.hypot(...cross(a,b))<1e-8)report.degenerate++;
   for(let i=0;i<3;i++){
    const f=key(face[i]),t=key(face[(i+1)%3]),k=f<t?f+"|"+t:t+"|"+f;
    const v=edges.get(k)||{n:0,dir:0};
    v.n++;v.dir+=f<t?1:-1;edges.set(k,v);
   }
  }
  for(const edge of edges.values()){
   if(edge.n===1)report.boundaryEdges++;
   else if(edge.n!==2)report.nonManifoldEdges++;
   else if(edge.dir!==0)report.reversedEdges++;
  }
 }
 report.closed=report.degenerate===0&&report.boundaryEdges===0&&report.nonManifoldEdges===0&&report.reversedEdges===0;
 return report;
}

function buildParts(modelOverride,paramsOverride){
 const p=current(),model=modelOverride||p.model,a=paramsOverride||p.params;let out=[];
 if(model==="arm"){
  const t1=a.angle1*Math.PI/180,t2=(a.angle1+a.angle2)*Math.PI/180,L1=a.link1,L2=a.link2,w=a.width,h=a.thickness,z0=16;
  const s=[0,0,z0],j=[L1*Math.cos(t1),0,z0+L1*Math.sin(t1)],end=[j[0]+L2*Math.cos(t2),0,j[2]+L2*Math.sin(t2)];
  out.push(boxPart("base","Base platform",[0,0,0],[a.base,a.base*.8,16],0,colors[3]));
  out.push(cylinderPart("shoulder","Shoulder pivot",s,w*.63,w*1.24,colors[2]));
  out.push(boxPart("link1","Link 01 — upper",[(s[0]+j[0])/2,0,(s[2]+j[2])/2],[L1,w,h],-t1,colors[0]));
  out.push(cylinderPart("elbow","Elbow pivot",j,w*.54,w*1.22,colors[4]));
  out.push(boxPart("link2","Link 02 — forearm",[(j[0]+end[0])/2,0,(j[2]+end[2])/2],[L2,w*.83,h*.87],-t2,colors[1]));
  out.push(boxPart("tool","End tool bracket",[end[0]+9*Math.cos(t2),0,end[2]+9*Math.sin(t2)],[20,w*.9,h*.7],-t2,colors[5]));
 }else if(model==="plate"){
  out.push(meshPlatePart(a));
 }else if(model==="bracket"){
  out.push(meshBracketPart(a));
 }else if(model==="shaft"){
  out.push(cylinderPart("shaft","Solid circular shaft",[0,0,0],a.diameter/2,a.length,colors[1],48));
 }else {
  out.push(boxPart("block","Solid machined blank",[0,0,a.height/2],[a.length,a.width,a.height],0,colors[1]));
 }
 return out;
}
function totalVolume(){return parts.reduce((sum,p)=>sum+p.volume,0)}
function massFor(volume,material){return volume*density[material]/1000000} // kg, assuming mm³ and g/cm³
function sampleLoads(){
 const p=current();if(p.model!=="arm")return null;const a=p.params,g=9.81,rad=Math.PI/180,L1=a.link1/1000,L2=a.link2/1000,theta1=a.angle1*rad,theta2=(a.angle1+a.angle2)*rad;
 const link1=parts.find(x=>x.id==="link1"),link2=parts.find(x=>x.id==="link2");const m1=massFor(link1.volume,p.material),m2=massFor(link2.volume,p.material),mp=a.payload/1000;
 const T1=g*(m1*L1/2*Math.cos(theta1)+m2*(L1*Math.cos(theta1)+L2/2*Math.cos(theta2))+mp*(L1*Math.cos(theta1)+L2*Math.cos(theta2)));
 const T2=g*(m2*L2/2*Math.cos(theta2)+mp*L2*Math.cos(theta2));
 return {T1,T2,m1,m2,mp,L1,L2};
}
function xyzBounds(){
 const visible=parts.filter(p=>!current().hiddenParts.includes(p.id)).concat(pendingCadPreview?.parts||[]);
 let mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
 for(const p of visible)for(const f of p.triangles)for(const v of f)for(let i=0;i<3;i++){mins[i]=Math.min(mins[i],v[i]);maxs[i]=Math.max(maxs[i],v[i])}
 if(!Number.isFinite(mins[0]))return {center:[0,0,0],size:260};
 return {center:mins.map((v,i)=>(v+maxs[i])/2),size:Math.max(...mins.map((v,i)=>maxs[i]-v),50)};
}
function cameraAxes(){
 const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
 return {right:[-sy,cy,0],up:[-cy*sp,-sy*sp,cp],forward:[cy*cp,sy*cp,sp]};
}
let viewCenter=[0,0,0],renderedFaces=[],viewScale=2;
function project(v,w,h){const axis=cameraAxes(),d=sub3(v,viewCenter);return [w/2+cam.panX+dot(d,axis.right)*viewScale,h/2+cam.panY-dot(d,axis.up)*viewScale,dot(d,axis.forward)]}
function hexRgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function litColor(hex,shade){return "rgb("+hexRgb(hex).map(v=>Math.max(0,Math.min(255,Math.round(v*shade)))).join(",")+")"}
let pendingCadPreview=null;
function updateCadGhost(plan){
 if(!plan||plan.kind!=="edit"||!plan.params||!Object.hasOwn(limits,plan.model)){
  pendingCadPreview=null;
 }else{
  const error=validateDesign(plan.model,plan.params);
  if(error){pendingCadPreview=null;return false}
  try{pendingCadPreview={model:plan.model,params:{...plan.params},parts:buildParts(plan.model,plan.params),summary:plan.note||"수정 미리보기"}}
  catch(e){pendingCadPreview=null;console.warn("Preview cannot generate geometry",e.message);return false}
 }
 const panel=$("#cadPreviewBanner");
 if(panel){panel.hidden=!pendingCadPreview;
  if(pendingCadPreview)panel.textContent="◈ 변경 예정 · "+pendingCadPreview.summary+" · 전송 전에는 저장되지 않습니다."}
 scheduleDraw();
 return Boolean(pendingCadPreview);
}
window.robotForgeCADPreview={set:updateCadGhost,clear:()=>updateCadGhost(null),get:()=>pendingCadPreview};
let rafPending=false;
function scheduleDraw(){if(rafPending)return;rafPending=true;requestAnimationFrame(()=>{rafPending=false;draw()})}
function draw(){
 const canvas=$("#modelCanvas"),rect=canvas.getBoundingClientRect();const w=rect.width,h=rect.height;if(w<1||h<1)return;
 const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
 const ctx=canvas.getContext("2d");if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const b=xyzBounds();viewCenter=b.center;viewScale=Math.min(w*.75,h*.73)/Math.max(b.size,90)*cam.zoom;
 if(grid){ctx.save();ctx.lineWidth=.6;ctx.strokeStyle="#9bc5e650";for(let v=-350;v<=350;v+=25){const A=project([-350,v,-10],w,h),B=project([350,v,-10],w,h),C=project([v,-350,-10],w,h),D=project([v,350,-10],w,h);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.moveTo(C[0],C[1]);ctx.lineTo(D[0],D[1]);ctx.stroke()}
 const O=project([0,0,0],w,h);for(const [v,color] of [[[130,0,0],"#dd877d"],[[0,130,0],"#78c58d"],[[0,0,130],"#73a8e8"]]){const P=project(v,w,h);ctx.beginPath();ctx.moveTo(O[0],O[1]);ctx.lineTo(P[0],P[1]);ctx.strokeStyle=color;ctx.lineWidth=1.65;ctx.stroke()}
 ctx.restore()}
 const faces=[];renderedFaces=[];const axes=cameraAxes(),light=unit([.25,-.45,.9]);let count=0;
 for(const part of parts){if(current().hiddenParts.includes(part.id))continue;for(const t of part.triangles){const points=t.map(v=>project(v,w,h));let normal=unit(cross(sub3(t[1],t[0]),sub3(t[2],t[0])));const shade=.42+.51*Math.abs(dot(normal,light));const depth=(points[0][2]+points[1][2]+points[2][2])/3;faces.push({points,depth,color:part.color,shade,id:part.id,selected:part.id===selectedPart});count++}}
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){ctx.beginPath();ctx.moveTo(f.points[0][0],f.points[0][1]);for(let i=1;i<3;i++)ctx.lineTo(f.points[i][0],f.points[i][1]);ctx.closePath();ctx.fillStyle=litColor(f.color,f.shade);ctx.fill();if(edges||f.selected){ctx.strokeStyle=f.selected?"#0b79c8b0":"#27638d50";ctx.lineWidth=f.selected?1.3:.45;ctx.stroke()}renderedFaces.push(f)}
 if(current().model==="arm"){
  const a=current().params,t1=a.angle1*Math.PI/180,t2=(a.angle1+a.angle2)*Math.PI/180;
  const coords=[[0,0,16],[a.link1*Math.cos(t1),0,16+a.link1*Math.sin(t1)],[a.link1*Math.cos(t1)+a.link2*Math.cos(t2),0,16+a.link1*Math.sin(t1)+a.link2*Math.sin(t2)]];
  coords.forEach((v,i)=>{const S=project(v,w,h);ctx.beginPath();ctx.arc(S[0],S[1],3.5,0,Math.PI*2);ctx.fillStyle="#e7faff";ctx.fill();ctx.fillStyle="#4e92b9";ctx.font="10px sans-serif";ctx.fillText(i===0?"J1":i===1?"J2":"TCP",S[0]+9,S[1]-8)});
 }

 if(pendingCadPreview&&panel==="cad"){
  // Ghost geometry uses identical view projection; never affects selection or STL export.
  const overlayFaces=[];
  for(const part of pendingCadPreview.parts)for(const t of part.triangles){
   const points=t.map(v=>project(v,w,h));
   const depth=(points[0][2]+points[1][2]+points[2][2])/3;
   overlayFaces.push({points,depth});
  }
  overlayFaces.sort((a,b)=>a.depth-b.depth);
  ctx.save();
  ctx.setLineDash([3,3]);
  for(const face of overlayFaces){
   ctx.beginPath();
   ctx.moveTo(face.points[0][0],face.points[0][1]);
   ctx.lineTo(face.points[1][0],face.points[1][1]);
   ctx.lineTo(face.points[2][0],face.points[2][1]);
   ctx.closePath();
   ctx.fillStyle="rgba(21,167,232,0.065)";
   ctx.strokeStyle="rgba(6,118,203,0.28)";
   ctx.lineWidth=.8;ctx.fill();ctx.stroke();
  }
  ctx.restore();
 }

 $("#viewportStats").textContent=fmt(count,0)+" TRIANGLES · "+parts.length+" COMPONENTS";
}
function fit(){cam.panX=0;cam.panY=0;cam.zoom=1.08;scheduleDraw()}
function hit(x,y){for(let i=renderedFaces.length-1;i>=0;i--){const f=renderedFaces[i],p=f.points;const area=(a,b,c)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);const a=area(p[0],p[1]),b=area(p[1],p[2]),c=area(p[2],p[0]);if((a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0))return f.id}return null}
function rebuild(){parts=buildParts();renderTree();renderSummary();renderChecks();scheduleDraw();if(panel!=="cad")renderStage()}
function renderTree(){const list=parts.map(part=>'<div class="tree-row'+(selectedPart===part.id?' active':'')+'" role="treeitem" data-part="'+esc(part.id)+'"><span class="part-icon">◇</span><span>'+esc(part.label)+'</span><button class="visibility" data-visible="'+esc(part.id)+'" title="Toggle visibility">'+(current().hiddenParts.includes(part.id)?"◌":"◉")+'</button></div>').join("");
 $("#assemblyTree").innerHTML='<div class="tree-root">⌄ &nbsp; ◈ &nbsp; '+esc(current().name)+'</div>'+list;
 $$("#assemblyTree [data-part]").forEach(el=>el.addEventListener("click",ev=>{if(ev.target.closest("[data-visible]"))return;selectedPart=el.dataset.part;selectPart()}));
 $$("#assemblyTree [data-visible]").forEach(el=>el.addEventListener("click",ev=>{ev.stopPropagation();const p=current(),id=el.dataset.visible;p.hiddenParts=p.hiddenParts.includes(id)?p.hiddenParts.filter(x=>x!==id):p.hiddenParts.concat(id);persist();renderTree();scheduleDraw()}))
}

function selectPart(){
 renderTree();
 const p=parts.find(x=>x.id===selectedPart);
 $("#selectedPartName").textContent=p?p.label:"선택한 부품 없음";
 const quick=$("#selectionQuickEdit");
 if(quick){
  quick.hidden=!p;
  if(p)$("#selectionSummary").textContent=p.label;
 }
 scheduleDraw();
}
function selectedParameterKey(){
 const model=current().model;
 if(model==="arm")return {base:"base",shoulder:"angle1",link1:"link1",elbow:"angle2",link2:"link2",tool:"payload"}[selectedPart]||"link1";
 if(model==="plate")return "hole_count";
 if(model==="shaft")return "diameter";
 if(model==="bracket")return "thickness";
 return "length";
}
function focusSelectedPart(){
 if(!selectedPart)return;
 const tab=$('.inspector-tab[data-inspector="properties"]');
 if(tab)tab.click();
 const target=$("#param-"+selectedParameterKey());
 if(target){
  target.focus();target.select?.();
  if(window.matchMedia("(max-width: 680px)").matches)target.scrollIntoView?.({behavior:"smooth",block:"center"});
 }
}


const KO_MODE_KEY="robotforge.uiMode.v2";
const KO_WELCOME_KEY="robotforge.welcomeSeen.v2";
const beginnerParamLabels={
 link1:["첫 번째 팔 길이","로봇 몸통에서 팔꿈치까지의 길이"],
 link2:["두 번째 팔 길이","팔꿈치에서 손끝 방향까지의 길이"],
 angle1:["첫 번째 관절 각도","몸통 쪽 관절이 돌아가는 각도"],
 angle2:["두 번째 관절 각도","팔꿈치가 구부러지는 각도"],
 base:["받침대 너비","바닥에 닿는 몸통의 크기"],
 width:["팔 부품의 폭","팔이 옆으로 얼마나 넓은지"],
 thickness:["팔 부품의 두께","팔 부품의 두께"],
 diameter:["축의 지름","원형 축의 가장 넓은 폭"],
 hole_count:["구멍 개수","0, 1, 2, 4개 중 하나를 선택하세요"],
 hole_diameter:["구멍 지름","나사가 들어갈 구멍의 크기"],
 offset_x:["좌우 가장자리 여백","판 가장자리에서 구멍 중심까지의 거리"],
 offset_y:["위아래 가장자리 여백","판 가장자리에서 구멍 중심까지의 거리"],
 payload:["끝에 다는 무게","팔 끝에 매달 물건의 질량 (g)"],
 length:["가로 길이","부품의 긴 쪽 길이"],
 height:["높이","부품의 위아래 높이"]
};
const simpleArmKeys=new Set(["link1","link2","angle1","angle2"]);
function safeLocalGet(key){try{return localStorage.getItem(key)}catch{return null}}
function safeLocalSet(key,value){try{localStorage.setItem(key,value)}catch{}}
function setUiMode(mode,persistMode=true){
 const beginner=mode!=="expert";
 document.body.classList.toggle("beginner-mode",beginner);
 document.body.classList.toggle("expert-mode",!beginner);
 for(const [id,on] of [["beginnerModeButton",beginner],["expertModeButton",!beginner]]){
   const el=$("#"+id);if(!el)continue;el.classList.toggle("active",on);el.setAttribute("aria-pressed",String(on));
 }
 if(persistMode)safeLocalSet(KO_MODE_KEY,beginner?"beginner":"expert");
 if(beginner&&["electronics","wiring","code","bom"].includes(panel))activatePanel("cad");
 if(panel!=="cad")renderStage();
}
function finishWelcome(){safeLocalSet(KO_WELCOME_KEY,"yes");if($("#welcomeDialog").open)$("#welcomeDialog").close()}
function showWelcome(){if(!$("#welcomeDialog").open)$("#welcomeDialog").showModal()}
function initBeginnerUX(){
 $("#beginnerModeButton").addEventListener("click",()=>setUiMode("beginner"));
 $("#expertModeButton").addEventListener("click",()=>setUiMode("expert"));
 $("#helpButton").addEventListener("click",showWelcome);
 $("#beginnerSeeHow").addEventListener("click",showWelcome);
 $("#beginnerChooseTemplate").addEventListener("click",showWelcome);
 $("#dismissBeginnerHelp").addEventListener("click",()=>{$("#beginnerHelp").hidden=true;safeLocalSet("robotforge.guideHidden.v2","yes")});
 $("#closeWelcomeButton").addEventListener("click",finishWelcome);
 $("#skipWelcomeButton").addEventListener("click",finishWelcome);
 $("#welcomeExpertButton").addEventListener("click",()=>{setUiMode("expert");finishWelcome()});
 $$("[data-start-template]").forEach(button=>button.addEventListener("click",()=>{
   setUiMode("beginner");
   const model=button.dataset.startTemplate;
   if(limits[model])setTemplate(model);
   activatePanel("cad");
   $("#beginnerHelp").hidden=false;
   const propertyTab=$(".inspector-tab[data-inspector=properties]");if(propertyTab)propertyTab.click();
   $("#templateSelect").focus();
   finishWelcome();
 }));
 $("#welcomeDialog").addEventListener("close",()=>safeLocalSet(KO_WELCOME_KEY,"yes"));
 $("#welcomeDialog").addEventListener("cancel",()=>safeLocalSet(KO_WELCOME_KEY,"yes"));
 if(safeLocalGet("robotforge.guideHidden.v2")==="yes")$("#beginnerHelp").hidden=true;
 setUiMode(safeLocalGet(KO_MODE_KEY)==="expert"?"expert":"beginner",false);
 if(safeLocalGet(KO_WELCOME_KEY)!=="yes"&&!document.body.classList.contains("focus-layout"))requestAnimationFrame(showWelcome);
}

function renderSummary(){
 const p=current();$("#projectName").textContent=p.name;$("#documentTabName").textContent=p.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,30)+".rfscene";
 $("#componentCount").textContent=String(parts.length);$("#summaryType").textContent=({arm:"로봇팔",plate:"구멍판",block:"블록",bracket:"ㄱ자 부품",shaft:"원통 축"}[p.model]||p.model);
 $("#modelTitle").textContent=({arm:"움직이는 로봇팔",plate:"나사 구멍이 있는 판",block:"네모 블록",bracket:"ㄱ자 연결 브래킷",shaft:"원통 축"}[p.model]||modelNames[p.model]);$("#modelSubtitle").textContent=({arm:"팔 길이와 관절 각도를 조절해요",plate:"구멍 개수·크기·위치를 정해보세요",block:"가로·세로·높이를 바꿔보세요",bracket:"기계를 고정하는 ㄱ자 부품이에요",shaft:"회전축 모양을 만들어보세요"}[p.model]||modelSubtitles[p.model]);
 $("#templateSelect").value=p.model;$("#materialSelect").value=p.material;
 $("#volumeEstimate").textContent=fmt(totalVolume()/1000,2)+" cm³";
 $("#massEstimate").textContent=fmt(massFor(totalVolume(),p.material)*1000,1)+" g";
 const quality=meshDiagnostics(parts);const indicator=$("#meshHealth");if(indicator){indicator.textContent=quality.closed?"✓ 닫힌 3D 메시 · "+quality.triangles+"개 삼각형":"⚠ 메시 경계 점검 필요 · "+quality.boundaryEdges+"개";indicator.classList.toggle("mesh-warn",!quality.closed)}
 $("#dynamicFields").innerHTML=limits[p.model].map(([key,label,min,max,step,unit])=>{const ko=beginnerParamLabels[key]||[label,""];const adv=(p.model==="arm"&&!simpleArmKeys.has(key))||(p.model==="plate"&&["offset_x","offset_y"].includes(key))?" advanced-parameter":"";const opts=key==="hole_count"?'<select class="select-control field-choice" id="param-hole_count" name="hole_count">'+[0,1,2,4].map(n=>'<option value="'+n+'" '+(p.params.hole_count===n?"selected":"")+'>'+n+'개</option>').join("")+'</select>':'<input type="number" inputmode="decimal" id="param-'+key+'" name="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+p.params[key]+'">';return '<div class="param-row'+adv+'"><div class="param-head"><label for="param-'+key+'">'+esc(ko[0])+'</label><span class="param-unit">'+unit+'</span></div>'+opts+'<small class="param-help">'+esc(ko[1])+'</small></div>'}).join("");
 $("#viewportTitle").textContent=p.model==="arm"?"3D 로봇팔 미리보기":"3D 부품 미리보기";
}
function refresh(){if(pendingCadPreview)updateCadGhost(null);selectedPart=null;const quick=$("#selectionQuickEdit");if(quick)quick.hidden=true;rebuild();renderHistory();renderSummary();renderProjectList();if(panel!=="cad")renderStage();}
function editParams(){
 const p=current(),next={};
 for(const [key,label,min,max] of limits[p.model]){const input=$("#param-"+key);const n=Number(input.value);if(!input.value.trim()||!Number.isFinite(n)||n<min||n>max){input.focus();notify(label+" must be between "+min+" and "+max,true);return}next[key]=n}
 const designError=validateDesign(p.model,next);if(designError){notify(designError,true);return}
 if(JSON.stringify(next)===JSON.stringify(p.params)){notify("No changes to apply");return}
 mutate(target=>{target.params=next},"Updated dimensional parameters");notify("Mesh regenerated and revision saved");
}
function setTemplate(model){
 if(!limits[model])return;const p=current();if(p.model===model)return;
 mutate(q=>{q.model=model;q.params=clone(defaults[model])},"Created "+modelNames[model]);fit();notify("Template loaded: "+modelNames[model]);
}
function activatePanel(name){
 if(name!=="cad"&&pendingCadPreview)updateCadGhost(null);
 panel=name;$$("#navList .nav-option").forEach(x=>x.classList.toggle("active",x.dataset.panel===panel));
 const cad=name==="cad";$("#modelCanvas").hidden=!cad;$("#nonCadStage").hidden=cad;if($("#beginnerHelp"))$("#beginnerHelp").hidden=!cad||safeLocalGet("robotforge.guideHidden.v2")==="yes";$("#viewportTitle").textContent=cad?"3D 모델 보기":({simulation:"힘·움직임 계산",manufacturing:"설계 파일 받기",electronics:"전자회로 참고",wiring:"배선 참고",code:"코드",bom:"부품·재료 목록"}[name]||name);
 if(!cad)renderStage();else scheduleDraw();
 $("#statusGeometry").textContent=cad?"MESH VIEWER":"REFERENCE / DRAFT";
 $("#leftSidebar").classList.remove("mobile-visible");log("VIEW","Opened "+name+" studio");
}
function tableHtml(head,rows){return '<table class="data-table"><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join("")+'</tr>').join("")+'</tbody></table>'}
function pcbDiagram(){return '<svg class="svg-diagram" viewBox="0 0 620 210" role="img" aria-label="Conceptual TTL and power wiring; not verified electronics"><rect x="10" y="44" width="170" height="116" rx="12" fill="#24422a" stroke="#72ba79"/><text x="95" y="73" text-anchor="middle" font-size="14" fill="#dcf9cf">Controller +</text><text x="95" y="92" text-anchor="middle" font-size="14" fill="#dcf9cf">TTL Interface</text><text x="95" y="126" text-anchor="middle" font-size="11" fill="#a8dbad">VERIFY LEVEL SHIFT</text><rect x="408" y="19" width="180" height="70" rx="11" fill="#25472f" stroke="#91ca85"/><rect x="408" y="122" width="180" height="70" rx="11" fill="#25472f" stroke="#91ca85"/><text x="498" y="47" text-anchor="middle" fill="#deffd6" font-size="14">AX-18A · Joint 1</text><text x="498" y="68" text-anchor="middle" fill="#acdbaf" font-size="11">TTL / VDD / GND</text><text x="498" y="150" text-anchor="middle" fill="#deffd6" font-size="14">AX-18A · Joint 2</text><text x="498" y="171" text-anchor="middle" fill="#acdbaf" font-size="11">TTL / VDD / GND</text><path d="M180 76 H300 V54 H408 M300 54 V155 H408" fill="none" stroke="#b8fa87" stroke-width="4"/><path d="M180 117 H270 V78 H408 M270 78 V180 H408" fill="none" stroke="#e2b76e" stroke-width="2.5"/><text x="218" y="40" fill="#bfff9c" font-size="11">TTL DATA</text><text x="185" y="188" fill="#e6c487" font-size="11">POWER / GND — NOT DESIGNED</text></svg>'}
function renderStage(){
 const p=current(),n=p.params,loads=sampleLoads();let html='';
 const title=(tag,heading,sub)=>'<div class="stage-header">'+tag+'</div><h2 class="stage-title">'+heading+'</h2><p class="stage-subtitle">'+sub+'</p>';

 if(document.body.classList.contains("beginner-mode")&&(panel==="simulation"||panel==="manufacturing")){
  if(panel==="simulation"){
    html=title("STEP 2 / 움직임 점검","팔이 물건을 들 수 있을까요?","관절에 걸리는 힘을 아주 단순하게 예상하는 체험 계산입니다. 실제 모터가 버틸지 판단하는 근거로 사용하면 안 돼요.");
    if(loads){
      html+='<div class="stage-cards"><div class="stage-card"><div class="small-heading">첫 번째 관절 / 중력 토크 추정</div><h3>'+fmt(Math.abs(loads.T1),3)+' N·m</h3><p>팔 안쪽 관절을 붙잡는 데 필요한 힘의 회전 효과를 추정했어요.</p></div><div class="stage-card"><div class="small-heading">두 번째 관절 / 중력 토크 추정</div><h3>'+fmt(Math.abs(loads.T2),3)+' N·m</h3><p>팔꿈치에 걸리는 중력의 회전 효과를 추정했어요.</p></div><div class="stage-card stage-full"><div class="small-heading">반드시 확인해 주세요</div><div class="warn-box">수직 평면에서 정지한 팔을 가정한 단순 계산이에요. 모터 무게·마찰·가속·충격·안전 여유는 반영되지 않았고, 실제 구동 시험도 아닙니다.</div></div></div>';
    }else html+='<div class="stage-cards"><div class="stage-card stage-full"><h3>로봇팔을 먼저 선택하세요</h3><p>오른쪽의 모델 선택 메뉴에서 로봇팔을 고르면 계산할 수 있어요.</p></div></div>';
  }else{
    html=title("STEP 3 / 완성한 모델 보관하기","파일로 저장해 볼까요?","3D 모양은 STL 파일로, 나중에 다시 편집할 치수는 JSON 백업으로 저장할 수 있어요.");
    html+='<div class="stage-cards"><div class="stage-card"><div class="small-heading">3D 파일</div><h3>STL 다운로드</h3><p>삼각형으로 이루어진 3D 모양이에요. 부품 간 간섭이나 강도 검사는 하지 않았어요.</p><button class="stage-action" data-stageexport="stl">↓ STL 파일 받기</button></div><div class="stage-card"><div class="small-heading">내 프로젝트 백업</div><h3>JSON 다운로드</h3><p>길이·각도·재료를 저장해 두었다가 이 사이트에서 다시 불러올 수 있어요.</p><button class="stage-action" data-stageexport="json">↓ 백업 파일 받기</button></div><div class="stage-card stage-full"><div class="warn-box">이 파일은 실제 제조 가능 여부를 검증하지 않은 미리보기예요. 공장에 바로 발주하지 마세요.</div></div></div>';
  }
  if(panel==="manufacturing"&&p.model==="plate")html+='<div class="stage-cards" style="margin-top:12px"><div class="stage-card stage-full"><div class="small-heading">2D CAD 도면</div><h3>DXF 나사 구멍 도면</h3><p>판의 외곽선과 구멍을 CAD 프로그램에서 편집할 수 있도록 저장합니다.</p><button class="stage-action" data-stageexport="dxf">↓ DXF 도면 받기</button></div></div>';
  $("#nonCadStage").innerHTML=html;
  $("[data-stageexport]").forEach(b=>b.addEventListener("click",()=>exportFile(b.dataset.stageexport)));
  return;
 }
 if(panel==="electronics"){
  html=title("ELECTRONICS STUDIO / REFERENCE ONLY","Electrical architecture","Conceptual AX-18A TTL connections. No KiCad engine or official ERC is running on this public static site.")+'<div class="stage-cards"><div class="stage-card stage-full"><div class="small-heading">CONCEPT / TTL NETWORK</div>'+pcbDiagram()+'</div><div class="stage-card"><div class="small-heading">ASSUMPTIONS</div><h3>12 V motor rail</h3><p>Separate regulated control power and servo power. Verify peak current, fusing and protection before creating any real board.</p></div><div class="stage-card"><div class="small-heading">VALIDATION STATUS</div><h3>NOT VERIFIED</h3><p>Actual schematics, footprints, routing, ERC and DRC require local KiCad and engineering review.</p></div></div>';
 }else if(panel==="wiring"){
  html=title("WIRING & HARNESS / CONCEPT","Connections that make sense.","Connector assignment reference only. Cable lengths, current limits, bend radii and protection are not established.")+'<div class="stage-cards"><div class="stage-card stage-full"><div class="small-heading">AX-18A CONNECTOR / MANUFACTURER PIN IDENTIFIERS</div>'+tableHtml(["Pin","Signal","Notes"],[["1","GND","Common return; verify polarity & orientation"],["2","VDD","Actuator power; dedicated supply design required"],["3","TTL DATA","Half-duplex bus; interface circuit required"]])+'</div><div class="stage-card"><div class="small-heading">HARNESS STATUS</div><h3>Physical routing pending</h3><p>Wire gauge, length, voltage drop and bending clearance have not been simulated.</p></div><div class="stage-card"><div class="small-heading">SAFE INTEGRATION</div><h3>No live hardware commands</h3><p>Control electronics and emergency stop must be engineered separately.</p></div></div>';
 }else if(panel==="simulation"){
  html=title("ANALYTICAL SIMULATION","Loads, with the assumptions visible.","A simple static gravity torque estimate for a vertical 2R plane. Not MuJoCo, not a measured motor curve and not a verified safety calculation.");
  if(loads){const base=Math.max(Math.abs(loads.T1),Math.abs(loads.T2),.001);html+='<div class="stage-cards"><div class="stage-card"><div class="small-heading">JOINT 1 · ESTIMATED</div><h3>'+fmt(Math.abs(loads.T1),4)+' N·m</h3><p>Signed gravity torque '+fmt(loads.T1,4)+' N·m</p><div style="height:9px;background:#28402c;border-radius:7px"><div style="height:100%;background:#b6ff83;border-radius:7px;width:'+fmt(Math.abs(loads.T1)/base*100)+'%"></div></div></div><div class="stage-card"><div class="small-heading">JOINT 2 · ESTIMATED</div><h3>'+fmt(Math.abs(loads.T2),4)+' N·m</h3><p>Signed gravity torque '+fmt(loads.T2,4)+' N·m</p><div style="height:9px;background:#28402c;border-radius:7px"><div style="height:100%;background:#7fc796;border-radius:7px;width:'+fmt(Math.abs(loads.T2)/base*100)+'%"></div></div></div><div class="stage-card stage-full"><div class="small-heading">EXPLICIT ASSUMPTIONS</div><p>Vertical X–Z plane, uniform link material, gravity 9.81 m/s², point-mass payload '+n.payload+' g; no actuator mass, friction, acceleration, safety factor, gearbox efficiency, thermal limits or cable forces.</p></div></div>'}
  else html+='<div class="stage-card">Torque analysis requires the 2-DOF arm template.</div>';
 }else if(panel==="code"){
  html=title("CODE STUDIO / GENERATOR","Reference kinematics","This is a mathematical forward-kinematics sample. It does not control physical motors or run untrusted code.")+'<div class="stage-cards"><div class="stage-card stage-full"><div class="small-heading">PYTHON / FORWARD KINEMATICS</div><pre style="overflow:auto;font-size:12px;line-height:1.8;color:#d3f6c7" id="referenceCode"></pre><button type="button" class="stage-action" id="copyCode">Copy Python snippet</button></div></div>';
 }else if(panel==="bom"){
  const rows=parts.map(x=>[x.label,fmt(x.volume/1000,2)+" cm³",fmt(massFor(x.volume,p.material)*1000,1)+" g",p.material]);
  html=title("MATERIALS & BOM","From geometry to estimates.","Volume is the sum of individual mesh components without Boolean union; costs, sourcing, stock and mechanical strength are not validated.")+'<div class="stage-cards"><div class="stage-card stage-full">'+tableHtml(["Component","Raw volume","Est. mass","Material"],rows)+'</div><div class="stage-card"><div class="small-heading">TOTAL RAW VOLUME</div><h3>'+fmt(totalVolume()/1000,2)+' cm³</h3></div><div class="stage-card"><div class="small-heading">ESTIMATED RAW MASS</div><h3>'+fmt(massFor(totalVolume(),p.material)*1000,1)+' g</h3></div></div>';
 }else if(panel==="manufacturing"){
  html=title("MANUFACTURING PREVIEW","Files you can inspect.","Download a tessellated STL scene or JSON backup. This browser preview cannot export true parametric STEP or certify manufacture.");
  html+='<div class="stage-cards"><div class="stage-card"><div class="small-heading">STL · TRIANGLE MESH</div><h3>Available</h3><p>Actual assembled surface triangles, dimensions in mm; overlapping parts are not fused.</p><button class="stage-action" data-stageexport="stl">Download STL</button></div><div class="stage-card"><div class="small-heading">JSON · SCENE BACKUP</div><h3>Available</h3><p>Local parameter model and material settings. Suitable for re-import to this preview.</p><button class="stage-action" data-stageexport="json">Download JSON</button></div><div class="stage-card stage-full"><div class="small-heading">INTEGRITY / ENGINEERING REVIEW</div><div class="warn-box">NOT FABRICATION VALIDATED: interference, bolt patterns, tolerances, stress, electrical safety and printer checks are not completed. STL does not replace native CAD or independent verification.</div></div></div>';
 }else return;
 if(panel==="manufacturing"&&p.model==="plate")html+='<div class="stage-card"><div class="small-heading">2D CAD / DXF</div><h3>Editable drilled plate sketch</h3><p>Actual LINE and CIRCLE entities.</p><button class="stage-action" data-stageexport="dxf">Download DXF</button></div>';
 $("#nonCadStage").innerHTML=html;
 if(panel==="code"){$("#referenceCode").textContent=codeSample();$("#copyCode").addEventListener("click",()=>copyText(codeSample()))}
 $$("[data-stageexport]").forEach(b=>b.addEventListener("click",()=>exportFile(b.dataset.stageexport)));
}
function codeSample(){
 const p=current(),L1=p.model==="arm"?p.params.link1:120,L2=p.model==="arm"?p.params.link2:90;
 return ["# Generated reference math — not device control","import math","","L1_MM = "+L1,"L2_MM = "+L2,"","def forward_kinematics(theta1_deg, theta2_deg):","    t1 = math.radians(theta1_deg)","    t12 = math.radians(theta1_deg + theta2_deg)","    x_mm = L1_MM * math.cos(t1) + L2_MM * math.cos(t12)","    z_mm = L1_MM * math.sin(t1) + L2_MM * math.sin(t12)","    return x_mm, z_mm","","print(forward_kinematics(34, -28))"].join("\n");
}
function renderHistory(){
 const p=current(),list=p.history.map((x,i)=>'<div class="history-item"><div class="history-item-top"><b>'+(i===p.cursor?"● ":"")+esc(x.label)+'</b><small>#'+(i+1)+'</small></div><small>'+new Date(x.time).toLocaleString()+'</small><div style="margin-top:10px"><button type="button" data-revision="'+i+'" '+(i===p.cursor?'disabled':'')+'>Restore version</button></div></div>').reverse().join("");
 $("#historyList").innerHTML=list;$$("[data-revision]").forEach(b=>b.addEventListener("click",()=>restore(Number(b.dataset.revision))));
 $("#undoButton").disabled=p.cursor<=0;$("#redoButton").disabled=p.cursor>=p.history.length-1;
}
function renderProjectList(){
 const list=$("#projectList");list.innerHTML=projects.map(p=>'<div class="project-item"><div><strong>'+esc(p.name)+'</strong><small>'+esc(modelNames[p.model])+' · '+(p.history.length)+' revisions'+(p.id===activeId?' · Active':'')+'</small></div><button data-open="'+esc(p.id)+'">'+(p.id===activeId?'Open':'Switch')+'</button></div>').join("");
 $$("[data-open]").forEach(b=>b.addEventListener("click",()=>{activeId=b.dataset.open;persist();refresh();$("#projectDialog").close();log("PROJECT","Switched to "+current().name)}));
}

/* 2D CAD outline for drilled mounting plates. DXF coordinates are millimeters. */
function plateHoleCenters(a){
 const x=a.length/2-a.offset_x,y=a.width/2-a.offset_y;
 if(a.hole_count===0)return [];
 if(a.hole_count===1)return [[0,0]];
 if(a.hole_count===2)return [[-x,0],[x,0]];
 if(a.hole_count===4)return [[-x,-y],[x,-y],[x,y],[-x,y]];
 return [];
}
function makePlateDxf(a){
 const error=validateDesign("plate",a);if(error)throw Error(error);
 const lines=["0","SECTION","2","HEADER","9","$ACADVER","1","AC1009","0","ENDSEC","0","SECTION","2","ENTITIES"];
 const fmtD=v=>Number(v).toFixed(5);
 const pts=[[-a.length/2,-a.width/2],[a.length/2,-a.width/2],[a.length/2,a.width/2],[-a.length/2,a.width/2]];
 for(let i=0;i<4;i++){
  const p=pts[i],q=pts[(i+1)%4];
  lines.push("0","LINE","8","OUTLINE","10",fmtD(p[0]),"20",fmtD(p[1]),"30","0","11",fmtD(q[0]),"21",fmtD(q[1]),"31","0");
 }
 for(const [x,y]of plateHoleCenters(a)){
  lines.push("0","CIRCLE","8","HOLES","10",fmtD(x),"20",fmtD(y),"30","0","40",fmtD(a.hole_diameter/2));
 }
 lines.push("0","ENDSEC","0","EOF");
 return lines.join("\n");
}

function exportFile(type){
 const p=current(),base=p.name.toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-|-$/g,"")||"robot-forge";
 let blob,ext;
 if(type==="json"){const scene={format:"RobotForgeBrowserScene",version:1,name:p.name,model:p.model,params:p.params,material:p.material,disclaimer:"Browser triangle mesh only; not verified for fabrication"};blob=new Blob([JSON.stringify(scene,null,2)],{type:"application/json"});ext="json"}
 else if(type==="bom"){const rows=[["Component","Volume_mm3","Mass_g_estimate","Material"],...parts.map(x=>[x.label,x.volume.toFixed(3),(massFor(x.volume,p.material)*1000).toFixed(3),p.material])];blob=new Blob([rows.map(row=>row.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(",")).join("\n")],{type:"text/csv;charset=utf-8"});ext="csv"}
 else if(type==="stl"){const health=meshDiagnostics(parts.filter(part=>!p.hiddenParts.includes(part.id)));if(!health.closed){notify("메시가 완전히 닫히지 않아 내보내기를 중단했어요.",true);return}let lines=["solid RobotForgeBrowserMesh"];for(const part of parts){if(p.hiddenParts.includes(part.id))continue;for(const v of part.triangles){const nn=unit(cross(sub3(v[1],v[0]),sub3(v[2],v[0])));lines.push("  facet normal "+nn.map(x=>x.toFixed(7)).join(" "),"    outer loop");for(const pt of v)lines.push("      vertex "+pt.map(x=>x.toFixed(5)).join(" "));lines.push("    endloop","  endfacet")}}lines.push("endsolid RobotForgeBrowserMesh");blob=new Blob([lines.join("\n")],{type:"model/stl"});ext="stl"}
 else if(type==="dxf"){if(p.model!=="plate"){notify("DXF 평면도는 구멍판 모델에서만 만들 수 있어요.",true);return}blob=new Blob([makePlateDxf(p.params)],{type:"application/dxf"});ext="dxf"}
 else if(type==="obj"){let lines=["# Robot Forge browser mesh; units: mm","# Not a parametric CAD solid"],index=1;for(const part of parts){if(p.hiddenParts.includes(part.id))continue;lines.push("o "+part.id);for(const face of part.triangles){for(const v of face)lines.push("v "+v.map(n=>n.toFixed(6)).join(" "));lines.push("f "+index+" "+(index+1)+" "+(index+2));index+=3}}blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});ext="obj"}
 else return;
 const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=base+"-"+type+"."+ext;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);log("EXPORT","Downloaded "+link.download);notify("Downloaded "+ext.toUpperCase()+" to your device");
}
function copyText(str){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(str).then(()=>notify("Copied to clipboard")).catch(()=>notify("Clipboard unavailable",true))}else notify("Clipboard API unavailable in this browser",true)}

/* Bounded, deterministic local-command grammar. Does not call an LLM. */
function detectTemplate(text){
 const s=String(text).toLowerCase();
 if(/bracket|브래킷|ㄱ자/.test(s))return "bracket";
 if(/shaft|원통|회전\s*축|축\s*만들/.test(s))return "shaft";
 if(/plate|플레이트|구멍판|나사\s*판|판재|판\s*만들|평평한\s*판/.test(s))return "plate";
 if(/block|블록/.test(s))return "block";
 if(/2\s*[- ]?\s*dof|robot arm|로봇팔/.test(s))return "arm";
 return null;
}
function parseRuleCommand(text,model){
 const defs=limits[model];if(!defs)return {changes:{},error:"지원하지 않는 모델입니다."};
 const rules=new Map(defs.map(row=>[row[0],row]));
 const rx=[
 ["hole_count",/(?:holes?|구멍\s*(?:개수|수)?)\s*(?:=|:|to|을|를|는)?\s*(\d+(?:\.\d+)?)/i],
 ["hole_diameter",/(?:hole\s*diameter|구멍\s*(?:의\s*)?(?:지름|크기)|홀\s*지름)\s*(?:=|:|to|을|를|는)?\s*(\d+(?:\.\d+)?)/i],
 ["offset_x",/(?:offset[_\s-]*x|좌우\s*여백|가로\s*여백)\s*(?:=|:|to|을|를|는)?\s*(\d+(?:\.\d+)?)/i],
 ["offset_y",/(?:offset[_\s-]*y|위아래\s*여백|세로\s*여백)\s*(?:=|:|to|을|를|는)?\s*(\d+(?:\.\d+)?)/i],
 ["link1",/(?:link\s*1|l1|first\s+link|첫\s*링크|첫\s*번째\s*팔|상완)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["link2",/(?:link\s*2|l2|second\s+link|둘째\s*링크|두\s*번째\s*팔|전완)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["angle1",/(?:angle\s*1|theta\s*1|joint\s*1|관절\s*1)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["angle2",/(?:angle\s*2|theta\s*2|joint\s*2|관절\s*2)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["payload",/(?:payload|하중|끝에\s*다는\s*무게)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i],
 ["thickness",/(?:thickness|두께)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i],
 ["diameter",/(?:diameter|지름)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i],
 ["height",/(?:height|높이)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i],
 ["width",/(?:width|너비|폭|세로)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i],
 ["length",/(?:length|가로|길이)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i]
 ];
 const changes={};
 for(const [key,pattern] of rx){
  if(!rules.has(key))continue;
  const match=String(text).match(pattern);if(!match)continue;
  const value=Number(match[1]),row=rules.get(key);
  if(!Number.isFinite(value)||value<row[2]||value>row[3])return {changes:{},error:"‘"+row[1]+"’의 허용 범위는 "+row[2]+"~"+row[3]+"입니다."};
  changes[key]=value;
 }
 if(Object.keys(changes).length===0)return {changes:{},error:null};
 return {changes,error:null};
}
function applyCommand(){if(window.robotForgeChat?.send)return window.robotForgeChat.send();notify("CAD 채팅 기능을 불러오지 못했어요. 새로고침 해주세요.",true)}
function bindUI(){
 $("#createProjectButton").addEventListener("click",()=>{$("#projectDialog").showModal();renderProjectList()});
 $("#projectPicker").addEventListener("click",()=>{$("#projectDialog").showModal();renderProjectList()});
 $("#newTabButton").addEventListener("click",()=>{$("#projectDialog").showModal();renderProjectList()});
 $("#newProjectSubmit").addEventListener("click",()=>{newProject($("#newProjectName").value||"Untitled project");$("#projectDialog").close()});
 $("#duplicateButton").addEventListener("click",()=>{const p=current(),q=newProject(p.name+" copy");q.model=p.model;q.params=clone(p.params);q.material=p.material;q.history=[snapshot("Duplicated project")];q.cursor=0;persist();refresh();log("PROJECT","Duplicated project")});
 $("#importJsonButton").addEventListener("click",()=>$("#importJsonFile").click());
 $("#importJsonFile").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>100000){notify("JSON too large (100 KB maximum)",true);return}try{const data=JSON.parse(await file.text());if(data.format!=="RobotForgeBrowserScene")throw Error("Unsupported scene signature");const p=safeProject(data);projects.push(p);activeId=p.id;persist();refresh();$("#projectDialog").close();log("IMPORT","Imported scene JSON");notify("Scene imported")}catch(err){notify("Cannot import: "+err.message,true)}e.target.value=""});
 $("#undoButton").addEventListener("click",undo);$("#redoButton").addEventListener("click",redo);
 $("#undoHistoryButton").addEventListener("click",undo);$("#redoHistoryButton").addEventListener("click",redo);
 $("#saveButton").addEventListener("click",()=>{persist();notify("Saved to this browser only")});
 $("#exportButton").addEventListener("click",()=>$("#exportDialog").showModal());
 $$("[data-export]").forEach(b=>b.addEventListener("click",()=>{exportFile(b.dataset.export);$("#exportDialog").close()}));
 $("#exportStlButton").addEventListener("click",()=>exportFile("stl"));$("#exportJsonButton").addEventListener("click",()=>exportFile("json"));
 $("#templateSelect").addEventListener("change",e=>setTemplate(e.target.value));
 $("#materialSelect").addEventListener("change",e=>{const m=e.target.value;if(!Object.hasOwn(density,m))return;mutate(p=>p.material=m,"Material set to "+m)});
 $("#applyParametersButton").addEventListener("click",editParams);
 $$("#navList .nav-option").forEach(b=>b.addEventListener("click",()=>activatePanel(b.dataset.panel)));
 $$(".inspector-tab").forEach(b=>b.addEventListener("click",()=>{inspect=b.dataset.inspector;$$(".inspector-tab").forEach(x=>x.classList.toggle("active",x.dataset.inspector===inspect));$("#propertiesPane").hidden=inspect!=="properties";$("#assistantPane").hidden=inspect!=="assistant";$("#historyPane").hidden=inspect!=="history";if(inspect==="history")renderHistory()}));
 $("#sendCommandButton").addEventListener("click",applyCommand);
 $("#commandInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();applyCommand()}});
 $$(".prompt-preset").forEach(b=>b.addEventListener("click",()=>{$("#commandInput").value=b.dataset.command;applyCommand()}));
 $("#fitButton").addEventListener("click",fit);$("#resetViewButton").addEventListener("click",()=>{cam.yaw=-.95;cam.pitch=.46;fit()});
 $("#zoomInButton").addEventListener("click",()=>{cam.zoom=Math.min(cam.zoom*1.25,8);scheduleDraw()});$("#zoomOutButton").addEventListener("click",()=>{cam.zoom=Math.max(cam.zoom/1.25,.15);scheduleDraw()});
 $("#wireButton").addEventListener("click",()=>{edges=!edges;$("#wireButton").classList.toggle("active",edges);scheduleDraw()});
 $("#gridButton").addEventListener("click",()=>{grid=!grid;$("#gridButton").classList.toggle("active",grid);scheduleDraw()});
 $("#selectTool").addEventListener("click",()=>{$("#selectTool").classList.add("active");$("#orbitTool").classList.remove("active")});
 $("#orbitTool").addEventListener("click",()=>{$("#orbitTool").classList.add("active");$("#selectTool").classList.remove("active")});
 $$(".view-chip").forEach(b=>b.addEventListener("click",()=>{const views={iso:[-.95,.46],front:[-Math.PI/2,0],top:[-Math.PI/2,Math.PI/2-.01],side:[0,0]};[cam.yaw,cam.pitch]=views[b.dataset.view];$$(".view-chip").forEach(x=>x.classList.toggle("active",x===b));scheduleDraw()}));
 $("#addPartButton").addEventListener("click",()=>{$("#templateSelect").focus();notify("Choose a template on the right. Arbitrary part insertion requires CAD backend.")});
 $("#editSelectedPartButton")?.addEventListener("click",focusSelectedPart);
 $("#clearSelectedPartButton")?.addEventListener("click",()=>{selectedPart=null;selectPart()});
 $$(".bottom-tab").forEach(b=>b.addEventListener("click",()=>{activeBottom=b.dataset.bottom;$$(".bottom-tab").forEach(x=>x.classList.toggle("active",x===b));$("#eventLog").hidden=activeBottom!=="events";$("#checkList").hidden=activeBottom!=="output"}));
 $("#toggleBottomButton").addEventListener("click",()=>$("#bottomPanel").classList.toggle("collapsed"));
 $("#mobileNavButton").addEventListener("click",()=>$("#leftSidebar").classList.toggle("mobile-visible"));
 window.addEventListener("keydown",e=>{const input=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||"");const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==="s"){e.preventDefault();persist();notify("Locally saved")}else if(mod&&e.key.toLowerCase()==="z"&&!input){e.preventDefault();e.shiftKey?redo():undo()}else if(mod&&e.key.toLowerCase()==="k"){e.preventDefault();$$(".inspector-tab")[1].click();$("#commandInput").focus()}else if(e.key==="Escape"){$("#leftSidebar").classList.remove("mobile-visible")}});
 const canvas=$("#modelCanvas");let last=[0,0];
 canvas.addEventListener("pointerdown",e=>{dragging=true;dragMoved=false;downPoint=[e.offsetX,e.offsetY];last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener("pointermove",e=>{if(!dragging)return;const dx=e.clientX-last[0],dy=e.clientY-last[1];if(Math.abs(e.offsetX-downPoint[0])+Math.abs(e.offsetY-downPoint[1])>4)dragMoved=true;if(e.shiftKey||e.buttons===2){cam.panX+=dx;cam.panY+=dy}else{cam.yaw+=dx*.008;cam.pitch=Math.min(1.55,Math.max(-1.45,cam.pitch+dy*.007))}last=[e.clientX,e.clientY];scheduleDraw()});
 canvas.addEventListener("pointerup",e=>{if(!dragMoved&&downPoint){selectedPart=hit(e.offsetX,e.offsetY);selectPart()}dragging=false;downPoint=null});
 canvas.addEventListener("pointercancel",()=>{dragging=false;downPoint=null});canvas.addEventListener("contextmenu",e=>e.preventDefault());
 canvas.addEventListener("dblclick",()=>{fit();notify("View fitted")});
 canvas.addEventListener("wheel",e=>{e.preventDefault();cam.zoom=Math.max(.15,Math.min(8,cam.zoom*Math.exp(-e.deltaY*.001)));scheduleDraw()},{passive:false});
 const resizeEl=(id,side)=>{const node=$("#"+id);node.addEventListener("pointerdown",e=>{node.setPointerCapture(e.pointerId);node.classList.add("dragging")});node.addEventListener("pointermove",e=>{if(!node.hasPointerCapture(e.pointerId))return;const width=side==="left"?e.clientX:window.innerWidth-e.clientX;const clamped=Math.max(side==="left"?185:250,Math.min(side==="left"?360:430,width));document.documentElement.style.setProperty(side==="left"?"--leftW":"--rightW",clamped+"px");scheduleDraw()});node.addEventListener("pointerup",()=>node.classList.remove("dragging"))};
 resizeEl("leftResizer","left");resizeEl("rightResizer","right");
 if(window.ResizeObserver)new ResizeObserver(scheduleDraw).observe($("#canvasWrap"));window.addEventListener("resize",scheduleDraw);
}
function init(){load();persist();bindUI();initBeginnerUX();refresh();$("#eventLog").hidden=false;$("#checkList").hidden=true;log("SYSTEM","Local workspace ready. No cloud CAD backend connected.");log("GEOMETRY","Loaded "+parts.length+" procedural mesh components");scheduleDraw()}
document.addEventListener("DOMContentLoaded",init);
