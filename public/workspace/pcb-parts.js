/* Robot Forge v2.7 component reference catalog.
   Names/pitches referenced from public KiCad THT footprint library catalog.
   Coordinates in this app are centered SIMPLIFICATIONS of real footprints, not
   their official pad shape/courtyard/3D model; always re-associate in KiCad
   against the actual manufacturer part before fabrication. */
(function(scope){
"use strict";
const profiles=Object.freeze({
 resistor:Object.freeze({
   key:"resistor-tht-7.62",label:"저항 7.62mm",footprint:"Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal",
   padPositions:[[-3.81,0],[3.81,0]],body:[10,4],pinNames:["1","2"],pinTypes:["passive","passive"],pitch:7.62,referenceOnly:true
 }),
 led:Object.freeze({
   key:"led-d5-2.54",label:"LED 5mm · 2.54mm",footprint:"LED_THT:LED_D5.0mm",
   padPositions:[[-1.27,0],[1.27,0]],body:[6,6],pinNames:["K (음극)","A (양극)"],pinTypes:["passive","passive"],pitch:2.54,referenceOnly:true
 }),
 capacitor:Object.freeze({
   key:"disc-cap-5.00",label:"세라믹 콘덴서 · 5.00mm",footprint:"Capacitor_THT:C_Disc_D5.1mm_W3.2mm_P5.00mm",
   padPositions:[[-2.5,0],[2.5,0]],body:[6.5,4],pinNames:["1","2"],pinTypes:["passive","passive"],pitch:5,referenceOnly:true
 }),
 conn2:Object.freeze({
   key:"header-2-2.54",label:"2핀 헤더 · 2.54mm",footprint:"Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical",
   padPositions:[[0,-1.27],[0,1.27]],body:[4,7],pinNames:["1","2"],pinTypes:["passive","passive"],pitch:2.54,referenceOnly:true
 }),
 conn3:Object.freeze({
   key:"header-3-2.54",label:"3핀 헤더 · 2.54mm",footprint:"Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical",
   padPositions:[[0,-2.54],[0,0],[0,2.54]],body:[4,10],pinNames:["1","2","3"],pinTypes:["passive","passive","passive"],pitch:2.54,referenceOnly:true
 }),
 ic4:Object.freeze({
   key:"dip-4-7.62",label:"DIP-4 · 7.62mm 행 간격",footprint:"Package_DIP:DIP-4_W7.62mm",
   padPositions:[[-3.81,-1.27],[-3.81,1.27],[3.81,1.27],[3.81,-1.27]],
   body:[10,6],pinNames:["1 (미지정)","2 (미지정)","3 (미지정)","4 (미지정)"],
   pinTypes:["unspecified","unspecified","unspecified","unspecified"],pitch:2.54,referenceOnly:true
 })
});
const legacy=Object.freeze({
 resistor:{pinNames:["1","2"],pinTypes:["passive","passive"]},
 led:{pinNames:["K (음극)","A (양극)"],pinTypes:["passive","passive"]},
 capacitor:{pinNames:["1","2"],pinTypes:["passive","passive"]},
 conn2:{pinNames:["1","2"],pinTypes:["passive","passive"]},
 conn3:{pinNames:["1","2","3"],pinTypes:["passive","passive","passive"]},
 ic4:{pinNames:["1","2","3","4"],pinTypes:["unspecified","unspecified","unspecified","unspecified"]}
});
function get(c){if(!c||!Object.hasOwn(profiles,c.kind)||c.profile!==profiles[c.kind].key)return null;return profiles[c.kind]}
function profileForKind(kind){return profiles[kind]||null}
function allowed(c){return !c.profile||get(c)!==null}
function description(c){
 const p=get(c);
 return p?p.footprint+" · 참고 패드 피치 "+p.pitch+"mm (실제 풋프린트 동일성 미검증)":"기본 예시 패드 · 실물 부품 대조 필요";
}
function pins(c){
 const p=get(c),ref=p||legacy[c.kind];
 return Array.from({length:ref?.pinNames?.length||0},(_,i)=>({
   pin:i+1,ref:c.id+":"+(i+1),name:ref.pinNames[i],type:ref.pinTypes[i]
 }));
}
function geometric(c,base){
 const p=get(c);
 return p?{pads:p.padPositions,w:p.body[0],h:p.body[1]}:base;
}
function report(board){
 const selected=board.components.filter(c=>get(c)).length,all=board.components.length;
 const unverified=board.components.filter(c=>!get(c)).map(c=>c.id);
 return {all,selected,unverified,verifiedAgainstLibraryFile:0,manufacturerVerified:0};
}
scope.robotForgePartCatalog={profiles,legacy,get,profileForKind,allowed,description,pins,geometric,report};
})(typeof window!=="undefined"?window:this);
