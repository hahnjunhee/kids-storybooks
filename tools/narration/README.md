# 그림책 낭독 도구 (Phase 1: 전기뱀장어 시범)

통합 기획안 v1.1(`proposals/2026-11-28-narration-feature-proposal.md`)의 구현 도구다. 책 본문과 삽화는 바꾸지 않고, 사전 합성한 장면별 MP3를 재생하는 플레이어를 책 HTML에 추가한다.

## 결정 사항 (Phase 0)
- 음성: MeloTTS 한국어 KR 화자, A형(원본). 단위(제목·문단)별 합성 파일을 그대로 이어 붙이고 무음 다듬기·음량 조절은 기본 적용하지 않는다.
- 재생 속도: 기본 1.15배, 선택지 0.9 / 1.0 / 1.15 / 1.25 / 1.35배.
- 모든 음성에 "AI 음성" 표시. 라이선스 위험(학습 데이터·화자 출처 비공개)은 사용자가 수용(기획안 §9).

## 구성
- `player.js`, `player.css`: 공통 플레이어 단일 소스. 읽기 방식(세로 스크롤/페이지 넘기기)과 낭독 UI를 런타임에 만든다.
- `adapters/<book>.json`: 책별 어댑터. 장면 선택자, 제목·문단 선택자, 발음 치환, 오디오 위치. 낭독 범위는 `scope` 필드에 적는다.
- `common.py`: 본문 추출·정규화·해시 규칙(브라우저와 같은 규칙).
- `synth.py`: 장면별 합성(MeloTTS). 저장소 밖 클라우드 세션에서만 실행하고 결과 MP3와 `manifest.json`만 커밋한다. 변경된 장면만 다시 합성한다.
- `make_adapter.py`: 공통 열람 템플릿 규약을 따르는 신규 작품에서 어댑터를 자동 생성한다(규약 위반은 오류, 숫자·영문 본문은 발음 확인 경고).
- `build.py`: 플레이어를 책 HTML에 삽입한다. 추가 전용이며 다시 실행해도 중복되지 않는다. `--modes-only`는 음성 없이 읽기 방식만 삽입한다(템플릿·음성 준비 전 책).
- `verify.py`: 배포 전 자동 검증 게이트(실패 시 종료 코드 1). `--modes-only <HTML>`은 읽기 방식만 삽입한 파일(템플릿)의 삽입 상태를 검사한다.
- `asr_check.py`: 보조 점검. 합성 음성을 음성 인식으로 받아 적어 원문과 비교한다. 사람의 청취를 대체하지 않는다.
- `survey.py` → `STRUCTURE_SURVEY.md`: 전체 책 HTML 구조 전수 조사.
- `tests/`: 브라우저 통합 시험(Playwright).

## 산출물
- `audio/<book>/sNN.mp3`: 장면별 MP3(mono, 64kbps, 44.1kHz). `audio/<book>/manifest.json`: 전체 해시를 담은 사이드카.
- 책 HTML 안 `<script type="application/json" id="narration-manifest">`: 플레이어가 읽는 요약(해시는 앞 16자). 필드: schema_version, player_version, book_id, scene_id, selector, heading_selector, paragraph_selectors, audio_url(`?v=`로 캐시 무효화), duration, paragraph_start_seconds, text_hash, synthesis_hash, audio_hash, engine, model_version, speaker, settings, review_status.
- `text_hash`: 표시 본문(제목+문단, 공백 정규화·NFC)의 SHA-256. `synthesis_hash`: 낭독 텍스트·발음 사전·엔진·모델·설정·후처리·MP3 설정. `audio_hash`: MP3 바이트.
- 플레이어는 실행 시 본문 해시를 다시 계산해 음성과 맞지 않는 장면은 건너뛴다(HTTPS 또는 localhost에서).
- 책 HTML에는 `<!--narration:style:begin-->…end-->`, `<!--narration:begin-->…<!--narration:end-->` 두 블록만 추가된다. 블록을 지우면 원본과 바이트 단위로 같다.

## 검수 상태 (`review_status`)
- `unreviewed`: 합성 직후. 배포 금지.
- `pilot_unlistened`: 자동 검증 통과, 전 장면 청취 전. `verify.py --allow-pilot`일 때만 시범 배포 허용.
- `approved`: 사용자가 전 장면을 듣고 승인. 일반 적용 가능. 전 장면 청취 기록을 남긴다.

## 실행 순서 (저장소 루트, MeloTTS 가상환경 필요)
```
python tools/narration/synth.py  --adapter tools/narration/adapters/electric-eel.json --work <작업폴더>
python tools/narration/build.py  --adapter tools/narration/adapters/electric-eel.json --review-status pilot_unlistened
python tools/narration/verify.py --adapter tools/narration/adapters/electric-eel.json --baseline origin/main --allow-pilot
bash tools/narration/tests/run-tests.sh origin/main
```
요건: Python 3.10, beautifulsoup4, numpy, soundfile, ffmpeg, MeloTTS(합성 시), Node와 npx(terser 압축), Playwright(브라우저 시험). 합성 환경 설치 때 막혔던 지점은 `video-test/TTS_RESEARCH.md`에 있다. 합성에는 `HF_HUB_DISABLE_XET=1`이 필요했다.

## 알려진 한계
- 자동 검증과 브라우저 시험은 사람이 들은 검수가 아니다. 음질·발음·장면 전환 호흡은 사람이 들어야 한다.
- 잠금화면에서의 연속 낭독과 Media Session은 구현하지 않았다(Phase 3).
- 문단 강조는 구현하지 않았다. `paragraph_start_seconds`는 데이터만 기록한다(Phase 3).
- 발견 노트·학습 카드 낭독은 구현하지 않았다(본문과 구분한 선택 낭독, 후속).
- 이미 있는 기존 책 7권에는 적용하지 않았다(시범 승인 후 한 권씩). 책마다 구조가 달라 어댑터를 손으로 작성해야 한다(`STRUCTURE_SURVEY.md`).

## 신규 작품 절차 (템플릿 규약을 따르는 책)
1. `templates/storybook.html`을 복사해 `books/<slug>.html`을 만들고 장면·본문·삽화를 채운다. 규약: `main > section#scene0, scene1, …`, 표지 `h1`, 나머지 `h2` + `.story p`, 발견 노트는 `section.activity`.
2. 어댑터 생성: `python tools/narration/make_adapter.py --html books/<slug>.html --book-id <slug> --out tools/narration/adapters/<slug>.json` (경고가 나온 숫자·영문 문장은 어댑터의 `pronunciation`에 치환을 추가).
3. 음성이 아직 없으면 `build.py --modes-only --html books/<slug>.html`로 읽기 방식만 삽입한다(템플릿에는 이미 들어 있음).
4. 낭독 포함 출시: 위 "실행 순서"(합성 → 삽입 → 검증 → 브라우저 시험)를 따르고 전 장면을 들어 `review_status`를 `approved`로 올린다.
5. 템플릿에는 플레이어가 삽입돼 있다. `player.js`를 고치면 `build.py --modes-only --html templates/storybook.html --book-id template`로 다시 삽입하고 `verify.py --modes-only templates/storybook.html`로 확인한다.
