/* Robot Forge PCB v2.9: independent schematic-to-PCB pin/net parity audit.
   Inspects in-memory logical nets and board pad/traces, not actual KiCad CLI files.
   Results never constitute manufacturing approval. */
(function(scope){
"use strict";
const catalog=scope.robotForgePartCatalog,padsLib=scope.robotForgeFootprintPads,netlib=scope.robotForgeNetlist;
if(!catalog||!padsLib||!netlib)throw Error("PCB parity requires footprint pad library, parts and netlist");
const sort=s=>[...s].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
function parity(board,helpers){
 const warnings=[],errors=[],details=[],all=helpers.pads(board),physical=helpers.unionNets(board);
 const expected=netlib.netPlan(board);
 const padIndex=new Map(all.map(x=>[x.ref,x]));
 const padRefs=sort(padIndex.keys());
 const pinMembership=new Map();
 for(const net of expected){
  for(const pin of net.pins){
   if(!padIndex.has(pin))errors.push("논리 신호 "+net.name+": PCB 패드 "+pin+"이 존재하지 않습니다.");
   if(pinMembership.has(pin))errors.push("핀 "+pin+"이 두 신호에 중복 할당됐습니다.");
   pinMembership.set(pin,net.name);
  }
 }
 const physicalGroups=physical.netNames||[],padToPhysical=new Map();
 physicalGroups.forEach((group,i)=>group.pads.forEach(ref=>padToPhysical.set(ref,i)));
 for(const net of expected){
  const groups=new Set(net.pins.map(pin=>padToPhysical.has(pin)?"group:"+padToPhysical.get(pin):"single:"+pin));
  if(groups.size>1)errors.push("오픈: "+net.name+"의 "+net.pins.length+"개 핀이 아직 완전히 연결되지 않았습니다 ("+groups.size+"그룹).");
 }
 for(const physicalNet of physicalGroups){
  const assigned=sort(new Set(physicalNet.pads.map(ref=>pinMembership.get(ref)).filter(Boolean)));
  if(assigned.length>1)errors.push("쇼트: "+assigned.join(" / ")+" 신호가 동일한 구리 연결에 합쳐졌습니다.");
  if(assigned.length===0)warnings.push("정의되지 않은 구리 연결: "+physicalNet.pads.join(" ↔ "));
  else if(physicalNet.pads.some(pin=>!pinMembership.has(pin)))
   warnings.push("신호 "+assigned[0]+"에 연결 계획에 없는 핀이 함께 연결됐습니다.");
 }
 for(const comp of board.components||[]){
  const cPins=all.filter(p=>p.ref.startsWith(comp.id+":"));
  const expectedPins=catalog.pins(comp);
  if(cPins.length!==expectedPins.length)errors.push(comp.id+"의 논리 핀 수와 PCB 패드 수가 다릅니다.");
  for(const p of expectedPins)if(!padIndex.has(p.ref))errors.push("핀 누락: "+p.ref);
  const profile=catalog.get(comp),spec=padsLib.get(comp);
  if(!profile){
   warnings.push(comp.id+": KiCad 풋프린트 선택 안 됨. 패드 위치·형상은 교육용 기본값입니다.");
   continue;
  }
  if(!spec||spec.pads.length!==expectedPins.length){
   errors.push(comp.id+": 공식 라이브러리에서 추출한 패드 정보가 없습니다.");
   continue;
  }
  for(const pad of spec.pads){
   const actual=padIndex.get(comp.id+":"+pad.pin);
   const rotation=comp.rotation*Math.PI/180;
   const x=comp.x+pad.x*Math.cos(rotation)-pad.y*Math.sin(rotation);
   const y=comp.y+pad.x*Math.sin(rotation)+pad.y*Math.cos(rotation);
   if(!actual||Math.hypot(x-actual.x,y-actual.y)>0.0005)errors.push(comp.id+":"+pad.pin+"의 패드 위치가 원본 KiCad 참고 데이터와 일치하지 않습니다.");
  }
  details.push({ref:comp.id,footprint:profile.footprint,
    checkedPads:spec.pads.length,source:spec.sourcePath,sourceBlobSha:spec.sourceBlobSha,
    exactPadDataFromUpstream:true,completeFootprintImported:false});
 }
 const summary={pinCount:padRefs.length,plannedNetCount:expected.length,physicalGroupCount:physicalGroups.length,componentCount:board.components.length,
  referencePadCount:details.reduce((n,d)=>n+d.checkedPads,0),preciseFootprintCount:details.length};
 return {status:errors.length?"BLOCKED_ERRORS":warnings.length?"BLOCKED_WARNINGS":"LOCAL_CHECK_ONLY",
  errors:[...new Set(errors)],warnings:[...new Set(warnings)],summary,details,
  schematicPins:sort(pinMembership.keys()),boardPins:padRefs,
  formalErcPassed:false,formalDrcPassed:false,manufacturingAuthorized:false};
}
function manifest(board,helpers){
 const result=parity(board,helpers);
 const logical=netlib.netPlan(board).map(n=>({name:n.name,pins:sort(n.pins)})).sort((a,b)=>a.name.localeCompare(b.name));
 const copper=helpers.unionNets(board).netNames.map(n=>({pins:sort(n.pads)}));
 return {
  format:"RobotForgePCBParityAudit",version:1,
  schematic:{pins:result.schematicPins,logicalNets:logical},
  pcb:{pads:result.boardPins,copperGroups:copper},
  comparison:result,
  officialKiCadChecks:{netlistExtracted:false,schematicPcbParityValidated:false,ercPassed:false,drcPassed:false},
  manufacturerVerified:false,fabricationApproval:"BLOCKED"
 };
}
scope.robotForgePCBParity={parity,manifest};
})(typeof window!=="undefined"?window:this);
