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

                cache[authorId] = {
                    data: profileRes.data,
                    stats: statsRes?.data ?? {},
                    lookupId,
                    cachedAt: Date.now(),
                };
            } catch (err) {
                console.warn(`Failed to cache profile ${authorId}`, err);
            }
        }),
    );

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

    return (
        Object.values(cache).find(
            (profile) =>
                profile?.data?.user?.username?.toLowerCase() ===
                username.toLowerCase(),
        ) ?? null
    );
}