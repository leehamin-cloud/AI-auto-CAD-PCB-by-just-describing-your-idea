/* Robot Forge PCB Studio v2.5. Browser-only board draft, no verified ERC/DRC. */
(() => {
"use strict";
const $$s=q=>Array.from(document.querySelectorAll(q));
const $s=q=>document.querySelector(q);
const deep=v=>JSON.parse(JSON.stringify(v));
const num=v=>Number(v).toFixed(3).replace(/\.?0+$/,"");
const safe=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KEY="robotforge.pcb.studio.v25.";
const lib={
 resistor:{label:"저항",prefix:"R",w:10,h:4,pads:[[-3.81,0],[3.81,0]]},
 led:{label:"LED",prefix:"D",w:9,h:5,pads:[[-2.54,0],[2.54,0]]},
 capacitor:{label:"커패시터",prefix:"C",w:9,h:5,pads:[[-2.54,0],[2.54,0]]},
 conn2:{label:"2핀 커넥터",prefix:"J",w:7,h:10,pads:[[0,-2.54],[0,2.54]]},
 conn3:{label:"3핀 커넥터",prefix:"J",w:7,h:13,pads:[[0,-5.08],[0,0],[0,5.08]]},
 ic4:{label:"4핀 IC",prefix:"U",w:10,h:10,pads:[[-3.81,-3.81],[-3.81,3.81],[3.81,3.81],[3.81,-3.81]]}
};
function starter(){
 return {format:"RobotForgePCB",version:1,width:100,height:70,components:[
 {id:"J1",kind:"conn3",x:16,y:29,rotation:0},
 {id:"U1",kind:"ic4",x:49,y:34,rotation:0},
 {id:"D1",kind:"led",x:79,y:30,rotation:0}
 ],traces:[],schematic:{nets:[]}};
}
let board=starter(),revision=[],tool="move",active=false,selected=null,routing=null,pointer=null,scale=1,originX=0,originY=0,mousePoint=null,pcbView="layout";
const netlib=window.robotForgeNetlist;
if(!netlib)throw Error("PCB netlist module was not loaded");
const traceWidths=new Set([0.3,0.5,0.8,1]);
const snap=n=>Math.round(n*2)/2;
function isValidShape(b){
 if(!b||b.format!=="RobotForgePCB"||b.version!==1||!Number.isFinite(b.width)||!Number.isFinite(b.height)||b.width<40||b.width>220||b.height<30||b.height>160)return false;
 if(!Array.isArray(b.components)||!Array.isArray(b.traces)||b.components.length>100||b.traces.length>300)return false;
 const refs=new Set();
 for(const c of b.components){
  if(!c||!lib[c.kind]||!/^([A-Z][1-9][0-9]{0,3})$/.test(c.id)||refs.has(c.id)||
    !Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>b.width||c.y<0||c.y>b.height||
    ![0,90,180,270].includes(c.rotation))return false;
  refs.add(c.id);
 }
 for(const t of b.traces){
  if(!t||typeof t.id!=="string"||t.id.length>36||
     typeof t.a!=="string"||typeof t.b!=="string"||t.a===t.b||
     !traceWidths.has(Number(t.width))||!/^([A-Z][1-9][0-9]{0,3}):[1-4]$/.test(t.a)||!/^([A-Z][1-9][0-9]{0,3}):[1-4]$/.test(t.b))return false;
  if(!padPos(t.a,b)||!padPos(t.b,b))return false;
 }
 if(netlib.validateShape(b,pads(b).map(p=>p.ref)))return false;
 return true;
}
function projectKey(){
 try{return KEY+current().id}catch{return KEY+"local"}
}
function load(){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(projectKey())||"null")}catch{}
 board=isValidShape(saved)?saved:starter();if(!board.schematic)board.schematic={nets:[]};revision=[];selected=null;routing=null;mousePoint=null;pcbView="layout";
 updateSizeInputs();setPcbView("layout");notice("PCB 초안 준비 완료 · 실제 회로 검증과 별개입니다.");
}
function save(){
 try{localStorage.setItem(projectKey(),JSON.stringify(board))}catch{notice("저장 실패: 저장소를 사용할 수 없습니다.",true)}
}
function transact(fn,label){
 const before=JSON.stringify(board);
 const draft=deep(board);fn(draft);
 if(!isValidShape(draft)){notice("올바르지 않은 부품 또는 기판 데이터입니다.",true);return false}
 if(JSON.stringify(draft)===before)return false;
 revision.push(board);if(revision.length>40)revision.shift();
 board=draft;save();draw();notice(label);
 return true;
}
function undo(){
 if(!revision.length){notice("되돌릴 기록이 없습니다.");return}
 board=revision.pop();selected=null;routing=null;save();updateSizeInputs();draw();notice("직전 PCB 수정으로 되돌렸어요.");
}
function padPos(reference,b=board){
 const [id,n]=String(reference).split(":");
 const c=b.components.find(c=>c.id===id);
 if(!c)return null;
 const p=lib[c.kind].pads[Number(n)-1];if(!p)return null;
 const rad=c.rotation*Math.PI/180,co=Math.cos(rad),si=Math.sin(rad);
 return {x:c.x+p[0]*co-p[1]*si,y:c.y+p[0]*si+p[1]*co};
}
function pads(b=board){return b.components.flatMap(c=>lib[c.kind].pads.map((_,i)=>({ref:c.id+":"+(i+1),...padPos(c.id+":"+(i+1),b)})))}
function trackLines(b=board){return b.traces.map(t=>({id:t.id,a:t.a,b:t.b,start:padPos(t.a,b),end:padPos(t.b,b),width:t.width})).filter(t=>t.start&&t.end)}
function unionNets(b=board){
 const parent=new Map();
 for(const p of pads(b))parent.set(p.ref,p.ref);
 function root(a){while(parent.get(a)!==a){parent.set(a,parent.get(parent.get(a)));a=parent.get(a)}return a}
 for(const t of b.traces){if(parent.has(t.a)&&parent.has(t.b))parent.set(root(t.a),root(t.b))}
 const groups=new Map();
 for(const id of parent.keys()){const rt=root(id);if(!groups.has(rt))groups.set(rt,[]);groups.get(rt).push(id)}
 const connected=[...groups.values()].filter(g=>g.length>1).map(g=>g.sort()).sort((a,b)=>a[0].localeCompare(b[0]));
 const nets=new Map(),netNames=[];
 connected.forEach((group,i)=>{const n=i+1,name="RF_NET_"+n;netNames.push({number:n,name,pads:group});for(const pad of group)nets.set(pad,n)});
 return {nets,netNames};
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function pointSegDist(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;
 if(L<1e-12)return dist(p,a);
 const t=Math.min(1,Math.max(0,((p.x-a.x)*dx+(p.y-a.y)*dy)/L));
 return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function ccw(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function intersects(a,b,c,d){
 const e1=ccw(a,b,c),e2=ccw(a,b,d),e3=ccw(c,d,a),e4=ccw(c,d,b);
 return e1*e2<-1e-8&&e3*e4<-1e-8;
}
function validate(b=board){
 const issues=[],warnings=[],insights=[],allPads=pads(b),lines=trackLines(b),net=unionNets(b),logic=netlib.graph(b,allPads,net);
 for(const c of b.components){
  const item=lib[c.kind],rad=c.rotation*Math.PI/180;
  const ex=(Math.abs(Math.cos(rad))*item.w+Math.abs(Math.sin(rad))*item.h)/2;
  const ey=(Math.abs(Math.sin(rad))*item.w+Math.abs(Math.cos(rad))*item.h)/2;
  if(c.x-ex<1.5||c.x+ex>b.width-1.5||c.y-ey<1.5||c.y+ey>b.height-1.5)
   issues.push(c.id+" 부품이 기판 가장자리에서 1.5mm보다 가깝습니다.");
 }
 // Approximate rotated component courtyards by axis-aligned bounding boxes.
 for(let i=0;i<b.components.length;i++)for(let j=i+1;j<b.components.length;j++){
  const a=b.components[i],c=b.components[j],A=lib[a.kind],B=lib[c.kind];
  const ext=p=>{
    const shape=lib[p.kind],angle=p.rotation*Math.PI/180;
    return {x:(Math.abs(Math.cos(angle))*shape.w+Math.abs(Math.sin(angle))*shape.h)/2,
            y:(Math.abs(Math.sin(angle))*shape.w+Math.abs(Math.cos(angle))*shape.h)/2};
  };
  const ea=ext(a),eb=ext(c);
  const gapX=Math.abs(a.x-c.x)-ea.x-eb.x,gapY=Math.abs(a.y-c.y)-ea.y-eb.y;
  if(gapX<0.5&&gapY<0.5)issues.push(a.id+" ↔ "+c.id+" 부품 외형이 겹치거나 0.5mm 이내로 접근합니다.");
 }
 for(let i=0;i<allPads.length;i++){
  const a=allPads[i];
  if(a.x<1.3||a.x>b.width-1.3||a.y<1.3||a.y>b.height-1.3)
   issues.push(a.ref+" 패드가 기판 가장자리에 너무 가깝습니다.");
  for(let j=i+1;j<allPads.length;j++){
   const p=allPads[j];if(a.ref.split(":")[0]!==p.ref.split(":")[0]&&dist(a,p)<2.45)
    issues.push(a.ref+" ↔ "+p.ref+" 패드 간격이 부족합니다.");
  }
 }
 for(const line of lines){
  if(dist(line.start,line.end)<1.5)issues.push(line.a+" ↔ "+line.b+" 배선 길이가 너무 짧습니다.");
  for(const p of allPads){
   if(p.ref===line.a||p.ref===line.b)continue;
   if(pointSegDist(p,line.start,line.end)<1+line.width/2+0.25)
    issues.push(line.a+" ↔ "+line.b+" 배선이 "+p.ref+" 패드와 너무 가깝습니다.");
  }
  if([line.start,line.end].some(p=>p.x<1.5||p.y<1.5||p.x>b.width-1.5||p.y>b.height-1.5))
   issues.push(line.a+" ↔ "+line.b+" 배선이 기판 가장자리에 너무 가깝습니다.");
 }
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j];
  if(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b)continue;
  if(intersects(a.start,a.end,b.start,b.end))issues.push(a.id+"과 "+b.id+" 배선이 같은 면에서 교차합니다.");
  else{
   const gap=Math.min(pointSegDist(a.start,b.start,b.end),pointSegDist(a.end,b.start,b.end),pointSegDist(b.start,a.start,a.end),pointSegDist(b.end,a.start,a.end));
   if(gap<(a.width+b.width)/2+0.25)issues.push(a.id+"과 "+b.id+" 배선 사이의 간격이 부족합니다.");
  }
 }
 for(const short of logic.shorts)issues.push("전기적 연결 충돌: "+short.groups.join(" ↔ ")+" 신호가 하나의 구리 배선으로 합쳐졌습니다.");
 for(const open of logic.opens)issues.push("필수 배선 누락: "+open.name+" ("+open.groups.length+"개로 분리된 연결)");
 const singles=allPads.filter(p=>!net.nets.has(p.ref)).length;
 if(singles)warnings.push(singles+"개 패드가 배선에 연결되지 않았습니다. 회로도가 없어 필수 연결 여부는 판단할 수 없습니다.");
 warnings.push(logic.plans?"등록된 핀 연결 계획과 배선의 일치 여부만 검사했습니다. 실제 전자회로는 검증되지 않았습니다.":"필요한 핀 연결을 아직 등록하지 않았습니다. 회로의 전기적 정답은 검증되지 않았습니다.");
 warnings.push("이 검사는 단순 거리·교차 검사이며 KiCad DRC/ERC를 대체하지 않습니다.");
 insights.push(b.components.length+"개 부품 · "+b.traces.length+"개 배선 · "+net.netNames.length+"개 연결 그룹 · 필요한 신호 "+logic.plans+"개");
 return {issues:[...new Set(issues)],warnings,insights,unconnected:singles,nets:net.netNames,opens:logic.opens,shorts:logic.shorts,planned:logic.plans};
}
function getInfo(){
 const r=validate();
 return {components:board.components.length,traces:board.traces.length,...r};
}
function refNext(kind,b=board){
 const prefix=lib[kind].prefix,ids=new Set(b.components.map(c=>c.id));
 for(let n=1;n<10000;n++){const id=prefix+n;if(!ids.has(id))return id}
 return null;
}
function add(kind){
 if(!lib[kind])return false;
 if(board.components.length>=100){notice("부품은 최대 100개까지 추가할 수 있습니다.",true);return false}
 const id=refNext(kind);let x=board.width/2,y=board.height/2;
 // Pick first position that avoids existing pad collisions.
 let found=false;
 for(let iy=0;iy<9&&!found;iy++)for(let ix=0;ix<11&&!found;ix++){
  const cx=10+ix*(board.width-20)/10,cy=10+iy*(board.height-20)/8;
  if(!board.components.some(c=>Math.hypot(c.x-cx,c.y-cy)<14)){x=snap(cx);y=snap(cy);found=true}
 }
 if(!found){notice("기판에 부품을 놓을 공간이 부족합니다.",true);return false}
 const done=transact(draft=>draft.components.push({id,kind,x,y,rotation:0}),id+" 부품을 추가했어요.");
 if(done){selected={type:"component",id};setTool("move");draw()}return done;
}
function rotate(){
 if(!selected||selected.type!=="component")return notice("회전할 부품을 선택해주세요.");
 const id=selected.id;
 transact(b=>{const c=b.components.find(x=>x.id===id);if(c)c.rotation=(c.rotation+90)%360},id+"을 90° 회전했어요.");
}
function remove(){
 if(!selected)return notice("삭제할 항목을 선택해주세요.");
 const s=selected;transact(b=>{
  if(s.type==="component"){b.components=b.components.filter(c=>c.id!==s.id);b.traces=b.traces.filter(t=>!t.a.startsWith(s.id+":")&&!t.b.startsWith(s.id+":"));netlib.dropComponent(b,s.id)}
  else b.traces=b.traces.filter(t=>t.id!==s.id);
 },"선택한 "+(s.type==="component"?"부품":"배선")+"을 삭제했어요.");
 selected=null;routing=null;draw();
}
function addRoute(first,second){
 if(!padPos(first)||!padPos(second)||first===second)return notice("서로 다른 패드 두 개를 선택해주세요.",true);
 const req=netlib.graph(board,pads(board),unionNets(board)).expected;
 if(req.has(first)&&req.has(second)&&req.get(first)!==req.get(second))return notice("두 패드는 서로 다른 필수 신호("+req.get(first)+" / "+req.get(second)+")입니다. 합선을 방지하도록 배선 연결을 막았습니다.",true);
 if(board.traces.some(t=>(t.a===first&&t.b===second)||(t.a===second&&t.b===first)))return notice("이미 연결된 패드입니다.",true);
 const w=Number($s("#pcbTraceWidth")?.value||0.5);
 const id="T"+(Date.now().toString(36))+"-"+Math.floor(Math.random()*100000).toString(36);
 const ok=transact(b=>b.traces.push({id,a:first,b:second,width:traceWidths.has(w)?w:0.5}),first+" ↔ "+second+" 배선을 만들었어요.");
 if(ok){const r=validate();if(r.issues.length)notice("배선 생성됨 · 간격/교차 문제 "+r.issues.length+"건을 확인해주세요.",true)}
 routing=null;draw();return ok;
}
function setTool(next){
 if(!["move","route","delete"].includes(next))return;
 tool=next;routing=null;mousePoint=null;
 $$s("[data-pcb-tool]").forEach(b=>b.classList.toggle("active",b.dataset.pcbTool===tool));
 const guide={move:"부품을 클릭해 선택하거나 드래그해 이동하세요.",route:"배선을 시작할 패드를 클릭한 다음, 연결할 패드를 클릭하세요.",delete:"부품 또는 배선을 클릭하면 삭제합니다."};
 const hint=$s("#pcbInstruction");if(hint)hint.textContent=guide[tool];draw();
}
function sizeUpdate(){
 const w=Number($s("#pcbWidth")?.value),h=Number($s("#pcbHeight")?.value);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<40||w>220||h<30||h>160)
  return notice("가로 40~220mm, 세로 30~160mm 범위에서 입력해주세요.",true);
 transact(b=>{b.width=w;b.height=h},"기판 크기를 "+w+" × "+h+"mm로 바꿨어요.");
 const checks=validate();if(checks.issues.length)notice("크기가 바뀌었습니다. 가장자리·간격 경고를 확인해주세요.",true);
}
function updateSizeInputs(){
 const w=$s("#pcbWidth"),h=$s("#pcbHeight");
 if(w)w.value=board.width;if(h)h.value=board.height;
}
function notice(message,problem=false){
 const v=$s("#pcbCanvasHint");if(v)v.textContent=message;
 const a=$s("#pcbInstruction");if(a&&problem)a.textContent=message;
}

