# Mind Canvas 배포 가이드

## 파일 구조
```
mind-canvas/
├── index.html       ← 프론트엔드 (API 키 없음)
├── vercel.json      ← Vercel 설정
├── README.md
└── api/
    ├── chat.js      ← Claude API 서버 함수
    └── image.js     ← Gemini 이미지 생성 서버 함수
```

## 배포 순서

### 1단계 — GitHub 업로드
1. github.com 접속 → New repository → `mind-canvas` 이름으로 생성
2. 이 폴더 전체를 업로드 (파일 드래그 or git push)

### 2단계 — Vercel 연결
1. vercel.com 접속 → 구글/깃허브 계정으로 로그인
2. "Add New Project" → GitHub 저장소 선택
3. "Deploy" 클릭 (설정 변경 불필요)

### 3단계 — 환경변수 등록 (API 키)
Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

| 이름 | 값 |
|------|-----|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (Claude 키) |
| `GEMINI_API_KEY` | `AIza...` (Gemini 키) |

등록 후 → Deployments 탭 → "Redeploy" 클릭

### 4단계 — 완료
Vercel이 자동으로 `https://mind-canvas-xxx.vercel.app` 주소를 생성해줘요.
커스텀 도메인도 무료로 연결 가능해요.

## 보안
- API 키는 서버(Vercel)에만 저장되어 브라우저에 노출되지 않아요
- 모든 API 호출은 서버를 거쳐서 이루어져요
