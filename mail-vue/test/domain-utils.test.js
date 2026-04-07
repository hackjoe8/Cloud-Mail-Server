import assert from 'node:assert/strict';

import {
  buildEmailAddress,
  extractCreatableDomainOptions,
  isValidDomain,
  isWildcardDomainRule,
  matchesDomainRule,
  matchesDomainRuleList,
  normalizeDomainValue,
  parseDomainBatchInput
} from '../src/utils/domain.js';

async function main() {
  assert.equal(normalizeDomainValue('@*.Example.COM'), '*.example.com');
  assert.equal(isValidDomain('*.example.com', { allowWildcard: true }), true);
  assert.equal(isValidDomain('*.bad_domain', { allowWildcard: true }), false);
  assert.equal(isWildcardDomainRule('*.example.com'), true);
  assert.equal(matchesDomainRule('*.example.com', 'mail.example.com'), true);
  assert.equal(matchesDomainRule('*.example.com', 'example.com'), false);
  assert.equal(matchesDomainRuleList(['foo.com', '*.example.com'], 'mail.example.com'), true);
  assert.deepEqual(
    parseDomainBatchInput('foo.com\n*.bar.com  @foo.com'),
    ['foo.com', '*.bar.com']
  );
  assert.deepEqual(
    extractCreatableDomainOptions(['@foo.com', '@*.bar.com', '@mail.cc']),
    ['@foo.com', '@mail.cc']
  );
  assert.equal(buildEmailAddress('user', '@foo.com'), 'user@foo.com');
  assert.equal(buildEmailAddress('user@mx.bar.com', '@foo.com'), 'user@mx.bar.com');

  console.log('domain utils tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
