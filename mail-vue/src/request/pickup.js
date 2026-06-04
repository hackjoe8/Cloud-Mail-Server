import http from '@/axios/index.js';

export function pickupLink(email, expiresInSeconds = 0) {
    return http.post('/pickup/link', {email, expiresInSeconds});
}

export function pickupBatchLinks(emails, expiresInSeconds = 0) {
    return http.post('/pickup/batchLinks', {emails, expiresInSeconds});
}

export function pickupPublicList(token, emailId, size = 20) {
    return http.get(`/pickup-public/${encodeURIComponent(token)}/list`, {
        params: {emailId, size},
        noMsg: true
    });
}
