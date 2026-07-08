import { decryptAsymmetric, decryptData } from "./encryption";

const getPostEncryptedFeedKey = (post) => {
  return (
    post?.encryptedFeedKey ??
    post?.follow?.encryptedFeedKey ??
    post?.relationship?.encryptedFeedKey ??
    post?.author?.encryptedFeedKey ??
    null
  );
};

export async function decryptPostOrReply(item, options = {}) {
  if (!item) return null;

  const {
    currentUserUid = null,
    feedKey = null,
    feedKeysCache = {},
    publicKey = null,
    privateKey = null,
    cacheFeedKey = null,
    updateFollowingStatus = null,
    parentFeedKey = null,
  } = options;

  const itemId = item.postId ?? item.replyId ?? item.id;
  const authorId = item.author?.uid ?? item.uid;
  const encryptedFeedKey = getPostEncryptedFeedKey(item);
  let postFeedKey = null;

  // Key resolution
  if (authorId && authorId === currentUserUid && feedKey) {
    postFeedKey = feedKey;
  } else if (authorId && feedKeysCache[authorId]) {
    postFeedKey = feedKeysCache[authorId];
  } else if (encryptedFeedKey && publicKey && privateKey) {
    try {
      postFeedKey = await decryptAsymmetric(
        encryptedFeedKey,
        publicKey,
        privateKey,
      );
      if (authorId && cacheFeedKey) {
        cacheFeedKey(authorId, postFeedKey);
      }
      if (authorId && updateFollowingStatus) {
        updateFollowingStatus(authorId, "accepted");
      }
    } catch (e) {
      console.warn("Failed to decrypt feed key in decryptPostOrReply", e);
    }
  } else if (parentFeedKey) {
    postFeedKey = parentFeedKey;
  }

  let content = item.content ?? "";
  let isDecrypted = false;

  // Decrypt Content
  if (item.encryptedContent && postFeedKey) {
    try {
      content = await decryptData(item.encryptedContent, postFeedKey);
      isDecrypted = true;
    } catch (e) {
      console.warn("Failed to decrypt content in decryptPostOrReply", e);
    }
  } else if (item.content) {
    isDecrypted = true;
  }

  let media = item.media ?? null;
  // Decrypt Media
  if (item.encryptedMedia && postFeedKey) {
    try {
      const rawMedia = await decryptData(item.encryptedMedia, postFeedKey);
      if (typeof rawMedia === "string") {
        media = rawMedia.trim();
      } else if (rawMedia && typeof rawMedia === "object") {
        media = rawMedia.toString();
      } else {
        media = rawMedia;
      }
    } catch (e) {
      console.warn("Failed to decrypt media in decryptPostOrReply", e);
    }
  }

  const decryptedItem = {
    ...item,
    postId: itemId,
    uid: authorId,
    likesCount: item.likesCount ?? 0,
    repostsCount: item.repostsCount ?? 0,
    repliesCount: item.repliesCount ?? 0,
    content,
    media,
    isDecrypted,
    feedKey: postFeedKey,
  };

  return decryptedItem;
}

export async function decryptPostsOrReplies(items, options = {}) {
  if (!items || !Array.isArray(items)) return [];
  return Promise.all(items.map((item) => decryptPostOrReply(item, options)));
}

