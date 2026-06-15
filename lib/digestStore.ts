export type WeeklyDigest = {
  id: string;
  brand: string;
  toEmail: string;
  subject: string;
  content: string;
  createdAt: string;
};

type DigestStoreState = {
  digests: WeeklyDigest[];
};

const globalForDigestStore = globalThis as typeof globalThis & {
  creatorIqDigestStore?: DigestStoreState;
};

const state =
  globalForDigestStore.creatorIqDigestStore ??
  (globalForDigestStore.creatorIqDigestStore = {
    digests: [],
  });

export const weeklyDigestStore = {
  getAll() {
    return state.digests;
  },
  getByBrand(brand: string) {
    return state.digests.filter((digest) => digest.brand === brand);
  },
  add(digest: WeeklyDigest) {
    state.digests = [digest, ...state.digests];

    return digest;
  },
};
