import assert from 'node:assert/strict';
import {
	domainMatchesList,
	domainMatchesPattern,
	formatDomainList,
	isValidDomainName,
	resolveActiveDomainList
} from '../src/utils/domain-uitls.js';

async function main() {
	assert.deepEqual(
		resolveActiveDomainList('["@db-one.com", "*.db-two.com", "@db-one.com"]', ['env.com']),
		['db-one.com', '*.db-two.com']
	);

	assert.deepEqual(
		resolveActiveDomainList('', ['env.com', 'env.com', '@fallback.com']),
		['env.com', 'fallback.com']
	);

	assert.deepEqual(
		formatDomainList(['db-one.com', '@db-two.com']),
		['@db-one.com', '@db-two.com']
	);

	assert.equal(isValidDomainName('mail.example.com'), true);
	assert.equal(isValidDomainName('bad_domain'), false);
	assert.equal(isValidDomainName('http://bad.example.com'), false);
	assert.equal(isValidDomainName('*.mail.example.com', { allowWildcard: true }), true);
	assert.equal(isValidDomainName('*.bad_domain', { allowWildcard: true }), false);

	assert.equal(domainMatchesPattern('*.mail.example.com', 'team.mail.example.com'), true);
	assert.equal(domainMatchesPattern('*.mail.example.com', 'mail.example.com'), false);
	assert.equal(domainMatchesPattern('mail.example.com', 'mail.example.com'), true);
	assert.equal(domainMatchesList(['mail.example.com', '*.mail.example.com'], 'ops.mail.example.com'), true);
	assert.equal(domainMatchesList(['mail.example.com'], 'ops.mail.example.com'), false);

	console.log('domain list setting tests passed');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
