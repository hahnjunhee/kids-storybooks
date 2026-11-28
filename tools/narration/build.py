"""낭독 플레이어를 책 HTML에 삽입한다(기본 동작은 추가 전용).

삽입 블록은 두 곳뿐이다: </head> 앞의 <style>, </body> 앞의 manifest JSON + 압축된 player.js.
기존 본문·삽화·스크립트는 바꾸지 않으며, 마커 사이를 지우면 원본 바이트와 같아진다(verify.py가 검사).
다시 실행하면 기존 블록을 지우고 새로 넣는다(중복 삽입 방지). 플레이어 버전은 manifest의 player_version과 일치해야 동작한다.

사용(저장소 루트): python tools/narration/build.py --adapter tools/narration/adapters/electric-eel.json --review-status pilot_unlistened
요건: beautifulsoup4(공용 모듈), Node/npx(terser로 player.js 압축)
"""
import argparse
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
HASH_LEN = 16
STYLE_BEGIN, STYLE_END = "<!--narration:style:begin-->", "<!--narration:style:end-->"
BODY_BEGIN, BODY_END = "<!--narration:begin-->", "<!--narration:end-->"
BLOCK_RE = re.compile(r"(%s.*?%s|%s.*?%s)" % (re.escape(STYLE_BEGIN), re.escape(STYLE_END), re.escape(BODY_BEGIN), re.escape(BODY_END)), re.S)
REVIEW = ("unreviewed", "pilot_unlistened", "approved")


def strip_blocks(html):
    return BLOCK_RE.sub("", html)


def minify_js():
    src = os.path.join(HERE, "player.js")
    out = subprocess.run(["npx", "--yes", "terser@5.51.4", src, "-c", "-m", "--comments", "false"], capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit("terser 실패: " + out.stderr[-400:])
    return out.stdout.strip()


def minify_css():
    css = open(os.path.join(HERE, "player.css"), encoding="utf8").read()
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)
    return re.sub(r"\s+", " ", css).strip()


def embedded_manifest(side):
    scenes = []
    for s in side["scenes"]:
        scenes.append({
            "scene_id": s["scene_id"], "selector": s["selector"],
            "heading_selector": s["heading_selector"], "paragraph_selectors": s["paragraph_selectors"],
            "audio_url": s["audio_url"] + "?v=" + s["audio_hash"][:12],
            "duration": s["duration"], "paragraph_start_seconds": s["paragraph_start_seconds"],
            "text_hash": s["text_hash"][:HASH_LEN], "synthesis_hash": s["synthesis_hash"][:HASH_LEN],
            "audio_hash": s["audio_hash"][:HASH_LEN],
        })
    keys = ["schema_version", "player_version", "book_id", "engine", "engine_commit", "model_version", "speaker", "settings", "postprocess", "review_status"]
    m = {k: side[k] for k in keys}
    m.update({"hash_len": HASH_LEN, "container": None, "sections": None, "scenes": scenes})
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--review-status", choices=REVIEW, default=None)
    a = ap.parse_args()
    ad = common.load_adapter(a.adapter)
    side_path = os.path.join(ad["audio_dir"], "manifest.json")
    side = json.load(open(side_path, encoding="utf8"))
    if a.review_status:
        side["review_status"] = a.review_status
        json.dump(side, open(side_path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    if side["player_version"] != common.PLAYER_VERSION:
        side["player_version"] = common.PLAYER_VERSION
        json.dump(side, open(side_path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    man = embedded_manifest(side)
    man["container"], man["sections"] = ad["container"], ad["sections"]
    mjson = json.dumps(man, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    js = minify_js()
    if "</script" in js.lower():
        raise SystemExit("압축된 스크립트에 </script 문자열이 있어 삽입할 수 없음")
    css = minify_css()
    raw = open(ad["html"], encoding="utf8").read()
    base = strip_blocks(raw)
    if base.lower().count("</head>") != 1 or base.lower().count("</body>") != 1:
        raise SystemExit("</head> 또는 </body>가 정확히 1개가 아님: 이 책은 어댑터/삽입 규칙을 따로 확정해야 함")
    h = base.lower().index("</head>")
    base = base[:h] + STYLE_BEGIN + "<style>" + css + "</style>" + STYLE_END + base[h:]
    b = base.lower().rindex("</body>")
    block = BODY_BEGIN + '<script type="application/json" id="narration-manifest">' + mjson + "</script><script>" + js + "</script>" + BODY_END
    base = base[:b] + block + base[b:]
    open(ad["html"], "w", encoding="utf8").write(base)
    orig = len(strip_blocks(raw).encode("utf8")), len(raw.encode("utf8"))
    print(f"삽입 완료: {ad['html']}")
    print(f"  HTML 증가분: {len(base.encode('utf8')) - orig[0]}B (스타일 {len(css)}B, manifest {len(mjson.encode('utf8'))}B, 스크립트 {len(js.encode('utf8'))}B)")
    print(f"  전체 크기: {orig[0]}B -> {len(base.encode('utf8'))}B")


if __name__ == "__main__":
    main()
