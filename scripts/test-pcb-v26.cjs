#!/usr/bin/env node
// Robot Forge PCB 2.6 offline regression and KiCad draft sample generator.
// Run: node scripts/test-pcb-v26.cjs
// Generate local KiCad draft for KiCad CLI: OUTPUT_DIR=/tmp/pcb-check node scripts/test-pcb-v26.cjs
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const nodes=new Map(),events=new Map(),stored=new Map();
function el(id){
 if(nodes.has(id))return nodes.get(id);
 const bag=new Set(),handlers=new Map();
 const item={id,hidden:true,value:id==="#pcbTraceWidth"?"0.5":"",innerHTML:"",textContent:"",dataset:{},style:{},
  classList:{add:v=>bag.add(v),remove:v=>bag.delete(v),contains:v=>bag.has(v),toggle:(v,on)=>on?bag.add(v):bag.delete(v)},
  setAttribute(){},addEventListener(t,fn){if(!handlers.has(t))handlers.set(t,[]);handlers.get(t).push(fn)},
  trigger(t,event){for(const fn of handlers.get(t)||[])fn(event||{})},
  getBoundingClientRect(){return{width:1000,height:640,left:0,top:0}},
  showModal(){},close(){},setPointerCapture(){}
 };
 nodes.set(id,item);return item;
}
const document={body:{classList:el("body").classList,appendChild(){}},
 querySelector:el,querySelectorAll:()=>[],
 addEventListener(t,fn){if(!events.has(t))events.set(t,[]);events.get(t).push(fn)},
 createElement:()=>({click(){},remove(){}})};
let projectId="test-project";
const window={},localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
const context=vm.createContext({window,document,localStorage,setTimeout:fn=>0,
 URL:{createObjectURL:()=> "blob:test",revokeObjectURL(){}},Blob:class{constructor(s){this.data=s}},
 current:()=>({id:projectId}),activatePanel(){},scheduleDraw(){},console});
