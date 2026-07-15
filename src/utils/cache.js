import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { resolveUserId } from "./users";
import { decryptPostsOrReplies } from "./wrencryption";

const PROFILE_CACHE_KEY = "profiles_cache";
const CACHED_FEED_DECRYPTED_KEY = "cached_feed_posts_decrypted";
const CACHED_FEED_RAW_KEY = "cached_feed_posts_raw";
const CACHED_REPLIES_KEY = "cached_replies_by_post";

async function fetchStatsSafely(path) {
    try {
        return await api.get(path);
    } catch (e) {
        if (e?.response?.status === 404 || e?.response?.status === 500) {
            console.warn(`Stats endpoint unavailable for ${path}`);
            return null;
        }
        throw e;
    }
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

function evictAndPersist(cache) {
    const now = Date.now();
    for (const key of Object.keys(cache)) {
        const entry = cache[key];
        const expiry = entry.expiry || (entry.cachedAt ? entry.cachedAt + DEFAULT_TTL : 0);
        if (now > expiry) {
            delete cache[key];
        }
    }

    const currentKeys = Object.keys(cache);
    if (currentKeys.length > MAX_CACHE_SIZE) {
        currentKeys.sort((a, b) => {
            const entryA = cache[a];
            const entryB = cache[b];
            const useCountA = entryA.useCount || 1;
            const useCountB = entryB.useCount || 1;
            if (useCountA !== useCountB) {
                return useCountA - useCountB;
            }
            const accessedA = entryA.accessedAt || entryA.cachedAt || 0;
            const accessedB = entryB.accessedAt || entryB.cachedAt || 0;
            return accessedA - accessedB;
        });

        const toDeleteCount = currentKeys.length - MAX_CACHE_SIZE;
        for (let i = 0; i < toDeleteCount; i++) {
            delete cache[currentKeys[i]];
        }
    }

    return AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
}

export async function cacheProfiles(posts) {
    const cache = JSON.parse(
        (await AsyncStorage.getItem(PROFILE_CACHE_KEY)) ?? "{}",
    );

    const authorIds = [
        ...new Set(
            posts
                .map((post) => post.author?.uid ?? post.uid)
                .filter(Boolean),
        ),
    ];

    const now = Date.now();
    const authorIdsToFetch = authorIds.filter((id) => {
        const entry = cache[id];
        if (!entry) return true;
        const expiry = entry.expiry || (entry.cachedAt ? entry.cachedAt + DEFAULT_TTL : 0);
        return now > expiry;
    });

    await Promise.all(
        authorIdsToFetch.map(async (authorId) => {
            let profileRes = null;
            let statsRes = null;
            let lookupId = null;

            try {
                const resolvedUid = await resolveUserId({
                    uid: authorId,
                    username: undefined,
                });

                const candidates = [authorId, resolvedUid]
                    .filter(Boolean)
                    .filter((v, i, arr) => arr.indexOf(v) === i);

                let lastError = null;

                for (const candidate of candidates) {
                    try {
                        profileRes = await api.get(
                            `/user/profile/${encodeURIComponent(candidate)}`,
                        );

                        statsRes = await fetchStatsSafely(
                            `/user/stats/${encodeURIComponent(candidate)}`,
                        );

                        lookupId = candidate;
                        lastError = null;
                        break;
                    } catch (e) {
                        lastError = e;

                        const status = e?.response?.status;
                        if (status === 404 || status === 500) {
                            continue;
                        }
                        throw e;
                    }
                }

                if (!profileRes) {
                    throw lastError || new Error("Profile not found");
                }

                const existing = cache[authorId] || {};
                cache[authorId] = {
                    data: profileRes.data,
                    stats: statsRes?.data ?? {},
                    lookupId,
                    cachedAt: Date.now(),
                    expiry: Date.now() + DEFAULT_TTL,
                    useCount: (existing.useCount || 0) + 1,
                    accessedAt: Date.now(),
                };
            } catch (err) {
                console.warn(`Failed to cache profile ${authorId}`, err);
            }
        }),
    );

    await evictAndPersist(cache);
    return cache;
}

export async function findProfile(username) {
    if (!username) return null;

    const cache = JSON.parse(
        (await AsyncStorage.getItem(PROFILE_CACHE_KEY)) ?? "{}",
    );

    const now = Date.now();
    let foundKey = null;
    let foundEntry = null;

    for (const [key, entry] of Object.entries(cache)) {
        if (entry?.data?.user?.username?.toLowerCase() === username.toLowerCase()) {
            foundKey = key;
            foundEntry = entry;
            break;
        }
    }

    if (!foundEntry) return null;

    const expiry = foundEntry.expiry || (foundEntry.cachedAt ? foundEntry.cachedAt + DEFAULT_TTL : 0);
    if (now > expiry) {
        delete cache[foundKey];
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
        return null;
    }

    // Hit: increment useCount and extend TTL
    foundEntry.useCount = (foundEntry.useCount || 0) + 1;
    foundEntry.expiry = now + DEFAULT_TTL;
    foundEntry.accessedAt = now;

    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache)).catch(() => {});

    return foundEntry;
}

