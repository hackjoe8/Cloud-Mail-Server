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

const pickupService = {
	async selectAccountByEmail(c, rawEmail) {
		const emailAddress = normalizeEmail(rawEmail);

		if (!verifyUtils.isEmail(emailAddress)) {
			throw new BizError('Invalid email address');
		}

		const accountRow = await orm(c)
			.select()
			.from(account)
			.where(sql`LOWER(${account.email}) = LOWER(${emailAddress})`)
			.get();

		if (!accountRow || accountRow.isDel === isDel.DELETE) {
			throw new BizError('Mailbox does not exist or has been deleted', 404);
		}

		return accountRow;
	},

	async generateLink(c, params) {
		assertAdmin(c);

		const accountRow = await this.selectAccountByEmail(c, params.email);
		const expiresInSeconds = parseExpiresInSeconds(params.expiresInSeconds);
		const token = await jwtUtils.generateToken(c, {
			scope: PICKUP_SCOPE,
			email: accountRow.email
		}, expiresInSeconds);

		return {
			email: accountRow.email,
			token,
			url: `${getOrigin(c)}/pickup/${encodeURIComponent(token)}`,
			expiresInSeconds: expiresInSeconds || 0
		};
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
		const accountRow = await this.selectAccountByEmail(c, payload.email);
		const size = clampPositiveInt(params.size, 20, 50);
		const cursorEmailId = Number(params.emailId) || 2147483647;

		const list = await orm(c)
			.select({ ...email })
			.from(email)
			.where(and(
				eq(email.accountId, accountRow.accountId),
				eq(email.userId, accountRow.userId),
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
				email: accountRow.email,
				accountId: accountRow.accountId
			},
			list
		};
	}
};

export default pickupService;
