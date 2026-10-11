import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
const BUCKET='training-photos';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new HttpError(status,message);};
const hash=s=>createHash('sha256').update(s).digest();
const equal=(a,b)=>timingSafeEqual(hash(a),hash(b));
function config(){
 const {SUPABASE_URL:url,ADMIN_PASSWORD:password,SESSION_SECRET:secret}=process.env;
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url?.startsWith('https://')||!key||password?.length<12||!password||secret?.length<32||!secret) fail(503,'서버 환경변수 설정을 확인해주세요.');
 return {url:url.replace(/\/$/,''),key,password,secret};
}
export function token(payload,secret){const raw=Buffer.from(JSON.stringify(payload)).toString('base64url');return raw+'.'+createHmac('sha256',secret).update(raw).digest('base64url');}
export function untoken(value,secret){try {const [raw,sig,...extra]=(value||'').split('.');if(extra.length||!raw||!sig||!equal(sig,createHmac('sha256',secret).update(raw).digest('base64url')))return null;const p=JSON.parse(Buffer.from(raw,'base64url'));return p.exp>Date.now()?p:null;}catch{return null;}}
function cookie(req,name,c){const found=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return untoken(found?.slice(name.length+1),c.secret);}
function setCookie(res,name,payload,c,seconds){res.setHeader('Set-Cookie',`${name}=${seconds?token({...payload,exp:Date.now()+seconds*1000},c.secret):''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${process.env.VERCEL?'; Secure':''}`);}
function admin(req,c){const p=cookie(req,'training_admin',c);if(!p||p.role!=='admin'||p.version!==hash(c.password).toString('hex'))fail(401,'관리자 로그인이 필요합니다.');}
function user(req,c){const p=cookie(req,'training_user',c);if(!p||!uuid.test(p.id))fail(401,'학교와 이름으로 다시 입장해주세요.');return p.id;}
function text(v,max,label){if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,`${label}을(를) 확인해주세요.`);return v.trim();}
async function remote(c,path,{method='GET',body,headers={}}={}){
 const r=await fetch(c.url+path,{method,headers:{apikey:c.key,...(c.key.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${c.key}`}),...(body?'Content-Type' in headers?{}:{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
 if(!r.ok){console.error('Supabase request failed',r.status,path.split('?')[0],data?.code||'');fail(502,'서버 저장·조회에 실패했습니다. 잠시 후 다시 시도해주세요.');}
 return data;
}
const db=(c,path,options)=>remote(c,'/rest/v1/'+path,options);
const rpc=(c,fn,body={})=>db(c,'rpc/'+fn,{method:'POST',body});
async function rate(c,key,limit,seconds){if(!await rpc(c,'training_take_rate',{p_key:key,p_limit:limit,p_seconds:seconds}))fail(429,'요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');}
async function codeExists(c,code){code=text(code,40,'활동 코드');if(!(await db(c,'training_activities?code=eq.'+encodeURIComponent(code)+'&select=code')).length)fail(400,'등록되지 않은 활동 코드입니다.');return code;}
export function imageData(value){
 if(!value)return null;
 if(typeof value!=='string'||value.length>2900000)fail(413,'사진은 변환 후 2MB 이하여야 합니다.');
 const m=/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!m)fail(400,'지원하지 않는 이미지입니다.');
 const bytes=Buffer.from(m[2],'base64');if(bytes.length>2097152||bytes.length<12)fail(413,'사진 크기를 확인해주세요.');
 const ok=m[1]==='jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255])):m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='gif'?/^GIF8[79]a/.test(bytes.toString('ascii',0,6)):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!ok)fail(400,'이미지 파일 형식이 올바르지 않습니다.');return {bytes,type:'image/'+m[1],ext:m[1]==='jpeg'?'jpg':m[1]};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 const c=config();const u=new URL(req.url,'http://localhost');const action=u.searchParams.get('action')||'';
 if(req.method==='GET'&&action==='image'){
 admin(req,c);const id=u.searchParams.get('id');if(!uuid.test(id||''))fail(400,'잘못된 사진 요청입니다.');
 const q=(await db(c,`training_questions?id=eq.${id}&select=image_path`))[0];if(!q?.image_path)fail(404,'사진이 없습니다.');
 const signed=await remote(c,`/storage/v1/object/sign/${BUCKET}/${q.image_path}`,{method:'POST',body:{expiresIn:600}});
 const target=new URL(signed.signedURL,c.url+'/storage/v1/');
 // Storage returns /object/sign/... relative to /storage/v1, not the host root.
 const location=signed.signedURL.startsWith('/object/')?c.url+'/storage/v1'+signed.signedURL:target.href;
 res.statusCode=302;res.setHeader('Location',location);res.end();return;
 }
 if(req.method!=='POST')fail(405,'POST 요청만 허용합니다.');
 if(req.headers['x-training-request']!=='1')fail(403,'허용되지 않은 요청입니다.');
 if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail(403,'다른 사이트의 요청은 허용하지 않습니다.');
 let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b);}catch{fail(400,'잘못된 요청입니다.');}}b=b||{};
 const ip=hash(String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown')+c.secret).toString('hex');
 let out;
 if(action==='register'){
 const school=text(b.school,100,'학교'),name=text(b.name,50,'이름');await rate(c,'register:'+ip,500,900);
 const rows=await db(c,'training_participants?on_conflict=school,name',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{school,name}});
 setCookie(res,'training_user',{id:rows[0].id},c,60*60*24*30);out={success:true};
 }else if(action==='adminLogin'){
 await rate(c,'admin:'+ip,10,900);
 if(typeof b.password!=='string'||!equal(b.password,c.password))fail(401,'관리자 비밀번호가 올바르지 않습니다.');
 setCookie(res,'training_admin',{role:'admin',version:hash(c.password).toString('hex')},c,60*60*12);out={success:true};
 }else if(action==='adminLogout'){
 setCookie(res,'training_admin',{},c,0);out={success:true};
 }else if(action==='sync'){
 const id=user(req,c);const current=(await db(c,'training_settings?id=eq.1&select=current_code'))[0]?.current_code;if(!current)fail(503,'활동 코드를 먼저 설정해주세요.');
 const saved=(await db(c,`training_statuses?participant_id=eq.${id}&code=eq.${encodeURIComponent(current)}&select=status`))[0];out={currentCode:current,status:saved?.status||''};
 }else if(action==='status'){
 const id=user(req,c);if(!['Y','N',''].includes(b.status))fail(400,'잘못된 수행 상태입니다.');const code=await codeExists(c,b.code);await rate(c,'status:'+id,120,60);
 await db(c,'training_statuses?on_conflict=participant_id,code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:{participant_id:id,code,status:b.status,updated_at:new Date().toISOString()}});out={success:true};
 }else if(action==='question'){
 const id=user(req,c);if(!uuid.test(b.requestId||''))fail(400,'제출 번호가 올바르지 않습니다.');
 // Retried submissions use the same ID; never create duplicate questions or overwrite a stored attachment.
 const old=(await db(c,`training_questions?id=eq.${b.requestId}&select=participant_id`))[0];
 if(old){if(old.participant_id!==id)fail(409,'제출 번호가 중복되었습니다.');out={success:true};}
 else{
 const code=await codeExists(c,b.code);const question=typeof b.question==='string'?b.question.trim():'';
 if(question.length>5000)fail(400,'질문은 5,000자까지 입력할 수 있습니다.');const img=imageData(b.image);if(!question&&!img)fail(400,'질문 또는 사진을 넣어주세요.');await rate(c,'question:'+id,20,60);
 const path=img?`${id}/${b.requestId}.${img.ext}`:null;
 if(img)await remote(c,`/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:{'Content-Type':img.type,'x-upsert':'true'},body:img.bytes});
 await db(c,'training_questions?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:{id:b.requestId,participant_id:id,code,question,image_path:path}});out={success:true};
 }
 }else if(action==='dashboard'){
 admin(req,c);out=await rpc(c,'training_dashboard');if(!out)fail(503,'schema.sql 실행과 활동 코드를 확인해주세요.');
 }else if(action==='changeCode'){
 admin(req,c);if(!['prev','next'].includes(b.direction))fail(400,'잘못된 이동 방향입니다.');out={currentCode:await rpc(c,'training_change_code',{p_direction:b.direction})};
 }else if(action==='questions'){
 admin(req,c);if(!uuid.test(b.participantId||''))fail(400,'연수생 정보가 올바르지 않습니다.');const code=text(b.code,40,'활동 코드');const offset=Number.isInteger(b.offset)&&b.offset>=0?b.offset:0;
 out=await db(c,`training_questions?participant_id=eq.${b.participantId}&code=eq.${encodeURIComponent(code)}&order=created_at.desc,id.desc&select=id,question,image_path,created_at&limit=50&offset=${offset}`);
 out=out.map(q=>({...q,image_path:undefined,imageUrl:q.image_path?`/api/training?action=image&id=${q.id}`:null}));
 }else fail(404,'알 수 없는 요청입니다.');
 res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(out));
 }catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:e.status?e.message:'처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}));}
}
