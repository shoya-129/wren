import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { resolveUserId } from "./users";

const PROFILE_CACHE_KEY = "profiles_cache";

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

    await Promise.all(
        authorIds.map(async (authorId) => {
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

    // Evict expired first, then LFU if over capacity
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

    await AsyncStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify(cache),
    );

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

