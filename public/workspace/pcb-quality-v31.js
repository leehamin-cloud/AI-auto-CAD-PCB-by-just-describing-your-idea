/* Robot Forge PCB v3.1 — user-supplied component datasheet records and
 * untrusted external KiCad diagnostic report summaries.
 *
 * This module cannot fetch, authenticate, interpret, or verify a datasheet or
 * sign off manufacture. It keeps requested measurements separate from absolute
 * maximum user-entered ratings, and never reports "certified" / "approved".
 */
(function(scope){
"use strict";
const FIELDS=["manufacturer","mpn","datasheetUrl","datasheetPitchMm","maxVoltageV",
 "maxCurrentMa","operatingVoltageV","operatingCurrentMa","pinMapNote","reviewedByUser"];
const strings={manufacturer:100,mpn:100,datasheetUrl:550,pinMapNote:400};
const numbers=new Set(["datasheetPitchMm","maxVoltageV","maxCurrentMa","operatingVoltageV","operatingCurrentMa"]);
const labels={datasheetPitchMm:"데이터시트 핀 간격",maxVoltageV:"최대 허용 전압",maxCurrentMa:"최대 허용 전류",
 operatingVoltageV:"설계 사용 전압",operatingCurrentMa:"설계 사용 전류"};
function validPart(part){
 if(part===undefined)return true;
 if(!part||typeof part!=="object"||Array.isArray(part))return false;
 const keys=Object.keys(part);
 if(keys.some(k=>!FIELDS.includes(k)))return false;
 for(const [k,v] of Object.entries(part)){
  if(k in strings){
   if(typeof v!=="string"||v.length>strings[k]||/[\x00-\x08\x0E-\x1F]/.test(v))return false;
   if(k==="datasheetUrl"&&v.trim()&&!/^https:\/\/[a-z\d.-]+(?::443)?(?:\/[^\s]*)?$/i.test(v.trim()))return false;
  }else if(k==="reviewedByUser"){
   if(typeof v!=="boolean")return false;
  }else if(numbers.has(k)){
   if(v!==null&&(!Number.isFinite(v)||v<=0||v>1000000))return false;
  }
 }
 return true;
}
function getPart(c){return c&&validPart(c.part)?c.part||{}:{}}
function analyzePart(c,library){
 const data=getPart(c),err=[],warnings=[];
 const knownPart=Boolean(data.mpn?.trim()&&data.manufacturer?.trim());
 if(!knownPart)warnings.push(c.id+": 제조사와 정확한 부품 품번(MPN)이 없습니다.");
 if(!data.datasheetUrl?.trim())warnings.push(c.id+": 사용자가 확인한 데이터시트 HTTPS 링크가 없습니다.");
 if(data.reviewedByUser&&!knownPart)warnings.push(c.id+": 품번 없이 검토 표시했습니다. 데이터시트 대조가 불완전합니다.");
 if(data.reviewedByUser&&!data.datasheetUrl?.trim())warnings.push(c.id+": 데이터시트 근거 없이 검토 표시했습니다.");
 const spec=library?.get?.(c);
 if(!spec)warnings.push(c.id+": KiCad 풋프린트 후보를 선택하지 않았습니다.");
 const pitch=spec?.pitch;
 if(data.datasheetPitchMm!=null&&Number.isFinite(pitch)){
  const delta=Math.abs(data.datasheetPitchMm-pitch);
  if(delta>0.11)err.push(c.id+": 기록된 핀 간격 "+data.datasheetPitchMm+"mm와 선택된 참고 풋프린트 피치 "+pitch+"mm가 일치하지 않습니다.");
 }
 for(const [operating,max,unit,title] of [
  ["operatingVoltageV","maxVoltageV","V","전압"],
  ["operatingCurrentMa","maxCurrentMa","mA","전류"]
 ]){
  if(data[operating]!=null&&data[max]!=null){
   if(data[operating]>data[max])
    err.push(c.id+": 설계 "+title+" "+data[operating]+unit+"가 입력된 최대 허용치 "+data[max]+unit+"를 초과했습니다.");
   else if(data[operating]>=data[max]*0.95)
    warnings.push(c.id+": 설계 "+title+"가 입력된 최대 허용치의 95% 이상입니다. 별도 디레이팅 확인이 필요합니다.");
  }else if(data[operating]!=null&&data[max]==null){
   warnings.push(c.id+": 설계 "+title+"를 적었지만 허용치가 없습니다.");
  }
 }
 if(!data.reviewedByUser)warnings.push(c.id+": 부품 데이터시트 검토 표시가 없습니다.");
 return {ref:c.id,errors:err,warnings,hasPartNumber:knownPart,hasDatasheet:Boolean(data.datasheetUrl),
  selfReviewed:!!data.reviewedByUser,manufacturerConfirmed:false,
  source:"User-entered fields; no automatic datasheet verification."};
}
function analyze(board,library){
 const details=(board.components||[]).map(c=>analyzePart(c,library));
 const issues=details.flatMap(v=>v.errors),warnings=details.flatMap(v=>v.warnings);
 return {issues,warnings,details,total:details.length,
  withPartNumber:details.filter(v=>v.hasPartNumber).length,
  withDatasheet:details.filter(v=>v.hasDatasheet).length,
  selfReviewed:details.filter(v=>v.selfReviewed).length,
  verifiedByManufacturer:0,manufacturingAuthorized:false};
}
function fingerprint(board){
 // Only a local change detector, not a cryptographic content hash or source authentication.
 const value=JSON.stringify(board,(key,v)=>key==="disclaimer"?undefined:v);
 let h=2166136261>>>0;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
 return "rf-v31-fnv32-"+h.toString(16).padStart(8,"0");
}
function parseKiCadReport(value,type){
 if(!["erc","drc"].includes(type))throw Error("ERC 또는 DRC 보고서 종류를 지정하세요.");
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("보고서 JSON 객체가 필요합니다.");
 const arrays=["violations","unconnected_items","shorting_items"];
 if(!arrays.some(k=>Array.isArray(value[k])))throw Error("KiCad 진단 보고서의 violations / unconnected_items 배열을 찾을 수 없습니다.");
 for(const key of arrays)if(value[key]!==undefined&&!Array.isArray(value[key]))throw Error("진단 목록 형식이 올바르지 않습니다: "+key);
 const findings=arrays.reduce((n,k)=>n+(value[k]?.length||0),0);
 if(findings>10000)throw Error("진단 항목이 지나치게 많습니다.");
 const errors=[],warnings=[];
 for(const key of arrays){
  for(const row of (value[key]||[])){
   if(!row||typeof row!=="object"||Array.isArray(row))throw Error("진단 항목 형식 오류");
   const summary=String(row.description||row.message||row.type||row.rule||key).slice(0,240);
   const sev=String(row.severity||"").toLowerCase();
   if(sev==="warning")warnings.push(summary);else errors.push(summary);
  }
 }
 return {type,issueCount:findings,errorCount:errors.length,warningCount:warnings.length,
  errors:errors.slice(0,100),warnings:warnings.slice(0,100),
  toolVersion:typeof value.kicad_version==="string"?value.kicad_version.slice(0,60):null,
  source:"USER_IMPORTED_UNVERIFIED",status:findings?"DIAGNOSTIC_FINDINGS":"NO_REPORTED_FINDINGS_UNVERIFIED",
  approved:false};
}
function parseImportedFile(text,kind){
 if(typeof text!=="string"||text.length>5000000)throw Error("파일 크기가 5MB를 초과합니다.");
 let json;
 try{json=JSON.parse(text)}catch{throw Error("유효한 JSON 파일이 아닙니다.")}
 return parseKiCadReport(json,kind);
}
function reportOverview(reports,board){
 const fp=fingerprint(board),checks={};
 for(const kind of ["erc","drc"]){
  const item=reports?.[kind];
  checks[kind]=item?{...item,currentLocalDraft:item.fingerprint===fp,
     notAuthenticated:true,officialSignoff:false}:null;
 }
 return {fingerprint:fp,checks,notAuthenticated:true,manufacturingAuthorized:false};
}
scope.robotForgePCBQuality={validPart,getPart,analyzePart,analyze,fingerprint,parseKiCadReport,parseImportedFile,reportOverview,labels};
})(typeof window!=="undefined"?window:this);
