import { SMTPServer } from 'smtp-server';
import { readFileSync } from 'node:fs';
import { relayOutboundRawMime } from './send-outbound-email.js';
import { domainMatchesList } from '../../utils/domain-uitls.js';

let inboundModulePromise = null;

async function defaultHandleInboundRawMime(env, envelopeTo, rawMimeBytes, options = {}) {
	if (!inboundModulePromise) {
		inboundModulePromise = import('../inbound/handle-inbound.js');
	}
	const mod = await inboundModulePromise;
	return await mod.handleInboundRawMime(env, envelopeTo, rawMimeBytes, options);
}

function defaultIsInboundRejectedError(error) {
	return error?.name === 'InboundRejectedError';
}

function stripBrackets(email) {
	return String(email || '').trim().replace(/^<|>$/g, '').toLowerCase();
}

function getDomain(email) {
	const atIndex = email.lastIndexOf('@');
	if (atIndex < 0) return '';
	return email.slice(atIndex + 1).toLowerCase();
}

function smtpError(message, code = 550) {
	const error = new Error(message);
	error.responseCode = code;
	return error;
}

async function collectRawBuffer(stream, maxSize) {
	const chunks = [];
	let total = 0;

	for await (const chunk of stream) {
		const buff = Buffer.from(chunk);
		total += buff.length;
		if (total > maxSize) {
			throw smtpError(`Message too large, max=${maxSize} bytes`, 552);
		}
		chunks.push(buff);
	}

	return Buffer.concat(chunks);
}

function resolveStarttlsOptions({
	smtpEnableStarttls,
	smtpTlsPfxPath,
	smtpTlsPfxPassphrase,
	smtpTlsKeyPath,
	smtpTlsCertPath
}) {
	let tlsKey = null;
	let tlsCert = null;
	let tlsPfx = null;
	let enableStarttls = smtpEnableStarttls;

	if (enableStarttls) {
		if (smtpTlsPfxPath) {
			try {
				tlsPfx = readFileSync(smtpTlsPfxPath);
			} catch (error) {
				console.warn(`[smtp] unable to load TLS PFX (${error.message}). fallback to disable STARTTLS.`);
				enableStarttls = false;
			}
		} else if (!smtpTlsKeyPath || !smtpTlsCertPath) {
			console.warn('[smtp] STARTTLS enabled but TLS material path missing. fallback to disable STARTTLS.');
			enableStarttls = false;
		} else {
			try {
				tlsKey = readFileSync(smtpTlsKeyPath);
				tlsCert = readFileSync(smtpTlsCertPath);
			} catch (error) {
				console.warn(`[smtp] unable to load TLS cert/key (${error.message}). fallback to disable STARTTLS.`);
				enableStarttls = false;
			}
		}
	}

	return {
		enableStarttls,
		tlsPfx,
		tlsPfxPassphrase: smtpTlsPfxPassphrase || undefined,
		tlsKey,
		tlsCert
	};
}

function resolveSecureTlsOptions({
	smtpSecureEnabled,
	smtpTlsPfxPath,
	smtpTlsPfxPassphrase,
	smtpTlsKeyPath,
	smtpTlsCertPath
}) {
	let tlsKey = null;
	let tlsCert = null;
	let tlsPfx = null;
	let enableSecureTls = smtpSecureEnabled;

	if (enableSecureTls) {
		if (smtpTlsPfxPath) {
			try {
				tlsPfx = readFileSync(smtpTlsPfxPath);
			} catch (error) {
				console.warn(`[smtp] unable to load SMTPS PFX (${error.message}). fallback to disable SMTPS.`);
				enableSecureTls = false;
			}
		} else if (!smtpTlsKeyPath || !smtpTlsCertPath) {
			console.warn('[smtp] SMTPS enabled but TLS material path missing. fallback to disable SMTPS.');
			enableSecureTls = false;
		} else {
			try {
				tlsKey = readFileSync(smtpTlsKeyPath);
				tlsCert = readFileSync(smtpTlsCertPath);
			} catch (error) {
				console.warn(`[smtp] unable to load SMTPS cert/key (${error.message}). fallback to disable SMTPS.`);
				enableSecureTls = false;
			}
		}
	}

	return {
		enableSecureTls,
		tlsPfx,
		tlsPfxPassphrase: smtpTlsPfxPassphrase || undefined,
		tlsKey,
		tlsCert
	};
}

function resolveAllowInsecureAuth({
	smtpRequireAuth,
	enableStarttls,
	smtpAllowInsecureAuth
}) {
	if (typeof smtpAllowInsecureAuth === 'boolean') {
		return smtpAllowInsecureAuth;
	}
	return Boolean(smtpRequireAuth && !enableStarttls);
}

