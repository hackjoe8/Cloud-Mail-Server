function normalizeNullableText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function buildAllEmailLatestParams(emailId, params = {}) {
  return {
    emailId,
    type: params.type || 'receive',
    userEmail: normalizeNullableText(params.userEmail),
    accountEmail: normalizeNullableText(params.accountEmail),
    name: normalizeNullableText(params.name),
    subject: normalizeNullableText(params.subject)
  };
}

export function shouldPollAllEmailLatest({ autoRefresh, latestId, params = {} }) {
  return Number(autoRefresh) >= 2
    && latestId !== undefined
    && latestId !== null
    && (params.type || 'receive') === 'receive';
}
