// Runs sandbox checks only; never connects to or writes a WBOJ database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateSubmissionRun } from '../src/services/submissionService.js';
import { ensureJavaClassSupport, safeJavaResults } from '../src/services/javaClassService.js';

const fixture = JSON.parse(readFileSync(0, 'utf8'));
await ensureJavaClassSupport();
console.log('Judge0 multi-file/JDK probe: passed');
const problem = { mode: 'java_class', className: 'Rectangle', testCases: fixture.groups,
  cpuTimeLimit: 2, memoryLimit: 512 };
const variants = [
  ['correct', fixture.correct, 100, 'AC'],
  ['wrong signature', fixture.correct.replace('setWidth(int w)', 'setWidths(int w)'), 30, 'CE'],
  ['static width', fixture.correct.replace('private int width, height;', 'private static int width; private int height;'), 60, 'PARTIAL']
];
for (const [name, sourceCode, score, verdict] of variants) {
  const result = await evaluateSubmissionRun({ submission: { sourceCode, languageId: 62 }, problem });
  assert.equal(result.score, score);
  assert.equal(result.verdict, verdict);
  const safe = safeJavaResults(result);
  for (const group of safe) {
    for (const field of ['input', 'output', 'stdout', 'stderr', 'message']) assert.equal(group[field], undefined);
  }
  if (verdict === 'CE') assert.ok(safe.some((group) => group.compileOutput.includes('constructor and public method signatures')));
  console.log(`${name}: ${score}/100 ${verdict}; student result redaction passed`);
}
const empty = await evaluateSubmissionRun({ submission: { sourceCode: fixture.correct, languageId: 62 },
  problem: { ...problem, testCases: [{ input: 'public class Main { public static void main(String[] args) {} }', output: '', points: 100 }] } });
assert.equal(empty.verdict, 'AC');
console.log('Intentionally empty expected output: 100/100 AC');
const normal = await evaluateSubmissionRun({ submission: { languageId: 71, sourceCode: 'print(sum(map(int, input().split())))' },
  problem: { testCases: [{ input: '1 2', output: '3', points: 1 }], cpuTimeLimit: 2, memoryLimit: 128 } });
assert.equal(normal.verdict, 'AC');
console.log('Existing stdin/stdout Python: 100/100 AC');