function registerNet(){
 const name=String($s("#pcbNetName")?.value||"").trim();
 const pinA=$s("#pcbNetPinA")?.value,pinB=$s("#pcbNetPinB")?.value;
 if(!pinA||!pinB)return notice("연결할 핀 A와 핀 B를 선택해주세요.",true);
 const trial=deep(board);
 try{netlib.add(trial,name,pinA,pinB)}
 catch(e){return notice(e.message||String(e),true)}
 const ok=transact(b=>netlib.add(b,name,pinA,pinB),name.toUpperCase()+" 신호 연결을 추가했어요.");
 if(ok){
  const nameField=$s("#pcbNetName");if(nameField)nameField.value="DATA";
  draw();
 }
}
function unregisterNet(name){
 const ok=transact(b=>netlib.remove(b,name),name+" 연결 계획을 삭제했어요.");
 if(ok)draw();
}
function loadExample(){
 const starterPins=["J1:1","J1:2","J1:3","U1:1","U1:2","U1:3","D1:1","D1:2"];
 const ids=new Set(pads(board).map(p=>p.ref));
 if(!starterPins.every(id=>ids.has(id)))return notice("예제는 기본 J1, U1, D1 부품이 있는 기판에 적용할 수 있어요.",true);
 const example={nets:[
  {name:"VCC",pins:["J1:1","U1:1"]},
  {name:"GND",pins:["J1:2","D1:2"]},
  {name:"DATA",pins:["J1:3","U1:2"]},
  {name:"LED_CTRL",pins:["U1:3","D1:1"]}
 ]};
 const copy=deep(board);copy.schematic=example;
 if(!isValidShape(copy))return notice("예시 연결이 기존 부품과 충돌합니다.",true);
 transact(b=>b.schematic=deep(example),"예시 핀 연결 계획 4개를 불러왔어요. 실제 전기적 타당성은 미검증입니다.");
 setPcbView("nets");
}
function renderNetEditor(){
 const refs=pads(board).map(p=>p.ref).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const options=refs.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join("");
 for(const [i,id] of ["#pcbNetPinA","#pcbNetPinB"].entries()){
  const field=$s(id);if(!field)continue;
  const token=refs.join("|");
  if(field.dataset?.optionsToken!==token){
   const prev=field.value;
   field.innerHTML=options;
   if(field.dataset)field.dataset.optionsToken=token;
   field.value=refs.includes(prev)?prev:refs[Math.min(i,refs.length-1)]||"";
  }
 }
 const list=$s("#pcbNetList");
 if(list){
  const nets=netlib.netPlan(board),status=netlib.graph(board,pads(board),unionNets(board));
  list.innerHTML=nets.length?nets.map(n=>{
   const open=status.opens.some(x=>x.name===n.name);
   return '<div class="pcb-net-row"><div><b>'+safe(n.name)+'</b><small>'+safe(n.pins.join(" · "))+'</small><em class="'+(open?"pending":"connected")+'">'+(open?"배선 대기":"연결됨")+'</em></div><button type="button" data-net-remove="'+safe(n.name)+'" aria-label="'+safe(n.name)+' 연결 삭제">×</button></div>';
  }).join(""):'<div class="pcb-net-empty">아직 연결 계획이 없어요. 핀 A와 B를 선택해 추가하세요.</div>';
 }
}
function setPcbView(name){
 if(!["layout","nets"].includes(name))return;
 pcbView=name;routing=null;mousePoint=null;pointer=null;
 const a=$s("#pcbLayoutView"),b=$s("#pcbNetsView");
 for(const [node,on]of [[a,name==="layout"],[b,name==="nets"]]){
  node?.classList.toggle("active",on);node?.setAttribute("aria-pressed",String(on));
 }
 const svg=$s("#pcbSvg");if(svg)svg.style.cursor=name==="nets"?"default":"";
 const hint=$s("#pcbCanvasHint");if(hint)hint.textContent=name==="nets"?"핀 사이의 필수 연결 계획입니다. 실제 부품 회로도는 아닙니다.":"부품을 드래그하거나 패드 두 개를 눌러 배선을 만들 수 있어요.";
 draw();
}

