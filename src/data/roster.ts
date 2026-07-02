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
  { id: 'catherine', name: 'CATHERINE', playable: false },
  { id: 'flo', name: 'FLO', playable: false },
  { id: 'freeman', name: 'FREEMAN', playable: false },
  { id: 'gene', name: 'GENE', playable: false },
  { id: 'kirby', name: 'KIRBY', playable: false },
  { id: 'marzipan', name: 'MARZIPAN', playable: false },
];
