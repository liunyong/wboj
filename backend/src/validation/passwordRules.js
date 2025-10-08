const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

const CHARACTER_CLASSES = [
  { test: /[a-z]/, label: 'lowercase letter' },
  { test: /[A-Z]/, label: 'uppercase letter' },
  { test: /\d/, label: 'digit' },
  { test: /[^A-Za-z0-9]/, label: 'symbol' }
];

const hasRequiredClasses = (value) =>
  CHARACTER_CLASSES.reduce((count, rule) => (rule.test.test(value) ? count + 1 : count), 0) >= 3;

const hasDisallowedIdentitySubstring = (passwordLower, identity) => {
  if (!identity || identity.length < 4) {
    return false;
  }

  for (let length = 4; length <= identity.length; length += 1) {
    for (let start = 0; start <= identity.length - length; start += 1) {
      const segment = identity.slice(start, start + length);
      if (segment && passwordLower.includes(segment)) {
        return true;
      }
    }
  }

  return false;
};

export const getPasswordStrengthIssues = (password, { username, email } = {}) => {
  const issues = [];

  if (typeof password !== 'string' || !password.length) {
    issues.push('Password is required');
    return issues;
  }

  if (password.length < MIN_LENGTH) {
    issues.push(`Password must be at least ${MIN_LENGTH} characters long`);
  }

  if (password.length > MAX_LENGTH) {
    issues.push(`Password must be at most ${MAX_LENGTH} characters long`);
  }

  if (/\s/.test(password)) {
    issues.push('Password must not contain whitespace characters');
  }

  if (/(.)\1\1/.test(password)) {
    issues.push('Password must not repeat the same character more than twice in a row');
  }

  if (!hasRequiredClasses(password)) {
    issues.push(
      'Password must include at least three of: lowercase letter, uppercase letter, digit, symbol'
    );
  }

  const passwordLower = password.toLowerCase();
  const identityCandidates = [];

  if (username) {
    identityCandidates.push(String(username).toLowerCase());
  }

  if (email) {
    const [localPart] = String(email).toLowerCase().split('@');
    if (localPart) {
      identityCandidates.push(localPart);
    }
  }

  if (
    identityCandidates.some((identity) => hasDisallowedIdentitySubstring(passwordLower, identity))
  ) {
    issues.push('Password must not contain your username or email handle');
  }

  return issues;
};

export default getPasswordStrengthIssues;
