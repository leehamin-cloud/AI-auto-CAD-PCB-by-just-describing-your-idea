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
run("public/workspace/pcb-schematic.js");
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

const generated=pcb.test.kicadDraft();
if(process.env.OUTPUT_DIR){
 const dest=path.resolve(process.env.OUTPUT_DIR);fs.mkdirSync(dest,{recursive:true});
 fs.writeFileSync(path.join(dest,"robot-forge-demo.kicad_pcb"),generated,"utf8");
 fs.writeFileSync(path.join(dest,"robot-forge-logical-plan.json"),JSON.stringify({
  format:"RobotForgeLogicalNetPlan",version:1,kind:"UNVERIFIED_PIN_PLAN",
  nets:pcb.test.read().schematic.nets,disclaimer:"Not validated in KiCad, not manufacturing ready."
 },null,2),"utf8");
 process.stdout.write("Draft files written to "+dest+"\n");
}
process.stdout.write("PCB regression: "+passed+"/"+passed+" passed\n");
