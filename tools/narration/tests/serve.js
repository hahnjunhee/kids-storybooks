// 로컬 시험 서버: GitHub Pages 경로(/kids-storybooks/)를 흉내 내고, 범위 요청(Range, 206)을 지원한다. 기준본은 /_baseline/ 아래에서 제공한다.
// 사용: node serve.js <저장소 루트> <포트> <기준본 폴더>
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.argv[2],port=+process.argv[3];
const types={'.html':'text/html; charset=utf-8','.mp3':'audio/mpeg','.json':'application/json'};
http.createServer((q,s)=>{
  let p=decodeURIComponent(q.url.split('?')[0]);
  if(!p.startsWith('/kids-storybooks/')){s.writeHead(404);return s.end('nf')}
  p=p.slice('/kids-storybooks'.length); let f=p.startsWith('/_baseline/')?path.join(process.argv[4]||'',p):path.join(root,p);
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!fs.existsSync(f)){s.writeHead(404);return s.end('nf')}
  const st=fs.statSync(f),t=types[path.extname(f)]||'application/octet-stream',r=q.headers.range;
  if(r){const m=/bytes=(\d*)-(\d*)/.exec(r);let a=m[1]?+m[1]:0,b=m[2]?+m[2]:st.size-1;
    s.writeHead(206,{'Content-Type':t,'Content-Range':`bytes ${a}-${b}/${st.size}`,'Accept-Ranges':'bytes','Content-Length':b-a+1});
    fs.createReadStream(f,{start:a,end:b}).pipe(s)}
  else{s.writeHead(200,{'Content-Type':t,'Accept-Ranges':'bytes','Content-Length':st.size});fs.createReadStream(f).pipe(s)}
}).listen(port,'127.0.0.1');
