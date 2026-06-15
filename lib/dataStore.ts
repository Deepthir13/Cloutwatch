export type CreatorRow = Record<string, string | number | boolean | null>;

export const REQUIRED_COLS: string[] = [
  "creator_handle",
  "tier",
  "platform",
  "followers",
  "avg_views",
  "eng_rate",
  "CPE",
  "EMV",
  "past_brand_fit_score",
  "niche",
  "sentiment_score",
  "fake_follower_flag",
  "brand",
  "prev_eng_rate",
  "prev_CPE",
  "prev_EMV",
  "prev_sentiment_score",
  "last_campaign_date",
];

type StoreState = {
  rows: CreatorRow[];
  custom: boolean;
};

const globalForDataStore = globalThis as typeof globalThis & {
  creatorIqDataStore?: StoreState;
};

const state =
  globalForDataStore.creatorIqDataStore ??
  (globalForDataStore.creatorIqDataStore = {
    rows: [],
    custom: false,
  });

export const dataStore = {
  get() {
    return state.rows;
  },
  set(rows: CreatorRow[]) {
    state.rows = rows;
    state.custom = true;
  },
  clear() {
    state.rows = [];
    state.custom = false;
  },
  isCustom() {
    return state.custom;
  },
};
