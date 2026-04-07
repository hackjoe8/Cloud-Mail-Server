function parseDomainInput(domainRaw) {
	if (!domainRaw) return [];
	if (Array.isArray(domainRaw)) return domainRaw;

	const text = String(domainRaw).trim();
	if (!text) return [];

	if (text.startsWith('[')) {
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed;
			}
		} catch {
			// fallback to csv/text parsing
		}
	}

	return text.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeDomainValue(domain, { allowWildcard = false } = {}) {
	let value = String(domain || '').trim().toLowerCase();
	if (!value) return '';
	value = value.replace(/^@+/, '').replace(/\/+$/, '');
	if (allowWildcard && value.startsWith('*.')) {
		const baseDomain = value.slice(2);
		return baseDomain ? `*.${baseDomain}` : '';
	}
	return value;
}

function isValidExactDomainName(domain) {
	return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

export function isWildcardDomainPattern(domain) {
	return normalizeDomainValue(domain, { allowWildcard: true }).startsWith('*.');
}

export function isValidDomainName(domain, { allowWildcard = false } = {}) {
	const sourceValue = String(domain || '').trim().toLowerCase();
	if (sourceValue.startsWith('http://') || sourceValue.startsWith('https://')) return false;
	const value = normalizeDomainValue(domain, { allowWildcard });
	if (!value) return false;
	if (value.startsWith('*.')) {
		if (!allowWildcard) return false;
		return isValidExactDomainName(value.slice(2));
	}
	return isValidExactDomainName(value);
}

export function normalizeDomainList(domainRaw, { allowWildcard = true } = {}) {
	return Array.from(
		new Set(
			parseDomainInput(domainRaw)
				.map((item) => normalizeDomainValue(item, { allowWildcard }))
				.filter(Boolean)
		)
	);
}

export function formatDomainList(domainRaw) {
	return normalizeDomainList(domainRaw).map((item) => `@${item}`);
}

export function resolveActiveDomainList(settingDomainRaw, envDomainRaw) {
	const settingDomainList = normalizeDomainList(settingDomainRaw, { allowWildcard: true });
	if (settingDomainList.length > 0) {
		return settingDomainList;
	}

	return normalizeDomainList(envDomainRaw, { allowWildcard: true });
}

export function domainMatchesPattern(pattern, domain) {
	const normalizedPattern = normalizeDomainValue(pattern, { allowWildcard: true });
	const normalizedDomain = normalizeDomainValue(domain);

	if (!normalizedPattern || !normalizedDomain) return false;

	if (normalizedPattern.startsWith('*.')) {
		const baseDomain = normalizedPattern.slice(2);
		return normalizedDomain !== baseDomain && normalizedDomain.endsWith(`.${baseDomain}`);
	}

	return normalizedPattern === normalizedDomain;
}

export function domainMatchesList(patterns, domain) {
	return normalizeDomainList(patterns, { allowWildcard: true }).some((pattern) => domainMatchesPattern(pattern, domain));
}

const domainUtils = {
	toOssDomain(domain) {

		if (!domain) {
			return null
		}

		if (!domain.startsWith('http')) {
			return 'https://' + domain
		}

		if (domain.endsWith("/")) {
			domain = domain.slice(0, -1);
		}

		return domain
	},
	parseDomainInput,
	normalizeDomainValue,
	isValidDomainName,
	isWildcardDomainPattern,
	normalizeDomainList,
	formatDomainList,
	resolveActiveDomainList,
	domainMatchesPattern,
	domainMatchesList
}

export default  domainUtils
