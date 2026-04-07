import http from '@/axios/index.js';

export function allEmailList(params, options = {}) {
    const { includeTotal = true, includeLatest = true } = options;
    return http.get('/allEmail/list', {params: {...params, includeTotal, includeLatest}})
}

export function allEmailDelete(emailIds) {
    return http.delete('/allEmail/delete?emailIds=' + emailIds)
}

export function allEmailBatchDelete(params) {
    return http.delete('/allEmail/batchDelete', {params: params} )
}

export function allEmailLatest(params) {
    return http.get('/allEmail/latest', {params, noMsg: true, timeout: 35 * 1000})
}
