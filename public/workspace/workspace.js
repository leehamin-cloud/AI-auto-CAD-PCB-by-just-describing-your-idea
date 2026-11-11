
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
 plate:[["length","Plate length",25,450,1,"mm"],["width","Plate width",25,400,1,"mm"],["thickness","Thickness",2,80,1,"mm"]],
 block:[["length","Block length",20,450,1,"mm"],["width","Block width",20,400,1,"mm"],["height","Block height",10,200,1,"mm"]]
};
const defaults={
 arm:{link1:128,link2:104,base:80,width:24,thickness:12,angle1:34,angle2:-28,payload:200},
 plate:{length:160,width:100,thickness:8},
 block:{length:100,width:65,height:48}
};
const modelNames={arm:"2-DOF Research Arm",plate:"Solid Mounting Blank",block:"Parametric Solid Block"};
const modelSubtitles={arm:"2 revolute joints · visual mesh",plate:"No drilled holes · solid blank",block:"Simple rectangular volume"};
const colors=["#7edb9d","#b6f986","#d3e9ca","#78ab82","#c2dfb2","#99c99e","#82a0a0"];
function makeProject(name){
 const model="arm", params=clone(defaults.arm), material="aluminum";
 const initial={model,params:clone(params),material,label:"Initial state",time:Date.now()};
 return {id:"rf-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),name:String(name||"Untitled project").slice(0,70),model,params,material,hiddenParts:[],history:[initial],cursor:0};
}
let projects=[],activeId="",panel="cad",inspect="properties",cam={yaw:-0.95,pitch:0.46,zoom:1.1,panX:0,panY:0},grid=true,edges=false,selectedPart=null,activeBottom="events",events=[],parts=[],toastTimer,dragging=false,downPoint=null,dragMoved=false;
function safeProject(obj){
 if(!obj||typeof obj!=="object"||!["arm","plate","block"].includes(obj.model))throw Error("Unsupported project format");
 const p=makeProject(obj.name||"Imported project");p.model=obj.model;p.params={};
 for(const [name,,min,max] of limits[p.model]){const v=Number(obj.params?.[name]);p.params[name]=Number.isFinite(v)&&v>=min&&v<=max?v:defaults[p.model][name]}
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
 ["Mesh triangulation","GENERATED"],["Dimensions bounded","CHECKED"],["STL triangle export","AVAILABLE"],["B-rep / STEP kernel","NOT CONNECTED"],["PCB ERC / DRC","NOT EXECUTED"],["Physical engineering safety","UNVERIFIED"]
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
function buildParts(){
 const p=current(),a=p.params;let out=[];
 if(p.model==="arm"){
  const t1=a.angle1*Math.PI/180,t2=(a.angle1+a.angle2)*Math.PI/180,L1=a.link1,L2=a.link2,w=a.width,h=a.thickness,z0=16;
  const s=[0,0,z0],j=[L1*Math.cos(t1),0,z0+L1*Math.sin(t1)],end=[j[0]+L2*Math.cos(t2),0,j[2]+L2*Math.sin(t2)];
  out.push(boxPart("base","Base platform",[0,0,0],[a.base,a.base*.8,16],0,colors[3]));
  out.push(cylinderPart("shoulder","Shoulder pivot",s,w*.63,w*1.24,colors[2]));
  out.push(boxPart("link1","Link 01 — upper",[(s[0]+j[0])/2,0,(s[2]+j[2])/2],[L1,w,h],-t1,colors[0]));
  out.push(cylinderPart("elbow","Elbow pivot",j,w*.54,w*1.22,colors[4]));
  out.push(boxPart("link2","Link 02 — forearm",[(j[0]+end[0])/2,0,(j[2]+end[2])/2],[L2,w*.83,h*.87],-t2,colors[1]));
  out.push(boxPart("tool","End tool bracket",[end[0]+9*Math.cos(t2),0,end[2]+9*Math.sin(t2)],[20,w*.9,h*.7],-t2,colors[5]));
 }else if(p.model==="plate"){
  out.push(boxPart("plate","Undrilled plate blank",[0,0,a.thickness/2],[a.length,a.width,a.thickness],0,colors[0]));
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
 const visible=parts.filter(p=>!current().hiddenParts.includes(p.id));
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
let rafPending=false;
function scheduleDraw(){if(rafPending)return;rafPending=true;requestAnimationFrame(()=>{rafPending=false;draw()})}
function draw(){
 const canvas=$("#modelCanvas"),rect=canvas.getBoundingClientRect();const w=rect.width,h=rect.height;if(w<1||h<1)return;
 const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
 const ctx=canvas.getContext("2d");if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const b=xyzBounds();viewCenter=b.center;viewScale=Math.min(w*.75,h*.73)/Math.max(b.size,90)*cam.zoom;
 if(grid){ctx.save();ctx.lineWidth=.6;ctx.strokeStyle="#35513b66";for(let v=-350;v<=350;v+=25){const A=project([-350,v,-10],w,h),B=project([350,v,-10],w,h),C=project([v,-350,-10],w,h),D=project([v,350,-10],w,h);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.moveTo(C[0],C[1]);ctx.lineTo(D[0],D[1]);ctx.stroke()}
 const O=project([0,0,0],w,h);for(const [v,color] of [[[130,0,0],"#dd877d"],[[0,130,0],"#78c58d"],[[0,0,130],"#73a8e8"]]){const P=project(v,w,h);ctx.beginPath();ctx.moveTo(O[0],O[1]);ctx.lineTo(P[0],P[1]);ctx.strokeStyle=color;ctx.lineWidth=1.65;ctx.stroke()}
 ctx.restore()}
 const faces=[];renderedFaces=[];const axes=cameraAxes(),light=unit([.25,-.45,.9]);let count=0;
 for(const part of parts){if(current().hiddenParts.includes(part.id))continue;for(const t of part.triangles){const points=t.map(v=>project(v,w,h));let normal=unit(cross(sub3(t[1],t[0]),sub3(t[2],t[0])));const shade=.42+.51*Math.abs(dot(normal,light));const depth=(points[0][2]+points[1][2]+points[2][2])/3;faces.push({points,depth,color:part.color,shade,id:part.id,selected:part.id===selectedPart});count++}}
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){ctx.beginPath();ctx.moveTo(f.points[0][0],f.points[0][1]);for(let i=1;i<3;i++)ctx.lineTo(f.points[i][0],f.points[i][1]);ctx.closePath();ctx.fillStyle=litColor(f.color,f.shade);ctx.fill();if(edges||f.selected){ctx.strokeStyle=f.selected?"#ecffb8aa":"#12261e55";ctx.lineWidth=f.selected?1.3:.45;ctx.stroke()}renderedFaces.push(f)}
 if(current().model==="arm"){
  const a=current().params,t1=a.angle1*Math.PI/180,t2=(a.angle1+a.angle2)*Math.PI/180;
  const coords=[[0,0,16],[a.link1*Math.cos(t1),0,16+a.link1*Math.sin(t1)],[a.link1*Math.cos(t1)+a.link2*Math.cos(t2),0,16+a.link1*Math.sin(t1)+a.link2*Math.sin(t2)]];
  coords.forEach((v,i)=>{const S=project(v,w,h);ctx.beginPath();ctx.arc(S[0],S[1],3.5,0,Math.PI*2);ctx.fillStyle="#e2ffbe";ctx.fill();ctx.fillStyle="#99bf91";ctx.font="10px sans-serif";ctx.fillText(i===0?"J1":i===1?"J2":"TCP",S[0]+9,S[1]-8)});
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
function selectPart(){renderTree();const p=parts.find(x=>x.id===selectedPart);$("#selectedPartName").textContent=p?p.label:"선택한 부품 없음";scheduleDraw()}

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
 if(safeLocalGet(KO_WELCOME_KEY)!=="yes")requestAnimationFrame(showWelcome);
}

function renderSummary(){
 const p=current();$("#projectName").textContent=p.name;$("#documentTabName").textContent=p.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,30)+".rfscene";
 $("#componentCount").textContent=String(parts.length);$("#summaryType").textContent=p.model==="arm"?"2-DOF arm":p.model==="plate"?"Plate":"Block";
 $("#modelTitle").textContent=({arm:"움직이는 로봇팔",plate:"평평한 판",block:"네모 블록"}[p.model]||modelNames[p.model]);$("#modelSubtitle").textContent=({arm:"팔 길이와 관절 각도를 조절해요",plate:"가로·세로·두께를 바꿔보세요",block:"가로·세로·높이를 바꿔보세요"}[p.model]||modelSubtitles[p.model]);
 $("#templateSelect").value=p.model;$("#materialSelect").value=p.material;
 $("#volumeEstimate").textContent=fmt(totalVolume()/1000,2)+" cm³";
 $("#massEstimate").textContent=fmt(massFor(totalVolume(),p.material)*1000,1)+" g";
 $("#dynamicFields").innerHTML=limits[p.model].map(([key,label,min,max,step,unit])=>{const ko=beginnerParamLabels[key]||[label,""];const adv=p.model==="arm"&&!simpleArmKeys.has(key)?" advanced-parameter":"";return '<div class="param-row'+adv+'"><div class="param-head"><label for="param-'+key+'">'+esc(ko[0])+'</label><span class="param-unit">'+unit+'</span></div><input type="number" inputmode="decimal" id="param-'+key+'" name="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+p.params[key]+'"><small class="param-help">'+esc(ko[1])+'</small></div>'}).join("");
 $("#viewportTitle").textContent=p.model==="arm"?"3D 로봇팔 미리보기":"3D 부품 미리보기";
}
function refresh(){rebuild();renderHistory();renderSummary();renderProjectList();if(panel!=="cad")renderStage();}
function editParams(){
 const p=current(),next={};
 for(const [key,label,min,max] of limits[p.model]){const input=$("#param-"+key);const n=Number(input.value);if(!input.value.trim()||!Number.isFinite(n)||n<min||n>max){input.focus();notify(label+" must be between "+min+" and "+max,true);return}next[key]=n}
 if(JSON.stringify(next)===JSON.stringify(p.params)){notify("No changes to apply");return}
 mutate(target=>{target.params=next},"Updated dimensional parameters");notify("Mesh regenerated and revision saved");
}
function setTemplate(model){
 if(!limits[model])return;const p=current();if(p.model===model)return;
 mutate(q=>{q.model=model;q.params=clone(defaults[model])},"Created "+modelNames[model]);fit();notify("Template loaded: "+modelNames[model]);
}
function activatePanel(name){
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
  $("#nonCadStage").innerHTML=html;
  $$("[data-stageexport]").forEach(b=>b.addEventListener("click",()=>exportFile(b.dataset.stageexport)));
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
function exportFile(type){
 const p=current(),base=p.name.toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-|-$/g,"")||"robot-forge";
 let blob,ext;
 if(type==="json"){const scene={format:"RobotForgeBrowserScene",version:1,name:p.name,model:p.model,params:p.params,material:p.material,disclaimer:"Browser triangle mesh only; not verified for fabrication"};blob=new Blob([JSON.stringify(scene,null,2)],{type:"application/json"});ext="json"}
 else if(type==="bom"){const rows=[["Component","Volume_mm3","Mass_g_estimate","Material"],...parts.map(x=>[x.label,x.volume.toFixed(3),(massFor(x.volume,p.material)*1000).toFixed(3),p.material])];blob=new Blob([rows.map(row=>row.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(",")).join("\n")],{type:"text/csv;charset=utf-8"});ext="csv"}
 else if(type==="stl"){let lines=["solid RobotForgeBrowserMesh"];for(const part of parts){if(p.hiddenParts.includes(part.id))continue;for(const v of part.triangles){const nn=unit(cross(sub3(v[1],v[0]),sub3(v[2],v[0])));lines.push("  facet normal "+nn.map(x=>x.toFixed(7)).join(" "),"    outer loop");for(const pt of v)lines.push("      vertex "+pt.map(x=>x.toFixed(5)).join(" "));lines.push("    endloop","  endfacet")}}lines.push("endsolid RobotForgeBrowserMesh");blob=new Blob([lines.join("\n")],{type:"model/stl"});ext="stl"}
 else return;
 const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=base+"-"+type+"."+ext;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);log("EXPORT","Downloaded "+link.download);notify("Downloaded "+ext.toUpperCase()+" to your device");
}
function copyText(str){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(str).then(()=>notify("Copied to clipboard")).catch(()=>notify("Clipboard unavailable",true))}else notify("Clipboard API unavailable in this browser",true)}
function applyCommand(){
 const field=$("#commandInput"),cmd=field.value.trim();if(!cmd){notify("Enter a design command",true);return}
 const hist=$("#chatHistory"),msg=document.createElement("div");msg.className="chat-user";msg.textContent=cmd;hist.append(msg);
 const p=current();let result="",changed=false,model=null;const lower=cmd.toLowerCase();
 if(/plate|플레이트|판재/.test(lower))model="plate";else if(/block|블록/.test(lower))model="block";else if(/2\s*[- ]?\s*dof|robot arm|로봇팔/.test(lower))model="arm";
 if(model&&p.model!==model){setTemplate(model);changed=true;result="Switched to "+modelNames[model]+". "}
 const changes={},text=lower.replaceAll(","," ");
 const patterns=[
 ["link1",/(?:link\s*1|l1|first\s+link|첫\s*링크|상완)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["link2",/(?:link\s*2|l2|second\s+link|둘째\s*링크|전완)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["angle1",/(?:angle\s*1|theta\s*1|joint\s*1|관절\s*1)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["angle2",/(?:angle\s*2|theta\s*2|joint\s*2|관절\s*2)\s*(?:=|:|to|를|은)?\s*(-?\d+(?:\.\d+)?)/i],
 ["payload",/(?:payload|하중)\s*(?:=|:|to|를|은)?\s*(\d+(?:\.\d+)?)/i]
 ];
 for(const [key,pat] of patterns){const m=text.match(pat);if(m){const val=Number(m[1]);const rule=limits[current().model].find(r=>r[0]===key);if(!rule){result="That parameter is not supported for this template.";break}if(!Number.isFinite(val)||val<rule[2]||val>rule[3]){result=rule[1]+" must stay between "+rule[2]+" and "+rule[3]+".";break}changes[key]=val}}
 if(Object.keys(changes).length&&!/(must stay between|not supported)/.test(result)){mutate(q=>Object.assign(q.params,changes),"Rule command: "+Object.keys(changes).join(", "));changed=true;result+="Updated "+Object.entries(changes).map(x=>x[0]+" = "+x[1]).join(", ")+". Mesh regenerated."}
 if(!result)result=changed?"Template updated.":"No supported change detected. Try: link1 150 link2 100, angle1 45, or create plate.";
 const reply=document.createElement("div");reply.className="chat-response";reply.textContent=result;hist.append(reply);hist.scrollTop=hist.scrollHeight;
 log(changed?"RULE":"INFO",result,!changed);notify(result,!changed);field.value="";
}
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