export async function saveProfileToCache(authorId, data, stats = {}, lookupId = authorId) {
    if (!authorId || !data) return null;
    const cache = JSON.parse(
        (await AsyncStorage.getItem(PROFILE_CACHE_KEY)) ?? "{}",
    );

    const existing = cache[authorId] || {};
    cache[authorId] = {
        data,
        stats: stats || {},
        lookupId: lookupId || authorId,
        cachedAt: Date.now(),
        expiry: Date.now() + DEFAULT_TTL,
        useCount: (existing.useCount || 0) + 1,
        accessedAt: Date.now(),
    };

    await evictAndPersist(cache);
    return cache[authorId];
}

export async function updateCachedProfile(authorId, updates) {
    if (!authorId) return null;
    const cache = JSON.parse(
        (await AsyncStorage.getItem(PROFILE_CACHE_KEY)) ?? "{}",
    );

    if (updates && (updates.followStatus === "none" || updates.followStatus === null)) {
        // Delete directly by key
        delete cache[authorId];

        // Also search and delete by username, lookupId, or sub-uid
        for (const [key, val] of Object.entries(cache)) {
            if (
                key.toLowerCase() === authorId.toLowerCase() ||
                val?.lookupId?.toLowerCase() === authorId.toLowerCase() ||
                val?.data?.user?.username?.toLowerCase() === authorId.toLowerCase() ||
                val?.data?.user?.uid?.toLowerCase() === authorId.toLowerCase()
            ) {
                delete cache[key];
            }
        }
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
        return null;
    }

    let entry = cache[authorId];
    if (!entry) {
        try {
            const profileRes = await api.get(
                `/user/profile/${encodeURIComponent(authorId)}`,
            );
            const statsRes = await fetchStatsSafely(
                `/user/stats/${encodeURIComponent(authorId)}`,
            );
            entry = {
                data: profileRes.data,
                stats: statsRes?.data ?? {},
                lookupId: authorId,
                cachedAt: Date.now(),
                expiry: Date.now() + DEFAULT_TTL,
                useCount: 1,
                accessedAt: Date.now(),
            };
        } catch (e) {
            console.warn(`Failed to fetch and cache profile ${authorId} on update`, e);
            entry = {
                data: { user: { uid: authorId } },
                stats: {},
                lookupId: authorId,
                cachedAt: Date.now(),
                expiry: Date.now() + DEFAULT_TTL,
                useCount: 1,
                accessedAt: Date.now(),
            };
        }
    }

    entry.data = entry.data || {};
    entry.data.user = {
        ...(entry.data.user || {}),
        ...updates,
    };

    cache[authorId] = entry;
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
    return entry;
}

const FEED_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
const REPLIES_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

export async function saveFeedToCache(decryptedPosts, rawPosts) {
    try {
        const metadata = {
            cachedAt: Date.now(),
        };
        if (decryptedPosts) {
            await AsyncStorage.setItem(CACHED_FEED_DECRYPTED_KEY, JSON.stringify({ posts: decryptedPosts, ...metadata }));
        }
        if (rawPosts) {
            await AsyncStorage.setItem(CACHED_FEED_RAW_KEY, JSON.stringify({ posts: rawPosts, ...metadata }));
        }
    } catch (e) {
        console.error("Failed to save feed to cache:", e);
    }
}

