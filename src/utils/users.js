import api from "./api";

export const getPaginatedData = (payload) => payload?.data ?? payload ?? [];

export const getPaginationMeta = (payload) => payload?.pagination ?? null;

export async function findUserByUsername(username) {
  if (!username) return null;

  let page = 1;
  const limit = 100;

  while (page <= 20) {
    const res = await api.get("/user/all", {
      params: { page, limit },
    });

    const users = getPaginatedData(res.data);
    const match = users.find((item) =>
      String(item?.username ?? "").toLowerCase() === String(username).toLowerCase()
    );

    if (match) return match;

    const pagination = getPaginationMeta(res.data);
    if (!pagination?.hasNextPage) break;

    page += 1;
  }

  return null;
}

export async function resolveUserId({ uid, username }) {
  if (uid) return uid;
  const found = await findUserByUsername(username);
  return found?.uid ?? null;
}
