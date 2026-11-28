"""신규 작품용 어댑터 생성·갱신. 공통 열람 템플릿 규약을 따르는 책 HTML에서 장면과 낭독 범위를 읽어 adapters/<slug>.json을 만든다.

규약(templates/storybook.html):
- 장면은 `main > section#sceneN`(N은 0부터 순번). 표지(scene0)는 제목 `h1`, 나머지는 장 제목 `h2`와 본문 `.story p`.
- 낭독하지 않는 블록은 `section.activity`(발견 노트·학습 카드)뿐이다. 표지 소개 문단·쪽 번호(.eyebrow)도 낭독하지 않는다.
- 규약 밖의 `main` 직계 section(id 없음, scene 아닌 id, activity 아닌 class)은 조용히 건너뛰지 않고 오류로 멈춘다.

안전장치:
- 이미 있는 어댑터는 덮어쓰지 않는다. `--update`를 주면 장면 정의만 다시 만들고 `pronunciation`(발음 치환), `pronunciation_review`(발음 검수 기록),
  `size_exception`, 그 밖의 알 수 없는 키를 그대로 보존한다.
- 본문에 숫자·영문이 있는 단위는 발음 확인이 필요하다. `pronunciation_review`에 단위 해시(unit_hash)로 기록하며 새 항목은 `pending`이다.
  사람이 들어 확인한 뒤 status를 `reviewed`로 바꾼다. 본문이 바뀌면 해시가 달라져 기록이 무효가 되고 다시 `pending`이 된다.

사용(저장소 루트):
  새로 만들기: python tools/narration/make_adapter.py --html books/<slug>.html --book-id <slug> --out tools/narration/adapters/<slug>.json
  다시 만들기: 같은 명령에 --update
  규약과 다른 책(기존 작품): --cover-heading h2 --paragraphs ".lead,.prose p" 처럼 선택자를 지정한다(학습 카드 aside 등 지정하지 않은 요소는 낭독하지 않는다).
  표지에 이야기가 있으면 --cover-paragraphs, 낭독하지 않는 마무리 블록(예: class="closing")은 --exclude-class closing.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SCOPE = "제목(표지 h1, 장 h2)과 본문 .story p. 제외: 표지 소개 문단, 쪽 번호(.eyebrow), 발견 노트(section.activity), 푸터."
FLAG_RE = re.compile(r"[0-9A-Za-z]")
KNOWN = {"book_id", "html", "audio_dir", "audio_url_prefix", "container", "sections", "scope", "pronunciation", "pronunciation_review", "size_exception", "exclude_classes", "scenes"}


def scope_text(a):
    """낭독 범위 문구: 템플릿 기본 선택자면 표준 문구, 아니면 실제 선택자를 적는다."""
    if (a.cover_heading, a.heading, a.paragraphs, a.cover_paragraphs) == ("h1", "h2", ".story p", "") and not a.exclude_class:
        return SCOPE
    cover = f"표지 {a.cover_heading}" + (f" + {a.cover_paragraphs}" if a.cover_paragraphs else "")
    cover_note = "" if a.cover_paragraphs else "표지 소개 문단, "
    return (f"제목({cover}, 장 {a.heading})과 본문 {a.paragraphs}. 제외: {cover_note}쪽 번호, "
            "지정하지 않은 요소(학습 카드 aside, 발견 노트·탐구 section.activity" + "".join(f", section.{c}" for c in a.exclude_class) + " 등), 푸터.")


def unit_hash(text):
    return common.sha256_hex(text)[:12]


def classify(soup, exclude_classes=()):
    """main 직계 자식을 장면/제외/오류로 나눈다. 조용히 누락되는 요소가 없게 한다."""
    main = soup.select_one("main")
    if main is None:
        raise SystemExit("main 요소가 없음: 템플릿 규약을 따르지 않는 책은 어댑터를 손으로 작성해야 함")
    scenes, excluded, errors, warns = [], [], [], []
    for c in main.find_all(recursive=False):
        cid, cls = c.get("id"), c.get("class") or []
        label = f"<{c.name}{'#' + cid if cid else ''}{'.' + '.'.join(cls) if cls else ''}>"
        if c.name == "section":
            if cid and re.fullmatch(r"scene\d+", cid):
                scenes.append(c)
            elif "activity" in cls or any(x in cls for x in exclude_classes):
                excluded.append(label)
            else:
                errors.append(f"규약 밖 section {label}: 장면이면 id를 scene<번호>로, 낭독하지 않는 블록이면 class=\"activity\"로 표시")
        elif c.name in ("script", "style"):
            continue
        elif c.find("img") or c.select(".story p"):
            errors.append(f"장면처럼 보이는 요소가 section이 아님 {label}: section#scene<번호>로 바꾸거나 class=\"activity\" section으로 표시")
        else:
            warns.append(f"main 안의 비장면 요소 {label}(낭독 제외)")
    return scenes, excluded, errors, warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", required=True)
    ap.add_argument("--book-id", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--update", action="store_true", help="이미 있는 어댑터를 다시 만든다(발음 치환·검수 기록 보존)")
    ap.add_argument("--cover-heading", default="h1", help="표지(scene0) 제목 선택자(템플릿 규약은 h1)")
    ap.add_argument("--heading", default="h2", help="장 제목 선택자(템플릿 규약은 h2)")
    ap.add_argument("--paragraphs", default=".story p", help="장 본문 선택자(쉼표로 여러 개, 문서 순서가 아니라 나열한 순서로 읽음). 템플릿 규약은 '.story p'")
    ap.add_argument("--cover-paragraphs", default="", help="표지에서 낭독할 문단 선택자(기본은 없음: 표지 소개는 낭독하지 않음). 표지에 실제 이야기가 있는 책은 지정한다")
    ap.add_argument("--exclude-class", action="append", default=[], help="낭독하지 않는 main 직계 section의 class(여러 번 지정 가능, activity는 항상 제외). 예: closing")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", a.book_id):
        raise SystemExit("book-id는 영문 소문자·숫자·하이픈 slug여야 함(이름 없는 파일명 정책)")
    old = None
    if os.path.exists(a.out):
        if not a.update:
            raise SystemExit(f"이미 있음: {a.out}\n덮어쓰지 않았다. 다시 만들려면 --update(발음 치환·검수 기록은 보존)를 사용한다.")
        old = json.load(open(a.out, encoding="utf8"))
        if old.get("book_id") != a.book_id:
            raise SystemExit(f"book-id가 다름: 기존 {old.get('book_id')} / 지정 {a.book_id}")
    soup = common.parse_book(a.html)
    scene_secs, excluded, errors, warns = classify(soup, a.exclude_class)
    if not scene_secs and not errors:
        raise SystemExit("main > section#sceneN 장면이 없음")
    ids = [s["id"] for s in scene_secs]
    if ids != ["scene%d" % i for i in range(len(ids))]:
        errors.append("장면 id가 scene0부터 빠짐없이 이어지지 않음: " + ", ".join(ids))
    scenes = []
    for i, sec in enumerate(scene_secs):
        sid = sec.get("id", f"scene{i}")
        cover = i == 0
        head = a.cover_heading if cover else a.heading
        h = sec.select_one(head)
        if h is None or not common.norm(h.get_text()):
            errors.append(f"{sid}: 제목 {head}가 없음")
        sels = [x.strip() for x in (a.cover_paragraphs if cover else a.paragraphs).split(",") if x.strip()]
        paras = sels
        if not cover and not any(sec.select(x) for x in sels):
            errors.append(f"{sid}: 본문 {a.paragraphs}가 없음")
        if cover and a.cover_heading == "h1" and sec.select_one("h2"):
            warns.append(f"{sid}: 표지에 h2가 있음(낭독은 h1만)")
        scenes.append({"scene_id": sid, "selector": "#" + sid, "heading": head, "paragraphs": paras, "audio_file": "s%02d.mp3" % i})
    for w in warns:
        print("경고:", w)
    if errors:
        for e in errors:
            print("오류:", e)
        raise SystemExit("오류 때문에 어댑터를 쓰지 않았다(기존 파일도 그대로)")
    for ex in excluded:
        print("낭독 제외:", ex)

    # 발음 확인이 필요한 단위(숫자·영문)와 검수 기록
    pron = (old or {}).get("pronunciation", [])
    old_rev = {e["unit_hash"]: e for e in (old or {}).get("pronunciation_review", [])}
    review, all_units = [], []
    for sc in scenes:
        for u in common.scene_units(soup, sc):
            all_units.append(u)
            if FLAG_RE.search(u):
                h = unit_hash(u)
                e = old_rev.pop(h, None) or {"scene_id": sc["scene_id"], "unit_hash": h, "preview": u[:30], "status": "pending", "note": ""}
                e["scene_id"], e["preview"] = sc["scene_id"], u[:30]
                review.append(e)
                if e["status"] == "pending":
                    print(f"경고: {sc['scene_id']}: 숫자·영문 포함, 발음 확인 필요(pending): {u[:50]}")
    for e in old_rev.values():
        print(f"경고: 본문이 바뀌어 발음 검수 기록이 무효가 됨(다시 확인 필요): {e['scene_id']} {e['preview']}")
    for src, _dst in pron:
        if not any(src in u for u in all_units):
            print(f"경고: 사용되지 않는 발음 치환(본문에 없음): {src}")

    ad = dict(old or {})
    if a.exclude_class:
        ad["exclude_classes"] = list(a.exclude_class)
    ad.update({"book_id": a.book_id, "html": a.html, "audio_dir": "audio/" + a.book_id, "audio_url_prefix": "../audio/" + a.book_id + "/",
               "container": "main", "sections": "main > section", "scope": scope_text(a), "pronunciation": pron, "pronunciation_review": review, "scenes": scenes})
    json.dump(ad, open(a.out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    kept = [k for k in (old or {}) if k not in KNOWN]
    print(f"어댑터 {'갱신' if old else '생성'}: {a.out} (장면 {len(scenes)}개, 발음 치환 {len(pron)}개 보존, 검수 기록 {len(review)}개" + (f", 추가 키 보존: {', '.join(kept)}" if kept else "") + ")")


if __name__ == "__main__":
    main()
