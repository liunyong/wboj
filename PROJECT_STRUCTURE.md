# WBOJ 구조 안내

상세 구조와 처리 흐름은 [docs/architecture.md](docs/architecture.md)에서 관리한다.

- 새 작업의 진입점·검증 명령·읽을 문서: [AGENTS.md](AGENTS.md)
- 로컬 실행과 문서 목록: [README.md](README.md)
- 모델과 데이터 작업: [docs/database.md](docs/database.md)
- 운영 구성: [docs/deployment.md](docs/deployment.md)
- 확인된 후속 작업: [docs/handoff.md](docs/handoff.md)

일반 구조 설명은 architecture에서 관리하며, Java Class Writing의 코드 지도와 작성 안내는 아래에 기록한다.

## Problem list and detail navigation

- `frontend/src/hooks/useProblemArchive.js` loads every API page for the current visibility and user. `pages/ProblemsPage.jsx` filters and sorts the complete archive before display pagination.
- `frontend/src/utils/problemList.js` shares URL option parsing, search/tag filtering, and sorting between the list and `components/ProblemNavigation.jsx`. Tag selection retains the existing single-select behavior: exact tag matching, with the first `tag` value used if a URL repeats the parameter. Search combines with the selected tag.
- List problem links carry the list query (`tag`, `q`, `visibility`, `sort`, `limit`, `page`) into the detail URL. Previous/Next preserve that query and traverse all matching results in list order across display pages; Problems returns to the original list view. The URL also restores context on reload or opening a link in another tab.
- With no active search/tag/visibility filter, including direct problem URLs without context, arrows retain full-archive ascending-ID navigation. Missing neighbors use the existing disabled arrow buttons. Flow coverage is in `pages/ProblemNavigationFlow.test.jsx`; archive controls and direct navigation also have their existing tests.

## Markdown rendering

- `frontend/src/components/ProblemEditor.jsx` (live preview) and `frontend/src/pages/ProblemDetailPage.jsx` (published statement and other Markdown sections) share `components/ProblemStatement.jsx`.
- `ProblemStatement` sanitizes with `utils/markdown.js`, then renders through react-markdown, remark-gfm, remark-math, rehype-raw and rehype-katex. Inline code stays native `<code>` inside its paragraph/list item; the `pre` component sends fenced/indented blocks to the existing `CodeBlock.jsx`, which owns the single `<pre><code>` wrapper and language class. react-markdown v9 no longer supplies `code.inline`.
- `frontend/src/styles.css` gives inline code its compact style and scopes block layout to `.markdown-body pre`. Renderer coverage is in `components/ProblemStatement.test.jsx`; editor/published-page regression coverage is in `components/ProblemMarkdown.test.jsx`.

## Java Class Writing (AP CSA)

- `backend/src/models/Problem.js`, `validation/problemSchemas.js`, `controllers/problemController.js`: `mode` (`stdin` default / `java_class`), required `className`, optional `starterCode`, test groups stored in `testCases` (`input`: full teacher Main.java, `output`: expected stdout, `points`, `visibility`). Existing records need no migration.
- `backend/src/services/javaClassService.js`: identifier/group validation, ZIP and server-owned compile/run scripts, cached live Judge0 capability probe, safe compiler feedback.
- `services/testCaseRunnerService.js`, `judge0Service.js`, `submissionService.js`, `controllers/submissionController.js`: independent group execution with language 89/additional_files, Java-only student language 62, weighted score, existing persistent queue/accounting/refresh. Java rejudges queue the same submission with the active-key lock; counters are recomputed, not incremented per group.
- `frontend/src/components/ProblemEditor.jsx`, `pages/ProblemDetailPage.jsx`, `components/SubmissionViewerModal.jsx`: authoring, class name/starter/public groups, safe group scores and compiler guidance.
- `backend/tests/javaClass.test.js`, `tests/fixtures/rectangle.json`: API/privacy/rejudge coverage and Rectangle examples.

### Authoring

Choose **Java Class Writing (AP CSA)**. Specify a class name such as `Rectangle` (not `Main`, a Java keyword, a path or a package-qualified name), and optionally supply starter source. Describe the required public constructors, method names, parameter/return types and behavior in the statement. Select at least 512 MB memory on the current OpenJDK 13 Judge0; JVM virtual-memory reservation needs more than the standard 128 MB default. Existing CPU and memory fields remain the actual sandbox limits; the server does not silently lift them.

Add one or more groups whose integer points total **100**. Each group contains a complete `public class Main` with `public static void main(String[] args)`, instantiates the student class and prints values. Set expected stdout (an empty string is valid) and Public/Private visibility. Only public groups are published. Each group compiles/runs separately; public and private groups both count. Standard output comparison keeps the existing trim-at-both-ends behavior. Students submit only their class source using Java. The Rectangle fixture uses 30 points for constructor/area, 30 for setWidth/getArea and 40 for two-instance independence.

Judge0 must advertise multi-file language 89 and actually compile/run the Java ZIP probe. The ZIP contains the student class, teacher `Main.java`, and fixed server `compile` / `run` scripts. Annotation processing and sandbox networking are disabled. The JVM uses a 32 MB heap and interpreted execution with bounded metadata/stack settings, suitable for small AP CSA exercises; authors should consider these additional limits when writing tests. A failed capability check returns `JAVA_CLASS_CONFIGURATION` with an administrator-facing setup instruction. Successful checks are cached for five minutes per backend process.

Private test source, expected/actual output, stderr, raw compilation logs and Judge0 run errors are omitted from Java student response DTOs, including submission owners. Compiler feedback reports student file line numbers when available or asks the student to check the published constructor/method signatures; it never quotes teacher compiler excerpts. Teacher test code should contain no secrets.

This is a **classroom practice grader**, not a tamper-resistant exam system. Student and teacher code share a filesystem and JVM; reflection, file reads, process termination, output spoofing, or other adversarial code can inspect or interfere with the harness. API redaction cannot isolate those runtime components. Use a separately designed isolated assessment system for hostile submissions or high-stakes exams.

After deployment, run the real Judge0 check without creating users, problems or submissions in MongoDB:

```bash
docker compose exec -T backend node scripts/verify-java-class.js < backend/tests/fixtures/rectangle.json
```

This verifies the capability probe, correct/signature/static Rectangle variants, safe result projection, empty expected stdout and an ordinary Python stdin/stdout problem. API queue/permissions/rejudge/counter checks run against an isolated in-memory database in `npm test --prefix backend -- tests/javaClass.test.js` with a mocked Judge0 transport.