export async function getCachedFeed(cryptoOptions = {}) {
    try {
        const decryptedJson = await AsyncStorage.getItem(CACHED_FEED_DECRYPTED_KEY);
        let decryptedData = decryptedJson ? JSON.parse(decryptedJson) : null;
        let decrypted = [];
        let decryptedCachedAt = 0;

        if (decryptedData) {
            if (Array.isArray(decryptedData)) {
                decrypted = decryptedData;
            } else {
                decrypted = decryptedData.posts || [];
                decryptedCachedAt = decryptedData.cachedAt || 0;
            }
        }

        const rawJson = await AsyncStorage.getItem(CACHED_FEED_RAW_KEY);
        let rawData = rawJson ? JSON.parse(rawJson) : null;
        let raw = [];
        let rawCachedAt = 0;

        if (rawData) {
            if (Array.isArray(rawData)) {
                raw = rawData;
            } else {
                raw = rawData.posts || [];
                rawCachedAt = rawData.cachedAt || 0;
            }
        }

        const now = Date.now();

        // Discard if cache is too old
        if (decryptedCachedAt > 0 && now - decryptedCachedAt > FEED_CACHE_TTL) {
            decrypted = [];
            await AsyncStorage.removeItem(CACHED_FEED_DECRYPTED_KEY).catch(() => {});
        }

        if (rawCachedAt > 0 && now - rawCachedAt > FEED_CACHE_TTL) {
            raw = [];
            await AsyncStorage.removeItem(CACHED_FEED_RAW_KEY).catch(() => {});
        }

        if (raw.length > 0 && cryptoOptions.publicKey && cryptoOptions.privateKey && cryptoOptions.feedKey) {
            try {
                const decryptedRaw = await decryptPostsOrReplies(raw, cryptoOptions);
                if (decryptedRaw && decryptedRaw.length > 0) {
                    const merged = [...decryptedRaw, ...decrypted];
                    const map = new Map();
                    for (const p of merged) {
                        if (p && p.postId) map.set(p.postId, p);
                    }
                    const deduplicated = Array.from(map.values());
                    
                    await AsyncStorage.setItem(CACHED_FEED_DECRYPTED_KEY, JSON.stringify({ posts: deduplicated, cachedAt: now }));
                    await AsyncStorage.removeItem(CACHED_FEED_RAW_KEY);
                    decrypted = deduplicated;
                }
            } catch (decErr) {
                console.warn("Failed to decrypt raw cached feed:", decErr);
            }
        }
        return decrypted;
    } catch (e) {
        console.error("Failed to get cached feed:", e);
        return [];
    }
}

export async function saveRepliesToCache(postId, decryptedReplies, rawReplies) {
    if (!postId) return;
    try {
        const cachedJson = await AsyncStorage.getItem(CACHED_REPLIES_KEY);
        const cache = cachedJson ? JSON.parse(cachedJson) : {};

        const existing = cache[postId] || {};
        cache[postId] = {
            decrypted: decryptedReplies ?? existing.decrypted ?? null,
            raw: rawReplies ?? existing.raw ?? null,
            cachedAt: Date.now(),
        };

        const keys = Object.keys(cache);
        if (keys.length > 50) {
            keys.sort((a, b) => (cache[a].cachedAt || 0) - (cache[b].cachedAt || 0));
            const toDelete = keys.length - 50;
            for (let i = 0; i < toDelete; i++) {
                delete cache[keys[i]];
            }
        }

        await AsyncStorage.setItem(CACHED_REPLIES_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error("Failed to save replies to cache:", e);
    }
}

export async function getCachedReplies(postId, cryptoOptions = {}) {
    if (!postId) return [];
    try {
        const cachedJson = await AsyncStorage.getItem(CACHED_REPLIES_KEY);
        const cache = cachedJson ? JSON.parse(cachedJson) : {};

        const entry = cache[postId];
        if (!entry) return [];

        // Check TTL
        const now = Date.now();
        const cachedAt = entry.cachedAt || 0;
        if (cachedAt > 0 && now - cachedAt > REPLIES_CACHE_TTL) {
            delete cache[postId];
            await AsyncStorage.setItem(CACHED_REPLIES_KEY, JSON.stringify(cache)).catch(() => {});
            return [];
        }

        let decrypted = entry.decrypted || [];
        const raw = entry.raw || [];

        if (raw.length > 0 && cryptoOptions.publicKey && cryptoOptions.privateKey && (cryptoOptions.feedKey || cryptoOptions.parentFeedKey)) {
            try {
                const decryptedRaw = await decryptPostsOrReplies(raw, cryptoOptions);
                if (decryptedRaw && decryptedRaw.length > 0) {
                    const merged = [...decryptedRaw, ...decrypted];
                    const map = new Map();
                    for (const r of merged) {
                        const id = r.postId ?? r.replyId ?? r.id;
                        if (id) map.set(id, r);
                    }
                    const deduplicated = Array.from(map.values());

                    entry.decrypted = deduplicated;
                    entry.raw = null;
                    cache[postId] = entry;
                    await AsyncStorage.setItem(CACHED_REPLIES_KEY, JSON.stringify(cache));
                    decrypted = deduplicated;
                }
            } catch (decErr) {
                console.warn("Failed to decrypt raw cached replies:", decErr);
            }
        }

        return decrypted;
    } catch (e) {
        console.error("Failed to get cached replies:", e);
        return [];
    }
}

