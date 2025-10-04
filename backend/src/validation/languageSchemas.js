import { z } from 'zod';

const booleanFromQuery = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

export const listLanguagesQuerySchema = z
  .object({
    forceRefresh: booleanFromQuery.optional().default(false)
  })
  .strict();
