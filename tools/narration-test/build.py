"""Phase 0 낭독 음성 시험 빌드: 같은 13문단에서 A/B/C 세 버전 MP3와 시험 페이지를 만든다.

입력은 MeloTTS 문단별 WAV(`s<장면>_p<문단>.wav`)와 문단 텍스트 목록이다. 합성은 저장소 밖(클라우드 세션)에서 하고
이 스크립트는 후처리·인코딩·페이지 생성만 한다. 실행에는 numpy, soundfile, ffmpeg가 필요하다.

사용: python build.py --rows rows.json --raw RAW_DIR --slow SLOW_DIR --out narration-test
  rows.json: [{"scene":"1","p":0,"text":"..."}, ...]  (장면·문단 순서)
  RAW_DIR  : speed 1.0 합성 결과, SLOW_DIR: speed 0.92 합성 결과
"""
import argparse, json, os, subprocess, datetime, html
import numpy as np
import soundfile as sf

SR = 44100
THRESH = 10 ** (-45 / 20)  # -45 dBFS 이하를 무음으로 본다
WIN = int(0.01 * SR)

CONFIG = {
    "A": dict(label="A형 · MeloTTS 원본", speed=1.0, src="raw", process=False),
    "B": dict(label="B형 · 무음 최적화", speed=1.0, src="raw", process=True,
              edge=0.05, cap_over=0.6, cap_to=0.5, gap=0.5, scene_gap=0.5, quote_gap=0.5, lead=0.0, tail=0.0),
    "C": dict(label="C형 · 어린이 호흡", speed=0.92, src="slow", process=True,
              edge=0.08, cap_over=0.8, cap_to=0.7, gap=0.7, scene_gap=1.4, quote_gap=0.55, lead=0.4, tail=0.6),
}


def silent_mask(x):
    n = len(x) // WIN
    if n == 0:
        return np.ones(0, dtype=bool)
    rms = np.sqrt((x[: n * WIN].reshape(n, WIN) ** 2).mean(axis=1))
    return rms < THRESH


def trim_edges(x, keep):
    m = silent_mask(x)
    voiced = np.where(~m)[0]
    if len(voiced) == 0:
        return x
    a = max(0, voiced[0] * WIN - int(keep * SR))
    b = min(len(x), (voiced[-1] + 1) * WIN + int(keep * SR))
    return x[a:b]


def cap_pauses(x, over, to):
    """내부 무음이 over초 이상이면 to초로 줄인다."""
    m = silent_mask(x)
    out, i, n = [], 0, len(m)
    while i < n:
        j = i
        while j < n and m[j] == m[i]:
            j += 1
        seg = x[i * WIN : j * WIN]
        if m[i] and (j - i) * WIN / SR >= over:
            seg = seg[: int(to * SR)]
        out.append(seg)
        i = j
    out.append(x[n * WIN :])
    return np.concatenate(out) if out else x


def assemble(rows, cfg, dirs):
    d = dirs[cfg["src"]]
    chunks, timeline, t = [], [], 0.0
    if cfg["process"] and cfg["lead"]:
        chunks.append(np.zeros(int(cfg["lead"] * SR), dtype="float32")); t += cfg["lead"]
    for k, r in enumerate(rows):
        x, sr = sf.read(os.path.join(d, f"s{r['scene']}_p{r['p']}.wav"), dtype="float32")
        assert sr == SR and x.ndim == 1
        if cfg["process"]:
            x = trim_edges(x, cfg["edge"])
            x = cap_pauses(x, cfg["cap_over"], cfg["cap_to"])
        dur = len(x) / SR
        timeline.append(dict(scene=r["scene"], p=r["p"], text=r["text"], start=round(t, 2), end=round(t + dur, 2)))
        chunks.append(x); t += dur
        if k + 1 < len(rows):
            if not cfg["process"]:
                continue
            nxt = rows[k + 1]
            quote = r["text"].startswith("“") and r["text"].rstrip().endswith("”")
            g = cfg["scene_gap"] if nxt["scene"] != r["scene"] else (cfg["quote_gap"] if quote else cfg["gap"])
            chunks.append(np.zeros(int(g * SR), dtype="float32")); t += g
    if cfg["process"] and cfg["tail"]:
        chunks.append(np.zeros(int(cfg["tail"] * SR), dtype="float32")); t += cfg["tail"]
    return np.concatenate(chunks), timeline