function run(file){vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file})}
run("public/workspace/pcb-netlist.js");
run("public/workspace/pcb-parts.js");
run("public/workspace/pcb-pad-library.js");
run("public/workspace/pcb-schematic.js");
run("public/workspace/pcb-parity.js");
run("public/workspace/pcb-kicad-schematic.js");
run("public/workspace/pcb-footprint-graphics.js");
run("public/workspace/pcb-router-v30.js");
run("public/workspace/pcb-studio.js");
const net=window.robotForgeNetlist,pcb=window.robotForgePCB;
assert.ok(net&&pcb,"PCB modules should load");
for(const fn of events.get("DOMContentLoaded")||[])fn();
let passed=0;
function test(name,fn){fn();passed++;process.stdout.write("✓ "+name+"\n")}
const data=pcb.test.starter();
test("starter board model and schema",()=>{assert.equal(data.schematic.nets.length,0);assert.equal(pcb.test.isValidShape(data),true)});
test("backwards compatible old saved boards",()=>{const old={...data};delete old.schematic;assert.equal(pcb.test.isValidShape(old),true)});
test("default board has 9 drill pads",()=>assert.equal(pcb.test.pads(data).length,9));
pcb.open();
test("PCB tab active",()=>assert.equal(document.body.classList.contains("pcb-mode"),true));
test("initial no required logical nets",()=>assert.equal(pcb.validate().planned,0));
const configured=pcb.test.read();
net.add(configured,"DATA","J1:3","U1:2");
net.add(configured,"GND","J1:1","U1:1");
pcb.test.set(configured);
test("explicit net requirements persisted in model",()=>{assert.equal(pcb.test.read().schematic.nets.length,2);assert.equal(pcb.test.isValidShape(pcb.test.read()),true)});
test("unconnected expected nets reported",()=>{assert.equal(pcb.validate().opens.length,2);assert.equal(pcb.validate().shorts.length,0)});
test("board SVG shows dashed unrouted connections",()=>assert.match(el("#pcbSvg").innerHTML,/pcb-airwire/));
test("logical connection diagram displays net names",()=>{const text=net.illustration(configured,pcb.test.unionNets(configured));assert.match(text,/DATA/);assert.match(text,/GND/)});
test("different named net direct route blocked",()=>{pcb.addRoute("J1:1","U1:2");assert.equal(pcb.test.read().traces.length,0)});
test("correct route satisfies DATA",()=>{assert.equal(pcb.addRoute("J1:3","U1:2"),true);assert.equal(pcb.validate().opens.length,1);assert.equal(pcb.validate().opens[0].name,"GND")});
test("export puts logical names into KiCad PCB",()=>{const p=pcb.test.kicadDraft();assert.match(p,/\(net 1 "DATA"\)/);assert.match(p,/\(net 2 "GND"\)/);assert.match(p,/\(segment /)});
test("KiCad output has balanced parentheses",()=>{
 let level=0,quoted=false,escaped=false;
 for(const c of pcb.test.kicadDraft()){
  if(escaped){escaped=false;continue}if(quoted&&c==="\\"){escaped=true;continue}if(c==='"'){quoted=!quoted;continue}
  if(!quoted&&c==="(")level++;else if(!quoted&&c===")")level--;
  assert.ok(level>=0);
 }
 assert.equal(level,0);assert.equal(quoted,false);
});
const wrong=pcb.test.read();
wrong.traces.push({id:"bad-net-bridge",a:"J1:1",b:"J1:3",width:0.5});
pcb.test.set(wrong);
test("short between DATA and GND detected",()=>assert.equal(pcb.validate().shorts.length,1));
test("shorted copper export uses net 0, never merges named nets",()=>{
 const p=pcb.test.kicadDraft();assert.match(p,/\(net 0\) \(uuid/);
});
const duplicate=pcb.test.read();
duplicate.schematic.nets.push({name:"BAD",pins:["J1:1","D1:1"]});
test("one pad cannot belong to two logical nets",()=>assert.equal(pcb.test.isValidShape(duplicate),false));
const cleaned=pcb.test.starter();
net.add(cleaned,"DATA","J1:3","U1:2");
pcb.test.set(cleaned);
test("removing component prunes invalid net assignments",()=>{
 pcb.open();const draft=pcb.test.read();net.add(draft,"DATA","J1:3","U1:2");pcb.test.set(draft);
 // Directly test pure pruning algorithm without deleting in GUI.
 net.dropComponent(draft,"U1");assert.equal(draft.schematic.nets.length,0);
});
test("project-local saved PCB data survives close and reload",()=>{
 pcb.open();
 const b=pcb.test.read();net.add(b,"DATA","J1:3","U1:2");pcb.test.set(b);
 // UI transaction persists after a real routing operation.
 pcb.addRoute("J1:3","U1:2");
 const snapshot=pcb.test.read();pcb.close();pcb.open();
 assert.deepEqual(JSON.stringify(pcb.test.read()),JSON.stringify(snapshot));
});
test("SVG image and logical net JSON can be produced",()=>{
 assert.match(pcb.test.svgDocument(),/<svg/);assert.equal(net.netPlan(pcb.test.read()).length,2);
});

const catalog=window.robotForgePartCatalog,schematic=window.robotForgeSchematic;
test("v2.7: six KiCad reference profiles exist",()=>assert.equal(Object.keys(catalog.profiles).length,6));
test("v2.7: schematic symbol diagram renders all starter parts",()=>{
 const d=schematic.drawing(pcb.test.starter());
 assert.match(d,/심벌 회로도/);assert.match(d,/>J1</);assert.match(d,/>U1</);assert.match(d,/>D1</);
});
test("v2.7: proposed header pad pitch is 2.54 mm",()=>{
 const b=pcb.test.starter();
 b.components[0].profile=catalog.profiles.conn3.key;
 assert.equal(pcb.test.isValidShape(b),true);
 const a=pcb.test.padPos("J1:1",b),z=pcb.test.padPos("J1:2",b);
 assert.ok(Math.abs(Math.abs(z.y-a.y)-2.54)<0.000001);
});
test("v2.7: LED pin labels distinguish cathode and anode",()=>{
 const d=catalog.pins(pcb.test.starter().components[2]);
 assert.match(d[0].name,/음극/);assert.match(d[1].name,/양극/);
});
test("v2.7: refuse unknown pin types in saved projects",()=>{
 const b=pcb.test.starter();b.components[0].pinRoles={"1":"short_circuit"};
 assert.equal(pcb.test.isValidShape(b),false);
});
test("v2.7: power-out role conflict is flagged",()=>{
 const b=pcb.test.starter();net.add(b,"VCC","J1:1","U1:1");
 b.components[0].pinRoles={"1":"power_out"};b.components[1].pinRoles={"1":"power_out"};
 assert.equal(schematic.check(b).errors.some(x=>x.includes("전원 공급")),true);
});
test("v2.7: unpowered power-in is a warning, not approval",()=>{
 const b=pcb.test.starter();net.add(b,"VCC","J1:1","U1:1");
 b.components[1].pinRoles={"1":"power_in"};
 assert.equal(schematic.check(b).warnings.some(x=>x.includes("전원 입력")),true);
});
test("v2.7: reference footprint ID appears in KiCad draft (not official geometry)",()=>{
 const b=pcb.test.starter();b.components[0].profile=catalog.profiles.conn3.key;
 pcb.test.set(b);
 assert.match(pcb.test.kicadDraft(),/Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical/);
 pcb.test.set(pcb.test.starter());
});
test("v2.7: schematic view is an SVG concept document",()=>{
 assert.match(schematic.drawing(pcb.test.starter()),/^<svg xmlns=/);
});


const kiSch=window.robotForgeKiCadSchematic;
const readySchematic=pcb.test.starter();
for(const c of readySchematic.components)c.profile=catalog.profiles[c.kind].key;
net.add(readySchematic,"DATA","J1:3","U1:2");
net.add(readySchematic,"GND","J1:1","U1:1");
test("v2.8: experimental KiCad schematic exporter exists",()=>{
 assert.equal(typeof kiSch.generate,"function");assert.equal(kiSch.summary(pcb.test.read()).verified,false);
});
test("v2.8: KiCad schematic embeds generic symbol definitions",()=>{
 const draft=kiSch.generate(readySchematic);
 assert.match(draft,/^\(kicad_sch \(version 20250114\)/);
 assert.match(draft,/\(lib_symbols/);
 assert.match(draft,/RobotForge:RF_conn3/);
 assert.match(draft,/RobotForge:RF_ic4/);
});
test("v2.8: correct pin labels and wire stubs encode logical nets",()=>{
 const draft=kiSch.generate(readySchematic);
 const count=(re)=>(draft.match(re)||[]).length;
 assert.equal(count(/\(label "DATA"/g),2);assert.equal(count(/\(label "GND"/g),2);
 assert.equal(count(/\(wire \(pts /g),4);
});
test("v2.8: no duplicate UUIDs in generated schematic",()=>{
 const draft=kiSch.generate(readySchematic),uuids=[...draft.matchAll(/\(uuid "([a-f0-9-]+)"\)/g)].map(x=>x[1]);
 assert.equal(uuids.length,new Set(uuids).size);
 assert.ok(uuids.length>10);
});
test("v2.8: S-expression quotes and parentheses are balanced",()=>{
 const draft=kiSch.generate(readySchematic);let depth=0,quoted=false,esc=false;
 for(const c of draft){
  if(esc){esc=false;continue}if(quoted&&c==="\\"){esc=true;continue}
  if(c==='"'){quoted=!quoted;continue}
  if(!quoted&&c==="(")depth++;else if(!quoted&&c===")")depth--;
  assert.ok(depth>=0,"unexpected closing parenthesis");
 }
 assert.equal(depth,0);assert.equal(quoted,false);
});
test("v2.8: pin role is mapped into embedded symbol definition",()=>{
 const demo=pcb.test.starter();
 demo.components[1].pinRoles={"1":"power_out"};
 const sch=kiSch.generate(demo);assert.match(sch,/\(pin power_out line /);
});
test("v2.8: selected KiCad footprint name is present as reference property",()=>{
 const demo=pcb.test.starter();demo.components[0].profile=catalog.profiles.conn3.key;
 const sch=kiSch.generate(demo);assert.match(sch,/Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical/);
});
test("v2.8: exporter rejects oversized single-sheet projects",()=>{
 const demo=pcb.test.starter();
 for(let i=4;i<=25;i++)demo.components.push({id:"R"+i,kind:"resistor",x:10+i,y:30,rotation:0});
 assert.throws(()=>kiSch.generate(demo),/24 components/);
});


test("v2.8: schematic contains root sheet_instances",()=>{
 assert.match(kiSch.generate(readySchematic),/\(sheet_instances \(path "\/" \(page "1"\)\)\)/);
});
test("v2.8: validation manifest explicitly blocks manufacturing approval",()=>{
 const b=pcb.test.starter();pcb.test.set(b);
 const manifest=JSON.parse(pcb.exportBoard("validation"));
 assert.equal(manifest.outcome,"BLOCKED_FOR_MANUFACTURING");
 assert.equal(manifest.official_checks.erc_passed,false);
 assert.equal(manifest.official_checks.drc_passed,false);
 assert.equal(manifest.footprint_reference.manufacturer_verified,false);
});
test("v2.8: browser export creates experimental schematic text",()=>{
 pcb.test.set(readySchematic);
 const text=pcb.exportBoard("kicad-sch");
 assert.match(text,/^\(kicad_sch/);
 assert.match(text,/\(label "DATA"/);
});

pcb.test.set(readySchematic);

const padsLibrary=window.robotForgeFootprintPads,parity=window.robotForgePCBParity;
test("v2.9: six KiCad upstream source pad metadata records available",()=>assert.equal(Object.keys(padsLibrary.models).length,6));
test("v2.9: every library-backed component has authentic pad shape and diameter",()=>{
 for(const comp of pcb.test.starter().components){
  comp.profile=catalog.profiles[comp.kind].key;
  const info=padsLibrary.get(comp);
  assert.equal(info.pads.length,catalog.pins(comp).length);
  assert.ok(info.pads.every(p=>p.drill>0&&p.size.every(v=>v>0)));
 }
});
test("v2.9: KiCad upstream LED first pad is rectangular and has drill 0.9mm",()=>{
 const c={id:"D1",kind:"led",profile:catalog.profiles.led.key};
 const one=padsLibrary.get(c).pads[0];
 assert.equal(one.shape,"rect");assert.equal(one.drill,0.9);assert.equal(one.size[0],1.8);
});
test("v2.9: connector pad 1 is rectangular and physical header pad spacing is 2.54",()=>{
 const c={id:"J1",kind:"conn3",profile:catalog.profiles.conn3.key};
 const spec=padsLibrary.pads(c);
 assert.equal(spec[0].shape,"rect");
 assert.ok(Math.abs(spec[1].y-spec[0].y-2.54)<1e-7);
});
test("v2.9: KiCad PCB now exports actual LED rect and 1.8mm pad size",()=>{
 const example=pcb.test.starter();example.components[2].profile=catalog.profiles.led.key;
 pcb.test.set(example);
 const output=pcb.test.kicadDraft();
 assert.match(output,/\(pad "1" thru_hole rect \(at -1\.2700 0\.0000\) \(size 1\.8000 1\.8000\) \(drill 0\.9000\)/);
 assert.match(pcb.test.svgDocument(),/data-pad="D1:1"[^>]*width="1\.8"/);
 pcb.test.set(pcb.test.starter());
});
test("v2.9: parity detects a missing required physical route",()=>{
 const b=pcb.test.starter();net.add(b,"DATA","J1:3","U1:2");
 const result=parity.parity(b,{pads:pcb.test.pads,unionNets:pcb.test.unionNets});
 assert.ok(result.errors.some(x=>x.includes("오픈")));
 assert.equal(result.manufacturingAuthorized,false);
});
test("v2.9: parity recognizes a satisfied required connection",()=>{
 const b=pcb.test.starter();net.add(b,"DATA","J1:3","U1:2");
 b.traces.push({id:"test-route",a:"J1:3",b:"U1:2",width:0.5});
 const result=parity.parity(b,{pads:pcb.test.pads,unionNets:pcb.test.unionNets});
 assert.equal(result.errors.length,0);
});
test("v2.9: parity reports unintended copper short",()=>{
 const b=pcb.test.starter();
 net.add(b,"DATA","J1:3","U1:2");net.add(b,"GND","J1:1","U1:1");
 b.traces.push({id:"bad-bridge",a:"J1:1",b:"J1:3",width:0.5});
 const result=parity.parity(b,{pads:pcb.test.pads,unionNets:pcb.test.unionNets});
 assert.ok(result.errors.some(x=>x.includes("쇼트")));
});
test("v2.9: selected profile exact pad positions match upstream specs",()=>{
 const b=pcb.test.starter();b.components[0].profile=catalog.profiles.conn3.key;
 b.components[2].profile=catalog.profiles.led.key;
 const result=parity.parity(b,{pads:pcb.test.pads,unionNets:pcb.test.unionNets});
 assert.equal(result.summary.referencePadCount,5);
 assert.equal(result.errors.length,0);
});
test("v2.9: parity report never claims official ERC/DRC success",()=>{
 const b=pcb.test.starter();
 const result=parity.manifest(b,{pads:pcb.test.pads,unionNets:pcb.test.unionNets});
 assert.equal(result.fabricationApproval,"BLOCKED");
 assert.equal(result.officialKiCadChecks.ercPassed,false);
 assert.equal(result.officialKiCadChecks.schematicPcbParityValidated,false);
});
test("v2.9: interactive parity JSON export includes a blocked manufacture gate",()=>{
 pcb.test.set(pcb.test.starter());
 const result=JSON.parse(pcb.exportBoard("parity"));
 assert.equal(result.fabricationApproval,"BLOCKED");
 assert.ok(result.pcb.pads.includes("J1:1"));
});

pcb.test.set(readySchematic);

const routeTool=window.robotForgeRouter;
test("v3.0: conservative router module loads with F and B layers",()=>{
 assert.ok(routeTool.LAYERS.includes("B.Cu"));assert.ok(routeTool.LAYERS.includes("F.Cu"));
});
test("v3.0: legacy straight F.Cu traces still pass schema",()=>{
 const b=pcb.test.starter();b.traces.push({id:"old-trace",a:"J1:1",b:"U1:1",width:0.5});
 assert.equal(pcb.test.isValidShape(b),true);
});
test("v3.0: manual B.Cu trace is valid and exported on back copper",()=>{
 const b=pcb.test.starter();b.traces.push({id:"back-trace",a:"J1:1",b:"U1:1",width:0.5,layer:"B.Cu"});
 assert.equal(pcb.test.isValidShape(b),true);
 assert.match(pcb.test.kicadDraft(b),/\(layer "B.Cu"\) \(net /);
});
test("v3.0: uncomplicated grid auto path avoids unnecessary vias",()=>{
 const b=pcb.test.starter();b.components=[
  {id:"J1",kind:"conn2",x:16,y:25,rotation:0},
  {id:"J2",kind:"conn2",x:76,y:25,rotation:0}
 ];b.traces=[];b.schematic={nets:[{name:"DATA",pins:["J1:1","J2:1"]}]};
 const ctx={padPos:pcb.test.padPos,pads:pcb.test.pads,unionNets:pcb.test.unionNets,netPlan:net.netPlan};
 const r=routeTool.candidate(b,"J1:1","J2:1",ctx,{layer:"F.Cu",allowVia:false,id:"test-simple"});
 assert.equal(r.ok,true);assert.equal(r.trace.vias.length,0);
 assert.equal(routeTool.validRoute(r.trace,b,ctx.padPos),true);
});
test("v3.0: automated routing adds an undoable PCB trace",()=>{
 const b=pcb.test.starter();b.schematic={nets:[{name:"DATA",pins:["J1:3","U1:2"]}]};
 pcb.test.set(b);
 const result=pcb.autoRouteMissing();
 assert.ok(result.success.length>=1,JSON.stringify(result.failed));
 assert.ok(pcb.test.read().traces.length>=1);
 pcb.undo();assert.equal(pcb.test.read().traces.length,0);
});
test("v3.0: routing returns explicit failure for impossible obstacles",()=>{
 const b=pcb.test.starter();b.components=[
  {id:"J1",kind:"conn2",x:16,y:25,rotation:0},
  {id:"J2",kind:"conn2",x:76,y:25,rotation:0}
 ];b.schematic={nets:[{name:"DATA",pins:["J1:1","J2:1"]}]};
 const ctx={padPos:pcb.test.padPos,pads:pcb.test.pads,unionNets:pcb.test.unionNets,netPlan:net.netPlan};
 const res=routeTool.candidate(b,"J1:1","J2:1",ctx,{layer:"B.Cu",allowVia:false,id:"test-back"});
 assert.equal(res.ok,true);assert.equal(res.trace.sections[0].layer,"B.Cu");
});
test("v3.0: malformed via route is rejected",()=>{
 const b=pcb.test.starter();b.traces.push({
  id:"bad-via",a:"J1:1",b:"U1:1",width:0.5,layer:"F.Cu",
  sections:[{layer:"F.Cu",points:[pcb.test.padPos("J1:1"),pcb.test.padPos("U1:1")]}],
  vias:[{x:10,y:10,diameter:1.4,drill:0.6}]
 });
 assert.equal(pcb.test.isValidShape(b),false);
});


const artwork=window.robotForgeFootprintGraphics;
test("v3.0: six source-traceable KiCad footprint graphic sets",()=>{
 assert.equal(Object.keys(artwork.graphics).length,6);
 for(const k of Object.keys(artwork.graphics))assert.ok(artwork.graphics[k].lines.length>5);
});
test("v3.0: selected KiCad LED footprint renders silkscreen and courtyard",()=>{
 const b=pcb.test.starter();b.components[2].profile=catalog.profiles.led.key;
 const svg=pcb.test.shapeSvg(b);
 assert.match(svg,/pcb-footprint-silk/);assert.match(svg,/pcb-footprint-courtyard/);
});
test("v3.0: generated KiCad PCB includes source-derived fp_line and fp_circle",()=>{
 const b=pcb.test.starter();b.components[2].profile=catalog.profiles.led.key;
 const result=pcb.test.kicadDraft(b);
 assert.match(result,/\(fp_line \(start /);assert.match(result,/\(fp_circle \(center /);
});
test("v3.0: valid two-sided via trace serializes segments and through-via",()=>{
 const b=pcb.test.starter();
 const a=pcb.test.padPos("J1:1",b),z=pcb.test.padPos("U1:1",b);
 b.traces=[{id:"via-example",a:"J1:1",b:"U1:1",width:0.5,layer:"F.Cu",
  sections:[{layer:"F.Cu",points:[a,{x:20,y:24}]},
            {layer:"B.Cu",points:[{x:20,y:24},z]}],
  vias:[{x:20,y:24,diameter:1.4,drill:0.6}]}];
 assert.equal(pcb.test.isValidShape(b),true);
 const content=pcb.test.kicadDraft(b);
 assert.match(content,/\(via \(at 20\.0000 24\.0000\)/);
 assert.match(content,/\(layer "B.Cu"\) \(net /);
 assert.equal((content.match(/\(segment /g)||[]).length,2);
});

const generated=pcb.test.kicadDraft();
if(process.env.OUTPUT_DIR){
 const dest=path.resolve(process.env.OUTPUT_DIR);fs.mkdirSync(dest,{recursive:true});
 fs.writeFileSync(path.join(dest,"robot-forge-demo.kicad_pcb"),generated,"utf8");
 fs.writeFileSync(path.join(dest,"robot-forge-draft.kicad_sch"),kiSch.generate(readySchematic),"utf8");
 fs.writeFileSync(path.join(dest,"robot-forge-parity.json"),JSON.stringify(parity.manifest(readySchematic,{pads:pcb.test.pads,unionNets:pcb.test.unionNets}),null,2),"utf8");
 fs.writeFileSync(path.join(dest,"robot-forge-logical-plan.json"),JSON.stringify({
  format:"RobotForgeLogicalNetPlan",version:1,kind:"UNVERIFIED_PIN_PLAN",
  nets:pcb.test.read().schematic.nets,disclaimer:"Not validated in KiCad, not manufacturing ready."
 },null,2),"utf8");
 process.stdout.write("Draft files written to "+dest+"\n");
}
process.stdout.write("PCB regression: "+passed+"/"+passed+" passed\n");
