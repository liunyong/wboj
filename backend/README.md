# WBOJ Backend

Express ESM API + MongoDB + 외부 Judge0 연동. 프로세스 시작은 `src/server.js`, HTTP 구성은 `src/app.js`, 설정 기본값은 `src/config/env.js`다.

저장소 루트에서:

```bash
npm ci --prefix backend
npm run dev --prefix backend
npm start --prefix backend
npm test --prefix backend
```

`dev`와 `start`는 선택해서 실행한다. API 기본 포트는 4000이며 실행 전 MongoDB와 `backend/.env`를 준비한다. backend 디렉터리에서 실행할 때는 각 명령의 `--prefix backend`를 생략한다.

- [로컬 설정](../README.md#로컬-개발)
- [구성·API·채점 흐름](../docs/architecture.md)
- [모델·인덱스·seed·보정 스크립트](../docs/database.md)
- [환경변수·배포](../docs/deployment.md)
- [인증·세션](../docs/security/session.md), [레이팅](../docs/ratings.md)
- [검증 절차](../TEST_PLAN.md), [현재 후속 작업](../docs/handoff.md)

테스트는 mongodb-memory-server와 명시적인 Judge0 mock을 사용한다. 실제 Judge0 장애 시 자동으로 mock으로 바뀌는 운영 동작은 없다. seed는 기존 문제를 삭제하므로 일반 시작 명령으로 사용하지 않는다.
