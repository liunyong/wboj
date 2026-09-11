import { describe, expect, it } from 'vitest';

import { applyEventToSubmissionList } from './submissions.js';

describe('applyEventToSubmissionList', () => {
  it('removes a submission when a deletion event arrives', () => {
    const submissions = [
      { _id: 'deleted-id', status: 'running' },
      { _id: 'remaining-id', status: 'accepted' }
    ];

    const result = applyEventToSubmissionList(submissions, {
      _id: 'deleted-id',
      type: 'submission:deleted',
      deletedAt: new Date().toISOString()
    });

    expect(result).toEqual([{ _id: 'remaining-id', status: 'accepted' }]);
  });
});
