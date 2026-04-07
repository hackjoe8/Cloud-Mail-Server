import assert from 'node:assert/strict';
import {
  buildAllEmailLatestParams,
  shouldPollAllEmailLatest
} from '../src/views/all-email/all-email-latest-utils.js';

async function main() {
  const params = {
    type: 'receive',
    userEmail: 'user@example.com',
    accountEmail: null,
    name: 'alice',
    subject: 'invoice',
    timeSort: 0
  };

  assert.deepEqual(
    buildAllEmailLatestParams(321, params),
    {
      emailId: 321,
      type: 'receive',
      userEmail: 'user@example.com',
      accountEmail: null,
      name: 'alice',
      subject: 'invoice'
    }
  );

  assert.equal(
    shouldPollAllEmailLatest({ autoRefresh: 5, latestId: 321, params }),
    true
  );

  assert.equal(
    shouldPollAllEmailLatest({ autoRefresh: 5, latestId: 321, params: { ...params, type: 'send' } }),
    false
  );

  console.log('all-email latest utils tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
