async function api(action,body={}) {
 const r=await fetch('/api/training?action='+encodeURIComponent(action),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Training-Request':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 let data;try{data=await r.json();}catch{throw new Error('서버 응답을 확인할 수 없습니다. Vercel 배포와 환경변수를 확인해주세요.');}
 if(!r.ok){const e=new Error(data.error||'요청에 실패했습니다.');e.status=r.status;throw e;}return data;
}
function notice(message,error=false){const n=document.getElementById('notice');if(!n)return;n.textContent=message;n.classList.toggle('hidden',!message);n.style.background=error?'#fee2e2':'#eef2ff';n.style.color=error?'#991b1b':'#3730a3';}
function errorMessage(e){return e.name==='TimeoutError'?'응답 시간이 초과되었습니다. 연결을 확인하고 다시 시도해주세요.':e.message;}
const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,val){try{localStorage.setItem(key,val);}catch{}}};
