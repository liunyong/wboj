# WBOJ 검증 안내

명령은 저장소 루트에서 실행한다. 실행 기록은 [docs/handoff.md](docs/handoff.md)에 남긴다. 테스트 결과와 실제 운영 통합 검증을 구분한다.

## 자동 검사

```bash
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
docker compose config --quiet
git diff --check
```

- backend: `backend/vitest.config.mjs`, `backend/tests/setup.js`. Node 환경, 테스트별 mongodb-memory-server, supertest, 명시적인 Judge0 mock. 최초 Mongo binary 다운로드에는 네트워크가 필요할 수 있다. 테스트는 실제 운영 Mongo를 사용하도록 바꾸지 않는다.
- frontend: `frontend/vite.config.js`의 test 설정과 `frontend/vitest.setup.js`. Vitest + jsdom + Testing Library, 기능 옆의 `*.test.jsx`/`*.test.js`.
- CI: `.github/workflows/ci.yml`에서 Node 22로 두 프로젝트의 `npm ci`와 `npm test`, frontend build, backend JS 구문 검사, 두 Docker 이미지 build를 수행한다. 자동 운영 배포는 없다.
- JS 변경 시 `node --check <변경한 파일>`도 실행한다. JSX는 Vite build로 확인한다. 현재 별도 lint 스크립트는 없다.

관련 파일만 검사하는 예:

```bash
npm test --prefix backend -- tests/submission.routes.test.js tests/resubmit_updates_same_submission.test.js
npm test --prefix frontend -- src/pages/ProblemsPage.test.jsx
```

시간 제한 실패는 동일 명령을 단독 실행해 재현 여부를 기록한다. timeout만 늘려 기본 검사가 통과했다고 보고하지 않는다. 코드 변경 후 영향 검사와 push 전 backend 전체 검사를 수행한다.

## 수동 확인 범위

개발/검증 전용 계정과 DB에서 수행한다. 가입·이메일·Turnstile은 실제 구성 없이는 끝까지 검증할 수 없다. seed를 테스트 준비 단계에서 자동 실행하지 않는다.

| 변경 영역 | 확인할 동작 |
| --- | --- |
| 인증/세션 | 가입 → 이메일 인증 → 로그인, 중복/입력 오류, 잘못된 비밀번호 → CAPTCHA, refresh rotation, 비밀번호 재설정, 두 탭 연장·로그아웃·유휴 만료 |
| 문제/편집 | 공개/비공개 목록, 검색·정렬·pagination, admin/저자 수정 권한, Markdown·수식·이미지, 저장 후 동일 표현, testcase 접근 제한 |
| 제출/채점 | 언어·소스 검증, 중복 진행 차단, queued/running/완료, AC·WA·CE·TLE·부분 점수, 소스 소유자 권한, SSE/재연결, 동일 제출 재채점 |
| 통계/레이팅 | 문제 counter/UTC 일별 통계, 최초 AC 중복 방지, Unrated 제외, 난이도 확정 후 재계산, 시즌 UTC 경계·결과 확정, 프로필 공개 범위 |
| 관리자 | user/admin/super_admin 권한 차이, 비활성화, 제출 soft delete, 계정 영구 삭제의 관련 데이터 정리 |
| 배포/UI | 공개 health, 새 정적 asset, SPA 직접 경로 이동, 이미지 `/api/uploads/`, 모바일 sidebar, 키보드·모달 focus |

로그인 limiter는 production에서 사용자 식별자 기준 15분/20회 실패 제한이다. 성공 로그인은 실패 카운트에서 제외한다. 다만 로그인 실패 3회부터 CAPTCHA가 별도로 요구되므로 단순 curl 반복만으로 전체 인증 흐름을 검증할 수 없다. 회원가입·인증 재발송·비밀번호 재설정에도 Turnstile과 별도 제한이 있다. 공유 계정/운영 IP의 제한을 테스트로 소모하지 않는다.

## 이번 문서 작업의 검증 경계

경로·npm script·Compose 서비스 이름은 저장소와 대조한다. seed/migration/backfill, 실제 메일·Turnstile·AI 호출, Judge0 실채점, 운영 서비스 재배포는 문서 확인을 위해 실행하지 않는다. 문서만 변경했다면 테스트/빌드 결과와 미실행 범위를 명시하면 된다.
