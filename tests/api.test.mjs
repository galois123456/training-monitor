import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import handler,{token,untoken,imageData} from '../api/training.js';
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.ADMIN_PASSWORD='Testing-Only-Password';process.env.SESSION_SECRET='test-secret-must-be-at-least-32-characters';
const fetchOriginal=global.fetch;
const id='11111111-1111-4111-8111-111111111111',qid='22222222-2222-4222-8222-222222222222';
let current='GH01',status='',participant=null,questions=[],rateAllowed=true,storageCalls=0;
global.fetch=async(url,opts)=>{
 assert.equal(opts.headers.apikey,'sb_secret_test');assert.equal(opts.headers.Authorization,undefined);
 const u=new URL(url),p=u.pathname,b=Buffer.isBuffer(opts.body)?opts.body:opts.body?JSON.parse(opts.body):{};let result;
 if(p.endsWith('rpc/training_take_rate'))result=rateAllowed;
 else if(p.endsWith('training_participants')){participant={id,...b};result=[participant];}
 else if(p.endsWith('training_settings'))result=[{current_code:current}];
 else if(p.endsWith('training_activities'))result=['GH01','GH02'].includes(u.searchParams.get('code').slice(3))?[{code:current}]:[];
 else if(p.endsWith('training_statuses')){if(opts.method==='POST'){assert.equal(b.participant_id,id);status=b.status;result=null;}else result=[{status}];}
 else if(p.endsWith('training_questions')){if(opts.method==='POST'){questions.push(b);result=null;}else result=questions.filter(q=>!u.searchParams.get('id')||q.id===u.searchParams.get('id').slice(3));}
 else if(p.includes('/storage/v1/object/sign/'))result={signedURL:'/object/sign/training-photos/x.jpg?token=example'};
 else if(p.includes('/storage/v1/object/')){storageCalls++;result={Key:'x'};}
 else if(p.endsWith('rpc/training_dashboard'))result={currentCode:current,hasPrev:false,hasNext:true,students:participant?[{...participant,status,questionCount:questions.length}]:[]};
 else if(p.endsWith('rpc/training_change_code')){current=b.p_direction==='next'?'GH02':'GH01';result=current;}
 else throw new Error('Unexpected endpoint '+p);
 return new Response(JSON.stringify(result),{status:200});
};
after(()=>{global.fetch=fetchOriginal;});
async function call(action,body={},cookie='',extra={}){const headers={};const res={setHeader(k,v){headers[k]=v;},end(v){this.raw=v;}};const req={method:'POST',url:'/api/training?action='+action,body,headers:{host:'localhost:3000',origin:'http://localhost:3000','x-training-request':'1',cookie,...extra}};await handler(req,res);return {status:res.statusCode,data:res.raw?JSON.parse(res.raw):null,headers};}
let userCookie='',adminCookie='';
test('signed cookies reject edits and expiration',()=>{const t=token({id,exp:Date.now()+1000},'secret');assert.equal(untoken(t,'secret').id,id);assert.equal(untoken(t+'x','secret'),null);assert.equal(untoken(token({exp:0},'secret'),'secret'),null);});
test('dashboard and activity control require admin',async()=>{assert.equal((await call('dashboard')).status,401);assert.equal((await call('changeCode',{direction:'next'})).status,401);});
test('cross-origin or missing custom header is rejected',async()=>{assert.equal((await call('register',{school:'학교',name:'이름'},'',{origin:'https://bad.example'})).status,403);assert.equal((await call('register',{},'',{'x-training-request':''})).status,403);});
test('register validates fields and returns HttpOnly cookie',async()=>{assert.equal((await call('register',{school:'',name:'홍길동'})).status,400);const r=await call('register',{school:'테스트학교',name:'홍길동'});assert.equal(r.status,200);assert.match(r.headers['Set-Cookie'],/HttpOnly/);userCookie=r.headers['Set-Cookie'].split(';')[0];});
test('status needs participant cookie and accepts Y N clear',async()=>{assert.equal((await call('status',{code:'GH01',status:'Y'})).status,401);for(const s of ['Y','N','']){assert.equal((await call('status',{code:'GH01',status:s,participantId:'attacker'},userCookie)).status,200);assert.equal((await call('sync',{},userCookie)).data.status,s);}assert.equal((await call('status',{code:'GH01',status:'bad'},userCookie)).status,400);});
test('unknown activity rejected',async()=>{assert.equal((await call('status',{code:'UNKNOWN',status:'Y'},userCookie)).status,400);});
test('question validates emptiness and idempotently retries',async()=>{assert.equal((await call('question',{requestId:qid,code:'GH01',question:''},userCookie)).status,400);const payload={requestId:qid,code:'GH01',question:'<img src=x onerror=alert(1)>'};assert.equal((await call('question',payload,userCookie)).status,200);assert.equal((await call('question',payload,userCookie)).status,200);assert.equal(questions.length,1);});
test('spoofed SVG and invalid image headers rejected',()=>{assert.throws(()=>imageData('data:image/svg+xml;base64,PHN2Zz4='));assert.throws(()=>imageData('data:image/png;base64,'+Buffer.from('not-a-real-image').toString('base64')));});
test('photo-only submission uploads then saves private path',async()=>{const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';const r=await call('question',{requestId:'33333333-3333-4333-8333-333333333333',code:'GH01',image:png},userCookie);assert.equal(r.status,200);assert.equal(storageCalls,1);assert.match(questions[1].image_path,/\.png$/);});
test('admin login and participant boundary',async()=>{assert.equal((await call('adminLogin',{password:'wrong'})).status,401);assert.equal((await call('dashboard',{},userCookie)).status,401);const r=await call('adminLogin',{password:process.env.ADMIN_PASSWORD});assert.equal(r.status,200);adminCookie=r.headers['Set-Cookie'].split(';')[0];});
test('admin sees dashboard, advances code, lists questions safely',async()=>{assert.equal((await call('dashboard',{},adminCookie)).data.students.length,1);assert.equal((await call('changeCode',{direction:'next'},adminCookie)).data.currentCode,'GH02');assert.equal((await call('sync',{},userCookie)).data.currentCode,'GH02');const rows=(await call('questions',{participantId:id,code:'GH01'},adminCookie)).data;assert.equal(rows[0].question,'<img src=x onerror=alert(1)>');assert.equal(rows[1].image_path,undefined);assert.match(rows[1].imageUrl,/\/api\/training/);});
test('private photo endpoint redirects only admin to signed storage URL',async()=>{for(const [cookie,expected] of [[userCookie,401],[adminCookie,302]]){let result={};const res={setHeader(k,v){result[k]=v;},end(){}};await handler({method:'GET',url:'/api/training?action=image&id='+questions[1].id,headers:{cookie}},res);assert.equal(res.statusCode,expected);if(expected===302)assert.match(result.Location,/^https:\/\/test.supabase.co\/storage\/v1\/object\/sign\//);}});
test('rate limiter rejects excess attempts',async()=>{rateAllowed=false;assert.equal((await call('adminLogin',{password:process.env.ADMIN_PASSWORD})).status,429);rateAllowed=true;});
test('database failure is shown without secrets',async()=>{const mock=global.fetch;global.fetch=async()=>new Response(JSON.stringify({code:'test',message:'private key'}),{status:500});const r=await call('sync',{},userCookie);assert.equal(r.status,502);assert.doesNotMatch(r.data.error,/private key/);global.fetch=mock;});
test('admin password rotation invalidates previous session',async()=>{process.env.ADMIN_PASSWORD='New-Testing-Password';assert.equal((await call('dashboard',{},adminCookie)).status,401);});