function toStoredBool(value, fallback = false) {
	if (value === undefined || value === null || value === '') return fallback;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	const lower = String(value).trim().toLowerCase();
	if (lower === 'true' || lower === '1') return true;
	if (lower === 'false' || lower === '0') return false;
	return fallback;
}

function pickConfiguredText(value, fallback) {
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'string' && value.trim() === '') return fallback;
	return value;
}

function pickConfiguredNumber(value, fallback) {
	if (value === undefined || value === null || value === '') return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.trunc(parsed);
}

export function resolveSmtpRuntimeConfig(baseConfig, settingRow = {}) {
	return {
		...baseConfig,
		smtpRequireAuth: toStoredBool(settingRow.smtpRequireAuth, baseConfig.smtpRequireAuth),
		smtpAuthUser: pickConfiguredText(settingRow.smtpAuthUser, baseConfig.smtpAuthUser),
		smtpAuthPass: pickConfiguredText(settingRow.smtpAuthPass, baseConfig.smtpAuthPass),
		smtpEnableStarttls: toStoredBool(settingRow.smtpEnableStarttls, baseConfig.smtpEnableStarttls),
		smtpTlsPfxPath: baseConfig.smtpTlsPfxPath,
		smtpTlsPfxPassphrase: baseConfig.smtpTlsPfxPassphrase,
		smtpTlsKeyPath: pickConfiguredText(settingRow.smtpTlsKeyPath, baseConfig.smtpTlsKeyPath),
		smtpTlsCertPath: pickConfiguredText(settingRow.smtpTlsCertPath, baseConfig.smtpTlsCertPath),
		smtpSecureEnabled: toStoredBool(settingRow.smtpSecureEnabled, baseConfig.smtpSecureEnabled),
		smtpSecurePort: pickConfiguredNumber(settingRow.smtpSecurePort, baseConfig.smtpSecurePort),
		smtpAllowInsecureAuth: baseConfig.smtpAllowInsecureAuth
	};
}

function normalizeDisabledCommands(commands) {
	return [].concat(commands || []).map((command) => (command || '').toString().toUpperCase().trim()).filter(Boolean);
}

export function attachServerErrorLogging(server, label = 'smtp') {
	const handleError = (error) => {
		console.error(`[${label}] server error:`, error);
	};
	server.on('error', handleError);
	return () => {
		server.off('error', handleError);
	};
}

function resolveServerLiveOptions(smtpConfig) {
	const disabledCommands = [];
	if (!smtpConfig.smtpRequireAuth) disabledCommands.push('AUTH');

	const { enableStarttls, tlsPfx, tlsPfxPassphrase, tlsKey, tlsCert } = resolveStarttlsOptions(smtpConfig);
	if (!enableStarttls) {
		disabledCommands.push('STARTTLS');
	}

	return {
		pfx: tlsPfx || undefined,
		passphrase: tlsPfxPassphrase,
		key: tlsKey || undefined,
		cert: tlsCert || undefined,
		size: smtpConfig.smtpMaxSize,
		authOptional: true,
		allowInsecureAuth: resolveAllowInsecureAuth({
			smtpRequireAuth: smtpConfig.smtpRequireAuth,
			enableStarttls,
			smtpAllowInsecureAuth: smtpConfig.smtpAllowInsecureAuth
		}),
		disabledCommands: normalizeDisabledCommands(disabledCommands),
		banner: 'cloud-mail-server smtp inbound/submission'
	};
}

function resolveSecureServerLiveOptions(smtpConfig) {
	const disabledCommands = ['STARTTLS'];
	if (!smtpConfig.smtpRequireAuth) disabledCommands.push('AUTH');

	const { enableSecureTls, tlsPfx, tlsPfxPassphrase, tlsKey, tlsCert } = resolveSecureTlsOptions(smtpConfig);

	return {
		enabled: enableSecureTls,
		port: smtpConfig.smtpSecurePort,
		pfx: tlsPfx || undefined,
		passphrase: tlsPfxPassphrase,
		key: tlsKey || undefined,
		cert: tlsCert || undefined,
		size: smtpConfig.smtpMaxSize,
		authOptional: true,
		allowInsecureAuth: true,
		disabledCommands: normalizeDisabledCommands(disabledCommands),
		banner: 'cloud-mail-server smtps submission'
	};
}

