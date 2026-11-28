"""그림책 HTML 구조 전수 조사. books.json의 모든 책을 읽어 낭독 어댑터 설계에 필요한 사실을 마크다운으로 출력한다.

사용: python tools/narration/survey.py > tools/narration/STRUCTURE_SURVEY.md   (저장소 루트에서, beautifulsoup4 필요)
"""
import json
import re
import sys
import datetime
from bs4 import BeautifulSoup

B64 = re.compile(r"data:[a-z/+\-]+;base64,[A-Za-z0-9+/=]+")


def label(el):
    cls = ".".join(el.get("class", []))
    return f"<{el.name}{'#' + el['id'] if el.get('id') else ''}{'.' + cls if cls else ''}>"


def text_of(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True))


def survey(book):
    raw = open(book["href"], encoding="utf8").read()
    stripped = B64.sub("DATA", raw)
    soup = BeautifulSoup(stripped, "html.parser")
    out = {"id": book["id"], "file": book["href"], "kb": round(len(raw) / 1024), "nonimg_kb": round(len(stripped) / 1024, 1)}
    imgs = soup.find_all("img")
    out["img_b64"] = len(B64.findall(raw))
    out["img_ext"] = sum(1 for i in imgs if i.get("src") and not i["src"].startswith("data:") and i["src"] != "DATA")
    out["img_total"] = len(imgs)
    # 장면 컨테이너: 이미지를 포함한 직계 자식이 가장 많은 요소(동수면 더 깊은 요소)
    def depth(e):
        return len(list(e.parents))
    best, best_key = None, (0, 0)
    for el in soup.find_all(True):
        cnt = sum(1 for c in el.find_all(recursive=False) if c.find("img"))
        if (cnt, depth(el)) > best_key:
            best, best_key = el, (cnt, depth(el))
    container = best
    out["container"] = label(container) if container else None
    kids = [c for c in container.find_all(recursive=False)] if container else []
    scenes = [c for c in kids if c.find("img")]
    out["scene_tags"] = sorted({f"<{c.name}{'.' + '.'.join(c.get('class', [])) if c.get('class') else ''}>" for c in scenes})
    out["scene_count"] = len(scenes)
    out["scene_ids"] = [c.get("id") for c in scenes]
    out["non_scene"] = [f"{label(c)}(p={len(c.find_all('p'))})" for c in kids if c not in scenes and c.name not in ("script", "style")]
    heads, pcounts = set(), []
    for c in scenes:
        for h in c.find_all(re.compile(r"^h[1-6]$")):
            heads.add(h.name)
        pcounts.append(len(c.find_all("p")))
    out["heads"] = sorted(heads)
    out["p_range"] = (min(pcounts), max(pcounts)) if pcounts else None
    story = sum(1 for c in scenes if c.select(".story p"))
    out["story_p_scenes"] = story
    out["body_tag"] = bool(soup.body)
    hdr = soup.find("header")
    out["header"] = bool(hdr)
    out["tools"] = [b.get_text(strip=True) for b in (hdr.find_all("button") if hdr else [])]
    allbtn = [b.get_text(strip=True) for b in soup.find_all("button")]
    out["buttons"] = allbtn
    out["has_mode_toggle"] = any(("페이지" in t and "넘" in t) or "세로" in t for t in allbtn)
    scripts = soup.find_all("script")
    out["script_bytes"] = sum(len(str(s)) for s in scripts)
    out["print_css"] = "@media print" in stripped
    out["lang"] = (soup.html.get("lang") if soup.html else None)
    out["sticky_header"] = bool(re.search(r"header\{[^}]*position:\s*sticky", stripped))
    return out


def fmt(o):
    L = [f"## {o['id']} (`{o['file']}`)"]
    L.append(f"- 크기: 전체 {o['kb']}KB, 이미지 제외 {o['nonimg_kb']}KB. 이미지 {o['img_total']}개(Base64 {o['img_b64']}, 외부 파일 {o['img_ext']}).")
    L.append(f"- 장면 컨테이너: {o['container']}, 장면 후보 {o['scene_count']}개, 형태 {', '.join(o['scene_tags'])}.")
    ids = [i for i in o["scene_ids"] if i]
    L.append(f"- 장면 id: {ids[0] + ' ~ ' + ids[-1] if ids else '없음(안정적 id 부재, 어댑터가 순번 선택자 필요)'}.")
    pr = f"{o['p_range'][0]}~{o['p_range'][1]}" if o["p_range"] else "해당 없음"
    L.append(f"- 제목 요소: {', '.join(o['heads']) or '없음'}. 장면당 `p` 수: {pr}. `.story p`가 있는 장면: {o['story_p_scenes']}/{o['scene_count']}.")
    L.append(f"- 장면 밖 블록: {', '.join(o['non_scene']) or '없음'}.")
    L.append(f"- 상단: header {'있음' if o['header'] else '없음'}(버튼: {', '.join(o['tools']) or '없음'}), 전체 버튼: {', '.join(o['buttons']) or '없음'}. 읽기 방식 전환 {'있음' if o['has_mode_toggle'] else '없음'}. header 고정(sticky) {'예' if o['sticky_header'] else '아니오'}.")
    L.append(f"- `<body>` 태그 {'있음' if o['body_tag'] else '없음'}, 인라인 스크립트 {o['script_bytes']}B, 인쇄 CSS {'있음' if o['print_css'] else '없음'}, lang={o['lang']}.")
    return "\n".join(L)


def main():
    books = json.load(open("books.json", encoding="utf8"))
    print("# 그림책 HTML 구조 전수 조사")
    print(f"\n조사일 {datetime.date.today().isoformat()}, `tools/narration/survey.py`로 생성. 낭독 어댑터는 이 조사를 바탕으로 책마다 확정한다.")
    print("장면 후보는 이미지를 포함한 컨테이너의 직계 자식으로 자동 판정한 값이므로, 실제 어댑터 작성 때 본문 단위를 다시 확인한다.\n")
    rows = [survey(b) for b in books]
    for o in rows:
        print(fmt(o))
        print()


if __name__ == "__main__":
    main()
