import { and, desc, eq, lt, ne, sql } from 'drizzle-orm';
import BizError from '../error/biz-error';
import account from '../entity/account';
import email from '../entity/email';
import orm from '../entity/orm';
import { emailConst, isDel } from '../const/entity-const';
import jwtUtils from '../utils/jwt-utils';
import verifyUtils from '../utils/verify-utils';
import emailService from './email-service';

const PICKUP_SCOPE = 'pickup:read';

function normalizeEmail(value) {
	return String(value || '').trim().toLowerCase();
}

function parseExpiresInSeconds(value) {
	const num = Number(value);
	if (!Number.isFinite(num) || num <= 0) return undefined;
	return Math.floor(num);
}

function clampPositiveInt(value, fallback, max) {
	const num = Number(value);
	if (!Number.isFinite(num) || num <= 0) return fallback;
	return Math.min(Math.floor(num), max);
}

function assertAdmin(c) {
	const currentUser = c.get('user');
	if (!currentUser || currentUser.email !== c.env.admin) {
		throw new BizError('Only admin can generate pickup URLs', 403);
	}
}

function getOrigin(c) {
	return new URL(c.req.url).origin;
}

async function buildPickupLink(c, emailAddress, expiresInSeconds) {
	const token = await jwtUtils.generateToken(c, {
		scope: PICKUP_SCOPE,
		email: emailAddress
	}, expiresInSeconds);

	return {
		email: emailAddress,
		token,
		url: `${getOrigin(c)}/pickup/${encodeURIComponent(token)}`,
		expiresInSeconds: expiresInSeconds || 0
	};
}

const pickupService = {
	async selectPickupTarget(c, rawEmail) {
		const emailAddress = normalizeEmail(rawEmail);

		if (!verifyUtils.isEmail(emailAddress)) {
			throw new BizError('Invalid email address');
		}

		const accountRow = await orm(c)
			.select()
			.from(account)
			.where(sql`LOWER(${account.email}) = LOWER(${emailAddress})`)
			.get();

		if (accountRow && accountRow.isDel !== isDel.DELETE) {
			return accountRow.email;
		}

		const emailRow = await orm(c)
			.select({ toEmail: email.toEmail })
			.from(email)
			.where(and(
				sql`LOWER(${email.toEmail}) = LOWER(${emailAddress})`,
				eq(email.type, emailConst.type.RECEIVE),
				eq(email.isDel, isDel.NORMAL),
				ne(email.status, emailConst.status.SAVING)
			))
			.get();

		if (emailRow) {
			return emailRow.toEmail;
		}

		throw new BizError('Mailbox does not exist or has been deleted', 404);
	},

	async generateLink(c, params) {
		assertAdmin(c);

		const emailAddress = await this.selectPickupTarget(c, params.email);
		const expiresInSeconds = parseExpiresInSeconds(params.expiresInSeconds);
		return buildPickupLink(c, emailAddress, expiresInSeconds);
	},

	async generatePublicLink(c, params) {
		const emailAddress = await this.selectPickupTarget(c, params.email);
		const expiresInSeconds = parseExpiresInSeconds(params.expiresInSeconds);
		return buildPickupLink(c, emailAddress, expiresInSeconds);
	},

	async batchGenerateLinks(c, params) {
		assertAdmin(c);

		const rawEmails = Array.isArray(params.emails)
			? params.emails
			: String(params.emails || '').split(/[\s,，;；]+/);

		const emails = [...new Set(rawEmails.map(normalizeEmail).filter(Boolean))];
		const list = [];

		for (const emailAddress of emails) {
			try {
				const item = await this.generateLink(c, {
					email: emailAddress,
					expiresInSeconds: params.expiresInSeconds
				});
				list.push(item);
			} catch (error) {
				list.push({
					email: emailAddress,
					error: error.message
				});
			}
		}

		const text = list
			.filter(item => item.url)
			.map(item => `${item.email}----${item.url}`)
			.join('\n');

		return { list, text };
	},

	async verifyPickupToken(c, token) {
		const payload = await jwtUtils.verifyToken(c, token);

		if (!payload || payload.scope !== PICKUP_SCOPE || !payload.email) {
			throw new BizError('Pickup URL is invalid or expired', 401);
		}

		return payload;
	},

	async list(c, token, params) {
		const payload = await this.verifyPickupToken(c, token);
		const emailAddress = normalizeEmail(payload.email);
		const size = clampPositiveInt(params.size, 20, 50);
		const cursorEmailId = Number(params.emailId) || 2147483647;

		const list = await orm(c)
			.select({ ...email })
			.from(email)
			.where(and(
				sql`LOWER(${email.toEmail}) = LOWER(${emailAddress})`,
				eq(email.type, emailConst.type.RECEIVE),
				eq(email.isDel, isDel.NORMAL),
				ne(email.status, emailConst.status.SAVING),
				lt(email.emailId, cursorEmailId)
			))
			.orderBy(desc(email.emailId))
			.limit(size)
			.all();

		await emailService.emailAddAtt(c, list);

		return {
			mailbox: {
				email: emailAddress
			},
			list
		};
	}
};

export default pickupService;
