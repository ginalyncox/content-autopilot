// Brand rules from the Gina Makes Style Guide (Notion + brand/README.md on GitHub).
// Drafts that break a rule can't be approved until they're fixed.

export const BRAND = {
  name: 'Gina Makes',
  tagline: 'Games, tools, and curious creations.',
  owner: 'Gina Makes LLC',
  gameCredit: 'A game by Gina Lyn Cox · Gina Makes',
  toolFooter: 'A Gina Makes tool.',
  copyright: '© 2026 Gina Makes LLC',
  voice:
    'Warm, playful and plain-spoken. A little silly, like a town crier who takes bread very seriously. ' +
    'Short sentences, everyday words, at most one joke and one exclamation mark. Never pushy or salesy. ' +
    'Say "license" for what a purchase gives you. No urgency, no superlatives, never hide a cost.',
};

interface Rule {
  id: string;
  test: (text: string) => boolean;
  message: string;
}

const RULES: Rule[] = [
  {
    id: 'retired-name',
    test: (t) => /gina\s*makes\s*bread\s*\+/i.test(t),
    message: 'Uses the retired name "Gina Makes Bread + <dev>". Say "Gina Makes".',
  },
  {
    id: 'other-company',
    test: (t) => /\bModuleOS\b/i.test(t),
    message: 'Names a company other than Gina Makes LLC.',
  },
  {
    id: 'donate',
    test: (t) => /\bdonat(e|es|ed|ing|ion|ions)\b/i.test(t),
    message: 'Says "donate". Use license language instead.',
  },
  {
    id: 'urgency',
    test: (t) => /\b(act now|hurry|limited time|don'?t miss out|last chance)\b/i.test(t),
    message: 'Uses pushy urgency.',
  },
  {
    id: 'exclamations',
    test: (t) => (t.match(/!/g) || []).length > 1,
    message: 'Has more than one exclamation mark.',
  },
  {
    id: 'private-partners',
    test: (t) => /\b(Ganjier Guild|ICAN|Wildwood Games)\b/i.test(t),
    message: 'Names a partner that must stay off public materials.',
  },
];

export interface BrandIssue {
  id: string;
  message: string;
}

export function checkBrand(text: string): BrandIssue[] {
  return RULES.filter((r) => r.test(text)).map(({ id, message }) => ({ id, message }));
}
