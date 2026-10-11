let currentData=null,timer,busy=false,changing=false,modalGeneration=0;
const $=id=>document.getElementById(id);
window.addEventListener('load',()=>{
 $('login-form').addEventListener('submit',async e=>{e.preventDefault();$('login-button').disabled=true;$('login-error').textContent='';try{await api('adminLogin',{password:$('password').value});$('password').value='';$('admin-login').classList.add('hidden');await loadDashboard();}catch(err){$('login-error').textContent=errorMessage(err);}finally{$('login-button').disabled=false;}});
 loadDashboard();window.addEventListener('resize',()=>{if(currentData)renderGrid(currentData);});document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadDashboard();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
});
function showLogin(){clearTimeout(timer);currentData=null;$('grid-container').replaceChildren();closeModal();$('admin-login').classList.remove('hidden');}
async function logout(){try{await api('adminLogout');showLogin();}catch(e){notice(errorMessage(e),true);}}
async function loadDashboard(){
 clearTimeout(timer);if(busy||changing||document.hidden){timer=setTimeout(loadDashboard,5000);return;}
 busy=true;let again=true;
 try{const data=await api('dashboard');currentData=data;$('admin-login').classList.add('hidden');$('admin-code').textContent=data.currentCode;renderGrid(data);$('prev').disabled=!data.hasPrev;$('next').disabled=!data.hasNext;notice('');$('sync-label').textContent='5초마다 자동 동기화 • 모든 연수생 전수 모니터링';}
 catch(e){if(e.status===401){showLogin();again=false;}else{notice(errorMessage(e),true);$('sync-label').textContent='동기화 실패 • 이전 데이터를 표시하고 있습니다.';if(!$('admin-login').classList.contains('hidden'))$('login-error').textContent=errorMessage(e);}}
 finally{busy=false;if(again)timer=setTimeout(loadDashboard,5000);}
}
async function changeCode(direction){
 if(changing||busy)return;changing=true;$('prev').disabled=true;$('next').disabled=true;closeModal();
 try{const d=await api('changeCode',{direction});$('admin-code').textContent=d.currentCode;}
 catch(e){notice(errorMessage(e),true);}finally{changing=false;await loadDashboard();}
}
function renderGrid(data){
 const container=$('grid-container');container.replaceChildren();const counts={Y:0,N:0,Q:0};
 data.students.forEach(s=>{if(s.status==='Y')counts.Y++;if(s.status==='N')counts.N++;if(s.questionCount>0)counts.Q++;});for(const k of ['Y','N','Q'])$('cnt-'+k).textContent=counts[k];
 if(!data.students.length){const msg=document.createElement('div');msg.className='w-full text-center text-gray-400 font-bold';msg.textContent='연수생 명단이 없습니다. 연수생 화면에서 입장해주세요.';container.append(msg);return;}
 const width=Math.max(70,container.clientWidth-20),height=Math.max(60,container.clientHeight-20),count=data.students.length;
 // Find the largest tile that fits; retain vertical scrolling if tiles cannot remain legible.
 let size=70;for(let w=160;w>=70;w--){const cols=Math.max(1,Math.floor((width+8)/(w+8)));if(Math.ceil(count/cols)*(w*.7+8)-8<=height){size=w;break;}}
 const fragment=document.createDocumentFragment();data.students.forEach(s=>{
 const box=document.createElement('button');box.type='button';box.className='student-box'+(s.status?' status-'+s.status:'')+(s.questionCount?' has-question':'');box.style.width=size+'px';box.style.height=size*.7+'px';box.style.fontSize=Math.max(10,size/10)+'px';
 const school=document.createElement('div');school.className='font-bold opacity-60 truncate w-full px-1';school.textContent=s.school;
 const name=document.createElement('div');name.className='font-black text-gray-800';name.textContent=s.name;box.append(school,name);box.title=`${s.school} ${s.name} · ${s.status==='Y'?'완료':s.status==='N'?'미완료':'미선택'} · 질문 ${s.questionCount}건`;box.onclick=()=>openModal(s,data.currentCode,box);fragment.append(box);
 });container.append(fragment);
}
let lastFocus;
function closeModal(){modalGeneration++;$('modal').classList.add('hidden');lastFocus?.focus();}
async function openModal(student,code,source){
 lastFocus=source;const generation=++modalGeneration;$('modal-title').textContent=`${student.name} (${student.school}) 선생님의 피드백 · ${code}`;$('modal-body').textContent='불러오는 중...';$('modal').classList.remove('hidden');$('modal').querySelector('button').focus();
 let offset=0;
 async function more(button){
 if(button)button.disabled=true;
 try{const rows=await api('questions',{participantId:student.id,code,offset});if(generation!==modalGeneration)return;if(!offset)$('modal-body').replaceChildren();button?.remove();
 if(!rows.length&&!offset){$('modal-body').textContent='제출된 질문이 없습니다.';return;}
 for(const q of rows){const card=document.createElement('div');card.className='p-3 bg-gray-50 rounded border text-sm';const time=document.createElement('div');time.className='text-[10px] text-gray-400 mb-1';time.textContent=new Date(q.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});const content=document.createElement('div');content.className='font-bold text-gray-700 feedback-text';content.textContent=q.question||'내용 없음';card.append(time,content);if(q.imageUrl){const a=document.createElement('a');a.href=q.imageUrl;a.target='_blank';a.rel='noopener';a.className='block mt-2 text-indigo-600 font-bold hover:underline text-xs';a.textContent='📷 첨부 이미지 보기(새창)';card.append(a);}$('modal-body').append(card);}
 offset+=rows.length;if(rows.length===50){const b=document.createElement('button');b.className='w-full p-2 border rounded text-sm';b.textContent='이전 질문 더 보기';b.onclick=()=>more(b);$('modal-body').append(b);}
 }catch(e){if(generation===modalGeneration){if(!offset)$('modal-body').textContent=errorMessage(e);else notice(errorMessage(e),true);if(button)button.disabled=false;}}
 }await more();
}