function renderInspection(){
 const result=validate(),field=$s("#pcbValidation");
 if(field){
  const first=result.issues.slice(0,3).map(s=>"• "+s).join("\n");
  field.textContent=(result.issues.length?"⚠ 초안 간격 검사: 문제 "+result.issues.length+"건":"✓ 간격·교차 기초 검사: 발견된 오류 없음")+
   "\n"+result.insights.join("\n")+
   (first?"\n"+first:"")+
   "\n\n※ 회로도 연결·공식 DRC는 미검증";
  field.classList.toggle("has-issues",Boolean(result.issues.length));
 }
 const selection=$s("#pcbSelection");
 if(selection){
  const c=selected?.type==="component"?board.components.find(c=>c.id===selected.id):null;
  const t=selected?.type==="trace"?board.traces.find(t=>t.id===selected.id):null;
  selection.textContent=c?c.id+" · "+lib[c.kind].label+" (x "+num(c.x)+", y "+num(c.y)+" mm)":
   t?"배선 "+t.a+" → "+t.b:"선택한 항목 없음";
 }
 renderNetEditor();
  const stats=$s("#pcbCanvasStats");if(stats)stats.textContent=board.components.length+"개 부품 · "+board.traces.length+"개 배선 · "+result.issues.length+"개 검토 항목";
}
function view(){
 scale=Math.min(820/board.width,505/board.height);
 originX=(1000-board.width*scale)/2;originY=(640-board.height*scale)/2;
}
function shapeSvg(b=board){
 view();
 const gx=[],gy=[],step=5;
 for(let x=step;x<b.width;x+=step)gx.push('<line class="pcb-grid" x1="'+x+'" y1="0" x2="'+x+'" y2="'+b.height+'"/>');
 for(let y=step;y<b.height;y+=step)gy.push('<line class="pcb-grid" x1="0" y1="'+y+'" x2="'+b.width+'" y2="'+y+'"/>');
 const traces=trackLines(b).map(t=>{
  const on=selected?.type==="trace"&&selected.id===t.id?" selected":"";
  return '<line data-trace="'+safe(t.id)+'" class="pcb-trace'+on+'" x1="'+num(t.start.x)+'" y1="'+num(t.start.y)+'" x2="'+num(t.end.x)+'" y2="'+num(t.end.y)+'" stroke-width="'+num(t.width)+'" />';
 }).join("");
 const components=b.components.map(c=>{
  const shape=lib[c.kind];const on=selected?.type==="component"&&selected.id===c.id?" pcb-comp-selected":"";
  const padHtml=shape.pads.map((p,i)=>'<circle class="pcb-pad'+(routing===c.id+":"+(i+1)?" selected":"")+'" data-pad="'+c.id+":"+(i+1)+'" cx="'+num(p[0])+'" cy="'+num(p[1])+'" r="1.05" />').join("");
  const label='<text class="pcb-comp-label" x="0" y="'+num(-shape.h/2-2)+'">'+c.id+'</text>';
  return '<g data-component="'+c.id+'" class="pcb-component'+on+'" transform="translate('+num(c.x)+' '+num(c.y)+') rotate('+c.rotation+')">'+
   '<rect class="pcb-comp-body" x="'+num(-shape.w/2)+'" y="'+num(-shape.h/2)+'" width="'+shape.w+'" height="'+shape.h+'" rx=".8"/>'+label+padHtml+'</g>';
 }).join("");

 const graph=netlib.graph(b,pads(b),unionNets(b));
 const unrouted=graph.opens.flatMap(req=>{
  const first=padPos(req.groups[0][0],b);
  return req.groups.slice(1).map(g=>{
   const target=padPos(g[0],b);
   if(!first||!target)return "";
   return '<line class="pcb-airwire" x1="'+num(first.x)+'" y1="'+num(first.y)+'" x2="'+num(target.x)+'" y2="'+num(target.y)+'" />';
  });
 }).join("");

 let wire="";
 if(routing&&mousePoint){const a=padPos(routing,b);if(a)wire='<line class="pcb-wire-preview" x1="'+num(a.x)+'" y1="'+num(a.y)+'" x2="'+num(mousePoint.x)+'" y2="'+num(mousePoint.y)+'"/>'}
 const scaleText='<text x="'+num(b.width/2)+'" y="'+num(b.height+4)+'" class="pcb-board-mm">'+num(b.width)+' × '+num(b.height)+' mm · top copper F.Cu</text>';
 return '<g transform="translate('+num(originX)+' '+num(originY)+') scale('+num(scale)+')">'+
   '<rect class="pcb-board" width="'+b.width+'" height="'+b.height+'" rx="1.0"/>'+
   '<g>'+gx.join("")+gy.join("")+'</g><rect class="pcb-board-outline" width="'+b.width+'" height="'+b.height+'" rx="1.0"/>'+
   traces+unrouted+wire+components+scaleText+'</g>';
}
function draw(){
 if(!active)return;
 const svg=$s("#pcbSvg");if(!svg)return;
 if(pcbView==="nets"){
  const illustration=netlib.illustration(board,unionNets(board));
  const vb=illustration.match(/viewBox="([^"]+)"/);
  const inner=illustration.replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
  svg.setAttribute("viewBox",vb?.[1]||"0 0 1000 640");
  svg.innerHTML=inner;
 }else{
  svg.setAttribute("viewBox","0 0 1000 640");
  svg.innerHTML=shapeSvg();
 }
 renderInspection();
 const label=$s("#pcbCanvasLabel");if(label)label.textContent=num(board.width)+" × "+num(board.height)+" mm · 전면 구리층 F.Cu";
}
function coordinates(evt){
 const svg=$s("#pcbSvg");if(!svg)return null;
 if(svg.createSVGPoint&&svg.getScreenCTM?.()){
  const matrix=svg.getScreenCTM();if(matrix){
   const p=svg.createSVGPoint();p.x=evt.clientX;p.y=evt.clientY;
   const u=p.matrixTransform(matrix.inverse());return {x:(u.x-originX)/scale,y:(u.y-originY)/scale};
  }
 }
 const rect=svg.getBoundingClientRect(),s=Math.min(rect.width/1000,rect.height/640),
  offsetX=(rect.width-s*1000)/2,offsetY=(rect.height-s*640)/2;
 return {x:((evt.clientX-rect.left-offsetX)/s-originX)/scale,y:((evt.clientY-rect.top-offsetY)/s-originY)/scale};
}
function onPointerDown(evt){
 if(pcbView!=="layout")return;
 const target=evt.target, pad=target?.closest?.("[data-pad]"),trace=target?.closest?.("[data-trace]"),component=target?.closest?.("[data-component]");
 if(tool==="route"&&pad){
  const ref=pad.dataset.pad;
  if(!routing){routing=ref;notice(ref+" 선택됨. 연결할 패드를 눌러주세요.");draw()}
  else if(ref===routing){routing=null;draw();notice("배선 시작을 취소했어요.")}
  else addRoute(routing,ref);
  return;
 }
 if(tool==="delete"){
  if(component){selected={type:"component",id:component.dataset.component};remove()}
  else if(trace){selected={type:"trace",id:trace.dataset.trace};remove()}
  return;
 }
 if(tool!=="move")return;
 if(component){
  selected={type:"component",id:component.dataset.component};
  const c=board.components.find(c=>c.id===selected.id),p=coordinates(evt);
  if(c&&p){pointer={id:evt.pointerId,comp:c.id,offsetX:c.x-p.x,offsetY:c.y-p.y,moved:false,original:JSON.stringify(board)};try{$s("#pcbSvg").setPointerCapture(evt.pointerId)}catch{}}
 }else if(trace)selected={type:"trace",id:trace.dataset.trace};
 else selected=null;
 draw();
}
function onPointerMove(evt){
 if(pcbView!=="layout")return;
 const p=coordinates(evt);if(!p)return;
 if(tool==="route"&&routing){mousePoint={x:snap(p.x),y:snap(p.y)};draw();return}
 if(!pointer||pointer.id!==evt.pointerId)return;
 const item=board.components.find(c=>c.id===pointer.comp);if(!item)return;
 const shape=lib[item.kind],w=item.rotation%180?shape.h:shape.w,h=item.rotation%180?shape.w:shape.h;
 const x=snap(Math.min(board.width-w/2,Math.max(w/2,p.x+pointer.offsetX))),y=snap(Math.min(board.height-h/2,Math.max(h/2,p.y+pointer.offsetY)));
 if(x!==item.x||y!==item.y){item.x=x;item.y=y;pointer.moved=true;draw()}
}
function onPointerUp(evt){
 if(!pointer||pointer.id!==evt.pointerId)return;
 if(pointer.moved){
  let prev=JSON.parse(pointer.original);
  revision.push(prev);if(revision.length>40)revision.shift();
  save();notice(pointer.comp+" 위치를 변경했어요.");
 }
 pointer=null;draw();
}
function onSvgLeave(){if(routing){mousePoint=null;draw()}}
function uid(seed){let k=0;for(let i=0;i<seed.length;i++)k=(Math.imul(k,31)+seed.charCodeAt(i))>>>0;const a=k.toString(16).padStart(8,"0");return a+"-a12b-4e3f-8d91-"+(k*17>>>0).toString(16).padStart(8,"0")+"0000"}
function kicadDraft(b=board){
 // Not verified by KiCad CLI: this is a starter file only, not manufacturing output.
 const connections=netlib.exportGraph(b,pads(b),unionNets(b)),q=s=>'"'+String(s).replace(/["\\]/g,"")+'"',f=n=>Number(n).toFixed(4),line=[];
 const getNet=ref=>connections.nets.get(ref)||0,netName=n=>n?connections.netNames[n-1]?.name||"":"";
 line.push('(kicad_pcb (version 20241229) (generator "robot_forge") (generator_version "9.0")',
  ' (general (thickness 1.6) (legacy_teardrops no))',' (paper "A4")',
  ' (layers (0 "F.Cu" signal) (31 "B.Cu" signal) (37 "F.SilkS" user) (44 "Edge.Cuts" user))',
  ' (setup (pad_to_mask_clearance 0))',' (net 0 "")');
 for(const net of connections.netNames)line.push(' (net '+net.number+' '+q(net.name)+')');
 line.push(' (gr_rect (start 0 0) (end '+f(b.width)+' '+f(b.height)+') (stroke (width 0.05) (type default)) (fill none) (layer "Edge.Cuts") (uuid "'+uid("outline") +'"))');
 for(const c of b.components){
  const comp=lib[c.kind];
  line.push(' (footprint '+q("RobotForge:"+c.kind)+' (layer "F.Cu") (at '+f(c.x)+' '+f(c.y)+' '+c.rotation+') (uuid "'+uid("fp"+c.id)+'")');
  line.push('  (property "Reference" '+q(c.id)+' (at 0 '+f(-comp.h/2-2.5)+') (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.12))))');
  line.push('  (property "Value" '+q(comp.label)+' (at 0 '+f(comp.h/2+2.5)+') (layer "F.Fab") (effects (font (size 1 1) (thickness 0.12))))');
  line.push('  (fp_rect (start '+f(-comp.w/2)+' '+f(-comp.h/2)+') (end '+f(comp.w/2)+' '+f(comp.h/2)+') (stroke (width 0.12) (type default)) (fill none) (layer "F.SilkS") (uuid "'+uid("fpbody"+c.id)+'"))');
  line.push('  (attr through_hole)');
  for(let i=0;i<comp.pads.length;i++){
   const p=comp.pads[i],ref=c.id+":"+(i+1),net=getNet(ref);
   line.push('  (pad '+q(i+1)+' thru_hole circle (at '+f(p[0])+' '+f(p[1])+') (size 2 2) (drill 0.9) (layers "*.Cu" "*.Mask") (net '+net+' '+q(netName(net))+') (uuid "'+uid("pad"+ref)+'"))');
  }
  line.push(' )');
 }
 for(const t of trackLines(b)){
  const net=connections.traceNets.get(t.id)||0,p=t.start,r=t.end;
  line.push(' (segment (start '+f(p.x)+' '+f(p.y)+') (end '+f(r.x)+' '+f(r.y)+') (width '+f(t.width)+') (layer "F.Cu") (net '+net+') (uuid "'+uid(t.id)+'"))');
 }
 line.push(')');
 return line.join("\n");
}
function svgDocument(){
 const previous=routing;const priorMouse=mousePoint;
 routing=null;mousePoint=null;
 const content=shapeSvg();
 routing=previous;mousePoint=priorMouse;
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640">'+
  '<style>.pcb-board{fill:#d9f2ef;stroke:#498b90;stroke-width:.4}.pcb-grid{stroke:#81aeb030;stroke-width:.1}.pcb-board-outline{fill:none;stroke:#398e86;stroke-width:.35}.pcb-comp-body{fill:#fff;stroke:#468da1;stroke-width:.28}.pcb-pad{fill:#d59b4d;stroke:#fff;stroke-width:.25}.pcb-comp-label{font:700 2.2px Arial;fill:#235579;text-anchor:middle}.pcb-trace{stroke:#de7b55;stroke-linecap:round}.pcb-board-mm{font:2px Arial;fill:#46787e;text-anchor:middle}</style>'+
  content+'</svg>';
}
function exportBoard(type){
 const state=board;
 let data="",mime="text/plain",extension=type;
 if(type==="json"){data=JSON.stringify({...state,disclaimer:"Local draft; not manufacturer-validated; no schematic connectivity validation"},null,2);mime="application/json"}
 else if(type==="svg"){data=svgDocument();mime="image/svg+xml"}
 else if(type==="netlist"){const status=netlib.graph(board,pads(board),unionNets(board));data=JSON.stringify({format:"RobotForgeLogicalNetPlan",version:1,kind:"UNVERIFIED_PIN_PLAN",nets:netlib.netPlan(board),status:{opens:status.opens,shorts:status.shorts},disclaimer:"Logical pin requirements only. Not a KiCad schematic or ERC result."},null,2);mime="application/json";extension="netlist.json"}
 else if(type==="kicad"){data=kicadDraft();extension="kicad_pcb"}
 else return;
 const blob=new Blob([data],{type:mime+";charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="robot-forge-pcb-draft."+extension;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 notice(extension+" 파일을 다운로드했습니다. 실제 제작 전 KiCad에서 확인해주세요.");
 return data;
}
function showExport(){
 const dlg=$s("#pcbExportDialog");if(dlg?.showModal)dlg.showModal();
}
function open(){
 active=true;document.body.classList.add("pcb-mode");
 const stage=$s("#pcbStage"),inspector=$s("#pcbInspector");
 if(stage)stage.hidden=false;if(inspector)inspector.hidden=false;
 const a=$s("#rfCadTab"),b=$s("#rfPcbTab");
 a?.classList.remove("active");a?.setAttribute("aria-pressed","false");
 b?.classList.add("active");b?.setAttribute("aria-pressed","true");
 const label=$s("#exportButton span");if(label)label.textContent="PCB 파일";
 load();setTool("move");draw();
}
function close(){
 active=false;selected=null;routing=null;pointer=null;document.body.classList.remove("pcb-mode");
 const stage=$s("#pcbStage"),inspector=$s("#pcbInspector");
 if(stage)stage.hidden=true;if(inspector)inspector.hidden=true;
 const a=$s("#rfCadTab"),b=$s("#rfPcbTab");
 a?.classList.add("active");a?.setAttribute("aria-pressed","true");
 b?.classList.remove("active");b?.setAttribute("aria-pressed","false");
 const label=$s("#exportButton span");if(label)label.textContent="파일 받기";
 if(typeof activatePanel==="function")activatePanel("cad");
 if(typeof scheduleDraw==="function")scheduleDraw();
}
function bind(){
 $s("#rfPcbTab")?.addEventListener("click",open);
 $s("#pcbLayoutView")?.addEventListener("click",()=>setPcbView("layout"));
 $s("#pcbNetsView")?.addEventListener("click",()=>setPcbView("nets"));
 $s("#pcbAddNetButton")?.addEventListener("click",registerNet);
 $s("#pcbLoadExampleButton")?.addEventListener("click",loadExample);
 $s("#pcbNetList")?.addEventListener("click",e=>{
  const btn=e.target?.closest?.("[data-net-remove]");
  if(btn)unregisterNet(btn.dataset.netRemove);
 });
 // The original CAD toolbar owns this button; intercept it only in PCB mode.
 $s("#exportButton")?.addEventListener("click",event=>{
  if(!active)return;
  event.stopImmediatePropagation();
  event.preventDefault();
  showExport();
 },{capture:true});
 $s("#rfCadTab")?.addEventListener("click",close);
 $$s("[data-pcb-add]").forEach(b=>b.addEventListener("click",()=>add(b.dataset.pcbAdd)));
 $$s("[data-pcb-tool]").forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.pcbTool)));
 $s("#pcbRotateButton")?.addEventListener("click",rotate);
 $s("#pcbRemoveButton")?.addEventListener("click",remove);
 $s("#pcbResizeButton")?.addEventListener("click",sizeUpdate);
 $s("#pcbCheckButton")?.addEventListener("click",()=>{draw();const r=validate();notice(r.issues.length?r.issues.length+"개 간격·교차 문제를 확인해주세요.":"기초 간격 검사에서 발견된 문제 없음 · 공식 DRC 미실행",Boolean(r.issues.length))});
 $s("#pcbUndoButton")?.addEventListener("click",undo);
 $s("#pcbExportButton")?.addEventListener("click",showExport);
 $$s("[data-pcb-export]").forEach(b=>b.addEventListener("click",()=>{exportBoard(b.dataset.pcbExport);$s("#pcbExportDialog")?.close?.()}));
 const svg=$s("#pcbSvg");
 if(svg){
  svg.addEventListener("pointerdown",onPointerDown);
  svg.addEventListener("pointermove",onPointerMove);
  svg.addEventListener("pointerup",onPointerUp);
  svg.addEventListener("pointercancel",()=>{pointer=null});
  svg.addEventListener("pointerleave",onSvgLeave);
 }
 // Project changes via existing project switcher. Preserves one PCB layout per CAD project.
 const title=$s("#projectName");
 if(title&&typeof MutationObserver!=="undefined"){
  new MutationObserver(()=>{if(active)load()}).observe(title,{childList:true,characterData:true,subtree:true});
 }
 document.addEventListener("keydown",e=>{
  if(!active)return;
  if(e.key==="Escape"){routing=null;mousePoint=null;setTool("move");draw()}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||"")){e.preventDefault();undo()}
 });
}
document.addEventListener("DOMContentLoaded",bind);
window.robotForgePCB={open,close,add,remove,rotate,undo,setTool,addRoute,sizeUpdate,validate,showExport,exportBoard,
 test:{starter,isValidShape,padPos,pads,unionNets,shapeSvg,kicadDraft,svgDocument,pointSegDist,intersects,registerNet,unregisterNet,loadExample,setPcbView,netlib,read:()=>deep(board),set(b){if(!isValidShape(b))throw Error("Invalid PCB layout");board=deep(b);draw()},draw,load}};
})();