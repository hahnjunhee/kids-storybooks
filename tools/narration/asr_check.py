"""보조 점검: 합성 음성을 음성 인식(faster-whisper)으로 다시 받아 적어 낭독 텍스트와 비교한다.

사람의 청취를 대체하지 않는다. 문장 누락·추가·심한 오독 같은 큰 문제를 찾는 용도이며, 합성 음성을 인식기가 잘못 받아 적는 경우도 있으므로
점수가 낮은 장면은 사람이 직접 들어서 판단한다. 기본 검증 게이트(verify.py)에는 넣지 않는다.

사용(저장소 루트): python tools/narration/asr_check.py --adapter tools/narration/adapters/electric-eel.json --out /path/to/asr-out
요건: faster-whisper (모델은 Hugging Face에서 내려받음, 예: small)
"""
import argparse
import difflib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402


def key(t):
    return re.sub(r"[^0-9A-Za-z가-힣]", "", t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="small")
    a = ap.parse_args()
    from faster_whisper import WhisperModel
    ad = common.load_adapter(a.adapter)
    soup = common.parse_book(ad["html"])
    pron = ad.get("pronunciation", [])
    os.makedirs(a.out, exist_ok=True)
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    rows = []
    for sc in ad["scenes"]:
        units = [common.apply_pron(u, pron) for u in common.scene_units(soup, sc)]
        ref = key("".join(units))
        segs, _ = model.transcribe(os.path.join(ad["audio_dir"], sc["audio_file"]), language="ko", beam_size=5, vad_filter=False)
        hyp_text = " ".join(s.text.strip() for s in segs)
        hyp = key(hyp_text)
        ratio = difflib.SequenceMatcher(None, ref, hyp, autojunk=False).ratio()
        open(os.path.join(a.out, sc["scene_id"] + ".txt"), "w", encoding="utf8").write("원문: " + " ".join(units) + "\n인식: " + hyp_text + "\n")
        rows.append((sc["scene_id"], len(ref), len(hyp), ratio))
        print(f"{sc['scene_id']:8} 원문 {len(ref):4}자 인식 {len(hyp):4}자 유사도 {ratio:.3f}", flush=True)
    avg = sum(r[3] for r in rows) / len(rows)
    low = [r[0] for r in rows if r[3] < 0.85]
    print(f"평균 유사도 {avg:.3f}, 0.85 미만 장면: {', '.join(low) or '없음'}")


if __name__ == "__main__":
    main()
