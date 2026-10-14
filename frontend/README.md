# WBOJ Frontend

React + Vite SPA. `src/main.jsx`에서 provider를 구성하고 `src/App.jsx`에서 화면을 연결한다. API 인증/refresh는 `src/context/AuthContext.jsx`가 담당한다.

저장소 루트에서:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

개발은 기본 5173, preview는 4173 포트다. preview는 build 후 실행한다. frontend 디렉터리에서 실행할 때는 `--prefix frontend`를 생략한다.

`VITE_API_URL`은 브라우저 API base URL이자 개발 서버 `/api` 프록시 대상이다. 미지정 시 동일 출처 요청을 개발 프록시가 backend 4000으로 전달한다. 현재 Vite 8의 preview도 `server.proxy` 설정을 상속한다. `VITE_*`는 빌드 시 번들에 고정되므로 서버 비밀값을 넣지 않는다. Docker의 Nginx는 SPA fallback과 `/api/` 프록시를 제공하며 Compose에는 frontend 호스트 3000 포트 매핑이 없다.

- [로컬 설정](../README.md#로컬-개발), [구조와 흐름](../docs/architecture.md)
- [운영 빌드·배포](../docs/deployment.md), [검증](../TEST_PLAN.md)
- [문제 작성](../docs/authoring-math.md), [세션](../docs/security/session.md), [레이팅](../docs/ratings.md)
