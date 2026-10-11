let mySchool='',myName='',activeStatus='',attachedImageBase64='',lastCode='';
let syncTimer,syncBusy=false,saveBusy=false,submitBusy=false,imageBusy=false,imageVersion=0,pending=null;
const drafts=new Map();
const $=id=>document.getElementById(id);
window.addEventListener('load',()=>{
 if(new URLSearchParams(location.search).get('page')?.toLowerCase()==='admin'){location.replace('/Admin.html');return;}
 $('school').value=storage.get('training_school')||'';$('name').value=storage.get('training_name')||'';
 setupImageEvents();['school','name'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')login();}));
 $('question').addEventListener('input',()=>{pending=null;saveDraft();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&lastCode)syncActiveCode();});
});
function draftKey(code){return 'training_draft:'+JSON.stringify([mySchool,myName,code]);}
function saveDraft(){if(!lastCode)return;const value={text:$('question').value,image:attachedImageBase64};drafts.set(lastCode,value);storage.set(draftKey(lastCode),value.text);}
function showDraft(code){const d=drafts.get(code)||{text:storage.get(draftKey(code))||'',image:''};$('question').value=d.text;setImage(d.image);pending=null;}
async function login(){
 if($('btn-login').disabled)return;mySchool=$('school').value.trim();myName=$('name').value.trim();if(!mySchool||!myName){alert('학교와 이름을 입력해주세요.');return;}
 $('btn-login').disabled=true;
 try{await api('register',{school:mySchool,name:myName});storage.set('training_school',mySchool);storage.set('training_name',myName);$('user-info').textContent=`${mySchool} | ${myName}`;
 $('login-section').classList.add('hidden');$('main-section').classList.remove('hidden');$('main-section').classList.add('flex');await syncActiveCode();}
 catch(e){notice(errorMessage(e),true);}finally{$('btn-login').disabled=false;}
}
function controls(){['btn-Y','btn-N'].forEach(id=>$(id).disabled=!lastCode||saveBusy||syncBusy);$('btn-submit').disabled=!lastCode||submitBusy||imageBusy;$('question').disabled=submitBusy;$('file-input').disabled=submitBusy;}
async function syncActiveCode(){
 clearTimeout(syncTimer);if(syncBusy||saveBusy||submitBusy||imageBusy||document.hidden){syncTimer=setTimeout(syncActiveCode,5000);return;}
 syncBusy=true;controls();
 try{const d=await api('sync');if(d.currentCode!==lastCode){saveDraft();lastCode=d.currentCode;$('current-code').textContent=lastCode;showDraft(lastCode);}applyStatus(d.status);notice('');}
 catch(e){notice(errorMessage(e),true);}finally{syncBusy=false;controls();syncTimer=setTimeout(syncActiveCode,5000);}
}
function applyStatus(status){activeStatus=status; $('btn-Y').className=status==='Y'?'btn-3d btn-Y-active':'btn-3d btn-Y-idle';$('btn-N').className=status==='N'?'btn-3d btn-N-active':'btn-3d btn-N-idle';}
async function toggleStatus(status){
 if(saveBusy||syncBusy||!lastCode)return;saveBusy=true;controls();const old=activeStatus,next=activeStatus===status?'':status;applyStatus(next);
 try{await api('status',{code:lastCode,status:next});notice('');}catch(e){applyStatus(old);notice(errorMessage(e),true);}finally{saveBusy=false;controls();}
}
async function submitFeedback(){
 if(submitBusy||imageBusy||!lastCode)return;const question=$('question').value.trim();if(!question&&!attachedImageBase64){alert('질문 내용이나 이미지 중 하나를 포함해주세요.');return;}
 const signature=JSON.stringify([lastCode,question,attachedImageBase64]);if(!pending||pending.signature!==signature)pending={signature,requestId:crypto.randomUUID()};
 submitBusy=true;controls();$('btn-submit').textContent='제출 중...';
 try{await api('question',{code:lastCode,question,image:attachedImageBase64,requestId:pending.requestId});$('question').value='';setImage('');pending=null;saveDraft();notice('정상적으로 제출되었습니다.');}
 catch(e){notice(errorMessage(e),true);}finally{submitBusy=false;$('btn-submit').textContent='질문 / 사진 제출';controls();}
}
function setImage(data){attachedImageBase64=data;$('image-preview').src=data||'';$('drop-text').classList.toggle('hidden',!!data);$('preview-container').classList.toggle('hidden',!data);if(!data)$('file-input').value='';}
function removeImage(e){e?.stopPropagation();e?.preventDefault();if(submitBusy)return;imageVersion++;imageBusy=false;setImage('');pending=null;saveDraft();controls();}
async function handleFile(file){
 if(submitBusy)return;if(!file||!file.type.startsWith('image/')){alert('이미지 파일만 첨부할 수 있습니다.');return;}
 if(file.size>30*1024*1024){alert('원본 사진은 30MB 이하로 선택해주세요.');return;}
 const version=++imageVersion;imageBusy=true;controls();const url=URL.createObjectURL(file);
 try{
 const img=new Image();img.src=url;await img.decode();let w=img.naturalWidth,h=img.naturalHeight;if(!w||!h||w*h>60000000)throw new Error('사진 해상도가 너무 큽니다. 작은 사진을 선택해주세요.');
 const ratio=Math.min(1,1920/Math.max(w,h));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 let data='';for(const quality of [.88,.75,.6,.45]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<2700000)break;}
 if(data.length>=2700000)throw new Error('사진을 더 작게 줄여서 선택해주세요.');if(version!==imageVersion)return;setImage(data);pending=null;saveDraft();
 }catch(e){if(version===imageVersion)notice('사진을 읽지 못했습니다. JPG 또는 PNG로 다시 선택해주세요. '+e.message,true);}
 finally{URL.revokeObjectURL(url);if(version===imageVersion){imageBusy=false;controls();}}
}
function setupImageEvents(){
 $('file-input').addEventListener('change',e=>handleFile(e.target.files[0]));
 document.addEventListener('paste',e=>{for(const item of e.clipboardData?.items||[]){if(item.type.startsWith('image/')){e.preventDefault();handleFile(item.getAsFile());break;}}});
 const zone=$('drop-zone');zone.addEventListener('click',()=>{if(!submitBusy)$('file-input').click();});
 window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
 for(const type of ['dragenter','dragover','dragleave','drop'])zone.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();zone.classList.toggle('dragover',type==='dragenter'||type==='dragover');if(type==='drop')handleFile(e.dataTransfer.files[0]);});
}
