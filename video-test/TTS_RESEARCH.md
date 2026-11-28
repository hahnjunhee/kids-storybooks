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
