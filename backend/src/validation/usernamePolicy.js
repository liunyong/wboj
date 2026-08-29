const RESERVED_NAMES = [
  'admin',
  'administrator',
  'moderator',
  'support',
  'staff',
  'official',
  'system',
  'root',
  'superuser',
  'webmaster',
  'wboj'
];

const PROHIBITED_FRAGMENTS = [
  'bitch',
  'cunt',
  'faggot',
  'fuck',
  'nazi',
  'nigga',
  'nigger',
  'retard',
  'shit',
  'slut',
  'whore'
];

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g'
};

const normalizeUsername = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[01345789]/g, (character) => LEET_MAP[character] ?? character)
    .replace(/_/g, '');

export const usernameMeetsPolicy = (value) => {
  const compact = String(value || '').toLowerCase().replace(/_/g, '');
  const normalized = normalizeUsername(value);
  const collapsed = normalized.replace(/(.)\1+/g, '$1');

  if (
    RESERVED_NAMES.some(
      (name) =>
        normalized === name ||
        compact === name ||
        new RegExp(`^${name}\\d+$`).test(compact)
    )
  ) {
    return false;
  }

  return !PROHIBITED_FRAGMENTS.some(
    (fragment) => normalized.includes(fragment) || collapsed.includes(fragment)
  );
};

export const USERNAME_POLICY_MESSAGE = 'Username does not meet our naming policy';
