import assert from 'node:assert/strict';
import { normalizeSubmittedRawMime } from '../src/runtime/smtp/send-outbound-email.js';

async function main() {
	const fromName = '哈基米公益站';
	const subjectText = '测试中文标题';
	const mojibakeFrom = Buffer.from(fromName, 'utf8').toString('latin1');
	const mojibakeSubject = Buffer.from(subjectText, 'utf8').toString('latin1');
	const expectedBody = Buffer.from(`${fromName} hello`, 'utf8').toString('base64');

	const raw = Buffer.from(
		`From: ${mojibakeFrom} <support@relay.example>\r\n` +
		'To: user@example.com\r\n' +
		`Subject: ${mojibakeSubject}\r\n` +
		'MIME-Version: 1.0\r\n' +
		'Content-Type: text/plain; charset=UTF-8\r\n' +
		'\r\n' +
		`${mojibakeFrom} hello`,
		'utf8'
	);

	const sent = normalizeSubmittedRawMime(raw).toString('utf8');
	assert.match(sent, /^From: =\?UTF-8\?B\?.+\?= <support@relay\.example>$/m);
	assert.match(sent, /^Subject: =\?UTF-8\?B\?.+\?=$/m);
	assert.match(sent, /^Content-Transfer-Encoding: base64$/m);
	assert.equal(sent.endsWith(`\r\n\r\n${expectedBody}`), true);

	console.log('outbound mime normalize test passed');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
