import AdmZip from 'adm-zip';
import { fetchJudge0Languages, runJudge0Submission } from './judge0Service.js';

const reserved = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _ var yield record sealed permits Main').split(' '));
export const isJavaClassName = (name) => typeof name === 'string' &&
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !reserved.has(name);

export const validateProblemMode = (problem) => {
  if (problem.mode !== 'java_class') {
    return problem.testCases?.every((item) => item.input && item.output) ? null : 'Input and output are required';
  }
  if (problem.memoryLimit != null && problem.memoryLimit < 512) return 'Java Class Writing requires at least 512 MB for JVM startup on this Judge0 instance';
  if (!isJavaClassName(problem.className)) return 'Required Java class name must be a valid identifier other than Main or a reserved word';
  if (!problem.testCases?.length || problem.testCases.length > 500) return 'Define between 1 and 500 test groups';
  if (problem.testCases.reduce((sum, item) => sum + item.points, 0) !== 100) return 'Java test groups must total exactly 100 points';
  if (problem.testCases.some((item) => !/\bpublic\s+class\s+Main\b/.test(item.input) || !/\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(?:\[\]\s*\w+|\w+\s*\[\])\s*\)/.test(item.input))) {
    return 'Each group requires Java test code with public static void main(String[] args) in class Main';
  }
  return null;
};

// Only server-owned scripts enter the archive; className cannot contain paths or shell syntax.
export const buildJavaArchive = ({ className, sourceCode, testCode }) => {
  if (!isJavaClassName(className)) throw new Error('Invalid Java class name');
  const zip = new AdmZip();
  const jdk = 'for d in /usr/local/openjdk* /usr/lib/jvm/* /opt/java/openjdk; do if [ -x "$d/bin/javac" ]; then export PATH="$d/bin:$PATH"; break; fi; done\n';
  const files = {
    [`${className}.java`]: sourceCode,
    'Main.java': testCode,
    compile: `#!/bin/bash\nset -eu\n${jdk}javac -encoding UTF-8 -proc:none '${className}.java' Main.java\n`,
    run: `#!/bin/bash\nset -eu\n${jdk}unset JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS _JAVA_OPTIONS\nexec java -XX:+UseSerialGC -XX:-UseCompressedOops -XX:-UseCompressedClassPointers -Xint -Xms8m -Xmx32m -Xss256k -XX:ReservedCodeCacheSize=8m -XX:MaxMetaspaceSize=32m -XX:CompressedClassSpaceSize=8m -cp . Main\n`
  };
  for (const [name, value] of Object.entries(files)) zip.addFile(name, Buffer.from(value), '', 0o100755);
  return zip.toBuffer().toString('base64');
};

let capability;
let checkedAt = 0;
let checkedUrl;
export const ensureJavaClassSupport = async () => {
  const url = process.env.JUDGE0_URL;
  if (checkedUrl !== url || Date.now() - checkedAt > 300000) capability = null;
  if (!capability) {
    checkedUrl = url;
    checkedAt = Date.now();
    capability = (async () => {
      const languages = await fetchJudge0Languages();
      if (!languages.some((item) => item.id === 89)) throw new Error('Multi-file language 89 is unavailable');
      const result = await runJudge0Submission({ languageId: 89,
        additionalFiles: buildJavaArchive({ className: 'WbojProbe', sourceCode: 'public class WbojProbe { public int value() { return 42; } }',
          testCode: 'public class Main { public static void main(String[] args) { System.out.println(new WbojProbe().value()); } }' }),
        expectedOutput: '42\n', cpuTimeLimit: 2, memoryLimit: 524288, enableNetwork: false });
      if (result.status?.id !== 3 || Buffer.from(result.stdout || '', 'base64').toString().trim() !== '42') {
        throw new Error('Multi-file Java compile/run probe failed');
      }
      checkedAt = Date.now();
    })().catch(() => {
      capability = null;
      const error = new Error('Java Class Writing is unavailable: configure Judge0 multi-file language 89 and a usable JDK (javac/java). Contact the administrator.');
      error.status = 503;
      error.code = 'JAVA_CLASS_CONFIGURATION';
      throw error;
    });
  }
  return capability;
};

// Never echo compiler text: javac diagnostics may embed teacher source, literals or arbitrary student text.
export const javaCompilerFeedback = (output, className) => {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = [...output.matchAll(new RegExp(`(?:^|\\n)${escaped}\\.java:(\\d+): error:`, 'g'))]
    .map((match) => Number(match[1])).filter((line) => Number.isSafeInteger(line) && line > 0);
  return lines.length
    ? `${className}.java: compilation failed at line(s) ${[...new Set(lines)].slice(0, 20).join(', ')}. Check Java syntax, types and the required public class interface.`
    : `Compilation failed: check that public class ${className} provides the constructor and public method signatures specified in the problem (including parameter and return types).`;
};

export const safeJavaResults = (submission) => (submission.testCaseResults || []).map((item) => ({
  index: item.index, points: item.points, passed: item.passed, status: { id: item.status?.id, description: ({ 3: 'Accepted', 4: 'Wrong Answer', 5: 'Time Limit Exceeded', 6: 'Compilation Error' })[item.status?.id] || 'Runtime Error' },
  time: item.time, memory: item.memory, compileOutput: item.feedback || ''
}));
