export type MeetingNote = {
  id: string;
  brand: string;
  date: string;
  decisions_made: string[];
  action_items: {
    owner: string;
    task: string;
    due: string;
  }[];
  open_questions: string[];
  next_meeting: string;
  key_themes: string[];
  raw_notes: string;
};

type MeetingStoreState = {
  notes: MeetingNote[];
};

const globalForMeetingStore = globalThis as typeof globalThis & {
  creatorIqMeetingStore?: MeetingStoreState;
};

const state =
  globalForMeetingStore.creatorIqMeetingStore ??
  (globalForMeetingStore.creatorIqMeetingStore = {
    notes: [],
  });

export const meetingStore = {
  get() {
    return state.notes;
  },
  add(note: MeetingNote) {
    state.notes = [note, ...state.notes];

    return note;
  },
  getByBrand(brand: string) {
    return state.notes.filter((note) => note.brand === brand);
  },
  clear(brand?: string) {
    if (brand) {
      state.notes = state.notes.filter((note) => note.brand !== brand);
      return;
    }

    state.notes = [];
  },
};
