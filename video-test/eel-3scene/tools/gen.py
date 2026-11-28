import json,sys,html
S,P=sys.argv[1],sys.argv[2]
scenes=json.load(open(S+'/eel-test/scenes.json',encoding='utf8'))
D=10.0
W,H=1280,720
def tpl(i,sc):
    sid=f's{i}'
    paras=sc['paras']
    weights=[len(p)+12 for p in paras]
    usable=D-0.8-0.4  # lead-in, tail
    t=0.8; rows=[]; css=[]; tw=[]
    for k,(p,w) in enumerate(zip(paras,weights)):
        dur=usable*w/sum(weights)
        st=round(t,2); du=round(dur,2); t+=dur
        pid=f'{sid}-p{k}'
        rows.append(f'<p id="{pid}" class="clip cap" data-start="{st}" data-duration="{du}" data-track-index="1">{html.escape(p)}</p>')
        tw.append(f'tl.fromTo("#{pid}",{{opacity:0,y:14}},{{opacity:1,y:0,duration:0.35,ease:"power2.out"}},{st});')
        tw.append(f'tl.to("#{pid}",{{opacity:0,duration:0.25,ease:"power1.in"}},{round(st+du-0.3,2)});')
    return f'''<template>
  <style>
    @font-face {{ font-family: "Pretendard"; src: url("assets/fonts/PretendardVariable.woff2") format("woff2"); font-weight: 45 920; }}
    #{sid} {{ position:absolute; inset:0; background:#fff7e6; font-family:"Pretendard",sans-serif; }}
    #{sid} .frame {{ position:absolute; left:160px; top:0; width:960px; height:720px; overflow:hidden; }}
    #{sid} .pic {{ position:absolute; left:0; top:0; width:960px; height:720px; transform-origin:50% 50%; }}
    #{sid} .chip {{ position:absolute; left:190px; top:34px; padding:10px 22px; border-radius:26px; background:#ffd24d; color:#3b2a00; font-size:30px; font-weight:800; }}
    #{sid} .cap {{ position:absolute; left:190px; width:900px; bottom:44px; padding:18px 26px; border-radius:20px; background:rgba(30,22,10,0.78); color:#fff; font-size:36px; font-weight:600; line-height:1.4; text-align:center; word-break:keep-all; }}
  </style>
  <div id="{sid}" data-composition-id="{sid}" data-width="{W}" data-height="{H}">
    <div class="frame"><img id="{sid}-pic" class="clip pic" src="assets/{sc['img']}" alt="" data-start="0" data-duration="{D}" data-track-index="0"/></div>
    <div id="{sid}-chip" class="clip chip" data-start="0.2" data-duration="{D-0.2}" data-track-index="2">{int(sc['id'])}장 · {html.escape(sc['title'])}</div>
    {chr(10).join('    '+r for r in rows)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    tl.fromTo("#{sid}-pic",{{opacity:0}},{{opacity:1,duration:0.5,ease:"power1.out"}},0);
    tl.fromTo("#{sid}-pic",{{scale:1}},{{scale:1.06,duration:{D},ease:"none"}},0);
    tl.fromTo("#{sid}-chip",{{opacity:0,y:-10}},{{opacity:1,y:0,duration:0.4,ease:"power2.out"}},0.2);
    {chr(10).join('    '+x for x in tw)}
    window.__timelines["{sid}"] = tl;
  </script>
</template>
'''
for i,sc in enumerate(scenes,1):
    open(f'{P}/compositions/s{i}.html','w',encoding='utf8').write(tpl(i,sc))
hosts='\n'.join(f'      <div id="s{i}" data-composition-id="s{i}" data-composition-src="compositions/s{i}.html" data-start="{(i-1)*D}" data-duration="{D}" data-track-index="0" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>' for i in range(1,len(scenes)+1))
idx=f'''<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:#fff7e6; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D*len(scenes)}" data-width="{W}" data-height="{H}">
{hosts}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
open(P+'/index.html','w',encoding='utf8').write(idx)
