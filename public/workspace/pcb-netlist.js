/* Robot Forge PCB net planning v2.6
   Browser-only logical pin-to-pin requirements, NOT a KiCad electrical schematic.
   Pure logic. No network calls, no DOM dependency. */
(function (scope) {
 "use strict";
 function key(v){return String(v)}
 function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
 function netPlan(b){return Array.isArray(b?.schematic?.nets)?b.schematic.nets:[]}
 function validateShape(b,refs){
   const nets=netPlan(b),valid=new Set(refs);
   if(!b?.schematic)return null; // backwards-compatible files without schematic plan
   if(!b.schematic||!Array.isArray(b.schematic.nets)||nets.length>80)return "연결 계획의 형식이나 개수를 확인하세요.";
   const names=new Set(),used=new Set();
   for(const n of nets){
     if(!n||typeof n.name!=="string"||!/^[A-Za-z_][A-Za-z0-9_+\-]{0,23}$/.test(n.name)||
        names.has(n.name)||!Array.isArray(n.pins)||n.pins.length<2||n.pins.length>40)return "신호 이름이 중복되었거나 핀 목록이 올바르지 않습니다.";
     names.add(n.name);
     const unique=new Set(n.pins);
     if(unique.size!==n.pins.length)return n.name+" 신호 안에 같은 핀이 중복됐습니다.";
     for(const p of n.pins){
       if(typeof p!=="string"||!valid.has(p)||used.has(p))return "회로 연결 계획에 존재하지 않거나 다른 신호에 이미 할당된 핀이 있습니다: "+p;
       used.add(p);
     }
   }
   return null;
 }
 function graph(b,allPadRefs,copper){
   const plans=netPlan(b),expected=new Map(),padRefs=allPadRefs.map(p=>typeof p==="string"?p:p.ref);
   for(const net of plans)for(const pin of net.pins)expected.set(pin,net.name);
   const physical=new Map();
   // copper.netNames enumerates each connected component, while untouched pads stay isolated
   for(const [i,net]of (copper?.netNames||[]).entries())for(const pin of net.pads)physical.set(pin,"C"+i);
   const roots=pin=>physical.get(pin)||"S:"+pin;
   const opens=[];
   for(const plan of plans){
     const clusters=new Map();
     for(const pin of plan.pins){
       const c=roots(pin);if(!clusters.has(c))clusters.set(c,[]);
       clusters.get(c).push(pin);
     }
     if(clusters.size>1)opens.push({name:plan.name,pins:plan.pins.slice(),groups:[...clusters.values()]});
   }
   const shorts=[];
   for(const net of copper?.netNames||[]){
     const members=[...new Set(net.pads.map(pin=>expected.get(pin)).filter(Boolean))];
     if(members.length>1)shorts.push({groups:members,pins:net.pads.slice()});
   }
   const unrouted=padRefs.filter(pin=>!physical.has(pin)).length;
   const unplanned=padRefs.filter(pin=>!expected.has(pin));
   const byPin=new Map(padRefs.map(pin=>[pin,expected.get(pin)||null]));
   return {plans:plans.length,expected,byPin,opens,shorts,unplanned:unplanned.length,unrouted};
 }
 function exportGraph(b,allPadRefs,copper){
   const graphInfo=graph(b,allPadRefs,copper),plans=netPlan(b);
   const netNames=[],nets=new Map(),traceNets=new Map(),physical=copper?.netNames||[],allocated=new Map();
   const register=(name,pins)=>{
     const number=netNames.length+1;
     netNames.push({number,name,pads:pins.slice()});
     return number;
   };
   for(const p of plans){
     const number=register(p.name,p.pins);
     for(const ref of p.pins)nets.set(ref,number);
   }
   for(const group of physical){
     const declared=[...new Set(group.pads.map(pin=>nets.get(pin)).filter(Boolean))];
     if(declared.length>1){
       // Do not silently merge differently named logical nets.
       for(const p of group.pads)allocated.set(p,0);
       continue;
     }
     const n=declared.length?declared[0]:register((plans.length?"AUTO_NET_":"RF_NET_")+(netNames.length+1),group.pads);
     for(const p of group.pads){
       allocated.set(p,n);
       if(!nets.has(p))nets.set(p,n);
     }
   }
   for(const trace of b.traces||[]){
     const x=allocated.get(trace.a),y=allocated.get(trace.b);
     traceNets.set(trace.id,x&&x===y?x:0);
   }
   return {netNames,nets,traceNets,graph:graphInfo};
 }
 function add(b,name,a,c){
   const padRefs=new Set((b.components||[]).flatMap(comp=>{
     const count={resistor:2,led:2,capacitor:2,conn2:2,conn3:3,ic4:4}[comp.kind]||0;
     return Array.from({length:count},(_,i)=>comp.id+":"+(i+1));
   }));
   const normalized=String(name||"").trim().toUpperCase();
   if(!/^[A-Z_][A-Z0-9_+\-]{0,23}$/.test(normalized))throw Error("신호 이름은 영문·숫자·밑줄을 사용하세요 (예: GND, VCC, DATA).");
   if(a===c||!padRefs.has(a)||!padRefs.has(c))throw Error("서로 다른 두 개의 존재하는 핀을 선택하세요.");
   const plans=netPlan(b),present=plans.find(n=>n.name===normalized);
   for(const net of plans){
     if(net.name===normalized)continue;
     if(net.pins.includes(a)||net.pins.includes(c))throw Error("해당 핀이 이미 '"+net.name+"' 신호에 속합니다.");
   }
   if(present){
     for(const pin of [a,c])if(!present.pins.includes(pin))present.pins.push(pin);
   }else{
     if(plans.length>=80)throw Error("연결 계획은 80개까지 지원됩니다.");
     if(!b.schematic)b.schematic={nets:[]};
     b.schematic.nets.push({name:normalized,pins:[a,c]});
   }
   if(validateShape(b,[...padRefs]))throw Error("핀 연결 계획을 검사하지 못했습니다.");
   return b;
 }
 function remove(b,name){
   if(!b.schematic||!Array.isArray(b.schematic.nets))return b;
   b.schematic.nets=b.schematic.nets.filter(n=>n.name!==name);return b;
 }
 function dropComponent(b,id){
   if(!b.schematic)return b;
   b.schematic.nets=b.schematic.nets.map(n=>({...n,pins:n.pins.filter(p=>!p.startsWith(id+":"))})).filter(n=>n.pins.length>=2);
   return b;
 }
 function illustration(b,copper){
   const plans=netPlan(b),connections=graph(b,[],copper),W=1000,row=75,height=Math.max(280,105+plans.length*row);
   const parts=['<rect x="0" y="0" width="'+W+'" height="'+height+'" fill="#f5faff" rx="12"/>',
      '<text x="28" y="35" font-size="18" font-weight="750" fill="#2c6f97">논리적 연결 계획</text>',
      '<text x="28" y="58" font-size="11" fill="#7797ad">실제 회로도 심벌이 아닌 핀 연결 표입니다. 배선 여부는 별도로 검사됩니다.</text>'];
   if(!plans.length)parts.push('<text x="500" y="160" font-size="15" fill="#92a8b8" text-anchor="middle">아직 지정한 전기적 연결이 없습니다.</text>');
   plans.forEach((n,i)=>{
     const y=96+i*row,open=connections.opens.some(item=>item.name===n.name);
     parts.push('<rect x="22" y="'+(y-19)+'" width="954" height="55" rx="10" fill="'+(open?"#fff9f0":"#ecf9ff")+'" stroke="'+(open?"#f1c491":"#c7e6f8")+'"/>');
     parts.push('<text x="42" y="'+(y+5)+'" font-size="16" font-weight="800" fill="#2b698d">'+esc(n.name)+'</text>');
     parts.push('<text x="265" y="'+(y+5)+'" font-size="13" fill="#446b85">'+esc(n.pins.join("  ↔  "))+'</text>');
     parts.push('<text x="947" y="'+(y+5)+'" text-anchor="end" font-size="12" fill="'+(open?"#c17c39":"#158f76")+'">'+(open?"배선 대기":"연결 확인")+'</text>');
   });
   return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+height+'">'+parts.join("")+'</svg>';
 }
 scope.robotForgeNetlist={netPlan,validateShape,graph,exportGraph,add,remove,dropComponent,illustration};
})(typeof window!=="undefined"?window:this);
