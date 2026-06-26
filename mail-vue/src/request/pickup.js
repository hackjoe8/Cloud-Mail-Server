import http from '@/axios/index.js';

export function pickupLink(email, expiresInSeconds = 0) {
    return http.post('/pickup/link', {email, expiresInSeconds});
}

export function pickupBatchLinks(emails, expiresInSeconds = 0, outputMode = 'list') {
    return http.post('/pickup/batchLinks', {
        emails,
        expiresInSeconds,
        outputMode
    });
}

export function pickupPublicList(token, emailId, size = 20) {
    return http.get(`/pickup-public/${encodeURIComponent(token)}/list`, {
        params: {emailId, size},
        noMsg: true
    });
}

export function pickupPublicMessage(token, index = 1) {
    return http.get(`/pickup-public/${encodeURIComponent(token)}/message/${encodeURIComponent(index)}`, {
        noMsg: true
    });
}