function applyServerLiveOptions(server, smtpConfig) {
	const liveOptions = resolveServerLiveOptions(smtpConfig);
	server.options.size = liveOptions.size;
	server.options.authOptional = liveOptions.authOptional;
	server.options.allowInsecureAuth = liveOptions.allowInsecureAuth;
	server.options.disabledCommands = liveOptions.disabledCommands;
	server.options.banner = liveOptions.banner;
	server.updateSecureContext({
		pfx: liveOptions.pfx,
		passphrase: liveOptions.passphrase,
		key: liveOptions.key,
		cert: liveOptions.cert
	});
	return liveOptions;
}

function applySecureServerLiveOptions(server, smtpConfig) {
	const liveOptions = resolveSecureServerLiveOptions(smtpConfig);
	server.options.size = liveOptions.size;
	server.options.authOptional = liveOptions.authOptional;
	server.options.allowInsecureAuth = liveOptions.allowInsecureAuth;
	server.options.disabledCommands = liveOptions.disabledCommands;
	server.options.banner = liveOptions.banner;
	server.updateSecureContext({
		pfx: liveOptions.pfx,
		passphrase: liveOptions.passphrase,
		key: liveOptions.key,
		cert: liveOptions.cert
	});
	return liveOptions;
}

function getEnvelopeFrom(session) {
	return stripBrackets(session?.envelope?.mailFrom?.address || session?.envelope?.mailFrom || '');
}

function getEnvelopeRecipients(session) {
	return (session?.envelope?.rcptTo || [])
		.map((item) => stripBrackets(item?.address || item))
		.filter(Boolean);
}

export function classifyEnvelopeRecipients({
	recipients,
	allowDomains,
	isAuthenticated
}) {
	const internalRecipients = [];
	const externalRecipients = [];
	const rejectedRecipients = [];

	for (const recipient of recipients || []) {
		const rcpt = stripBrackets(recipient);
		if (!rcpt) {
			rejectedRecipients.push({ recipient: rcpt, message: 'Invalid recipient' });
			continue;
		}

		const rcptDomain = getDomain(rcpt);
		if (domainMatchesList(Array.from(allowDomains || []), rcptDomain)) {
			internalRecipients.push(rcpt);
			continue;
		}

		if (isAuthenticated) {
			externalRecipients.push(rcpt);
			continue;
		}

		rejectedRecipients.push({ recipient: rcpt, message: `Relay denied for domain ${rcptDomain}` });
	}

	return {
		internalRecipients,
		externalRecipients,
		rejectedRecipients
	};
}

export function buildSmtpServerOptions(runtime, dependencies = {}, configRef = { current: runtime.config }, mode = 'plain') {
	const getAllowDomains = () => new Set((runtime.env.domain || []).map((item) => String(item).toLowerCase()));
	const handleInboundRawMime = dependencies.handleInboundRawMime || defaultHandleInboundRawMime;
	const isInboundRejectedError = dependencies.isInboundRejectedError || defaultIsInboundRejectedError;
	const relayOutboundRawMessage = dependencies.relayOutboundRawMime || relayOutboundRawMime;
	const getCurrentConfig = () => configRef.current;
	const initialLiveOptions = mode === 'secure'
		? resolveSecureServerLiveOptions(getCurrentConfig())
		: resolveServerLiveOptions(getCurrentConfig());

	return {
		secure: mode === 'secure',
		pfx: initialLiveOptions.pfx,
		passphrase: initialLiveOptions.passphrase,
		key: initialLiveOptions.key,
		cert: initialLiveOptions.cert,
		disabledCommands: initialLiveOptions.disabledCommands,
		allowInsecureAuth: initialLiveOptions.allowInsecureAuth,
		authOptional: initialLiveOptions.authOptional,
		banner: initialLiveOptions.banner,
		size: initialLiveOptions.size,
		onAuth(auth, session, callback) {
			const smtpConfig = getCurrentConfig();
			if (!smtpConfig.smtpRequireAuth) {
				callback(null, { user: auth.username || 'anonymous' });
				return;
			}

			if (auth.username === smtpConfig.smtpAuthUser && auth.password === smtpConfig.smtpAuthPass) {
				callback(null, { user: auth.username });
				return;
			}

			callback(smtpError('Authentication failed', 535));
		},
		onRcptTo(address, session, callback) {
			const rcpt = stripBrackets(address?.address || address);
			if (!rcpt) {
				callback(smtpError('Invalid recipient', 550));
				return;
			}

			const { rejectedRecipients } = classifyEnvelopeRecipients({
				recipients: [rcpt],
				allowDomains: getAllowDomains(),
				isAuthenticated: Boolean(session?.user)
			});

			if (rejectedRecipients.length > 0) {
				callback(smtpError(rejectedRecipients[0].message, 550));
				return;
			}

			callback();
		},
		onData(stream, session, callback) {
			(async () => {
				const smtpConfig = getCurrentConfig();
				const rawBuffer = await collectRawBuffer(stream, smtpConfig.smtpMaxSize);
				const recipients = getEnvelopeRecipients(session);
				const envelopeFrom = getEnvelopeFrom(session);

				if (recipients.length === 0) {
					throw smtpError('No recipient', 550);
				}

				const {
					internalRecipients,
					externalRecipients,
					rejectedRecipients
				} = classifyEnvelopeRecipients({
					recipients,
					allowDomains: getAllowDomains(),
					isAuthenticated: Boolean(session?.user)
				});

				if (rejectedRecipients.length > 0) {
					throw smtpError(rejectedRecipients[0].message, 550);
				}

				for (const recipient of internalRecipients) {
					try {
						await handleInboundRawMime(runtime.env, recipient, rawBuffer, {
							forward: async (toEmail) => {
								await relayOutboundRawMessage({
									envelopeFrom,
									recipients: [toEmail],
									rawMessage: rawBuffer
								});
							}
						});
					} catch (error) {
						if (isInboundRejectedError(error)) {
							throw smtpError(error.message || 'Recipient rejected', 550);
						}
						throw error;
					}
				}

				if (externalRecipients.length > 0) {
					if (!envelopeFrom) {
						throw smtpError('Invalid sender', 550);
					}

					await relayOutboundRawMessage({
						envelopeFrom,
						recipients: externalRecipients,
						rawMessage: rawBuffer
					});
				}

				callback(null, 'accepted');
			})().catch((error) => {
				if (error?.responseCode) {
					callback(error);
					return;
				}
				console.error('[smtp] inbound process failed:', error);
				callback(smtpError('Internal processing error', 451));
			});
		}
	};
}

