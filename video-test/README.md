# 영상 파생물 1단계 시험 (전기뱀장어 3장면)

목적: 기존 그림책 HTML을 Hyperframes로 영상화할 수 있는지 시험한다. 정식 도입 전 실험이며 가이드라인에는 반영하지 않았다.

## 구성
- `eel-3scene/tools/extract.py` — 책 HTML(Base64 내장 이미지)에서 장면 이미지·본문 추출
- `eel-3scene/tools/gen.py` — 장면 JSON으로 Hyperframes 컴포지션 생성(1280×720, 30fps, 장면당 10초, 자막만·무음)
- `eel-3scene/assets/` — 추출한 삽화 3장(1~3장 본문 그대로)과 Pretendard 가변 폰트(OFL-1.1)

## 재현
```
python3 -I tools/extract.py ../../books/korean-electric-eel-storybook.html <작업폴더> 1,2,3
python3 -I tools/gen.py <작업폴더> .
npx hyperframes@0.9.104 check
npx hyperframes@0.9.104 render --crf 26 --output out.mp4
```

## 결과 (2026-11-28, Claude Code 클라우드 컨테이너)
- 한글 자막: 시스템에 한글 폰트가 없어 폰트 파일(assets/fonts)을 직접 넣어야 정상 렌더. 넣으면 정상.
- 삽화 원본은 책 HTML 안에서 960×720 WebP. 720p 캔버스에서 확대 6%까지는 업스케일 없이 선명.
- 렌더: 30초·900프레임, 소프트웨어 렌더 약 70초(1워커).
- 용량: 기본 품질(CRF 16) 21.4MB, `--crf 26` 약 4.3MB, CRF 30 약 2.2MB. 전체 12장면(약 6분 추정)은 CRF 26 기준 수십 MB.
- `check`: 오류 0, 경고 3(장면 파일당 요소 수 안내), 정보 3(의도한 확대에 따른 컨테이너 넘침).
- 미검증: 내레이션(TTS), GitHub Actions 렌더, 전체 12장면 렌더 시간, 안드로이드 재생 확인.

MP4는 저장소에 커밋하지 않는다(`.gitignore`). 배포 시 Release 또는 Actions artifact 사용 예정.
