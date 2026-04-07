import { createPgPoolFromEnv, createPostgresD1Database } from './db/postgres-d1';
import { createRedisClientFromEnv, createRedisKVNamespace } from './kv/redis-kv';
import { normalizeDomainList } from '../utils/domain-uitls.js';

function toBool(value, fallback = false) {
	if (value === undefined || value === null || value === '') return fallback;
	if (typeof value === 'boolean') return value;
	return String(value).toLowerCase() === 'true';
}

function toOptionalBool(value) {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'boolean') return value;
	return String(value).toLowerCase() === 'true';
}

export async function createRuntime() {
	const pgPool = createPgPoolFromEnv(process.env);
	const redis = createRedisClientFromEnv(process.env);
	redis.on('error', (error) => {
		console.warn(`[redis] ${error.message}`);
	});

	const db = createPostgresD1Database(pgPool);
	const kv = createRedisKVNamespace(redis, process.env.KV_PREFIX || 'cm:kv:');

	const domain = normalizeDomainList(process.env.DOMAIN);

	const env = {
		db,
		kv,
		domain,
		admin: process.env.ADMIN || '',
		jwt_secret: process.env.JWT_SECRET || '',
		orm_log: toBool(process.env.ORM_LOG, false),
		linuxdo_client_id: process.env.LINUXDO_CLIENT_ID || '',
		linuxdo_client_secret: process.env.LINUXDO_CLIENT_SECRET || '',
		linuxdo_callback_url: process.env.LINUXDO_CALLBACK_URL || '',
		linuxdo_switch: toBool(process.env.LINUXDO_SWITCH, false)
	};

	const config = {
		port: Number(process.env.PORT || 8787),
		enableCron: toBool(process.env.ENABLE_CRON, true),
		cronExpr: process.env.CRON_EXPR || '0 0 * * *',
		cronTimezone: process.env.CRON_TIMEZONE || 'Asia/Shanghai',
		autoInit: toBool(process.env.AUTO_INIT, false),
		inboundSharedSecret: process.env.INBOUND_SHARED_SECRET || '',
		inboundMaxSkewSeconds: Number(process.env.INBOUND_MAX_SKEW_SECONDS || 300),
		smtpEnabled: toBool(process.env.SMTP_ENABLED, true),
		smtpHost: process.env.SMTP_HOST || '0.0.0.0',
		smtpPort: Number(process.env.SMTP_PORT || 25),
		smtpRequireAuth: toBool(process.env.SMTP_REQUIRE_AUTH, false),
		smtpAuthUser: process.env.SMTP_AUTH_USER || '',
		smtpAuthPass: process.env.SMTP_AUTH_PASS || '',
		smtpMaxSize: Number(process.env.SMTP_MAX_SIZE || 25 * 1024 * 1024),
		smtpEnableStarttls: toBool(process.env.SMTP_ENABLE_STARTTLS, false),
		smtpAllowInsecureAuth: toOptionalBool(process.env.SMTP_ALLOW_INSECURE_AUTH),
		smtpTlsKeyPath: process.env.SMTP_TLS_KEY_PATH || '',
		smtpTlsCertPath: process.env.SMTP_TLS_CERT_PATH || '',
		smtpTlsPfxPath: process.env.SMTP_TLS_PFX_PATH || '',
		smtpTlsPfxPassphrase: process.env.SMTP_TLS_PFX_PASSPHRASE || '',
		smtpSecureEnabled: toBool(process.env.SMTP_SECURE_ENABLED, false),
		smtpSecurePort: Number(process.env.SMTP_SECURE_PORT || 465)
	};

	if (!env.jwt_secret) {
		console.warn('[runtime] JWT_SECRET is empty.');
	}

	if (!env.admin) {
		console.warn('[runtime] ADMIN is empty.');
	}

	if (domain.length === 0) {
		console.warn('[runtime] DOMAIN is empty.');
	}

	if (!config.inboundSharedSecret) {
		console.warn('[runtime] INBOUND_SHARED_SECRET is empty. /api/internal/inbound-email will reject requests.');
	}

	if (config.smtpEnabled && config.smtpPort < 1024) {
		console.warn(`[runtime] SMTP_PORT=${config.smtpPort} usually requires privileged permission/root.`);
	}

	if (config.smtpEnabled && config.smtpSecureEnabled && config.smtpSecurePort < 1024) {
		console.warn(`[runtime] SMTP_SECURE_PORT=${config.smtpSecurePort} usually requires privileged permission/root.`);
	}

	return {
		env,
		config,
		async close() {
			await Promise.allSettled([
				pgPool.end(),
				redis.quit()
			]);
		}
	};
}
