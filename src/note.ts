export type LegacyNote = {
  alias: string;
  title: string | null;
  content: string;
  password: string | null;
  status: string;
  isDeleted: boolean;
  isExpired: boolean;
};

export type PublicNoteState =
  | { kind: "available"; note: LegacyNote }
  | { kind: "protected"; note: LegacyNote }
  | { kind: "unavailable" };

const ACTIVE_STATUSES = new Set(["active", "1"]);

export function publicNoteState(note: LegacyNote): PublicNoteState {
  if (
    note.isDeleted ||
    note.isExpired ||
    !ACTIVE_STATUSES.has(note.status.trim()) ||
    note.content.trim() === ""
  ) {
    return { kind: "unavailable" };
  }
  if (note.password?.trim()) return { kind: "protected", note };
  return { kind: "available", note };
}
