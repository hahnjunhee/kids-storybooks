import re,base64,sys,json
src,out,ids=sys.argv[1],sys.argv[2],sys.argv[3].split(',')
s=open(src,encoding='utf8').read()
scenes=[]
for i in ids:
    m=re.search(r'<section class="spread" id="scene%s">(.*?)</section>'%i,s,re.S)
    b=m.group(1)
    mm=re.search(r'src="data:image/([a-z]+);base64,([^"]+)"',b)
    ext=mm.group(1); fn='scene%s.%s'%(i,ext)
    open(f'{out}/assets/{fn}','wb').write(base64.b64decode(mm.group(2)))
    title=re.search(r'<h2>(.*?)</h2>',b).group(1)
    ps=re.findall(r'<p>(.*?)</p>',b,re.S)
    scenes.append(dict(id=i,img=fn,title=title,paras=ps))
json.dump(scenes,open(f'{out}/scenes.json','w'),ensure_ascii=False,indent=1)
