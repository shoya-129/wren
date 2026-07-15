import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import api from "./api";
import { decryptPostsOrReplies } from "./wrencryption";
import { saveFeedToCache, saveRepliesToCache, cacheProfiles } from "./cache";

const BACKGROUND_TASK_IDENTIFIER = "wren-sync-task";
const MINIMUM_INTERVAL = 15 * 60; // 15 minutes

const isReplyRecord = (item) => {
  if (!item) return false;
  return !!(
    item.replyId ||
    item.replyTo ||
    item.commentTo ||
    item.parentId ||
    item.parentPostId ||
    item.parentReplyId ||
    item.rootPostId ||
    item.replyToPostId ||
    item.replyToReplyId ||
    item.type === "reply" ||
    item.kind === "reply" ||
    item.isReply === true
  );
};

TaskManager.defineTask(BACKGROUND_TASK_IDENTIFIER, async () => {
  console.log("[BG Task] started execution");
  try {
    const token = await AsyncStorage.getItem("token");
    const userRaw = await AsyncStorage.getItem("user");
    if (!token || !userRaw) {
      console.log("[BG Task] User not logged in, skipping");
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    const user = JSON.parse(userRaw);

    // Apply authorization token
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    // Fetch feed posts
    const response = await api.get("/posts/feed", {
      params: { page: 1, limit: 20 },
    });
    const rawPosts = response.data || [];

    const topLevelPosts = rawPosts.filter((p) => !isReplyRecord(p));
    const filtered = user?.uid
      ? topLevelPosts.filter((p) => p.uid !== user.uid)
      : topLevelPosts;

    // Check SecureStore keys
    let pk = null, pub = null, fk = null;
    let keysAccessible = false;
    try {
      pk = await SecureStore.getItemAsync("privateKey");
      pub = await SecureStore.getItemAsync("publicKey");
      fk = await SecureStore.getItemAsync("feedKey");
      if (pk && pub && fk) {
        keysAccessible = true;
      }
    } catch (e) {
      console.warn("[BG Task] SecureStore keys inaccessible:", e);
    }

    let decryptedPosts = [];
    if (keysAccessible) {
      decryptedPosts = await decryptPostsOrReplies(filtered, {
        currentUserUid: user?.uid,
        feedKey: fk,
        publicKey: pub,
        privateKey: pk,
      });
      await saveFeedToCache(decryptedPosts, null);
    } else {
      await saveFeedToCache(null, filtered);
    }

    // Prefetch replies/comments for the top 15 posts
    const targetPosts = keysAccessible ? decryptedPosts : filtered;
    const postsToPrefetch = targetPosts.slice(0, 15);

    await Promise.all(
      postsToPrefetch.map(async (post) => {
        const postId = post.postId ?? post.replyId ?? post.id;
        if (!postId) return;

        try {
          const res = await api.get(`/posts/${postId}/replies`, {
            params: { page: 1, limit: 20 },
          });
          const rawReplies = res.data || [];

          if (keysAccessible) {
            const decryptedReplies = await decryptPostsOrReplies(rawReplies, {
              currentUserUid: user?.uid,
              feedKey: fk,
              publicKey: pub,
              privateKey: pk,
              parentFeedKey: post.feedKey,
            });
            await saveRepliesToCache(postId, decryptedReplies, null);
          } else {
            await saveRepliesToCache(postId, null, rawReplies);
          }
        } catch (err) {
          console.warn(`[BG Task] Failed to prefetch replies for post:`, err);
        }
      })
    );

    // Fetch profiles & profile stats
    if (targetPosts.length > 0) {
      await cacheProfiles(targetPosts);
    }

    console.log("[BG Task] finished execution successfully");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[BG Task] execution failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const initializeBackgroundTask = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_IDENTIFIER);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_IDENTIFIER, {
        minimumInterval: MINIMUM_INTERVAL,
      });
      console.log(`[BG Task] Registered successfully with interval: ${MINIMUM_INTERVAL}s`);
    } else {
      console.log("[BG Task] Task is already registered");
    }
  } catch (error) {
    console.error("[BG Task] Registration failed:", error);
  }
};

export const unregisterBackgroundTask = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_IDENTIFIER);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_IDENTIFIER);
      console.log("[BG Task] Unregistered successfully");
    }
  } catch (error) {
    console.error("[BG Task] Unregistration failed:", error);
  }
};