"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAnalysis = saveAnalysis;
exports.getAnalysis = getAnalysis;
const TTL_MS = 30 * 60 * 1000;
const store = new Map();
function cleanupExpired(now = Date.now()) {
    for (const [id, record] of store.entries()) {
        if (record.expiresAt <= now)
            store.delete(id);
    }
}
function saveAnalysis(dataSource) {
    cleanupExpired();
    const id = crypto.randomUUID();
    const now = Date.now();
    store.set(id, {
        id,
        createdAt: now,
        expiresAt: now + TTL_MS,
        dataSource,
    });
    return id;
}
function getAnalysis(id) {
    if (!id)
        return null;
    cleanupExpired();
    return store.get(id) ?? null;
}
