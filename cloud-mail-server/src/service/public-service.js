import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { v4 as uuidv4 } from 'uuid';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import emailUtils from '../utils/email-utils';
import roleService from './role-service';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n';
import reqUtils from '../utils/req-utils';
import dayjs from 'dayjs';
import { isDel, roleConst } from '../const/entity-const';
import email from '../entity/email';
import userService from './user-service';
import KvConst from '../const/kv-const';
import settingService from './setting-service.js';
import { domainMatchesList } from '../utils/domain-uitls.js';

function toBool(value, fallback = false) {
	if (value === undefined || value === null || value === '') return fallback;
	if (typeof value === 'boolean') return value;
	return String(value).toLowerCase() === 'true';
}

function clampPositiveInt(value, fallback, max) {
	const num = Number(value);
	if (!Number.isFinite(num) || num <= 0) return fallback;
	return Math.min(Math.floor(num), max);
}

const publicService = {

	async emailList(c, params) {

		let { toEmail, content, subject, sendName, sendEmail, timeSort, num, size, type , isDel, includeBody } = params

		size = clampPositiveInt(size, 20, 50);
		num = clampPositiveInt(num, 1, 1000000);
		includeBody = toBool(includeBody, true);

		const fields = {
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			sendName: email.name,
			subject: email.subject,
			toEmail: email.toEmail,
			toName: email.toName,
			type: email.type,
			createTime: email.createTime,
			isDel: email.isDel,
		};

		if (includeBody) {
			fields.content = email.content;
			fields.text = email.text;
		}

		const query = orm(c).select(fields).from(email)

		num = (num - 1) * size;

		const conditions = []

		if (toEmail) {
			conditions.push(sql`LOWER(${email.toEmail}) LIKE LOWER(${toEmail})`)
		}

		if (sendEmail) {
			conditions.push(sql`LOWER(${email.sendEmail}) LIKE LOWER(${sendEmail})`)
		}

		if (sendName) {
			conditions.push(sql`LOWER(${email.name}) LIKE LOWER(${sendName})`)
		}

		if (subject) {
			conditions.push(sql`LOWER(${email.subject}) LIKE LOWER(${subject})`)
		}

		if (content) {
			conditions.push(sql`LOWER(${email.content}) LIKE LOWER(${content})`)
		}

		if (type || type === 0) {
			conditions.push(eq(email.type, type))
		}

		if (isDel || isDel === 0) {
			conditions.push(eq(email.isDel, isDel))
		}

		if (conditions.length === 1) {
			query.where(conditions[0])
		} else if (conditions.length > 1) {
			query.where(and(...conditions))
		}

		if (timeSort === 'asc') {
			query.orderBy(asc(email.emailId));
		} else {
			query.orderBy(desc(email.emailId));
		}

		return query.limit(size).offset(num);

	},

	async addUser(c, params) {
		const { list } = params;
		const { domainList } = await settingService.query(c);

		if (list.length === 0) return { list: [] };

		const normalizedList = [];
		const seenEmails = new Set();

		for (const emailRow of list) {
			if (!verifyUtils.isEmail(emailRow.email)) {
				throw new BizError(t('notEmail'));
			}

			if (!domainMatchesList(domainList, emailUtils.getDomain(emailRow.email))) {
				throw new BizError(t('notEmailDomain'));
			}

			const normalizedEmail = String(emailRow.email).trim().toLowerCase();
			if (seenEmails.has(normalizedEmail)) {
				throw new BizError(t('emailExistDatabase'));
			}

			const { salt, hash } = await saltHashUtils.hashPassword(
				emailRow.password || cryptoUtils.genRandomPwd()
			);

			seenEmails.add(normalizedEmail);
			normalizedList.push({
				...emailRow,
				email: String(emailRow.email).trim(),
				salt,
				hash
			});
		}

		const activeIp = reqUtils.getIp(c);
		const { os, browser, device } = reqUtils.getUserAgent(c);
		const activeTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

		const roleList = await roleService.roleSelectUse(c);
		const defRole = roleList.find(roleRow => roleRow.isDefault === roleConst.isDefault.OPEN);

			const sqlList = [];

		for (const emailRow of normalizedList) {
			let { email, hash, salt, roleName } = emailRow;
			let type = defRole.roleId;

			if (roleName) {
				const roleRow = roleList.find(role => role.name === roleName);
				type = roleRow ? roleRow.roleId : type;
			}

				sqlList.push(
					c.env.db.prepare(`
						WITH inserted_user AS (
							INSERT INTO "user" (
								email, password, salt, type, os, browser, active_ip, create_ip, device, active_time, create_time
							) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
							RETURNING user_id, email
						)
						INSERT INTO account (email, name, user_id)
						SELECT email, ?, user_id
						FROM inserted_user
					`).bind(email, hash, salt, type, os, browser, activeIp, activeIp, device, activeTime, activeTime, emailUtils.getName(email))
				);
			}

		try {
			await c.env.db.batch(sqlList);
		} catch (e) {
			if (e.code === '23505' || e.message.includes('SQLITE_CONSTRAINT') || e.message.includes('duplicate key value')) {
				throw new BizError(t('emailExistDatabase'))
			} else {
				throw e
			}
		}

		return {
			list: normalizedList.map(item => ({ email: item.email }))
		};

	},

	async genToken(c, params) {

		await this.verifyUser(c, params)

		const uuid = uuidv4();

		await c.env.kv.put(KvConst.PUBLIC_KEY, uuid);

		return {token: uuid}
	},

	async verifyUser(c, params) {

		const { email, password } = params

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (email !== c.env.admin) {
			throw new BizError(t('notAdmin'));
		}

		if (!userRow || userRow.isDel === isDel.DELETE) {
			throw new BizError(t('notExistUser'));
		}

		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password)) {
			throw new BizError(t('IncorrectPwd'));
		}
	}

}

export default publicService