def encode(wav_path, mp3_path):
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", wav_path, "-ac", "1", "-ar", "44100",
                           "-c:a", "libmp3lame", "-b:a", "64k", mp3_path])


def probe_duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return round(float(out), 2)


def settings_text(key, cfg, versions):
    base = [f"엔진 MeloTTS Korean(KR 화자), speed {cfg['speed']}, sdp_ratio 0.2, noise_scale 0.6, noise_scale_w 0.8",
            f"{versions['melo_commit']} / torch {versions['torch']} / transformers {versions['transformers']}"]
    if not cfg["process"]:
        base.append("후처리 없음: 문단별 합성 파일을 그대로 이어 붙임(원래의 앞뒤·문장 중간 무음 유지)")
    elif key == "B":
        base.append(f"문단 앞뒤 무음 {cfg['edge']}초만 남김, {cfg['cap_over']}초 이상 문장 중간 무음은 {cfg['cap_to']}초로 단축, 문단·장면 사이 {cfg['gap']}초")
    else:
        base.append(f"문단 앞뒤 무음 {cfg['edge']}초만 남김, {cfg['cap_over']}초 이상 문장 중간 무음은 {cfg['cap_to']}초로 단축")
        base.append(f"문단 사이 {cfg['gap']}초, 대사(따옴표 문단) 뒤 {cfg['quote_gap']}초, 장면 사이 {cfg['scene_gap']}초, 시작 {cfg['lead']}초·끝 {cfg['tail']}초 여유")
    base.append("MP3 mono 64kbps 44.1kHz(libmp3lame)")
    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", required=True); ap.add_argument("--raw", required=True)
    ap.add_argument("--slow", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--melo-commit", default="unknown"); ap.add_argument("--torch", default="unknown")
    ap.add_argument("--transformers", default="unknown")
    a = ap.parse_args()
    rows = json.load(open(a.rows, encoding="utf8"))
    dirs = {"raw": a.raw, "slow": a.slow}
    ver = dict(melo_commit="MeloTTS " + a.melo_commit, torch=a.torch, transformers=a.transformers)
    os.makedirs(os.path.join(a.out, "audio"), exist_ok=True)
    names = {"A": "a-original", "B": "b-trimmed", "C": "c-child"}
    data = dict(generated=datetime.date.today().isoformat(), versions=[])
    tmp = os.path.join(a.out, "audio", "_tmp.wav")
    for key in "ABC":
        cfg = CONFIG[key]
        audio, tl = assemble(rows, cfg, dirs)
        sf.write(tmp, audio, SR)
        mp3 = os.path.join(a.out, "audio", names[key] + ".mp3")
        encode(tmp, mp3)
        data["versions"].append(dict(
            key=key, label=cfg["label"], file="audio/" + names[key] + ".mp3",
            bytes=os.path.getsize(mp3), duration=probe_duration(mp3),
            speech=round(sum(p["end"] - p["start"] for p in tl), 1),
            settings=settings_text(key, cfg, ver), paragraphs=tl))
    os.remove(tmp)
    tpl = open(os.path.join(os.path.dirname(__file__), "index.template.html"), encoding="utf8").read()
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    open(os.path.join(a.out, "index.html"), "w", encoding="utf8").write(tpl.replace("__DATA__", payload))
    json.dump(data, open(os.path.join(a.out, "audio", "manifest.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    for v in data["versions"]:
        print(v["key"], v["duration"], "s", round(v["bytes"] / 1024, 1), "KB", "speech", v["speech"])


if __name__ == "__main__":
    main()
