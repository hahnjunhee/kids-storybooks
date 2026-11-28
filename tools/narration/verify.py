"""낭독 산출물 자동 검증(배포 전 게이트). 하나라도 실패하면 종료 코드 1.

검사: 기존 본문·삽화 무변경(추가 전용), text_hash(표시 본문), synthesis_hash(낭독 텍스트·발음·모델·설정), audio_hash(MP3),
HTML 내 manifest와 사이드카 manifest 일치, 상대 URL·캐시 무효화 쿼리, MP3 디코딩·길이·형식·무음·피크, 검수 상태 게이트.
자동 검증은 사람이 들은 검수가 아니다. 청취는 review_status로 구분한다(unreviewed / pilot_unlistened / approved).

사용(저장소 루트):
  낭독 포함 책: python tools/narration/verify.py --adapter tools/narration/adapters/electric-eel.json --baseline origin/main --allow-pilot
  읽기 방식만(템플릿): python tools/narration/verify.py --modes-only templates/storybook.html
"""
import argparse
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
from build import BLOCK_RE, HASH_LEN, minify_css, minify_js, strip_blocks  # noqa: E402
from make_adapter import FLAG_RE, unit_hash  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def verify_modes_only(path, max_bytes=None):
    """읽기 방식만 삽입한 파일(템플릿 등) 검사: 블록 구성, manifest, 삽입된 플레이어가 현재 소스와 같은지."""
    html = open(path, encoding="utf8").read()
    check("삽입 블록은 스타일 1 + 본문 1", len(BLOCK_RE.findall(html)) == 2)
    check("중복 삽입 없음", html.count('id="narration-manifest"') == 1 and html.count("<!--narration:begin-->") == 1)
    m = re.search(r'<script type="application/json" id="narration-manifest">(.*?)</script>', html, re.S)
    man = json.loads(m.group(1).replace("<\\/", "</")) if m else None
    check("manifest 존재", man is not None)
    if man is None:
        sys.exit(1)
    check("player_version 일치", man["player_version"] == common.PLAYER_VERSION, man["player_version"])
    check("낭독 장면 없음(읽기 방식만)", man["scenes"] == [])
    check("container·sections 지정", bool(man.get("container")) and bool(man.get("sections")))
    check("삽입된 스크립트가 현재 player.js와 동일", ("<script>" + minify_js() + "</script>") in html)
    check("삽입된 스타일이 현재 player.css와 동일", ("<style>" + minify_css() + "</style>") in html)
    soup = BeautifulSoup(strip_blocks(html), "html.parser")
    check("장면 섹션 존재(main > section)", len(soup.select(man["sections"])) > 0)
    size = len(html.encode("utf8"))
    print(f"보고: HTML {size}B")
    if max_bytes:
        check("최종 HTML 용량 목표(플레이어 포함)", size <= max_bytes, f"{size}B / 목표 {max_bytes}B")
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n검사 {len(RESULTS)}개, 실패 {len(fails)}개")
    sys.exit(1 if fails else 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter")
    ap.add_argument("--baseline", help="원본 HTML을 읽을 git 참조(예: origin/main)")
    ap.add_argument("--allow-pilot", action="store_true", help="pilot_unlistened 상태의 시범 배포 허용")
    ap.add_argument("--modes-only", metavar="HTML", help="읽기 방식만 삽입한 파일 검사(예: templates/storybook.html)")
    ap.add_argument("--max-html-bytes", type=int, default=None, help="최종 HTML 용량 목표(바이트, 플레이어 삽입분 포함). 신규 작품은 500000. 어댑터의 size_exception 사유가 있으면 예외로 통과")
    a = ap.parse_args()
    if a.modes_only:
        verify_modes_only(a.modes_only, a.max_html_bytes)
    if not a.adapter or not a.baseline:
        raise SystemExit("--adapter와 --baseline이 필요함(또는 --modes-only <HTML>)")
    ad = common.load_adapter(a.adapter)
    html = open(ad["html"], encoding="utf8").read()
    side = json.load(open(os.path.join(ad["audio_dir"], "manifest.json"), encoding="utf8"))

    # 1. 기존 본문·삽화·스크립트 무변경: 삽입 블록을 지우면 기준본과 바이트 동일
    base = run(["git", "show", f"{a.baseline}:{ad['html']}"])
    stripped = strip_blocks(html)
    check("기존 HTML 무변경(블록 제거 시 기준본과 동일)", base.returncode == 0 and base.stdout == stripped,
          f"기준 {a.baseline}, 삽입 블록 {len(BLOCK_RE.findall(html))}개")
    check("삽입 블록은 스타일 1 + 본문 1", len(BLOCK_RE.findall(html)) == 2)
    check("중복 삽입 없음", html.count('id="narration-manifest"') == 1 and html.count("<!--narration:begin-->") == 1)

    # 2. HTML 내 manifest
    m = re.search(r'<script type="application/json" id="narration-manifest">(.*?)</script>', html, re.S)
    emb = json.loads(m.group(1).replace("<\\/", "</")) if m else None
    check("HTML 내 manifest 존재", emb is not None)
    if emb is None:
        sys.exit(1)
    check("player_version 일치", emb["player_version"] == common.PLAYER_VERSION == side["player_version"], emb["player_version"])
    for k in ["schema_version", "book_id", "engine", "engine_commit", "model_version", "speaker", "settings", "postprocess", "review_status"]:
        check(f"manifest.{k} = 사이드카", emb[k] == side[k])

    # 3. 검수 상태 게이트
    st = side["review_status"]
    check("검수 상태 게이트", st == "approved" or (a.allow_pilot and st == "pilot_unlistened"), f"review_status={st} (청취 승인 전 시범은 --allow-pilot)")

    # 4. 장면별 해시·MP3
    soup = BeautifulSoup(stripped, "html.parser")
    pron = ad.get("pronunciation", [])
    total_chars = total_dur = 0
    flagged = {}
    check("장면 수 일치", len(side["scenes"]) == len(emb["scenes"]) == len(ad["scenes"]), str(len(ad["scenes"])))
    for sc, ss, es in zip(ad["scenes"], side["scenes"], emb["scenes"]):
        sid = sc["scene_id"]
        units = common.scene_units(soup, sc)
        narr = [common.apply_pron(u, pron) for u in units]
        for u in units:
            if FLAG_RE.search(u):
                flagged[unit_hash(u)] = (sid, u[:30])
        th = common.text_hash(units)
        check(f"{sid} text_hash(표시 본문)", th == ss["text_hash"] and es["text_hash"] == th[:HASH_LEN])
        synth_input = {"units": narr, "pronunciation": pron, "engine": side["engine"], "model": side["model_version"], "speaker": side["speaker"],
                       "settings": side["settings"], "postprocess": side["postprocess"], "mp3": side["mp3"]}
        sh = common.sha256_hex(common.canon(synth_input))
        check(f"{sid} synthesis_hash(낭독 텍스트·설정)", sh == ss["synthesis_hash"] and es["synthesis_hash"] == sh[:HASH_LEN])
        path = os.path.join(ad["audio_dir"], ss["audio_file"])
        exists = os.path.exists(path)
        ah = common.sha256_hex(open(path, "rb").read()) if exists else ""
        check(f"{sid} audio_hash(MP3)", exists and ah == ss["audio_hash"] and es["audio_hash"] == ah[:HASH_LEN])
        check(f"{sid} audio_url 상대경로·캐시 쿼리", es["audio_url"] == ad["audio_url_prefix"] + ss["audio_file"] + "?v=" + ss["audio_hash"][:12]
              and os.path.exists(os.path.normpath(os.path.join(os.path.dirname(ad["html"]), es["audio_url"].split("?")[0]))))
        dec = run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"])
        check(f"{sid} MP3 디코딩 오류 없음", dec.returncode == 0 and not dec.stderr.strip(), dec.stderr.strip()[:120])
        pr = run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=channels,sample_rate,codec_name", "-of", "json", path])
        j = json.loads(pr.stdout)
        dur = float(j["format"]["duration"])
        stm = j["streams"][0]
        check(f"{sid} 형식(mp3·mono·44.1kHz)", stm["codec_name"] == "mp3" and stm["channels"] == 1 and stm["sample_rate"] == "44100")
        check(f"{sid} 길이 일치", abs(dur - ss["duration"]) < 0.05 and es["duration"] == ss["duration"], f"{dur:.2f}s")
        ps = ss["paragraph_start_seconds"]
        check(f"{sid} 문단 시작 시각(단위 수·단조 증가·길이 이내)", len(ps) == len(units) and ps == sorted(ps) and ps[0] == 0 and ps[-1] < dur)
        chars = sum(len(u) for u in units)
        cps = chars / dur
        check(f"{sid} 낭독 속도 범위(3~9자/초)", 3 <= cps <= 9, f"{cps:.2f}자/초")
        sil = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "silencedetect=noise=-45dB:d=0.3", "-f", "null", "-"]).stderr
        longest = max([float(x) for x in re.findall(r"silence_duration: ([0-9.]+)", sil)] or [0])
        check(f"{sid} 최장 무음 3초 이하", longest <= 3.0, f"{longest:.2f}s")
        vol = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"]).stderr
        mx = re.search(r"max_volume: (-?[0-9.]+) dB", vol)
        check(f"{sid} 피크 -0.1dB 이하(클리핑 없음)", mx is not None and float(mx.group(1)) <= -0.1, mx.group(1) + " dB" if mx else "측정 실패")
        total_chars += chars
        total_dur += dur

    # 4-2. 숫자·영문 발음 검수 기록(make_adapter.py가 기록, 사람이 들은 뒤 reviewed로 바꾼다)
    rev = {e["unit_hash"]: e for e in ad.get("pronunciation_review", [])}
    for h, (sid, prev) in flagged.items():
        e = rev.get(h)
        ok = e is not None and e.get("status") in ("pending", "reviewed") and (e.get("status") == "reviewed" or st != "approved")
        why = "기록 없음(make_adapter.py --update)" if e is None else f"status={e.get('status')}"
        check(f"{sid} 숫자·영문 발음 검수 기록({prev}…)", ok, why + (" — approved는 reviewed 필요" if (not ok and e is not None and e.get("status") == "pending") else ""))
    check("발음 검수 기록에 낡은 항목 없음(본문이 바뀐 뒤 갱신됨)", set(rev) <= set(flagged), ", ".join(sorted(set(rev) - set(flagged))))

    # 5. 용량(플레이어 삽입분 포함, MP3는 별도 관리) 점검과 보고
    size = len(html.encode("utf8"))
    if a.max_html_bytes:
        exc = (ad.get("size_exception") or "").strip()
        check("최종 HTML 용량 목표(플레이어 포함)", size <= a.max_html_bytes or bool(exc),
              f"{size}B / 목표 {a.max_html_bytes}B" + (f", 초과 사유 기록: {exc}" if size > a.max_html_bytes and exc else ""))
    inj = sum(len(b.encode("utf8")) for b in BLOCK_RE.findall(html))
    mp3_total = sum(os.path.getsize(os.path.join(ad["audio_dir"], s["audio_file"])) for s in side["scenes"])
    print(f"\n보고: 낭독 {total_chars}자, 음성 {total_dur:.1f}초({total_dur / 60:.1f}분), MP3 합계 {mp3_total / 1024:.0f}KB")
    print(f"보고: HTML {len(stripped.encode('utf8'))}B -> {len(html.encode('utf8'))}B (삽입 {inj}B, {inj / len(stripped.encode('utf8')) * 100:.2f}%)")
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n검사 {len(RESULTS)}개, 실패 {len(fails)}개")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
