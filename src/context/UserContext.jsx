import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import api, {
  clearApiAuthToken,
  setApiAuthToken,
  setApiUnauthorizedHandler,
} from "../utils/api";
import {
  initializeBackgroundTask,
  unregisterBackgroundTask,
} from "../utils/bgTask";
import { registerForPushNotificationsAsync } from "../utils/notifications";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const UserContext = createContext(null);

const STORAGE_KEYS = {
  user: "user",
  token: "token",
  privateKey: "privateKey",
  publicKey: "publicKey",
  feedKey: "feedKey",
};

function persistUser(nextUser) {
  if (!nextUser) {
    return AsyncStorage.removeItem(STORAGE_KEYS.user);
  }

  return AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
}

async function safeGetSecureItem(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeDeleteSecureItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

async function safeRemoveStorageItem(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function parseUser(raw) {
  if (!raw || raw === "null") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistToken(nextToken) {
  if (!nextToken) {
    return AsyncStorage.removeItem(STORAGE_KEYS.token);
  }

  return AsyncStorage.setItem(STORAGE_KEYS.token, nextToken);
}

export function UserProvider({ children }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);
  const [isHydrating, setIsHydrating] = useState(true);

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [feedKey, setFeedKey] = useState(null);

  const [followingStatus, setFollowingStatus] = useState({});
  const [activities, setActivities] = useState([]);

  // Engagement states
  const [likedPosts, setLikedPosts] = useState({});
  const [dislikedPosts, setDislikedPosts] = useState({});
  const [repostedPosts, setRepostedPosts] = useState({});

  // No-op to avoid any feed key caching; legacy references cleared here intentionally
  const setFeedKeysCache = () => {};

  const isLoggedIn = !!user && !!token;

  const hydrate = async () => {
    if (mountedRef.current) setIsHydrating(true);
    try {
      const [
        userRaw,
        storedToken,
        pk,
        pub,
        fk,
        followingStatusRaw,
        activitiesRaw,
        likedRaw,
        dislikedRaw,
        repostedRaw,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.token),
        safeGetSecureItem(STORAGE_KEYS.privateKey),
        safeGetSecureItem(STORAGE_KEYS.publicKey),
        safeGetSecureItem(STORAGE_KEYS.feedKey),
        AsyncStorage.getItem("followingStatus"),
        AsyncStorage.getItem("activities"),
        AsyncStorage.getItem("likedPosts"),
        AsyncStorage.getItem("dislikedPosts"),
        AsyncStorage.getItem("repostedPosts"),
      ]);

      if (!mountedRef.current) return;
      const parsedUser = parseUser(userRaw);
      const normalizedToken =
        storedToken && storedToken !== "null" ? storedToken : null;

      setUser(parsedUser);
      setToken(normalizedToken);
      setApiAuthToken(normalizedToken);
      setPrivateKey(pk);
      setPublicKey(pub);
      setFeedKey(fk);
      if (followingStatusRaw) {
        try {
          setFollowingStatus(JSON.parse(followingStatusRaw));
        } catch {
          setFollowingStatus({});
        }
      }
      if (activitiesRaw) {
        try {
          setActivities(JSON.parse(activitiesRaw));
        } catch {
          setActivities([]);
        }
      }
      if (likedRaw) {
        try {
          setLikedPosts(JSON.parse(likedRaw));
        } catch {
          setLikedPosts({});
        }
      }
      if (dislikedRaw) {
        try {
          setDislikedPosts(JSON.parse(dislikedRaw));
        } catch {
          setDislikedPosts({});
        }
      }
      if (repostedRaw) {
        try {
          setRepostedPosts(JSON.parse(repostedRaw));
        } catch {
          setRepostedPosts({});
        }
      }
    } finally {
      if (mountedRef.current) setIsHydrating(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      await hydrate();
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const registerPush = async () => {
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await api.patch("/user/push-token", { pushToken });
          }
        } catch (error) {
          console.warn("Failed to register/upload push token:", error);
        }
      };
      registerPush();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;

      let type = null;
      const lowerTitle = (title || "").toLowerCase();
      if (lowerTitle.includes("like")) {
        type = "post_liked";
      } else if (lowerTitle.includes("dislike")) {
        type = "post_disliked";
      } else if (lowerTitle.includes("comment") || lowerTitle.includes("reply")) {
        type = "post_commented";
      } else if (lowerTitle.includes("follow")) {
        type = "follow_request_received";
      }

      if (type) {
        addActivity(type, data?.senderUsername || "system", body, {
          senderAvatar: data?.senderAvatar || null,
          postId: data?.postId || null,
        });
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { title, body, data } = response.notification.request.content;
      
      let type = null;
      const lowerTitle = (title || "").toLowerCase();
      if (lowerTitle.includes("like")) {
        type = "post_liked";
      } else if (lowerTitle.includes("dislike")) {
        type = "post_disliked";
      } else if (lowerTitle.includes("comment") || lowerTitle.includes("reply")) {
        type = "post_commented";
      } else if (lowerTitle.includes("follow")) {
        type = "follow_request_received";
      }

      if (type) {
        addActivity(type, data?.senderUsername || "system", body, {
          senderAvatar: data?.senderAvatar || null,
          postId: data?.postId || null,
        });
      }

      // Route the user to the correct tab in notifications
      if (lowerTitle.includes("follow")) {
        router.push({
          pathname: "/(tabs)/notifications",
          params: { tab: "requests" },
        });
      } else {
        router.push({
          pathname: "/(tabs)/notifications",
          params: { tab: "activity" },
        });
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [isLoggedIn, addActivity]);

  useEffect(() => {
    setApiUnauthorizedHandler(async () => {
      unregisterBackgroundTask().catch(console.error);

      await Promise.all([
        safeDeleteSecureItem(STORAGE_KEYS.privateKey),
        safeDeleteSecureItem(STORAGE_KEYS.publicKey),
        safeDeleteSecureItem(STORAGE_KEYS.feedKey),
        safeRemoveStorageItem(STORAGE_KEYS.user),
        safeRemoveStorageItem(STORAGE_KEYS.token),
        safeRemoveStorageItem("followingStatus"),
        safeRemoveStorageItem("activities"),
        safeRemoveStorageItem("likedPosts"),
        safeRemoveStorageItem("dislikedPosts"),
        safeRemoveStorageItem("repostedPosts"),
        safeRemoveStorageItem("profiles_cache"),
        safeRemoveStorageItem("cached_feed_posts_decrypted"),
        safeRemoveStorageItem("cached_feed_posts_raw"),
        safeRemoveStorageItem("cached_replies_by_post"),
        safeRemoveStorageItem("cached_follow_requests"),
      ]);

      queryClient.clear();

      setUser(null);
      setToken(null);
      clearApiAuthToken();
      setPrivateKey(null);
      setPublicKey(null);
      setFeedKey(null);
      setFeedKeysCache({});
      setFollowingStatus({});
      setActivities([]);
      setLikedPosts({});
      setDislikedPosts({});
      setRepostedPosts({});
    });

    return () => {
      setApiUnauthorizedHandler(null);
    };
  }, []);

  const updateFollowingStatus = useCallback((uid, status) => {
    if (!uid) return;
    setFollowingStatus((prev) => {
      if (prev[uid] === status) return prev;
      const next = { ...prev, [uid]: status };
      AsyncStorage.setItem("followingStatus", JSON.stringify(next)).catch(
        () => {},
      );
      return next;
    });
  }, []);

  const addActivity = async (type, targetName, description, metadata = null) => {
    setActivities((prev) => {
      const next = [
        {
          id: String(Date.now()),
          type,
          targetName,
          description,
          createdAt: new Date().toISOString(),
          metadata,
        },
        ...prev.slice(0, 19),
      ];
      AsyncStorage.setItem("activities", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // Engagement action handlers
  const toggleLike = useCallback(
    (postId) => {
      const currentlyLiked = !!likedPosts[postId];
      const nextLiked = !currentlyLiked;

      setLikedPosts((prev) => {
        const next = { ...prev, [postId]: nextLiked };
        AsyncStorage.setItem("likedPosts", JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });

      if (nextLiked) {
        setDislikedPosts((prev) => {
          const next = { ...prev, [postId]: false };
          AsyncStorage.setItem("dislikedPosts", JSON.stringify(next)).catch(
            () => {},
          );
          return next;
        });
      }

      api
        .post(`/posts/${postId}/like`)
        .then((res) => {
          const serverLiked = res.data.liked;
          if (serverLiked !== nextLiked) {
            setLikedPosts((prev) => {
              const next = { ...prev, [postId]: serverLiked };
              AsyncStorage.setItem("likedPosts", JSON.stringify(next)).catch(
                () => {},
              );
              return next;
            });
          }
        })
        .catch((e) => {
          console.error("Error toggling like in background:", e);
          setLikedPosts((prev) => {
            const next = { ...prev, [postId]: currentlyLiked };
            AsyncStorage.setItem("likedPosts", JSON.stringify(next)).catch(
              () => {},
            );
            return next;
          });
        });

      return { liked: nextLiked };
    },
    [likedPosts],
  );

  const toggleDislike = useCallback(
    (postId) => {
      const currentlyDisliked = !!dislikedPosts[postId];
      const nextDisliked = !currentlyDisliked;

      setDislikedPosts((prev) => {
        const next = { ...prev, [postId]: nextDisliked };
        AsyncStorage.setItem("dislikedPosts", JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });

      if (nextDisliked) {
        setLikedPosts((prev) => {
          const next = { ...prev, [postId]: false };
          AsyncStorage.setItem("likedPosts", JSON.stringify(next)).catch(
            () => {},
          );
          return next;
        });
      }

      api
        .post(`/posts/${postId}/dislike`)
        .then((res) => {
          const serverDisliked = res.data.disliked;
          if (serverDisliked !== nextDisliked) {
            setDislikedPosts((prev) => {
              const next = { ...prev, [postId]: serverDisliked };
              AsyncStorage.setItem("dislikedPosts", JSON.stringify(next)).catch(
                () => {},
              );
              return next;
            });
          }
        })
        .catch((e) => {
          console.error("Error toggling dislike in background:", e);
          setDislikedPosts((prev) => {
            const next = { ...prev, [postId]: currentlyDisliked };
            AsyncStorage.setItem("dislikedPosts", JSON.stringify(next)).catch(
              () => {},
            );
            return next;
          });
        });

      return { disliked: nextDisliked };
    },
    [dislikedPosts],
  );

  const toggleRepost = useCallback(
    (postId) => {
      const currentlyReposted = !!repostedPosts[postId];
      const nextReposted = !currentlyReposted;

      setRepostedPosts((prev) => {
        const next = { ...prev, [postId]: nextReposted };
        AsyncStorage.setItem("repostedPosts", JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });

      api
        .post(`/posts/${postId}/repost`)
        .then((res) => {
          const serverReposted = res.data.reposted;
          if (serverReposted !== nextReposted) {
            setRepostedPosts((prev) => {
              const next = { ...prev, [postId]: serverReposted };
              AsyncStorage.setItem("repostedPosts", JSON.stringify(next)).catch(
                () => {},
              );
              return next;
            });
          }
        })
        .catch((e) => {
          console.error("Error toggling repost in background:", e);
          setRepostedPosts((prev) => {
            const next = { ...prev, [postId]: currentlyReposted };
            AsyncStorage.setItem("repostedPosts", JSON.stringify(next)).catch(
              () => {},
            );
            return next;
          });
        });

      return { reposted: nextReposted };
    },
    [repostedPosts],
  );

  const updateUser = useCallback((nextUserOrUpdater) => {
    setUser((prev) => {
      const nextUser =
        typeof nextUserOrUpdater === "function"
          ? nextUserOrUpdater(prev)
          : nextUserOrUpdater;

      persistUser(nextUser ?? null).catch(() => {});
      return nextUser ?? null;
    });
  }, []);

  const setSession = useCallback(
    async ({
      user: nextUser,
      token: nextToken,
      privateKey: nextPrivateKey,
      publicKey: nextPublicKey,
      feedKey: nextFeedKey,
    }) => {
      const normalizedToken = nextToken ?? null;

      await persistToken(normalizedToken).catch(() => {});
      updateUser(nextUser ?? null);
      setToken(normalizedToken);
      setApiAuthToken(normalizedToken);
      setPrivateKey(nextPrivateKey ?? null);
      setPublicKey(nextPublicKey ?? null);
      setFeedKey(nextFeedKey ?? null);

      if (normalizedToken) {
        initializeBackgroundTask().catch(console.error);
      }
    },
    [updateUser],
  );

  const logout = async () => {
    unregisterBackgroundTask().catch(console.error);

    await Promise.all([
      safeDeleteSecureItem(STORAGE_KEYS.privateKey),
      safeDeleteSecureItem(STORAGE_KEYS.publicKey),
      safeDeleteSecureItem(STORAGE_KEYS.feedKey),
      safeRemoveStorageItem(STORAGE_KEYS.user),
      safeRemoveStorageItem(STORAGE_KEYS.token),
      safeRemoveStorageItem("followingStatus"),
      safeRemoveStorageItem("activities"),
      safeRemoveStorageItem("likedPosts"),
      safeRemoveStorageItem("dislikedPosts"),
      safeRemoveStorageItem("repostedPosts"),
      safeRemoveStorageItem("profiles_cache"),
      safeRemoveStorageItem("cached_feed_posts_decrypted"),
      safeRemoveStorageItem("cached_feed_posts_raw"),
      safeRemoveStorageItem("cached_replies_by_post"),
      safeRemoveStorageItem("cached_follow_requests"),
    ]);

    queryClient.clear();

    setUser(null);
    setToken(null);
    clearApiAuthToken();
    setPrivateKey(null);
    setPublicKey(null);
    setFeedKey(null);
    setFeedKeysCache({});
    setFollowingStatus({});
    setActivities([]);
    setLikedPosts({});
    setDislikedPosts({});
    setRepostedPosts({});
  };

  const value = useMemo(
    () => ({
      isHydrating,
      isLoggedIn,
      user,
      token,
      privateKey,
      publicKey,
      feedKey,
      hydrate,
      setSession,
      updateUser,
      logout,
      followingStatus,
      updateFollowingStatus,
      setFollowingStatus,
      activities,
      addActivity,
      likedPosts,
      dislikedPosts,
      repostedPosts,
      toggleLike,
      toggleDislike,
      toggleRepost,
    }),
    [
      isHydrating,
      isLoggedIn,
      user,
      token,
      privateKey,
      publicKey,
      feedKey,
      setSession,
      updateUser,
      updateFollowingStatus,
      followingStatus,
      activities,
      likedPosts,
      dislikedPosts,
      repostedPosts,
      toggleLike,
      toggleDislike,
      toggleRepost,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within <UserProvider />");
  }
  return ctx;
}
