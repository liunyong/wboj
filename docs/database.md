# DB와 데이터 작업

## 연결과 영속 저장

MongoDB 6 + Mongoose 7을 사용한다. Compose는 standalone `mongo:6.0`을 `mongodb://mongo:27017/judge0`으로 연결하고 `mongo-data` 볼륨에 저장한다. 호스트에서는 `mongodb://127.0.0.1:27017/judge0`을 사용한다. 이미지 `uploads-imgs` 볼륨은 DB 백업과 별도로 보존해야 한다.

모델 원본은 `backend/src/models/`다. 별도 SQL migration 체계는 없으며 Mongoose 스키마, 데이터 보정 스크립트, 서비스의 backfill이 함께 사용된다.

| 모델 | 주요 책임·불변 조건 |
| --- | --- |
| `User` | 고유 username/email, bcrypt password hash, role·활성/삭제 상태, 이메일 인증/재설정 hash, embedded sessions, 기본 비공개 profile |
| `Problem` | Mongo `_id`, 고유·불변 `problemId`(100000부터)와 `problemNumber`(1부터), statement·samples·비공개 testcase(1~500), 언어·제한·공개 여부·난이도 이력 |
| `Counter` | `problemId`, `problemNumber` sequence; `backend/src/services/idService.js`에서 원자적으로 할당 |
| `Submission` | user/problem 참조와 표시용 snapshot, 소스, queue 상태, testcase 결과, 최근 runs, 최초 AC·통계/레이팅 pending |
| `UserStatsDaily` | `user_stats_daily` 컬렉션, 고유 `(user, date)`; UTC 일자의 제출/AC 집계 |
| `FirstSolve` | 고유 `(user, problem)`; 평생 최초 AC 시각과 문제 삭제 시 난이도 snapshot |
| `RatingProfile` | 고유 `(user, scope)`; overall/시즌 점수·해결 수·이력·낙관적 revision |
| `Season` | UTC `[startDate, endDate)`, 활성 여부, 종료 시 결과 snapshot과 확정 시각 |
| `SeasonWriteLock` | 시즌 변경의 owner·expiresAt 잠금 |
| `Announcement`, `ProblemUpdate` | 공지와 문제 변경 기록 |

`problemId`는 URL의 공개 번호, `_id`는 내부 참조, `problemNumber`는 별도 순번이다. 혼용하지 않는다. 공개 문제 상세는 `/api/problems/:problemId`, 이전 slug는 `/api/problems/slug/:slug`로 제공한다. 반면 `POST /api/submissions` body의 `problemId`는 문자열 Mongo ObjectId를 요구한다(`backend/src/validation/submissionSchemas.js`).

중요 인덱스는 각 모델의 `schema.index()`에 있다. 제출의 부분 고유 `activeKey`는 진행 중 중복을, FirstSolve의 고유 인덱스는 중복 최초 AC를 막는다. 명시적 `syncIndexes()`로 임의 정리하지 말고 운영 인덱스와 변경 영향을 먼저 확인한다.

## 생성·갱신·삭제

- 서버 시작 시 `backfillRatings()`가 끝나야 HTTP listen이 시작된다. 데이터가 큰 환경은 시작 시간을 따로 확인한다.
- 문제 목록 접근 시 `backend/src/services/problemNumberService.js`가 누락 순번을 보정한다. 공개 번호 누락 보정은 별도 스크립트다.
- 워커는 `accountingPending`, `ratingPending`, 문제의 `difficultyRatingPending`을 복구한다. 통계 cache와 rating profile을 원본 제출/최초 AC와 구별한다.
- 제출 삭제 API는 super_admin의 soft delete다. 최초 AC에 따른 earned solve는 유지한다.
- 문제 삭제는 hard delete와 관련 제출 삭제를 수행한다. 모델의 `deleteOne`/`findOneAndDelete` hook은 FirstSolve에 난이도 snapshot을 남긴다. `deleteMany`는 이 경로를 거치지 않는다.
- 계정 soft delete와 영구 삭제는 다르다. 영구 삭제는 rating profile/first solve 정리와 확정 시즌 결과 익명화도 포함하므로 `backend/src/controllers/userController.js`를 확인한다.

## 운영 스크립트

아래는 **목록이며 일괄 실행 순서가 아니다**. 명령은 저장소 루트 기준이다. 적용 전 명시적 `MONGO_URI`, 대상 DB, 백업과 복구 방법을 확인한다. 스크립트마다 fallback DB 이름이 달라 기본값에 의존하지 않는다. `npm --prefix backend`는 backend를 작업 디렉터리로 사용하므로 일반 dotenv는 `backend/.env`를 읽는다.

| 명령 | 실제 동작 / 주의 |
| --- | --- |
| `npm run seed --prefix backend` | admin이 없으면 생성, **모든 Problem과 두 문제 Counter 삭제**, A+B 삽입. 다른 데이터는 초기화하지 않아 참조 불일치 가능. 새 개발 DB 전용 |
| `npm run backfill:problem-ids --prefix backend` | 누락 problemId를 100000 이상에서 순차 할당하고 counter 갱신 |
| `npm run migrate:submissions --prefix backend` | 제출 표시 snapshot/상태·시간/메모리 필드, 누락 profilePublic, 조회 인덱스 보정. fallback DB는 `wboj` |
| `npm run migrate:roles --prefix backend` | 현재 모든 admin을 super_admin으로 승격. fallback DB는 `online-judge`; 일반 관리 명령으로 반복하지 않는다 |
| `npm run backfill:ratings --prefix backend` | 최초 AC·레이팅·시즌 결과 보정; 시작 시 실행하는 함수와 동일. 문제/샘플 초기화 없음 |
| `npm run clean:highlighted-submissions --prefix backend -- --dry-run --limit=20` | 하이라이트 HTML이 섞인 소스의 변경 예시만 출력. 기본도 dry run; 출력에 소스가 있으므로 공유 주의 |
| `npm run clean:highlighted-submissions --prefix backend -- --execute --limit=20` | 위 정리 내용을 실제 저장; 백업·preview 검토 후 적용 |

컨테이너에서는 같은 script를 `docker compose exec -T backend npm run backfill:ratings`처럼 실행할 수 있다. 배포 환경변수와 볼륨을 사용하므로 실제 DB 변경이다. 이 문서 정리 작업에서는 seed·migration·backfill을 수동 실행하지 않았다.

## 백업과 복구 확인

현재 저장소에는 예약 백업·복구 자동화가 없다. 운영 작업 전 Mongo 전체 데이터/인덱스와 이미지 볼륨을 함께 보존하고 별도 DB에서 복구를 확인한다. 코드의 삭제 hook, FirstSolve snapshot, archived season 결과도 백업 대상이다. `docker compose down -v`는 영속 볼륨 삭제이므로 일반 재배포 절차에 사용하지 않는다. 최초 AC가 영구 삭제되거나 과거 runs에서 사라진 경우 backfill로 원래 시각을 복구할 수 없는 한계는 [레이팅 문서](ratings.md)에 있다.
