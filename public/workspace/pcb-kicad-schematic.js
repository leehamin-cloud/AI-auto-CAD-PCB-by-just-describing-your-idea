/* Robot Forge PCB v2.8 — experimental KiCad 9 schematic S-expression exporter.
 * Small embedded placeholder symbols, true KiCad schematic constructs (not a raster SVG).
 * WARNING: Symbols/footprints are educational placeholders, no manufacturer-level mapping.
 * Validate resulting .kicad_sch in KiCad before use. No ERC approval is implied.
 */
(function(scope){
"use strict";
const catalog=scope.robotForgePartCatalog,netlib=scope.robotForgeNetlist,schem=scope.robotForgeSchematic;
if(!catalog||!netlib||!schem)throw Error("Robot Forge parts, netlist, schematic modules must load first");
const kinds={resistor:"R",led:"D",capacitor:"C",conn2:"J",conn3:"J",ic4:"U"};
const values={resistor:"R_GENERIC",led:"LED_GENERIC",capacitor:"C_GENERIC",conn2:"HEADER_2",conn3:"HEADER_3",ic4:"IC_GENERIC"};
const roles={unspecified:"unspecified",passive:"passive",input:"input",output:"output",power_in:"power_in",power_out:"power_out"};
function q(s){return '"'+String(s).replace(/\\/g,"").replace(/"/g,"").replace(/[\r\n]/g," ")+'"'}
function f(x){return Number(x.toFixed(4)).toString()}
function uuid(seed){
 let a=2166136261,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
 for(let i=0;i<seed.length;i++){const k=seed.charCodeAt(i);a=Math.imul(a^k,16777619)>>>0;b=Math.imul(b^(k+17),2246822519)>>>0;c=Math.imul(c^(k+43),3266489917)>>>0;d=Math.imul(d^(k+71),668265263)>>>0}
 const hex=[a,b,c,d].map(n=>n.toString(16).padStart(8,"0")).join("");
 return hex.slice(0,8)+"-"+hex.slice(8,12)+"-4"+hex.slice(13,16)+"-8"+hex.slice(17,20)+"-"+hex.slice(20,32);
}
function locations(count){
 if(count!==2&&count!==3&&count!==4)throw Error("Only 2-, 3-, 4-pin symbols are supported");
 // Library coordinates have Y up; schematic drawing coordinates have Y down.
 const pinSet=count===2?[[-7.62,0,0],[7.62,0,180]]:
 count===3?[[-7.62,2.54,0],[-7.62,-2.54,0],[7.62,0,180]]:
 [[-7.62,2.54,0],[-7.62,-2.54,0],[7.62,-2.54,180],[7.62,2.54,180]];
 return pinSet;
}
function symbolKey(component){
 const roleCodes={unspecified:"U",passive:"P",input:"I",output:"O",power_in:"W",power_out:"S"};
 const sig=catalog.pins(component).map(p=>roleCodes[schem.role(component,p.pin-1)]||"U").join("");
 return "RF_"+component.kind+"_"+sig;
}
function libSymbol(component){
 const name=symbolKey(component),id="RobotForge:"+name,pins=catalog.pins(component),locs=locations(pins.length);
 const pname=pins.map((p,i)=>{
  const [x,y,angle]=locs[i],type=roles[schem.role(component,i)]||"unspecified";
  // 'at' indicates the electrical connection end of the pin, not the body end.
  const pinName=(component.kind==="led"?(i===0?"K":"A"):component.kind==="ic4"?"PIN"+p.pin:String(p.pin));
  return '  (pin '+type+' line (at '+f(x)+' '+f(y)+' '+angle+') (length 2.54)'+
   ' (name '+q(pinName)+' (effects (font (size 1.27 1.27))))'+
   ' (number '+q(String(i+1))+' (effects (font (size 1.27 1.27)))))';
 }).join("\n");
 const ref=kinds[component.kind];
 return ' (symbol '+q(id)+
   ' (pin_names (offset 0.508)) (in_bom yes) (on_board yes)'+
   ' (property "Reference" '+q(ref)+' (at 0 8.89 0) (effects (font (size 1.27 1.27))))'+
   ' (property "Value" '+q(values[component.kind])+' (at 0 -8.89 0) (effects (font (size 1.27 1.27))))'+
   ' (property "Footprint" "" (at 0 -11.43 0) (effects (font (size 1.27 1.27)) (hide yes)))'+
   ' (symbol '+q(name+"_0_1")+
   ' (rectangle (start -5.08 5.08) (end 5.08 -5.08)'+
   ' (stroke (width 0.254) (type default)) (fill (type background))))'+
   ' (symbol '+q(name+"_1_1")+'\n'+pname+'\n )'+
   ' (embedded_fonts no))';
}
function pinPoint(index,cx,cy,pinCount){
 const [dx,dy,rot]=locations(pinCount)[index];
 return {x:Number(f(cx+dx)),y:Number(f(cy-dy)),side:rot===0?"left":"right"};
}
function instance(component,i,root){
 const name=symbolKey(component),id="RobotForge:"+name,cols=4,
  x=30.48+(i%cols)*60.96,y=35.56+Math.floor(i/cols)*25.4;
 const pinList=catalog.pins(component);
 const footprint=catalog.get(component)?.footprint||"";
 const part=component.part||{};
 const extraFields=[["Datasheet",part.datasheetUrl],["Manufacturer",part.manufacturer],["MPN",part.mpn]]
  .filter(entry=>typeof entry[1]==="string"&&entry[1].trim()).map(([key,val],i)=>
   ' (property '+q(key)+' '+q(val)+' (at '+f(x)+' '+f(y+13.97+i*2.54)+' 0)'+
   ' (effects (font (size 1.27 1.27)) (hide yes)))').join("");
 const pins=pinList.map(p=>' (pin '+q(p.pin)+' (uuid '+q(uuid("pin:"+component.id+":"+p.pin))+'))').join("");
 const center={x,y};
 const text=' (symbol (lib_id '+q(id)+') (at '+f(x)+' '+f(y)+' 0) (unit 1)'+
   ' (exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no) (uuid '+q(uuid("component:"+component.id))+')'+
   ' (property "Reference" '+q(component.id)+' (at '+f(x)+' '+f(y-10.16)+' 0) (effects (font (size 1.27 1.27))))'+
   ' (property "Value" '+q(values[component.kind])+' (at '+f(x)+' '+f(y+9.0)+' 0) (effects (font (size 1.27 1.27))))'+
   ' (property "Footprint" '+q(footprint)+' (at '+f(x)+' '+f(y+11.43)+' 0) (effects (font (size 1.27 1.27)) (hide yes)))'+
   extraFields+pins+
   ' (instances (project "robot-forge-draft" (path '+q("/"+root)+' (reference '+q(component.id)+') (unit 1)))))';
 return {text,center,pins:pinList.map(p=>({ref:p.ref,...pinPoint(p.pin-1,x,y,pinList.length)}))};
}
function make(board){
 if(!board||!Array.isArray(board.components)||board.components.length>24)throw Error("KiCad schematic draft supports up to 24 components per page.");
 if(!board.components.length)throw Error("Add a component before exporting a KiCad schematic.");
 if(board.components.some(c=>!Object.hasOwn(kinds,c.kind)||!catalog.allowed(c)||!schem.pinRoleShape(c)))throw Error("Unsupported symbol type, footprint profile or pin-role entry");
 const required=netlib.netPlan(board);
 if(required.some(n=>typeof n.name!=="string"))throw Error("Invalid netlist");
 const pids=board.components.flatMap(c=>catalog.pins(c).map(p=>p.ref));
 const logicalError=netlib.validateShape(board,pids);
 if(logicalError)throw Error(logicalError);
 const coreUuid=uuid("root:"+JSON.stringify(board.components.map(c=>c.id))+"|"+JSON.stringify(required));
 const defs=new Map(),chunks=[],pinLocs=new Map();
 for(let i=0;i<board.components.length;i++){
  const c=board.components[i],symbolName=symbolKey(c);
  if(!defs.has(symbolName))defs.set(symbolName,libSymbol(c));
  const item=instance(c,i,coreUuid);chunks.push(item.text);
  for(const pin of item.pins)pinLocs.set(pin.ref,pin);
 }
 const wires=[],labels=[],connected=new Set();
 for(const n of required)for(const p of n.pins){
  if(connected.has(p))throw Error("Duplicate pin in multiple nets");
  connected.add(p);
  const position=pinLocs.get(p);if(!position)throw Error("Schematic connection uses unknown pin "+p);
  // Connection labels are on short stubs, not standalone text.
  const offset=position.side==="left"?-2.54:2.54;
  const start={x:position.x,y:position.y};
  const end={x:Number(f(position.x+offset)),y:position.y};
  wires.push(' (wire (pts (xy '+f(start.x)+' '+f(start.y)+') (xy '+f(end.x)+' '+f(end.y)+'))'+
   ' (stroke (width 0) (type default)) (uuid '+q(uuid("wire:"+p))+'))');
  labels.push(' (label '+q(n.name)+' (at '+f(end.x)+' '+f(end.y)+' 0)'+
   ' (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid '+q(uuid("label:"+p))+'))');
 }
 const file='(kicad_sch (version 20250114) (generator "robot_forge") (generator_version "0.2.8")'+
  ' (uuid '+q(coreUuid)+') (paper "A4")'+
  ' (title_block (title "Robot Forge experimental schematic") (comment 1 "Generic symbols; datasheets and ERC unverified"))'+
  ' (lib_symbols\n'+[...defs.values()].join("\n")+'\n )\n'+
  chunks.join("\n")+'\n'+wires.join("\n")+'\n'+labels.join("\n")+
  '\n (sheet_instances (path "/" (page "1")))\n (embedded_fonts no)\n)';
 return file;
}
function summary(board){
 const refs=board.components.flatMap(c=>catalog.pins(c).map(p=>p.ref));
 return {components:board.components.length,nets:netlib.netPlan(board).length,
  pins:refs.length,assignedPins:netlib.netPlan(board).reduce((n,net)=>n+net.pins.length,0),
  verified:false,formalKiCadSyntaxAttempt:true,
  note:"Experimental structured schematic. Must pass KiCad CLI parse, official ERC, and part verification before fabrication."};
}
scope.robotForgeKiCadSchematic={generate:make,summary,_test:{uuid,libSymbol,locations,instance,pinPoint}};
})(typeof window!=="undefined"?window:this);
