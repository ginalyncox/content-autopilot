// One piece of content moving through the weekly loop.
// Statuses match the Notion "Gina Makes Content & Launches" database.

export type Status = 'Idea' | 'Draft' | 'Ready' | 'Published';
export type Channel = 'Website' | 'Email';

export interface ContentItem {
  id: string;
  name: string; // headline or email subject
  channel: Channel;
  status: Status;
  publishDate: string; // YYYY-MM-DD, America/Chicago
  body: string; // markdown
  site?: string; // which publisher target, e.g. "hearthvale" or "ginamakes"
  result?: string; // what happened when it was published
  rejected?: boolean;
}

/** Allowed moves. Nothing reaches Published without passing through Ready (your approval). */
const NEXT: Record<Status, Status[]> = {
  Idea: ['Draft'],
  Draft: ['Ready', 'Idea'],
  Ready: ['Published', 'Draft'],
  Published: [],
};

export function canMove(from: Status, to: Status): boolean {
  return NEXT[from].includes(to);
}