export async function startSmtpServer(runtime, dependencies = {}) {
	const initialConfig = resolveSmtpRuntimeConfig(runtime.config, dependencies.initialSetting || {});
	const {
		smtpEnabled,
		smtpHost,
		smtpPort
	} = initialConfig;

	if (!smtpEnabled) {
		console.log('[smtp] disabled.');
		return null;
	}

	const configRef = {
		current: initialConfig
	};
	const server = new SMTPServer(buildSmtpServerOptions(runtime, dependencies, configRef, 'plain'));
	const detachPlainErrorLogging = attachServerErrorLogging(server, 'smtp');
	applyServerLiveOptions(server, configRef.current);
	let secureServer = null;
	let detachSecureErrorLogging = null;
	const secureLiveOptions = resolveSecureServerLiveOptions(configRef.current);
	if (secureLiveOptions.enabled) {
		secureServer = new SMTPServer(buildSmtpServerOptions(runtime, dependencies, configRef, 'secure'));
		detachSecureErrorLogging = attachServerErrorLogging(secureServer, 'smtps');
		applySecureServerLiveOptions(secureServer, configRef.current);
	}

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(smtpPort, smtpHost, () => {
			server.off('error', reject);
			resolve();
		});
	});

	console.log(`[smtp] listening on ${smtpHost}:${smtpPort}`);

	if (secureServer) {
		await new Promise((resolve, reject) => {
			secureServer.once('error', reject);
			secureServer.listen(secureLiveOptions.port, smtpHost, () => {
				secureServer.off('error', reject);
				resolve();
			});
		});
		console.log(`[smtps] listening on ${smtpHost}:${secureLiveOptions.port}`);
	}

	return {
		async applySettings(settingRow = {}) {
			const previousConfig = { ...configRef.current };
			configRef.current = resolveSmtpRuntimeConfig(runtime.config, settingRow);
			applyServerLiveOptions(server, configRef.current);
			if (secureServer) {
				applySecureServerLiveOptions(secureServer, configRef.current);
			}
			if (
				previousConfig.smtpSecureEnabled !== configRef.current.smtpSecureEnabled ||
				previousConfig.smtpSecurePort !== configRef.current.smtpSecurePort
			) {
				console.log('[smtp] SMTPS listener config changed. restart service to rebind secure listener.');
			}
			console.log('[smtp] live config reloaded from settings.');
			return configRef.current;
		},
		getConfig() {
			return { ...configRef.current };
		},
		close() {
			return Promise.all([
				new Promise((resolveClose) => {
					detachPlainErrorLogging();
					server.close(() => resolveClose());
				}),
				secureServer
					? new Promise((resolveClose) => {
						detachSecureErrorLogging?.();
						secureServer.close(() => resolveClose());
					})
					: Promise.resolve()
			]);
		}
	};
}
