/* Robot Forge Focus Workspace v2.4
   Keep the underlying CAD engine intact; only change which tools are visible.
   Never store project secrets or send telemetry. */
(() => {
 "use strict";
 const KEY="robotforge.focusLayout.v24";
 const $=selector=>document.querySelector(selector);
 const syncPicker=()=>{
   const picker=$("#focusModelSelect");
   if(!picker)return;
   try{const model=current().model;if(picker.value!==model)picker.value=model}catch{}
 };
 const setFocus=(on,write=true)=>{
   const isFocus=Boolean(on);
   document.body.classList.toggle("focus-layout",isFocus);
   const advanced=$("#focusMoreButton");
   if(advanced){
     advanced.textContent=isFocus?"⚙ 상세 도구":"↤ 간편 보기";
     advanced.setAttribute("aria-expanded",String(!isFocus));
     advanced.title=isFocus?"상세 도구 열기":"간편 화면으로 돌아가기";
   }
   // Other views remain available in advanced; focus mode always returns to CAD.
   if(isFocus){
     if(typeof setUiMode==="function")setUiMode("beginner",false);
     if(typeof activatePanel==="function")activatePanel("cad");
     const chatTab=$('.inspector-tab[data-inspector="assistant"]');
     if(chatTab)chatTab.click();
   }else{
     if(typeof setUiMode==="function")setUiMode("expert",false);
   }
   if(write){try{localStorage.setItem(KEY,isFocus?"focus":"advanced")}catch{}}
   syncPicker();
   if(typeof scheduleDraw==="function")scheduleDraw();
 };
 const openProject=()=>{
   const source=$("#createProjectButton");
   if(source)source.click();
 };
 const refreshDraft=()=>{
   const input=$("#commandInput");
   document.body.classList.toggle("chat-drafting",Boolean(input?.value?.trim()));
 };
 const mount=()=>{
   const picker=$("#focusModelSelect"),more=$("#focusMoreButton"),create=$("#focusNewProjectButton");
   if(!picker||!more||!create)return;
   // v2.4 defaults to a clean UI, even if a previous build saved "expert" mode.
   let preference="focus";
   try{preference=localStorage.getItem(KEY)||"focus"}catch{}
   setFocus(preference!=="advanced",false);
   syncPicker();
   picker.addEventListener("change",()=>{
     const model=picker.value;
     if(!Object.hasOwn(limits,model)){syncPicker();return}
     window.robotForgeCADPreview?.clear();
     if(current().model!==model)setTemplate(model);
     syncPicker();
   });
   create.addEventListener("click",openProject);
   more.addEventListener("click",()=>setFocus(!document.body.classList.contains("focus-layout")));
   const input=$("#commandInput");
   if(input){
     input.addEventListener("input",refreshDraft);
     input.addEventListener("keydown",ev=>{
       if(ev.key==="Enter"&&!ev.shiftKey&&!ev.isComposing)queueMicrotask(refreshDraft);
     });
   }
   $("#sendCommandButton")?.addEventListener("click",()=>queueMicrotask(refreshDraft));
   $(".inspector-tab[data-inspector=assistant]")?.addEventListener("click",syncPicker);
   $(".inspector-tab[data-inspector=properties]")?.addEventListener("click",syncPicker);
   $("#projectPicker")?.addEventListener("click",syncPicker);
   // The core renderer updates #modelTitle during every project/scene refresh.
   // Observe it so project changes and chat-driven template switches are reflected.
   const modelLabel=$("#modelTitle");
   if(modelLabel&&typeof MutationObserver!=="undefined"){
     new MutationObserver(syncPicker).observe(modelLabel,{childList:true,characterData:true,subtree:true});
   }
   document.addEventListener("click",event=>{
     if(event.target?.closest?.("[data-open], [data-start-template]"))queueMicrotask(syncPicker);
   });
   refreshDraft();
 };
 document.addEventListener("DOMContentLoaded",mount);
 window.robotForgeFocus={setFocus,syncPicker,refreshDraft};
})();