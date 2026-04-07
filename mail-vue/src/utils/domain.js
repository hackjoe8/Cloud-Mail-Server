function toNormalizedText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '')
        .replace(/\/+$/, '');
}

function isValidExactDomain(domain) {
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

export function normalizeDomainValue(value, { allowWildcard = true } = {}) {
    const normalized = toNormalizedText(value);
    if (!allowWildcard || !normalized.startsWith('*.')) {
        return normalized;
    }

    const baseDomain = normalized.slice(2);
    return baseDomain ? `*.${baseDomain}` : '';
}

export function isWildcardDomainRule(value) {
    return normalizeDomainValue(value, { allowWildcard: true }).startsWith('*.');
}

export function isValidDomain(value, { allowWildcard = false } = {}) {
    const source = String(value || '').trim().toLowerCase();
    if (source.startsWith('http://') || source.startsWith('https://')) return false;
    const domain = normalizeDomainValue(value, { allowWildcard });
    if (!domain) return false;

    if (domain.startsWith('*.')) {
        if (!allowWildcard) return false;
        return isValidExactDomain(domain.slice(2));
    }

    return isValidExactDomain(domain);
}

export function matchesDomainRule(rule, domain) {
    const normalizedRule = normalizeDomainValue(rule, { allowWildcard: true });
    const normalizedDomain = normalizeDomainValue(domain, { allowWildcard: false });

    if (!normalizedRule || !normalizedDomain) return false;

    if (normalizedRule.startsWith('*.')) {
        const baseDomain = normalizedRule.slice(2);
        return normalizedDomain !== baseDomain && normalizedDomain.endsWith(`.${baseDomain}`);
    }

    return normalizedRule === normalizedDomain;
}

export function matchesDomainRuleList(rules, domain) {
    return (rules || []).some(item => matchesDomainRule(item, domain));
}

export function parseDomainBatchInput(value) {
    return Array.from(new Set(
        String(value || '')
            .split(/[\n,，\s]+/)
            .map(item => normalizeDomainValue(item, { allowWildcard: true }))
            .filter(Boolean)
    ));
}

export function extractCreatableDomainOptions(domainList = []) {
    return (domainList || []).filter(item => !isWildcardDomainRule(item));
}

export function buildEmailAddress(input, suffix = '') {
    const trimmedInput = String(input || '').trim();
    if (!trimmedInput) return '';
    if (trimmedInput.includes('@')) return trimmedInput;
    return trimmedInput + String(suffix || '');
}
