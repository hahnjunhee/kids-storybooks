# 생활동화 삽화 디자인 시스템 검토 및 개선 기획안

- 날짜: 2026-11-28
- 상태: 검토안 (미승인)
- 기준 작품: [영흥도 바다 여행](https://hahnjunhee.github.io/kids-storybooks/books/yeongheung-seaside.html)
- 범위: 생활동화 시각 스타일 및 제작 방법론. 기존 과학동화 규칙과 배포 체계는 유지.

## 1. 목표
영흥도 동화의 선호 화풍을 골드 스탠더드로 고정하고, 토스 디자인 시스템처럼 일관된 결과를 반복 생산하는 체계를 마련한다. 기존 v2.5 논의의 참조 이미지 중심 경량 프롬프트를 계승한다. main에는 v2.3 가이드와 v2.4 최종 기획안이 확인되며 v2.5의 실제 반영 여부는 별도 확인한다.

## 2. 레퍼런스 비교
| 기준 | 가져올 기술 | 우선순위 |
|---|---|---|
| 영흥도 동화 | 화풍, 색감, 감성의 최상위 기준 | P0 |
| 토스 디자인 시스템 | 공통 원칙과 재사용 가능한 설정, 디자인 토큰 | P2 |
| [Pixar](https://www.pixar.com/) | Color Script: 감정에 따른 색과 빛의 변화 | P1 |
| [Disney](https://www.disneyanimation.com/process/story/) | Visual Development, 캐릭터 모델 시트, 스토리보드 | P0 |
| [Studio Ghibli](https://www.ghibli.jp/) | 환경을 통한 서사, 자연광, 일상 디테일 | P1 |
| [Shopify Polaris](https://polaris.shopify.com/) | 삽화 목적, 필수·금지 규칙, 메시지 집중 | P1 |
| [Atlassian Design System](https://atlassian.design/) | 목적별 삽화 유형 분류 | P1 |
| [이수지 작가](https://www.suzyleebooks.com/) | 그림만으로 사건과 감정을 전달하는 시각적 서사 | P1 |
| 베아트릭스 포터 | 자연 관찰과 동식물 묘사 | P1 |
| 세계은행 어린이 도서 제작 가이드 | 연령별 이해도와 페이지 전환 | P1 |

외부 화풍을 혼합하는 것이 아니라 제작 방법론만 선별한다. 위 링크는 참고 출발점이며 세부 공식 문서 및 내부 제작 매뉴얼 검증은 미완료다.

## 3. 생활동화 아트 디렉션 (잠정)
따뜻한 손그림 질감, 자연스러운 윤곽, 풍부한 자연 색감, 인물과 배경의 조화, 과장되지 않은 표정과 행동, 시간대별 자연광을 후보 원칙으로 삼는다. 실제 영흥도 원본 추출 및 시각 비교 후 확정한다.
스타일 레퍼런스 후보: 1장 여행 준비(실내), 4장 항구(공간), 6장 수영(동작), 8장 개구리(발견), 12장 노을(감정). 번호와 적합성은 원본 대조 후 확정한다.

## 4. 핵심 기술
- Color Script: 장면별 대표 색, 명암, 감정 흐름을 사전 설계. 동일 색감 강제 금지.
- Character Model Sheet: 정면·측면·후면·표정·행동을 포함한 작품별 캐릭터 참조.
- Environmental Storytelling: 장소와 소품도 이야기를 전달하되 불필요한 배경 장식 제한.
- Shot Variation: 와이드(장소), 미디엄(관계), 클로즈업(감정), 디테일(발견)을 장면 목적에 따라 선택. 인접 장면의 과도한 구도 반복 방지.
- Design Tokens: style.reference, character.reference, scene.shot, scene.palette, composition.ratio, output.format 등 공통 설정과 장면별 설정 분리.
- Visual Storytelling Test: 본문 없이 무엇을 하는지, 어떤 감정인지, 다음 사건이 무엇일지 유추 가능한지 검수. 실제 아동 이해도 검증과 성인 검수는 구분.

## 5. KSDS 구조
Foundations(원칙) → Visual Identity(화풍·캐릭터) → Scene Direction(색감·구도) → Visual Literacy(어린이 이해) → Production(참조 이미지·경량 프롬프트) → QA(개별·통합 검수).
스타일 참조는 작품 간 재사용하고 캐릭터 참조는 작품별 관리한다. 스타일 ID만으로 이미지 생성기가 원본을 이해하지 않으므로 실제 참조 이미지를 전달해야 한다.

### 경량 프롬프트 예시
생활동화 스타일: YEONGHEUNG-LIFE-v1.0. 첨부 스타일 이미지와 캐릭터 마스터 레퍼런스 적용.
장면: 루아가 아빠와 비가 그친 공원을 산책하다 달팽이를 발견한다.
구도: 아이 눈높이, 측면 중거리.
강조: 젖은 나뭇잎, 호기심, 구름 사이 햇살.
가로 4:3, 단독 삽화, 문자 없음.

## 6. 검수 기준 (잠정 100점)
화풍 25, 본문 일치 20, 캐릭터 일관성 15, 배경·공간 15, 행동·감정 10, 구도 다양성 10, 기술 완성도 5. 권장 승인 90점. 캐릭터 오류, 본문 불일치, 과도한 장면 유사성은 점수와 무관하게 재검수. 기존 C형 과학 관찰·도감·원리 설명 삽화의 아이 제외 규칙 유지.

## 7. 실행 순서
1. 영흥도 HTML 내 원본 삽화 추출 및 전체 비교.
2. 스타일 참조 5장 후보 검증 및 선정.
3. 생활동화 스타일 가이드 초안 작성.
4. 실내·야외·감정 장면 테스트 생성.
5. 원본 대비 화풍, 캐릭터, 구도 및 본문 일치 검수.
6. 사용자 승인 후 기존 가이드에 연결 및 버전 확정.
7. 디자인 토큰 및 독립 KSDS 문서화는 필요성이 확인될 때 진행.

## 8. 한계와 변경 통제
현재 원본 삽화의 직접 시각 검증은 미완료이며 화풍 분석, 점수, 참조 후보는 잠정안이다. 외부 스튜디오 내부 매뉴얼을 확인했다고 간주하지 않는다. 기존 동화, 제작 가이드, 자동화, 배포 파일은 수정하지 않는다. 별도 브랜치에서 검토하고 승인 후 병합한다.


## 9. 통합 결정 — KSDS v1.1 (사용자 승인 2026-11-28)
GPT 기획안을 우선하며 [Claude 검토안](https://github.com/hahnjunhee/my-claude/blob/ccr-9489ffc9-uforws/docs/plans/kids-storybook-design-references.md)은 선택적으로 반영한다. 이 절은 앞선 잠정안에 우선한다. 승인 범위는 개선 방향이며 실제 스타일 검증 완료를 의미하지 않는다.

### 채택
- MUST / SHOULD / MAY / MUST NOT / EXAMPLE 등급으로 규칙 관리. 캐릭터 정체성·본문 일치·4:3은 MUST, 자연광·구도 차별화는 SHOULD, 형태 언어·역광은 MAY, 워터마크·불필요한 문자·외형 변형은 MUST NOT.
- Color Script는 기존 장면 명세에 emotion, lighting, palette, shot, reference를 추가하는 경량 방식. 신규 DB 불필요.
- 기존 제작 가이드와 충돌 방지. 기존 과학 C형 규칙 유지.
- 출처 검증 수준 구분: 공식 원문, 2차 자료, 경험적 판단.
- 형태 언어와 정적 삽화에 유용한 동작 원칙(anticipation, staging, 제한적 exaggeration)은 선택 적용.
- 외부 스튜디오명 대신 구도·조명·질감 등 구체적 특성으로 프롬프트 작성.
- 실제 모바일 열람과 어린이 반응은 AI 자체 검수와 별도 기록.

### 통합 구조
Gold Standard → Foundations → Visual Identity → Scene Direction → Shape & Motion → Visual Literacy → Reference Library → Production → QA → Feedback Loop.
Reference Library는 Gold Standard, Approved Examples, Anti-patterns, Character Masters, Composition Patterns, Style References로 구분한다. 기존 파일과 명세를 재사용하고 승인 이미지 및 실패 원인을 축적한다. 별도 앱이나 DB는 만들지 않는다.

### 범위 제외
토스 UX Writing, Material 3 UI 토큰, 접근성 수치, 초기 독자 타이포, 발견 노트 컴포넌트는 별도 UI/본문 개선 과제로 보류. Diátaxis, Evergreen notes, Notion/LLM-Wiki 경계는 제외. CMYK 및 Lexile도 이번 범위에서 제외.

### 실행 게이트
P0: 원본 추출·시각 검증 → 스타일 참조 선정 → 캐릭터/화풍 분리 → 규칙 등급화 → 경량 프롬프트.
P1: 장면 명세 Color Script → 구도·형태 언어 → 실내/야외/감정 테스트 → 우수/실패 사례 기록.
P2: 실제 열람 평가 → 승인 이미지 재사용 → 기존 가이드 연동 → 최종 문서 확정.
원본 직접 검증 전에는 화풍 수치나 색상값을 확정하지 않는다. 외부 출처 전체 재검증도 미완료다. 단일 기준 저장소는 kids-storybooks이며 my-claude 원문은 수정하지 않는다.
