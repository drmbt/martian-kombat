// The full Mars College roster as shown on the select screen. `playable`
// flips to true once a character has frame data + a packed sprite sheet.
export interface RosterEntry {
  id: string;
  name: string;
  playable: boolean;
}

export const ROSTER: RosterEntry[] = [
  { id: 'vincent', name: 'VINCENT', playable: true },
  { id: 'yulia', name: 'YULIA', playable: true },
  { id: 'catherine', name: 'CATHERINE', playable: true },
  { id: 'flo', name: 'FLO', playable: true },
  { id: 'freeman', name: 'FREEMAN', playable: false },
  { id: 'gene', name: 'GENE', playable: true },
  { id: 'kirby', name: 'KIRBY', playable: true },
  { id: 'marzipan', name: 'MARZIPAN', playable: true },
];
