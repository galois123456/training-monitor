// Local development only; production /api/training is handled by Vercel.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import handler from '../api/training.js';
const root=resolve('public');
createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/training'){
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>3000000){res.writeHead(413);res.end('{"error":"사진이 너무 큽니다."}');return;}chunks.push(chunk);}req.body=Buffer.concat(chunks).toString();await handler(req,res);return;}
 let path=url.pathname;if(path==='/'||path==='/Index.html')path='/index.html';if(path==='/admin')path='/Admin.html';const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end('Not found');}
}).listen(3000,'127.0.0.1',()=>console.log('http://localhost:3000 / 관리자: http://localhost:3000/Admin.html'));
