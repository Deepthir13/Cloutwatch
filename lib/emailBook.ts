export type EmailBookEntry = {
  id: string;
  email: string;
  label: string;
  brand: string | null;
  usedCount: number;
  lastUsed: string | null;
};

type EmailBookState = {
  entries: EmailBookEntry[];
};

const seededEntries: EmailBookEntry[] = [
  {
    id: "email-loreal-team",
    email: "loreal.team@gmail.com",
    label: "L'Oreal Brand Team",
    brand: "L'Oreal",
    usedCount: 0,
    lastUsed: null,
  },
  {
    id: "email-nike-partnerships",
    email: "nike.partnerships@gmail.com",
    label: "Nike Partnerships",
    brand: "Nike",
    usedCount: 0,
    lastUsed: null,
  },
  {
    id: "email-glossier-collab",
    email: "glossier.collab@gmail.com",
    label: "Glossier Collab Team",
    brand: "Glossier",
    usedCount: 0,
    lastUsed: null,
  },
];

const globalForEmailBook = globalThis as typeof globalThis & {
  creatorIqEmailBook?: EmailBookState;
};

const state =
  globalForEmailBook.creatorIqEmailBook ??
  (globalForEmailBook.creatorIqEmailBook = {
    entries: seededEntries,
  });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const emailBook = {
  getAll() {
    return state.entries;
  },
  add(email: string, label: string, brand: string | null) {
    const normalizedEmail = normalizeEmail(email);
    const existing = state.entries.find(
      (entry) => normalizeEmail(entry.email) === normalizedEmail,
    );

    if (existing) {
      return existing;
    }

    const entry: EmailBookEntry = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      label: label.trim() || normalizedEmail,
      brand: brand?.trim() || null,
      usedCount: 0,
      lastUsed: null,
    };

    state.entries = [entry, ...state.entries];

    return entry;
  },
  remove(id: string) {
    state.entries = state.entries.filter((entry) => entry.id !== id);
  },
  incrementUsage(email: string) {
    const normalizedEmail = normalizeEmail(email);
    let updatedEntry: EmailBookEntry | null = null;

    state.entries = state.entries.map((entry) => {
      if (normalizeEmail(entry.email) !== normalizedEmail) {
        return entry;
      }

      updatedEntry = {
        ...entry,
        usedCount: entry.usedCount + 1,
        lastUsed: new Date().toISOString(),
      };

      return updatedEntry;
    });

    return updatedEntry;
  },
  getByBrand(brand: string) {
    return state.entries.filter((entry) => entry.brand === brand);
  },
};
