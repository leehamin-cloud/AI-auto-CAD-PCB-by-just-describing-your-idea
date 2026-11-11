/* Robot Forge v2.7 educational schematic symbol view and conservative pin-type checks.
   NOT a .kicad_sch editor, not a true KiCad ERC or an electrical simulator. */
(function(scope){
"use strict";
const parts=scope.robotForgePartCatalog, netlib=scope.robotForgeNetlist;
if(!parts||!netlib)throw Error("PCB symbols require part and netlist modules");
const roles=new Set(["unspecified","passive","input","output","power_in","power_out"]);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function role(c,i){
 const defaultType=parts.pins(c)[i]?.type||"unspecified";
 return c.pinRoles&&Object.hasOwn(c.pinRoles,String(i+1))?c.pinRoles[String(i+1)]:defaultType;
}
function pinRoleShape(c){
 if(!c.pinRoles)return true;
 if(typeof c.pinRoles!=="object"||Array.isArray(c.pinRoles)||Object.keys(c.pinRoles).length>4)return false;
 const count=parts.pins(c).length;
 return Object.entries(c.pinRoles).every(([key,val])=>/^[1-4]$/.test(key)&&Number(key)<=count&&roles.has(val));
}
function check(b){
 const errors=[],warnings=[],notes=[],allPins=new Map();
 for(const component of b.components||[]){
  for(const pin of parts.pins(component)){
   allPins.set(pin.ref,{...pin,role:role(component,pin.pin-1),component});
  }
 }
 const plans=netlib.netPlan(b),byPin=new Map();
 for(const net of plans)for(const id of net.pins)byPin.set(id,net.name);
 for(const net of plans){
  const pins=net.pins.map(x=>allPins.get(x)).filter(Boolean);
  const types=pins.map(p=>p.role),sources=types.filter(t=>t==="power_out").length;
  const outputs=types.filter(t=>t==="output").length;
  const inputs=types.filter(t=>t==="input").length;
  if(sources>1)errors.push(net.name+": 전원 공급 출력 핀이 "+sources+"개 연결돼 있습니다. 전원 충돌 가능성을 확인하세요.");
  if(outputs>1)errors.push(net.name+": 출력 핀이 여러 개 연결돼 있습니다. 구동 충돌 가능성을 확인하세요.");
  if(sources&&outputs)warnings.push(net.name+": 일반 출력과 전원 출력이 동일 신호에 연결됐습니다.");
  if(types.includes("power_in")&&!sources)warnings.push(net.name+": 전원 입력 핀에 공급 출력이 지정되지 않았습니다. 외부 전원 공급이 있다면 명시하세요.");
  if(inputs&&!outputs&&!sources)warnings.push(net.name+": 입력 핀에 출력 구동이 지정되지 않았습니다. 외부 입력일 수도 있으므로 확인하세요.");
  for(const c of b.components||[]){
   if(c.kind!=="led")continue;
   if(net.pins.includes(c.id+":1")&&net.pins.includes(c.id+":2"))errors.push(c.id+": LED의 K(음극)와 A(양극)를 같은 신호에 할당했습니다.");
  }
 }
 const unknown=(b.components||[]).filter(c=>c.kind==="ic4"&&parts.pins(c).some(p=>role(c,p.pin-1)==="unspecified"));
 if(unknown.length)notes.push("4핀 IC "+unknown.map(c=>c.id).join(", ")+"의 핀 기능이 미지정입니다. 실제 부품 데이터시트를 확인하세요.");
 const uncovered=(b.components||[]).flatMap(c=>parts.pins(c)).filter(p=>!byPin.has(p.ref));
 if(uncovered.length)notes.push("연결 계획에 포함되지 않은 핀 "+uncovered.length+"개 (모두 반드시 연결해야 하는 것은 아닙니다).");
 if(!(b.components||[]).every(parts.allowed))errors.push("알 수 없는 풋프린트 후보가 포함돼 있습니다.");
 notes.push("참고 회로 규칙 검사만 수행했습니다. 실제 KiCad ERC 및 부품 정격 검증은 별도로 필요합니다.");
 return {errors,warnings,notes,unassigned:uncovered.length,scannedNets:plans.length};
}
function symbolGraphics(kind,x,y){
 const base='stroke="#2c82aa" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';
 if(kind==="resistor")return '<path d="M '+(x-34)+' '+y+' h 12 l 5 -9 10 18 10 -18 10 18 5 -9 h 12" '+base+'/>';
 if(kind==="led")return '<path d="M '+(x-33)+' '+y+' h 13 m 0 -16 v 32 M '+(x-20)+' '+(y-16)+' L '+(x+9)+' '+y+' L '+(x-20)+' '+(y+16)+' Z M '+(x+9)+' '+(y-16)+' v 32 M '+(x+9)+' '+y+' h 24" '+base+'/><path d="M '+(x+10)+' '+(y-20)+' l 10 -12 m-7 12 l 10 -12" '+base+'/>';
 if(kind==="capacitor")return '<path d="M '+(x-35)+' '+y+' h 29 M '+(x-6)+' '+(y-18)+' v 36 M '+(x+6)+' '+(y-18)+' v 36 M '+(x+6)+' '+y+' h 29" '+base+'/>';
 if(kind==="ic4")return '<rect x="'+(x-30)+'" y="'+(y-26)+'" width="60" height="52" rx="7" '+base+'/><text x="'+x+'" y="'+(y+5)+'" text-anchor="middle" font-size="13" fill="#2c82aa" font-weight="750">IC</text>';
 if(kind.startsWith("conn"))return '<rect x="'+(x-19)+'" y="'+(y-28)+'" width="38" height="56" rx="5" '+base+'/><text x="'+x+'" y="'+(y+5)+'" text-anchor="middle" font-size="14" fill="#2c82aa">J</text>';
 return '<rect x="'+(x-28)+'" y="'+(y-21)+'" width="56" height="42" rx="4" '+base+'/>';
}
function drawing(b){
 const all=(b.components||[]),count=Math.min(all.length,48),cols=3,cw=350,ch=186,rows=Math.ceil(count/cols);
 const W=1100,H=Math.max(310,110+rows*ch+70),plans=netlib.netPlan(b),lookup=new Map();
 for(const n of plans)for(const p of n.pins)lookup.set(p,n.name);
 const header=['<rect x="0" y="0" width="'+W+'" height="'+H+'" rx="12" fill="#f5faff"/>',
  '<text x="28" y="36" font-size="21" font-family="sans-serif" fill="#235c81" font-weight="800">Robot Forge · 심벌 회로도</text>',
  '<text x="28" y="61" font-size="12" font-family="sans-serif" fill="#7696ae">부품 핀과 논리 신호의 개념도 · 공식 KiCad 회로도가 아님</text>'];
 const content=all.slice(0,count).map((c,i)=>{
  const left=22+(i%cols)*362,top=88+Math.floor(i/cols)*ch,midx=left+175,midy=top+76,allpins=parts.pins(c);
  const symbol=symbolGraphics(c.kind,midx,midy);
  const pn=allpins.map((p,j)=>{
   const y=top+122+j*12,netName=lookup.get(p.ref)||"미지정",isAssigned=lookup.has(p.ref);
   return '<text x="'+(left+14)+'" y="'+y+'" font-size="10" fill="#567d96" font-family="sans-serif">'+
    esc(p.ref+" "+p.name)+"</text><text x='"+(left+335)+"' y='"+y+"' text-anchor='end' font-size='10' font-family='sans-serif' fill='"+(isAssigned?"#168cab":"#97acb9")+"'>"+esc(netName)+"</text>";
  }).join("");
  const profile=parts.get(c);
  return '<g><rect x="'+left+'" y="'+top+'" width="350" height="176" rx="13" fill="#ffffff" stroke="#d3e5f4"/>'+
   '<text x="'+(left+14)+'" y="'+(top+23)+'" font-size="16" fill="#214a67" font-family="sans-serif" font-weight="800">'+esc(c.id)+'</text>'+
   '<text x="'+(left+335)+'" y="'+(top+22)+'" text-anchor="end" font-size="10" fill="#7899af" font-family="sans-serif">'+esc(profile?"참고: "+profile.key:"일반 예시")+'</text>'+
   symbol+pn+'</g>';
 }).join("");
 const trailing=all.length>count?'<text x="25" y="'+(H-21)+'" font-size="12" fill="#9b7742">표시 제한: '+count+'개만 보입니다. 실제 데이터에는 '+all.length+'개 부품이 있습니다.</text>':'';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'">'+header.join("")+content+trailing+'</svg>';
}
scope.robotForgeSchematic={check,drawing,role,pinRoleShape,roles};
})(typeof window!=="undefined"?window:this);
