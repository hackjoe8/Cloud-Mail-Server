import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

import {
	attachServerErrorLogging,
	buildSmtpServerOptions,
	classifyEnvelopeRecipients,
	resolveSmtpRuntimeConfig
} from '../src/runtime/smtp/start-smtp-server.js';
import settingService, { normalizeSmtpSettingParams } from '../src/service/setting-service.js';

function createRuntime(overrides = {}) {
	return {
		env: {
			domain: ['relay.example'],
			...overrides.env
		},
		config: {
			smtpEnabled: true,
			smtpHost: '127.0.0.1',
			smtpPort: 2525,
			smtpRequireAuth: true,
			smtpAuthUser: 'relay-user',
			smtpAuthPass: 'relay-pass',
			smtpMaxSize: 1024 * 1024,
			smtpEnableStarttls: false,
			smtpTlsKeyPath: '',
			smtpTlsCertPath: '',
			smtpSecureEnabled: false,
			smtpSecurePort: 465,
			...overrides.config
		}
	};
}

function callbackResult(invoke) {
	return new Promise((resolve) => {
		invoke((error, data) => resolve({ error, data }));
	});
}

async function main() {
	const relayClassification = classifyEnvelopeRecipients({
		recipients: ['user@example.net'],
		allowDomains: new Set(['relay.example']),
		isAuthenticated: true
	});
	assert.deepEqual(relayClassification.internalRecipients, []);
	assert.deepEqual(relayClassification.externalRecipients, ['user@example.net']);
	assert.deepEqual(relayClassification.rejectedRecipients, []);

	const rejectedClassification = classifyEnvelopeRecipients({
		recipients: ['user@example.net'],
		allowDomains: new Set(['relay.example']),
		isAuthenticated: false
	});
	assert.deepEqual(rejectedClassification.internalRecipients, []);
	assert.deepEqual(rejectedClassification.externalRecipients, []);
	assert.deepEqual(rejectedClassification.rejectedRecipients, [
		{ recipient: 'user@example.net', message: 'Relay denied for domain example.net' }
	]);

	const wildcardClassification = classifyEnvelopeRecipients({
		recipients: ['user@mail.ops.example.net', 'user@example.net'],
		allowDomains: new Set(['*.ops.example.net']),
		isAuthenticated: false
	});
	assert.deepEqual(wildcardClassification.internalRecipients, ['user@mail.ops.example.net']);
	assert.deepEqual(wildcardClassification.externalRecipients, []);
	assert.deepEqual(wildcardClassification.rejectedRecipients, [
		{ recipient: 'user@example.net', message: 'Relay denied for domain example.net' }
	]);

	const options = buildSmtpServerOptions(createRuntime());
	assert.equal(options.allowInsecureAuth, true);
	assert.equal(options.authOptional, true);
	assert.deepEqual(options.disabledCommands, ['STARTTLS']);

	const mergedConfig = resolveSmtpRuntimeConfig(createRuntime().config, {
		smtpRequireAuth: 1,
		smtpAuthUser: 'panel-user',
		smtpAuthPass: 'panel-pass',
		smtpEnableStarttls: 1,
		smtpTlsKeyPath: '/etc/ssl/private/mail.key',
		smtpTlsCertPath: '/etc/ssl/certs/mail.crt',
		smtpSecureEnabled: 1,
		smtpSecurePort: 2465
	});
	assert.equal(mergedConfig.smtpRequireAuth, true);
	assert.equal(mergedConfig.smtpAuthUser, 'panel-user');
	assert.equal(mergedConfig.smtpAuthPass, 'panel-pass');
	assert.equal(mergedConfig.smtpEnableStarttls, true);
	assert.equal(mergedConfig.smtpTlsKeyPath, '/etc/ssl/private/mail.key');
	assert.equal(mergedConfig.smtpTlsCertPath, '/etc/ssl/certs/mail.crt');
	assert.equal(mergedConfig.smtpSecureEnabled, true);
	assert.equal(mergedConfig.smtpSecurePort, 2465);

	const preservedEnvConfig = resolveSmtpRuntimeConfig(createRuntime({
		config: {
			smtpAuthUser: 'env-user',
			smtpAuthPass: 'env-pass',
			smtpEnableStarttls: true,
			smtpTlsKeyPath: '/env/key',
			smtpTlsCertPath: '/env/cert',
			smtpSecureEnabled: true,
			smtpSecurePort: 1465
		}
	}).config, {
		smtpAuthUser: '',
		smtpAuthPass: '',
		smtpEnableStarttls: '',
		smtpTlsKeyPath: '',
		smtpTlsCertPath: '',
		smtpSecureEnabled: '',
		smtpSecurePort: ''
	});
	assert.equal(preservedEnvConfig.smtpAuthUser, 'env-user');
	assert.equal(preservedEnvConfig.smtpAuthPass, 'env-pass');
	assert.equal(preservedEnvConfig.smtpEnableStarttls, true);
	assert.equal(preservedEnvConfig.smtpTlsKeyPath, '/env/key');
	assert.equal(preservedEnvConfig.smtpTlsCertPath, '/env/cert');
	assert.equal(preservedEnvConfig.smtpSecureEnabled, true);
	assert.equal(preservedEnvConfig.smtpSecurePort, 1465);

	const normalizedParams = normalizeSmtpSettingParams(
		{ smtpAuthPass: '', smtpAuthUser: 'new-user', smtpRequireAuth: 1, smtpSecureEnabled: true, smtpSecurePort: '2465' },
		{ smtpAuthPass: 'current-pass' }
	);
	assert.equal(normalizedParams.smtpAuthUser, 'new-user');
	assert.equal(normalizedParams.smtpRequireAuth, 1);
	assert.equal(normalizedParams.smtpSecureEnabled, 1);
	assert.equal(normalizedParams.smtpSecurePort, 2465);
	assert.ok(!Object.hasOwn(normalizedParams, 'smtpAuthPass'));
	assert.equal(settingService.maskSecret('abcd', 4), '******');

	const inboundCalls = [];
	const relayCalls = [];
	const runtime = createRuntime();
	const deliveryOptions = buildSmtpServerOptions(runtime, {
		handleInboundRawMime: async (...args) => {
			inboundCalls.push(args);
		},
		relayOutboundRawMime: async (payload) => {
			relayCalls.push(payload);
		}
	});

	const session = {
		user: 'relay-user',
		envelope: {
			mailFrom: { address: 'support@relay.example' },
			rcptTo: [
				{ address: 'member@relay.example' },
				{ address: 'user@example.net' }
			]
		}
	};

	let result = await callbackResult((done) => deliveryOptions.onRcptTo({ address: 'member@relay.example' }, session, done));
	assert.equal(result.error, undefined);

	result = await callbackResult((done) => deliveryOptions.onRcptTo({ address: 'user@example.net' }, session, done));
	assert.equal(result.error, undefined);

	const rawBuffer = Buffer.from('Subject: Relay Test\r\n\r\nhello relay');
	result = await callbackResult((done) => deliveryOptions.onData(Readable.from([rawBuffer]), session, done));
	assert.equal(result.error, null);
	assert.equal(result.data, 'accepted');

	assert.equal(inboundCalls.length, 1);
	assert.equal(inboundCalls[0][1], 'member@relay.example');

	assert.equal(relayCalls.length, 1);
	assert.equal(relayCalls[0].envelopeFrom, 'support@relay.example');
	assert.deepEqual(relayCalls[0].recipients, ['user@example.net']);
	assert.equal(Buffer.compare(relayCalls[0].rawMessage, rawBuffer), 0);

	const runtimeWithDynamicDomains = createRuntime();
	const optionsWithDynamicDomains = buildSmtpServerOptions(runtimeWithDynamicDomains);
	runtimeWithDynamicDomains.env.domain = ['dynamic.example'];

	result = await callbackResult((done) => optionsWithDynamicDomains.onRcptTo({ address: 'team@dynamic.example' }, {
		user: null,
		envelope: {
			mailFrom: { address: 'support@relay.example' },
			rcptTo: []
		}
	}, done));
	assert.equal(result.error, undefined);

	const emitter = new EventEmitter();
	const logged = [];
	const originalConsoleError = console.error;
	console.error = (...args) => {
		logged.push(args.map((item) => String(item)).join(' '));
	};
	try {
		const detach = attachServerErrorLogging(emitter, 'smtps');
		emitter.emit('error', new Error('tls alert bad certificate'));
		detach();
	} finally {
		console.error = originalConsoleError;
	}
	assert.equal(logged.length, 1);
	assert.match(logged[0], /\[smtps\] server error:/);
	assert.match(logged[0], /tls alert bad certificate/);

	console.log('smtp-server tests passed');
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
