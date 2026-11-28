# 한국어 TTS 조사 (2단계)

관찰일: 2026-11-28 / 관찰 주체: Claude Code 클라우드 세션 / 방법: CLI 도움말, 공식 가격 페이지 직접 조회, 웹 검색, 호스트 접속 시험. 접속 결과는 이 세션 시점의 스냅샷이다.

## 후보별 결과

| 후보 | 한국어 | 비용 | 이 환경 접근 | 판정 |
|---|---|---|---|---|
| Hyperframes 내장 Kokoro | 없음(`--lang`: en, es, fr, hi, it, pt-br, ja, zh) | 무료 | 로컬 | 제외 |
| Google Cloud TTS (Neural2 / Chirp 3 HD) | 지원으로 알고 있음(voices 페이지 접속 불가로 미확인) | 월 무료: Neural2·Chirp 3 HD 각 100만자, 초과 시 $16·$30/100만자. Standard·WaveNet은 400만자 | `texttospeech.googleapis.com` 응답함. 계정 인증 없음(`gcloud auth list` 비어 있음) | 1순위 |
| Gemini TTS | 미확인 | Cloud 가격표에서 무료 한도 "Not available". Gemini API 무료 한도는 제3자 정보만 있음(구형 모델 15 RPD 등) | 미확인 | 보류 |
| MeloTTS Korean | 지원(모델 카드 MIT) | 무료 | `huggingface.co` 프록시 차단(403). 허용 필요. torch 등 무거운 의존성 | 2순위(오프라인) |
| edge-tts | ko-KR-SunHi/InJoon 있음 | 무료, 비공식 엔드포인트 | `speech.platform.bing.com` 차단(403). Microsoft 약관상 회색지대(Q&A 답변 수준) | 비추천 |
| HeyGen Starfish | 미확인 | 유료(최소 $5 충전) | `api.heygen.com` 차단(403) | 제외 |

## 분량 계산
책 본문 약 2,000~2,500자. Google 월 무료 100만자 대비 0.2~0.3%.

## 설계 메모
- Google TTS는 단어 타임스탬프가 없다. 문단별로 합성해 `ffprobe`로 길이를 재고 자막 `data-start/duration`을 그 길이로 맞추면 된다.
- `<audio>`에는 `id`가 필요하고 `crossorigin`은 쓰지 않는다(Hyperframes 규칙).

## 미검증
Korean 음성 목록(Neural2/Chirp 3 HD), 실제 음질, GCP 결제 계정 설정 여부, MeloTTS 한국어 음질·설치 용량.

## 출처
- 공식 가격: https://cloud.google.com/text-to-speech/pricing (2026-11-28 조회)
- Hyperframes tts 옵션: `npx hyperframes tts --help` (v0.9.104)
- MeloTTS: https://huggingface.co/myshell-ai/MeloTTS-Korean
- edge-tts 약관 논의: https://learn.microsoft.com/en-us/answers/questions/2088770/are-opensource-edge-tts-free-for-commercial-use
- HeyGen 가격: https://developers.heygen.com/docs/pricing.md

## MeloTTS Korean 시험 결과 (2026-11-28)

대상: 전기뱀장어 1~3장 본문 13문단, 380자. 환경: 이 클라우드 컨테이너, CPU만 사용.

- **합성 성공.** 화자는 `KR` 하나뿐(남녀·연령 선택 없음). 음질은 사람이 들어보고 판단해야 한다(이 기록은 청취 평가를 포함하지 않음).
- **속도:** 총 음성 69초(무음 포함)를 합성하는 데 약 21초, 실시간 대비 약 0.3배. 모델 로딩 약 10초, 첫 임포트 최대 약 65초.
- **분량:** 문단 앞뒤 무음을 다듬으면 장면당 낭독 17~21초(3장면 합계 56.2초). 문단당 `0.148초/자` 정도라서 12장면 전체(약 2,100자)는 낭독 약 5분 추정. 현재 영상 틀(장면당 10초 고정)은 낭독 길이에 맞춰 장면 길이를 늘려야 한다.
- **무음:** 합성 결과에 앞 0.1초, 뒤 0.8~1.4초, 문장 중간 약 1.1초 무음이 있다(따옴표·문장부호 뒤). 앞뒤는 `silenceremove`로 다듬을 수 있다.
- **디스크:** 모델·BERT 캐시 약 204MB(Hugging Face), PyPI torch와 CUDA 라이브러리로 의존성 캐시 약 5GB.

### 설치 때 막혔던 지점 (재현용)
Python 3.13 기본 환경에서는 MeloTTS의 고정 버전 의존성(`transformers==4.27.4` 등) 때문에 설치 불가. `uv python install 3.10`으로 3.10 가상환경 사용.
1. `pkg_resources` 없음 → `setuptools<81`
2. MeCab 사전 없음(일본어 모듈이 임포트 시 초기화) → `unidic/dicdir`를 `unidic_lite/dicdir`로 심볼릭 링크
3. NLTK 데이터 없음(영어 모듈) → NLTK 내장 다운로더는 프록시 경유를 보안상 거부. `curl`로 `cmudict`, `averaged_perceptron_tagger(_eng)` zip을 `~/nltk_data`에 직접 풀기
4. 모델 파일: Xet 전송이 `cas-server.xethub.hf.co`로 가서 막힘 → `HF_HUB_DISABLE_XET=1`, 그래도 `us.aws.cdn.hf.co`로 리다이렉트되므로 이 호스트 허용 필요
5. 한국어 형태소 분석기 없음 → `python-mecab-ko` 설치

허용한 호스트: `huggingface.co`, `us.aws.cdn.hf.co`(실제 사용 확인). `cdn-lfs.huggingface.co`, `cas-bridge.xethub.hf.co`는 추측으로 추가했고 실제 사용은 확인하지 못했다.

### 미검증
Google Cloud TTS(키 미등록), 두 방식의 청취 비교, 속도 조절(`speed`) 영향, GitHub Actions 러너에서의 설치 시간·용량.
