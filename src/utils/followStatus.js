const ACCEPTED_STATUSES = new Set([
  "accepted",
  "following",
  "followed",
  "friends",
  "connected",
  "approved",
]);

const PENDING_STATUSES = new Set([
  "pending",
  "requested",
  "request_sent",
  "sent",
  "awaiting",
]);

function normalizeStringStatus(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (ACCEPTED_STATUSES.has(normalized)) return "accepted";
  if (PENDING_STATUSES.has(normalized)) return "pending";
  if (normalized === "none" || normalized === "not_following") return "none";

  return null;
}

export function getEntityUid(entity) {
  return (
    entity?.uid ??
    entity?.id ??
    entity?.userId ??
    entity?.followingId ??
    entity?.followerId ??
    entity?.author?.uid ??
    null
  );
}

function hasUid(list, uid) {
  if (!Array.isArray(list) || !uid) return false;

  return list.some((item) => {
    if (typeof item === "string" || typeof item === "number") {
      return String(item) === String(uid);
    }

    return (
      String(item?.uid ?? item?.id ?? item?.userId ?? item?.followingId) ===
      String(uid)
    );
  });
}

export function getFollowStatus(
  entity,
  localStatus = "none",
  currentUser = null,
) {
  const targetUid = getEntityUid(entity);

  // 1) Local overrides: reflect the most recent user action immediately
  if (localStatus === "none") return "none";
  if (localStatus === "accepted") return "accepted";
  if (localStatus === "pending") return "pending";

  // 2) Trust explicit server-provided statuses next
  const stringStatus =
    normalizeStringStatus(entity?.followStatus) ??
    normalizeStringStatus(entity?.followingStatus) ??
    normalizeStringStatus(entity?.relationshipStatus) ??
    normalizeStringStatus(entity?.followRequestStatus) ??
    normalizeStringStatus(entity?.relationship?.status);
  if (stringStatus) return stringStatus;

  // 3) Infer from booleans/keys only when nothing else is known
  if (
    entity?.isFollowing === true ||
    entity?.isFollowed === true ||
    entity?.following === true ||
    entity?.relationship?.isFollowing === true ||
    !!entity?.encryptedFeedKey ||
    !!entity?.feedKey
  ) {
    return "accepted";
  }

  if (
    entity?.isPending === true ||
    entity?.isRequested === true ||
    entity?.requestPending === true ||
    entity?.relationship?.isPending === true
  ) {
    return "pending";
  }

  if (
    hasUid(currentUser?.following, targetUid) ||
    hasUid(currentUser?.followingIds, targetUid) ||
    hasUid(currentUser?.acceptedFollowing, targetUid)
  ) {
    return "accepted";
  }

  if (
    hasUid(currentUser?.pendingFollowing, targetUid) ||
    hasUid(currentUser?.requestedFollowing, targetUid) ||
    hasUid(currentUser?.followRequestsSent, targetUid)
  ) {
    return "pending";
  }

  return localStatus || "none";
}
