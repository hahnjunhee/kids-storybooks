"""신규 작품용 어댑터 생성. 공통 열람 템플릿 규약을 따르는 책 HTML에서 장면과 낭독 범위를 읽어 adapters/<slug>.json을 만든다.

규약(templates/storybook.html):
- 장면은 `main > section#sceneN`(N은 0부터 순번). 표지(scene0)는 제목 `h1`, 나머지는 장 제목 `h2`와 본문 `.story p`.
- 표지 소개 문단·쪽 번호(.eyebrow)·발견 노트(section.activity)는 낭독하지 않는다.
규약을 어기면 오류로 멈춘다. 본문에 숫자·영문이 있으면 발음 치환이 필요할 수 있어 경고한다(자동으로 고치지 않는다).

사용(저장소 루트): python tools/narration/make_adapter.py --html books/<slug>.html --book-id <slug> --out tools/narration/adapters/<slug>.json
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SCOPE = "제목(표지 h1, 장 h2)과 본문 .story p. 제외: 표지 소개 문단, 쪽 번호(.eyebrow), 발견 노트(section.activity), 푸터."


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", required=True)
    ap.add_argument("--book-id", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", a.book_id):
        raise SystemExit("book-id는 영문 소문자·숫자·하이픈 slug여야 함(이름 없는 파일명 정책)")
    soup = common.parse_book(a.html)
    secs = soup.select("main > section[id]")
    scene_secs = [s for s in secs if re.fullmatch(r"scene\d+", s["id"])]
    errors, warns, scenes = [], [], []
    if not scene_secs:
        raise SystemExit("main > section#sceneN 장면이 없음: 템플릿 규약을 따르지 않는 책은 어댑터를 손으로 작성해야 함")
    ids = [s["id"] for s in scene_secs]
    if ids != ["scene%d" % i for i in range(len(ids))]:
        errors.append("장면 id가 scene0부터 빠짐없이 이어지지 않음: " + ", ".join(ids))
    for i, sec in enumerate(scene_secs):
        sid = sec["id"]
        cover = i == 0
        head = "h1" if cover else "h2"
        h = sec.select_one(head)
        if h is None or not common.norm(h.get_text()):
            errors.append(f"{sid}: 제목 {head}가 없음")
        paras = [] if cover else [".story p"]
        if not cover and not sec.select(".story p"):
            errors.append(f"{sid}: 본문 .story p가 없음")
        if cover and sec.select_one("h2"):
            warns.append(f"{sid}: 표지에 h2가 있음(낭독은 h1만)")
        sc = {"scene_id": sid, "selector": "#" + sid, "heading": head, "paragraphs": paras, "audio_file": "s%02d.mp3" % i}
        scenes.append(sc)
        if not errors:
            for u in common.scene_units(soup, sc):
                if re.search(r"[0-9A-Za-z]", u):
                    warns.append(f"{sid}: 숫자·영문 포함, 발음 치환 필요 여부 확인: {u[:50]}")
    for w in warns:
        print("경고:", w)
    if errors:
        for e in errors:
            print("오류:", e)
        raise SystemExit(1)
    ad = {"book_id": a.book_id, "html": a.html, "audio_dir": "audio/" + a.book_id, "audio_url_prefix": "../audio/" + a.book_id + "/",
          "container": "main", "sections": "main > section", "scope": SCOPE, "pronunciation": [], "scenes": scenes}
    json.dump(ad, open(a.out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"어댑터 생성: {a.out} (장면 {len(scenes)}개)")


if __name__ == "__main__":
    main()
