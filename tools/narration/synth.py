"""장면별 낭독 MP3 합성(MeloTTS 한국어 KR, A형 원본).

A형: 단위(제목·문단)별로 합성한 WAV를 그대로 이어 붙인다. 무음 다듬기·음량 조절은 기본 적용하지 않는다(Phase 0 결정).
합성은 저장소 밖(클라우드 세션, MeloTTS 설치 환경)에서만 실행하고 결과 MP3와 manifest.json만 커밋한다.

사용(저장소 루트): python tools/narration/synth.py --adapter tools/narration/adapters/electric-eel.json --work /path/to/work
설치 요건은 README.md 참고. 변경된 장면만 다시 합성한다(synthesis_hash 비교).
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SR = 44100
SETTINGS = {"speed": 1.0, "sdp_ratio": 0.2, "noise_scale": 0.6, "noise_scale_w": 0.8}
POSTPROCESS = "A-raw-concat-1"
MP3 = {"codec": "libmp3lame", "bitrate": "64k", "channels": 1, "sample_rate": 44100}


def hf_snapshot(repo):
    d = glob.glob(os.path.expanduser(f"~/.cache/huggingface/hub/models--{repo.replace('/', '--')}/snapshots/*"))
    return os.path.basename(sorted(d)[-1]) if d else "unknown"


def env_versions():
    import melo
    import torch
    import transformers
    mdir = os.path.dirname(os.path.dirname(melo.__file__))
    try:
        commit = subprocess.check_output(["git", "-C", mdir, "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        commit = "unknown"
    return {
        "engine": "MeloTTS",
        "engine_commit": commit,
        "model_version": "myshell-ai/MeloTTS-Korean@" + hf_snapshot("myshell-ai/MeloTTS-Korean"),
        "bert_version": "kykim/bert-kor-base@" + hf_snapshot("kykim/bert-kor-base"),
        "torch": torch.__version__,
        "transformers": transformers.__version__,
    }


def ffprobe_duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return round(float(out), 3)


def encode(wav, mp3):
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", str(MP3["sample_rate"]),
                           "-c:a", MP3["codec"], "-b:a", MP3["bitrate"], mp3])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    ad = common.load_adapter(a.adapter)
    soup = common.parse_book(ad["html"])
    out_dir = ad["audio_dir"]
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(a.work, exist_ok=True)
    ver = env_versions()
    pron = ad.get("pronunciation", [])
    model = None
    entries = []
    t_all = time.time()
    for sc in ad["scenes"]:
        units = common.scene_units(soup, sc)
        narr = [common.apply_pron(u, pron) for u in units]
        synth_input = {"units": narr, "pronunciation": pron, "engine": ver["engine"], "model": ver["model_version"],
                       "speaker": "KR", "settings": SETTINGS, "postprocess": POSTPROCESS, "mp3": MP3}
        sh = common.sha256_hex(common.canon(synth_input))
        mp3 = os.path.join(out_dir, sc["audio_file"])
        meta_path = os.path.join(a.work, sc["scene_id"] + ".json")
        starts, dur = None, None
        if not a.force and os.path.exists(mp3) and os.path.exists(meta_path):
            m = json.load(open(meta_path, encoding="utf8"))
            if m.get("synthesis_hash") == sh:
                starts, dur = m["starts"], m["duration"]
                print(sc["scene_id"], "재사용(변경 없음)", flush=True)
        if starts is None:
            if model is None:
                from melo.api import TTS
                model = TTS(language="KR", device="cpu")
                sid = model.hps.data.spk2id["KR"]
            t0 = time.time()
            chunks, starts, t = [], [], 0.0
            for k, text in enumerate(narr):
                wav = os.path.join(a.work, f"{sc['scene_id']}_{k}.wav")
                model.tts_to_file(text, sid, wav, quiet=True, **SETTINGS)
                x, sr = sf.read(wav, dtype="float32")
                assert sr == SR and x.ndim == 1, (sr, x.shape)
                starts.append(round(t, 3))
                chunks.append(x)
                t += len(x) / SR
            scene_wav = os.path.join(a.work, sc["scene_id"] + ".wav")
            sf.write(scene_wav, np.concatenate(chunks), SR)
            encode(scene_wav, mp3)
            dur = ffprobe_duration(mp3)
            json.dump({"synthesis_hash": sh, "starts": starts, "duration": dur}, open(meta_path, "w", encoding="utf8"))
            print(sc["scene_id"], f"합성 {time.time() - t0:.1f}s, 음성 {dur:.1f}s, 단위 {len(units)}", flush=True)
        entries.append({
            "scene_id": sc["scene_id"],
            "selector": sc["selector"],
            "heading_selector": sc.get("heading"),
            "paragraph_selectors": sc.get("paragraphs", []),
            "audio_url": ad["audio_url_prefix"] + sc["audio_file"],
            "audio_file": sc["audio_file"],
            "duration": dur,
            "paragraph_start_seconds": starts,
            "text_hash": common.text_hash(units),
            "synthesis_hash": sh,
            "audio_hash": common.sha256_hex(open(mp3, "rb").read()),
        })
    manifest = {
        "schema_version": common.SCHEMA_VERSION,
        "player_version": common.PLAYER_VERSION,
        "book_id": ad["book_id"],
        "scope": ad["scope"],
        "engine": ver["engine"],
        "engine_commit": ver["engine_commit"],
        "model_version": ver["model_version"],
        "bert_version": ver["bert_version"],
        "runtime": {"torch": ver["torch"], "transformers": ver["transformers"]},
        "speaker": "KR",
        "settings": SETTINGS,
        "postprocess": POSTPROCESS,
        "mp3": MP3,
        "pronunciation": pron,
        "review_status": "unreviewed",
        "scenes": entries,
    }
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"완료: 장면 {len(entries)}개, 총 {time.time() - t_all:.0f}s")


if __name__ == "__main__":
    main()
