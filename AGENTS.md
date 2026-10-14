# WBOJ 작업 안내

WBOJ는 문제 작성·코드 제출·Judge0 채점·활동 통계·포트폴리오 레이팅을 제공하는 온라인 저지다. Node.js 22 / Express / MongoDB API와 React / Vite SPA를 Docker Compose로 운영한다. Judge0는 이 저장소 밖에서 운영한다.

## 작업 시작

- 기존 변경을 `git status --short`로 확인하고 보존한다. 아래에서 작업에 필요한 문서만 읽는다.
- 실행 환경과 문서 목록: [README.md](README.md)
- 구성·요청/채점 흐름·코드 위치를 찾을 때: [docs/architecture.md](docs/architecture.md)
- 미완료 작업을 이어받거나 현재 한계를 확인할 때: [docs/handoff.md](docs/handoff.md)
- 모델·인덱스·seed·마이그레이션·데이터 삭제를 다룰 때: [docs/database.md](docs/database.md)
- 환경변수·Docker·프록시·운영 장애·배포를 다룰 때: [docs/deployment.md](docs/deployment.md)
- 인증·세션: [docs/security/session.md](docs/security/session.md)
- 레이팅·시즌·AI 난이도: [docs/ratings.md](docs/ratings.md)
- 문제 편집·Markdown·수식·이미지: [docs/authoring-math.md](docs/authoring-math.md)
- 검증 범위를 정할 때: [TEST_PLAN.md](TEST_PLAN.md)

## 주요 진입점

- API 시작: `backend/src/server.js`; 미들웨어·라우터·health: `backend/src/app.js`; 기본 설정: `backend/src/config/env.js`.
- 기능별 HTTP 처리: `backend/src/routes/`, `backend/src/controllers/`; 비즈니스 로직: `backend/src/services/`; 모델: `backend/src/models/`; Zod 검증: `backend/src/validation/`.
- 채점: `backend/src/controllers/submissionController.js` → `backend/src/services/submissionService.js` → `backend/src/services/testCaseRunnerService.js` → `backend/src/services/judge0Service.js`; 복구 워커: `backend/src/services/submissionWorkerService.js`.
- SPA 시작·라우팅: `frontend/src/main.jsx`, `frontend/src/App.jsx`; 인증/API: `frontend/src/context/AuthContext.jsx`; 화면·공통 UI: `frontend/src/pages/`, `frontend/src/components/`; 스타일: `frontend/src/styles.css`.
- 운영: `docker-compose.yml`, `Caddyfile`, `frontend/nginx.conf`, 각 서비스의 `Dockerfile`; CI: `.github/workflows/ci.yml`.

## 실행·검증 (저장소 루트 기준)

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run dev --prefix backend      # :4000, MongoDB 필요
npm run dev --prefix frontend     # :5173, 별도 터미널
npm test --prefix backend         # Vitest + mongodb-memory-server + Judge0 mock
npm test --prefix frontend        # Vitest + jsdom
npm run build --prefix frontend
npm run preview --prefix frontend # 기본 :4173, 별도 API 필요
docker compose config --quiet
git diff --check
```

`.env` 준비와 로컬/컨테이너 주소 차이는 README와 배포 문서를 따른다. seed는 기존 문제를 삭제하므로 일반 실행·검증 단계에 넣지 않는다. DB 변경 명령은 대상과 백업을 확인한 후 실행한다.

## 변경·완료 기준

- ESM, 2칸 들여쓰기, 함수/변수 `camelCase`, React/모델 `PascalCase`. 기존 구조를 따르고 Node core → 외부 패키지 → 내부 모듈 순으로 import를 정리한다.
- API 테스트는 `backend/tests/`, UI 테스트는 해당 기능 옆에 둔다. 성공·권한·입력 오류와 관련 재시도/복구 흐름을 검증한다. JS 구문은 `node --check <변경한 파일>`로 확인한다.
- 코드·설정·경로·명령·기능 정책이 바뀌면 관련 문서도 같은 변경에서 갱신한다. 미완료 항목은 handoff에 근거·다음 단계·검증 상태를 남기고, 해결 시 제거하거나 완료 표시한다. 비밀값은 기록하지 않는다.
- push 전 백엔드 전체 테스트를 실행한다. 변경 영향에 맞는 UI 테스트·빌드도 실행하고, 실패/미실행 항목을 보고한다. 커밋 제목은 72자 이내 명령형; PR에는 동작 변화·검증 명령·환경변수·관련 UI 이미지를 포함한다.
- 애플리케이션/배포 설정 변경은 관련 검사 후 **영향받는 서비스만** 기존 Compose로 재빌드·배포하고 상태와 공개 엔드포인트를 확인한다. 배포는 추가 확인 없이 허용된다. 사용자가 제외한 경우 또는 문서만 변경한 경우 서비스 재배포는 필요 없다.
