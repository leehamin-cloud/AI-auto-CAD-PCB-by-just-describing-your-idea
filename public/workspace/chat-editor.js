/* Robot Forge CAD chat — deterministic local commands, instant mesh updates.
   Does NOT call an LLM, run external code, or control physical robots.
   Depends on workspace.js global lexical CAD functions. */
(() => {
  "use strict";
  const STORAGE="robotforge.chat.v2.";
  const $chat=s=>document.querySelector(s);
  const modelLabels={arm:"로봇팔",plate:"나사 구멍판",block:"네모 블록",bracket:"ㄱ자 브래킷",shaft:"원통 축"};
  const fieldLabels={link1:"첫 번째 팔 길이",link2:"두 번째 팔 길이",angle1:"첫 번째 관절 각도",angle2:"두 번째 관절 각도",payload:"팔 끝 하중",length:"길이",width:"폭/세로",height:"높이",thickness:"두께",base:"받침대 크기",diameter:"축 지름",hole_count:"구멍 수",hole_diameter:"구멍 지름",offset_x:"좌우 구멍 여백",offset_y:"위아래 구멍 여백"};
  const patterns={
    hole_count:[/(?:구멍|홀)(?:\s*(?:갯수|개수|수))?\s*(?:는|을|을|:|=|로)?\s*(\d{1,2})\s*(?:개|곳)?(?:\b|(?=\s)|$|짜리|있는|의)/i,/(\d{1,2})\s*개(?:의)?\s*(?:구멍|홀)/i,/(?:holes?|hole\s+count)\s*[:=]?\s*(\d{1,2})/i],
    hole_diameter:[/(?:구멍|홀)\s*(?:의\s*)?(?:지름|직경|크기)\s*(?:를|을|은|이|로|:|=|가)?\s*(-?\d+(?:\.\d+)?)/i,/(?:hole\s*(?:size|diameter)|hole_diameter)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i],
    offset_x:[/(?:좌우|가로)\s*(?:구멍\s*)?(?:여백|간격)\s*(?:을|를|은|로|:|=)?\s*(-?\d+(?:\.\d+)?)/i,/(?:offset[_\s-]*x)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i],
    offset_y:[/(?:위아래|세로)\s*(?:구멍\s*)?(?:여백|간격)\s*(?:을|를|은|로|:|=)?\s*(-?\d+(?:\.\d+)?)/i,/(?:offset[_\s-]*y)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i],
    link1:[/(?:첫\s*번째\s*팔|첫\s*팔|첫\s*링크|상완|link\s*1|l1)\s*(?:의\s*)?(?:길이)?\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    link2:[/(?:두\s*번째\s*팔|둘째\s*팔|둘째\s*링크|전완|link\s*2|l2)\s*(?:의\s*)?(?:길이)?\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    angle1:[/(?:관절\s*1|첫\s*번째\s*관절|첫\s*관절|angle\s*1|joint\s*1)\s*(?:의\s*)?(?:각도)?\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    angle2:[/(?:관절\s*2|두\s*번째\s*관절|두\s*관절|angle\s*2|joint\s*2)\s*(?:의\s*)?(?:각도)?\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    payload:[/(?:하중|페이로드|payload|끝\s*(?:에)?\s*다는\s*무게)\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    thickness:[/(?:두께|thickness)\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    base:[/(?:받침대|베이스|base)\s*(?:크기|길이|너비)?\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    diameter:[/(?:축\s*)?(?:지름|직경|diameter)\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    height:[/(?:높이|height)\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    width:[/(?:세로(?:\s*길이)?|너비|폭|width)\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i],
    length:[/(?:가로(?:\s*길이)?|전체\s*길이|길이|length)\s*(?:를|을|은|로|:|=|to)?\s*(-?\d+(?:\.\d+)?)/i]
  };
  const relativeKeys=[
    {key:"hole_diameter",token:/(?:구멍|홀)\s*(?:의\s*)?(?:지름|크기|직경)|(?:^|\s)(?:지름|직경)/i},
    {key:"link1",token:/(?:첫\s*번째\s*팔|첫\s*팔|첫\s*링크|link\s*1)/i},
    {key:"link2",token:/(?:두\s*번째\s*팔|둘째\s*팔|두\s*팔|link\s*2)/i},
    {key:"angle1",token:/(?:관절\s*1|첫\s*관절|angle\s*1)/i},
    {key:"angle2",token:/(?:관절\s*2|두\s*관절|angle\s*2)/i},
    {key:"height",token:/(?:높이|height)/i},
    {key:"width",token:/(?:세로|폭|너비|width)/i},
    {key:"thickness",token:/(?:두께|thickness)/i},
    {key:"diameter",token:/(?:지름|축\s*크기|diameter)/i},
    {key:"length",token:/(?:가로|길이|length)/i}
  ];
  const relativeUp=/(?:늘려|키워|높여|길게|두껍게|크게|증가|더\s*크게|더\s*길게|더\s*높게|expand|increase)/i;
  const relativeDown=/(?:줄여|낮춰|짧게|얇게|작게|감소|더\s*작게|더\s*짧게|decrease|reduce)/i;
  const prettyModel=(text)=>{
    const str=text.toLowerCase();
    if(/ㄱ\s*자|브래킷|브라켓|bracket/.test(str))return "bracket";
    if(/원통|회전\s*축|원기둥|shaft/.test(str))return "shaft";
    if(/구멍.*판|판.*구멍|평평한\s*판|플레이트|mounting\s*plate|plate/.test(str))return "plate";
    if(/네모\s*블록|사각\s*블록|블록|block/.test(str))return "block";
    if(/로봇\s*팔|로봇팔|robot\s*arm|2\s*[- ]?\s*dof/.test(str))return "arm";
    return null;
  };
  const modelFromText=(text,existingModel)=>{
    const named=prettyModel(text);
    if(named)return named;
    const isNew=/(?:만들|생성|그려|설계|create|new)/i.test(text);
    if(isNew&&/(?:나사\s*구멍|구멍\s*\d+\s*개|판재)/i.test(text))return "plate";
    return existingModel;
  };
  const ruleUnit=(key)=>key==="angle1"||key==="angle2"?"°":key==="payload"?"g":key==="hole_count"?"개":"mm";
  const near=(a,b)=>Math.abs(Number(a)-Number(b))<1e-8;
  const normalize=(s)=>s.replace(/,/g," ").replace(/(\d)\s*밀리미터/g,"$1mm").replace(/[“”]/g,'"').trim();

  function parse(text,snapshot){
    const input=normalize(String(text||"").slice(0,1500)),lower=input.toLowerCase();
    const state=snapshot||{model:current().model,params:{...current().params}};
    const model=modelFromText(lower,state.model);
    // Never apply arm-specific requests to unrelated dimensions of a different model.
    if(model!=="arm"&&/(?:첫\s*번째\s*팔|두\s*번째\s*팔|첫\s*링크|둘째\s*링크|관절\s*[12]|link\s*[12]|joint\s*[12])/i.test(lower)){
      return {kind:"error",model,changes:{},note:"현재는 "+modelLabels[model]+" 모델입니다. 로봇팔 길이·관절을 바꾸려면 ‘로봇팔 만들기’를 먼저 입력해주세요."};
    }
    if(model!=="plate"&&/(?:구멍|홀)\s*(?:\d|지름|크기|직경|개수)/i.test(lower)){
      return {kind:"error",model,changes:{},note:"현재는 "+modelLabels[model]+" 모델입니다. 구멍을 편집하려면 ‘구멍판 만들기’를 먼저 입력해주세요."};
    }
    const oldParams=model===state.model?state.params:defaults[model];
    const changes={};
    const schema=limits[model];
    const allowed=new Map(schema.map(row=>[row[0],row]));
    if(!input)return {kind:"empty",note:"원하는 변경 내용을 입력해주세요.",model,changes:{}};
    if(/^(?:도움말|help|뭐\s*할\s*수\s*있|사용법|명령\s*예시)/i.test(lower))return {kind:"help",note:"예: ‘구멍 4개 판 만들어줘 가로 180 세로 100’, ‘구멍 지름 2mm 늘려줘’, ‘첫 번째 팔 길이 150’, ‘이전으로’",model,changes:{}};
    if(/^(?:되돌려|이전으로|취소|undo|한\s*단계\s*전|전\s*단계)/i.test(lower))return {kind:"undo",note:"직전 CAD 수정 상태로 되돌립니다.",model,changes:{}};
    if(/^(?:다시\s*실행|다시\s*앞으로|redo)/i.test(lower))return {kind:"redo",note:"되돌린 수정을 다시 적용합니다.",model,changes:{}};
    if(/^(?:정면|앞에서|front\s*view|앞\s*보기|위에서|평면도|top\s*view|측면|옆에서|side\s*view|입체|isometric)/i.test(lower)){
      const v=/앞|front/.test(lower)?"front":/위|평면도|top/.test(lower)?"top":/옆|측면|side/.test(lower)?"side":"iso";
      return {kind:"view",view:v,note:"카메라 시점을 전환합니다.",model,changes:{}};
    }
    if(/^(?:내보내|다운로드|export|파일\s*저장)/i.test(lower)){
      const type=/dxf/i.test(lower)?"dxf":/obj/i.test(lower)?"obj":/json/i.test(lower)?"json":"stl";
      return {kind:"export",export:type,note:type.toUpperCase()+" 파일을 다운로드합니다.",model,changes:{}};
    }
    let matchedRelative=false;
    if(relativeUp.test(lower)||relativeDown.test(lower)){
      const deltaMatch=lower.match(/(-?\d+(?:\.\d+)?)\s*(?:mm|밀리미터|도|°)?\s*(?:만\s*)?(?:더\s*)?(?=늘려|키워|높여|길게|두껍게|크게|줄여|낮춰|짧게|얇게|작게|증가|감소|expand|increase|decrease|reduce)/i)
                     ||lower.match(/(?:더\s*)?(?:늘려|줄여|크게|작게|길게|짧게)\s*(?:줘|주세요|요|:)?\s*(-?\d+(?:\.\d+)?)/i);
      if(deltaMatch){
        const source=relativeKeys.find(({key,token})=>allowed.has(key)&&token.test(lower)&&
          (key!=="diameter"||!/(?:구멍|홀)/.test(lower)));
        if(source){
          const step=Number(deltaMatch[1]);
          const direction=relativeDown.test(lower)?-1:1;
          if(Number.isFinite(step)&&step>0){
            changes[source.key]=Number(oldParams[source.key])+direction*step;
            matchedRelative=true;
          }
        }
      }
    }
    if(!matchedRelative){
      // More specific field grammar wins over short generic terms.
      for(const [key,regexList] of Object.entries(patterns)){
        if(!allowed.has(key))continue;
        for(const regex of regexList){
          const match=lower.match(regex);
          if(match){
            const v=Number(match[1]);
            if(!Number.isFinite(v))return {kind:"error",note:"숫자를 확인해주세요.",model,changes:{}};
            changes[key]=v;
            break;
          }
        }
      }
      if(model==="plate"&&!Object.hasOwn(changes,"hole_diameter")){
        const bareDiameter=lower.match(/(?:^|\s)(?:지름|직경)\s*(?:을|를|은|이|로|:|=)?\s*(-?\d+(?:\.\d+)?)/i);
        if(bareDiameter)changes.hole_diameter=Number(bareDiameter[1]);
      }
      if(Object.hasOwn(changes,"hole_diameter")&&model==="shaft")delete changes.hole_diameter;
    }
    if(model===state.model&&Object.keys(changes).length===0){
      return {kind:"help",model,changes:{},note:"이 요청에서 지원되는 치수를 찾지 못했어요. 예: ‘가로 180 세로 100’, ‘구멍 4개’, ‘첫 번째 팔 길이 150’"};
    }
    for(const [key,value] of Object.entries(changes)){
      const row=allowed.get(key);
      if(!row||!Number.isFinite(value)||value<row[2]||value>row[3]||(key==="hole_count"&&![0,1,2,4].includes(value))){
        return {kind:"error",model,changes,note:(fieldLabels[key]||key)+" 값이 올바르지 않아요. 허용 범위: "+row[2]+"~"+row[3]+ruleUnit(key)};
      }
    }
    const next={...oldParams,...changes};
    const validity=validateDesign(model,next);
    if(validity)return {kind:"error",model,changes,note:validity};
    const changed={};
    for(const [key,value] of Object.entries(changes)){
      if(!near(value,oldParams[key]))changed[key]=value;
    }
    if(model===state.model&&Object.keys(changed).length===0){
      return {kind:"help",model,changes:{},note:"이미 같은 치수예요. 다른 값으로 입력해보세요."};
    }
    const fromModel=model!==state.model;
    const summary=(fromModel?"모델: "+modelLabels[model]+(Object.keys(changed).length?" · ":""):"")+
      Object.entries(changed).map(([key,value])=>fieldLabels[key]+" "+value+ruleUnit(key)).join(" · ");
    return {kind:"edit",model,changes:changed,params:next,note:summary||"모델 변경",previousModel:state.model};
  }

  function sessionKey(){return STORAGE+current().id}
  function historyLoad(){
    try{
      const raw=JSON.parse(localStorage.getItem(sessionKey())||"[]");
      if(!Array.isArray(raw))return [];
      return raw.filter(e=>e&&["assistant","user"].includes(e.role)&&typeof e.text==="string").slice(-45).map(e=>({role:e.role,text:e.text.slice(0,1800),time:typeof e.time==="string"?e.time:""}));
    }catch{return []}
  }
  let transcript=[],activeProjectId=null;
  const welcome="안녕하세요! 👋 CAD 설계를 채팅으로 바로 수정할 수 있어요.\n\n예: “구멍 4개 판 만들어줘. 가로 180, 세로 100, 구멍 지름 8”";
  const clock=()=>new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false});
  function append(role,text,store=true){
    const obj={role,text:String(text).slice(0,1800),time:clock()};
    transcript.push(obj);
    if(transcript.length>45)transcript.shift();
    const area=$chat("#chatHistory");
    if(area){
      const div=document.createElement("div");
      div.className=role==="user"?"chat-user":"chat-response";
      div.textContent=obj.text;
      const meta=document.createElement("small");
      meta.className="chat-message-meta";meta.textContent=obj.time+(role==="assistant"?" · CAD 편집":"");
      div.append(meta);area.append(div);area.scrollTop=area.scrollHeight;
    }
    if(store){try{localStorage.setItem(sessionKey(),JSON.stringify(transcript))}catch{}}
  }
  function loadProjectChat(){
    if(activeProjectId===current().id)return;
    activeProjectId=current().id;
    transcript=historyLoad();
    const area=$chat("#chatHistory");if(!area)return;
    area.replaceChildren();
    if(!transcript.length){append("assistant",welcome,true)}
    else{
      const messages=transcript.slice();transcript=[];
      for(const item of messages)append(item.role,item.text,false);
    }
    const name=$chat("#chatSessionName");if(name)name.textContent=current().name+" · 채팅 설계";
  }
  function status(plan){
    const area=$chat("#chatLivePreview");if(!area)return;
    const text=plan.kind==="edit"?"적용 예정: "+plan.note:plan.note;
    area.classList.toggle("ready",plan.kind==="edit");
    area.classList.toggle("problem",plan.kind==="error");
    area.replaceChildren();
    const dot=document.createElement("span");dot.className="preview-dot";
    area.append(dot,document.createTextNode(text));
  }
  function preview(){
    const el=$chat("#commandInput");if(!el)return;
    if(isOnline()){
      const text=el.value.trim();
      status({kind:"help",note:text?"AI가 문장을 해석합니다. 전송하면 검증 후 3D에 적용합니다.":"실제 AI 모드에서 작성한 내용은 서버로 전송됩니다."});
      return {kind:"online"};
    }
    const plan=parse(el.value);
    status(plan);
    return plan;
  }

  /* Remote model mode is optional. Keys NEVER appear in the static site bundle.
     The access code is kept only in the current input field, never localStorage. */
  const AI_URL="https://robot-forge-ai-proxy.onrender.com";
  let aiReady=false,aiSending=false;
  const isOnline=()=>Boolean(aiReady&&$chat("#useOnlineAI")?.checked);
  function updateAIBadge(){
    const badge=$chat("#chatProviderBadge");
    if(!badge)return;
    badge.textContent=isOnline()?"OpenAI 채팅":"로컬 채팅";
    badge.classList.toggle("server",isOnline());
  }
  async function refreshAIStatus(){
    const indicator=$chat("#aiConnectivity"),toggle=$chat("#useOnlineAI"),code=$chat("#aiAccessCode");
    if(indicator)indicator.textContent="연결 확인 중…";
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
    try{
      const res=await fetch(AI_URL+"/api/status",{method:"GET",cache:"no-store",signal:ctl.signal});
      if(!res.ok)throw Error("HTTP "+res.status);
      const data=await res.json();
      aiReady=Boolean(data.enabled===true);
      if(toggle)toggle.disabled=!aiReady;
      if(code)code.disabled=!aiReady;
      if(indicator){indicator.textContent=aiReady?"AI 연결 준비 완료":"API 키 설정 필요";indicator.classList.toggle("ready",aiReady)}
      if(!aiReady&&toggle)toggle.checked=false;
    }catch{
      aiReady=false;
      if(toggle){toggle.checked=false;toggle.disabled=true}
      if(code)code.disabled=true;
      if(indicator){indicator.textContent="AI 서버 연결 불가";indicator.classList.remove("ready")}
    }finally{clearTimeout(timer);updateAIBadge()}
  }
  async function sendOnlineAI(text,field){
    const access=$chat("#aiAccessCode")?.value||"";
    if(!access){
      append("assistant","실제 AI 모드에는 Render에서 설정한 접근 코드가 필요합니다. 코드를 입력하거나 로컬 채팅으로 전환해주세요.",true);
      status({kind:"error",note:"AI 접근 코드를 입력해주세요."});return;
    }
    if(text.length>900){
      append("assistant","실제 AI 요청은 900자 이내로 작성해주세요.",true);
      status({kind:"error",note:"900자 이내로 입력해주세요."});return;
    }
    if(aiSending)return;
    aiSending=true;
    const button=$chat("#sendCommandButton"),projectId=current().id;
    const base={model:current().model,params:{...current().params}};
    const tag=JSON.stringify(base);
    if(button)button.disabled=true;
    status({kind:"help",note:"실제 AI가 CAD 치수 변경안을 해석하고 있습니다…"});
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),40000);
    try{
      const res=await fetch(AI_URL+"/api/plan",{
        method:"POST",
        headers:{"Content-Type":"application/json","X-RobotForge-Code":access},
        body:JSON.stringify({
          prompt:text,model:base.model,params:base.params,
          history:transcript.slice(-7,-1).map(x=>({role:x.role,text:x.text.slice(0,300)})),
        }),
        signal:abort.signal,cache:"no-store",
      });
      if(!res.ok){
        let detail="AI 요청 실패 ("+res.status+")";
        try{const problem=await res.json();if(typeof problem.detail==="string")detail=problem.detail}catch{}
        throw Error(detail);
      }
      const proposal=await res.json();
      if(current().id!==projectId||JSON.stringify({model:current().model,params:current().params})!==tag){
        throw Error("AI 응답 도중 현재 설계가 변경됐습니다. 다시 요청하면 최신 모델로 계산합니다.");
      }
      if(!proposal||!Object.hasOwn(defaults,proposal.model)||!Array.isArray(proposal.edits)||proposal.edits.length>10||proposal.source!=="openai"){
        throw Error("AI 응답의 형식이 올바르지 않습니다.");
      }
      const model=proposal.model,rows=new Map(limits[model].map(x=>[x[0],x]));
      const next=model===base.model?{...base.params}:{...defaults[model]};
      const seen=new Set(),descriptions=[];
      for(const edit of proposal.edits){
        if(!edit||typeof edit.key!=="string"||!rows.has(edit.key)||seen.has(edit.key)||
           typeof edit.value!=="number"||!Number.isFinite(edit.value))throw Error("AI 수정안에 지원하지 않는 값이 있습니다.");
        const rule=rows.get(edit.key);
        if(edit.value<rule[2]||edit.value>rule[3]||
           (edit.key==="hole_count"&&![0,1,2,4].includes(edit.value))){
          throw Error("AI가 허용 범위를 벗어난 치수를 제안했습니다.");
        }
        seen.add(edit.key);next[edit.key]=edit.value;
        descriptions.push((fieldLabels[edit.key]||edit.key)+" "+edit.value+ruleUnit(edit.key));
      }
      const problem=validateDesign(model,next);
      if(problem)throw Error("AI 수정안 검증 실패: "+problem);
      const changed=model!==base.model||Object.keys(next).some(k=>!near(next[k],base.params[k]));
      if(changed){
        const label="AI 채팅: "+modelLabels[model]+" "+descriptions.join(", ");
        mutate(p=>{p.model=model;p.params={...next};p.hiddenParts=[]},label.slice(0,90));
        const integrity=meshDiagnostics(buildParts());
        append("assistant","AI 수정안 적용 완료 ✨\n"+(model!==base.model?"모델: "+modelLabels[model]+"\n":"")+
          (descriptions.length?descriptions.join(" · ")+"\n":"")+
          (typeof proposal.message==="string"?proposal.message.slice(0,380)+"\n":"")+
          "3D 모델을 갱신했습니다. "+(integrity.closed?"메시 닫힘 검사 통과.":"메시 검토가 필요합니다.")+
          "\n수정 기록에서 이전 상태로 되돌릴 수 있습니다.",true);
        notify("AI의 CAD 수정안이 적용됐어요");
      }else{
        append("assistant",typeof proposal.message==="string"?proposal.message.slice(0,450):"현재 모델에 적용할 변경사항이 없습니다.",true);
      }
      status({kind:"help",note:"✓ AI 응답 처리 완료 · 결과를 확인해주세요."});
    }catch(e){
      append("assistant","AI 연결에서 문제가 발생했습니다: "+(e?.message||String(e))+
        "\n현재 설계는 변경되지 않았습니다. 로컬 채팅 모드로 전환하면 바로 수정할 수 있습니다.",true);
      status({kind:"error",note:"AI 요청 실패 · 현재 CAD는 그대로입니다."});
    }finally{clearTimeout(timer);aiSending=false;if(button)button.disabled=false;field.focus()}
  }

  function send(){
    loadProjectChat();
    const field=$chat("#commandInput");if(!field)return;
    const msg=field.value.trim();
    if(!msg){status({kind:"empty",note:"무엇을 수정하고 싶으신가요?"});field.focus();return}
    if(msg.length>1500){status({kind:"error",note:"1500자 이내로 입력해주세요."});return}
    if(aiSending)return;
    if(isOnline()){
      append("user",msg,true);
      field.value="";
      return sendOnlineAI(msg,field);
    }
    const plan=parse(msg);
    append("user",msg,true);
    field.value="";
    if(plan.kind==="error"||plan.kind==="empty"||plan.kind==="help"){
      append("assistant",plan.note,true);status(plan);return;
    }
    try{
      if(plan.kind==="edit"){
        // Atomic single revision: validate before any project mutation.
        const stillValid=validateDesign(plan.model,plan.params);
        if(stillValid)throw Error(stillValid);
        mutate(p=>{
          p.model=plan.model;
          p.params={...plan.params};
          p.hiddenParts=[];
        },"채팅 편집: "+plan.note.slice(0,70));
        const verification=meshDiagnostics(buildParts());
        const ok=verification.closed?"메시가 닫힌 형상인지 확인했어요.":"메시 경계가 있어 추가 검토가 필요해요.";
        append("assistant","수정 완료! ✅\n"+plan.note+"\n3D 모델을 새로 그렸어요. "+ok+"\n'수정 기록'에서 되돌릴 수 있습니다.",true);
        status({kind:"help",note:"✓ 수정 완료 · 다음 변경도 이어서 말해주세요."});
        notify("채팅 수정이 3D 모델에 반영됐어요");
        scheduleDraw();
      }else if(plan.kind==="undo"||plan.kind==="redo"){
        plan.kind==="undo"?undo():redo();
        append("assistant",plan.kind==="undo"?"직전 설계로 돌아갔어요.":"되돌렸던 설계를 다시 적용했어요.",true);
        status({kind:"help",note:plan.note});
      }else if(plan.kind==="view"){
        const control=$chat('.view-chip[data-view="'+plan.view+'"]');
        if(control)control.click();
        append("assistant","카메라 시점을 변경했습니다.",true);
        status({kind:"help",note:plan.note});
      }else if(plan.kind==="export"){
        if(plan.export==="dxf"&&current().model!=="plate")throw Error("DXF는 현재 구멍판 모델에서만 지원합니다.");
        exportFile(plan.export);
        append("assistant",plan.export.toUpperCase()+" 파일 다운로드를 요청했어요. 브라우저의 다운로드 목록을 확인해주세요.",true);
        status({kind:"help",note:plan.note});
      }
    }catch(e){
      append("assistant","수정을 적용하지 못했어요: "+(e?.message||String(e))+"\n치수를 다시 확인해주세요.",true);
      status({kind:"error",note:"오류: "+(e?.message||String(e))});
    }
    field.focus();
  }
  function show(){
    const tab=$chat('.inspector-tab[data-inspector="assistant"]');
    if(tab)tab.click();
    const sidebar=$chat("#rightSidebar");
    if(window.matchMedia("(max-width: 680px)").matches&&sidebar)sidebar.scrollIntoView({behavior:"smooth",block:"start"});
    setTimeout(()=>{$chat("#commandInput")?.focus()},70);
  }
  function clear(){
    transcript=[];
    try{localStorage.removeItem(sessionKey())}catch{}
    $chat("#chatHistory")?.replaceChildren();
    append("assistant",welcome,true);
    status({kind:"help",note:"대화만 지웠습니다. CAD 모델 및 수정 기록은 그대로입니다."});
  }
  function mount(){
    if(!$chat("#commandInput"))return;
    loadProjectChat();
    status({kind:"help",note:"수정 요청을 입력하면 적용할 내용을 미리 보여드려요."});
    $chat("#commandInput").addEventListener("input",preview);
    $chat("#commandInput").addEventListener("keydown",event=>{
      if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing&&!event.ctrlKey&&!event.metaKey){
        event.preventDefault();send();
      }
    });
    $chat("#useOnlineAI")?.addEventListener("change",()=>{updateAIBadge();preview()});
    $chat("#aiRetryButton")?.addEventListener("click",refreshAIStatus);
    refreshAIStatus();
    $chat("#chatClearButton")?.addEventListener("click",clear);
    $chat("#topChatButton")?.addEventListener("click",show);
    $chat("#canvasChatButton")?.addEventListener("click",show);
    $chat("#projectPicker")?.addEventListener("click",()=>setTimeout(loadProjectChat,150));
    document.addEventListener("click",event=>{
      if(event.target?.closest?.("[data-open],[data-start-template],[data-inspector=assistant]"))setTimeout(loadProjectChat,0);
    });
    const tab=$chat('.inspector-tab[data-inspector="assistant"]');
    if(tab)tab.click();
  }
  window.robotForgeChat={parse,preview,send,show,clear,mount,loadProjectChat,_test:{modelFromText,patterns,fieldLabels}};
  document.addEventListener("DOMContentLoaded",mount);
})();
