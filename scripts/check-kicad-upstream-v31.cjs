#!/usr/bin/env node
/*
 * Robot Forge v3.1 — KiCad upstream footprint SOURCE DRIFT check
 *
 * Local mode: compare our two source-derived datasets, source paths, blob SHA,
 * pad counts & UI profile pitches without network.
 *
 * --online: query GitHub's public contents API for each original .kicad_mod
 * file and verify current Git blob SHA. A mismatch is not silently updated;
 * source-derived profiles must be reviewed and regenerated separately.
 *
 * No official .kicad_mod is copied, downloaded into the repo, or shipped
 * through this script. Source: https://github.com/KiCad/kicad-footprints
 * License: CC BY-SA 4.0 with KiCad schematic/PCB project exception.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),https=require("node:https"),assert=require("node:assert/strict");
const base=path.resolve(__dirname,".."),window={};
function load(name){vm.runInNewContext(fs.readFileSync(path.join(base,"public/workspace",name),"utf8"),{window,console,Math,Object,Array,Number,String})}
load("pcb-parts.js");load("pcb-pad-library.js");load("pcb-footprint-graphics.js");
const pad=window.robotForgeFootprintPads.models,art=window.robotForgeFootprintGraphics.graphics,profiles=window.robotForgePartCatalog.profiles;
const expected=["resistor","led","capacitor","conn2","conn3","ic4"];
function checkLocal(){
 assert.deepEqual(Object.keys(pad).sort(),expected.slice().sort());
 assert.deepEqual(Object.keys(art).sort(),expected.slice().sort());
 for(const key of expected){
  const a=pad[key],g=art[key],profile=profiles[key];
  assert.ok(a&&g&&profile,"Missing source record for "+key);
  assert.equal(a.sourcePath,g.source,key+" source path drift");
  assert.equal(a.sourceBlobSha,g.sha,key+" source blob mismatch");
  assert.ok(/^[a-f0-9]{40}$/.test(a.sourceBlobSha),key+" invalid upstream blob SHA");
  assert.ok(a.sourcePath.endsWith(".kicad_mod"),key+" not a KiCad module");
  assert.ok(a.pads.length===profile.padPositions.length,key+" unexpected pad count");
  assert.deepEqual(a.pads.map(p=>p.pin),a.pads.map((_,i)=>i+1),key+" pad order mismatch");
  assert.ok(a.pads.every(p=>p.drill>0&&p.size.every(n=>n>0)&&["circle","rect","oval"].includes(p.shape)),key+" invalid geometry");
  assert.ok(g.lines.length+g.circles.length>0,key+" no upstream graphics");
  for(let i=0;i<a.pads.length;i++){
   const data=a.pads[i],model=profile.padPositions[i];
   assert.ok(Math.hypot(data.x-model[0],data.y-model[1])<0.001,key+" source coordinates drift from browser profile");
  }
 }
 console.log("KiCad upstream LOCAL consistency: 6/6 source records match pad and outline models");
}
async function githubBlobSha(source){
 const url="https://api.github.com/repos/KiCad/kicad-footprints/contents/"+source;
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{headers:{"User-Agent":"RobotForge-Footprint-Diff-Check","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}},res=>{
   const chunks=[];
   res.on("data",c=>{chunks.push(c);if(chunks.reduce((n,x)=>n+x.length,0)>250000)req.destroy(new Error("Oversized upstream metadata"));});
   res.on("end",()=>{
    if(res.statusCode!==200)return reject(new Error("GitHub "+res.statusCode+" for "+source));
    try{const data=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(data.type!=="file"||!data.sha)throw Error("Unexpected GitHub response");resolve(data.sha)}
    catch(e){reject(e)}
   });
  });
  req.setTimeout(15000,()=>req.destroy(new Error("GitHub lookup timed out")));
  req.on("error",reject);
 });
}
async function main(){
 checkLocal();
 if(!process.argv.includes("--online"))return;
 for(const key of expected){
  const item=pad[key],sha=await githubBlobSha(item.sourcePath);
  if(sha!==item.sourceBlobSha){
   console.error("SOURCE_DRIFT "+key+" "+item.sourcePath+" stored="+item.sourceBlobSha+" current="+sha);
   throw Error("Upstream KiCad library changed: review current official footprint before updating cached geometry");
  }
  console.log("Current upstream blob matches "+key+" "+sha.slice(0,10));
 }
 console.log("KiCad upstream ONLINE source revision check: 6/6 match");
}
main().catch(e=>{console.error("KiCad footprint consistency failed:",e.message);process.exitCode=1});
