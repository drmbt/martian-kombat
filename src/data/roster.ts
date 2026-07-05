// The full Mars College roster as shown on the select screen. `playable`
// flips to true once a character has frame data + a packed sprite sheet.
// `mesh3d` flips to true once a character has a baked GLB (tools/mesh-manifest)
// — the select screen gates the 3D-mode roster on it (others read "3D SOON").
export interface RosterEntry {
  id: string;
  name: string;
  playable: boolean;
  mesh3d?: boolean;
}

export const ROSTER: RosterEntry[] = [
  { id: 'vincent', name: 'VINCENT', playable: true, mesh3d: true },
  { id: 'yulia', name: 'YULIA', playable: true, mesh3d: true },
  { id: 'catherine', name: 'CATHERINE', playable: true },
  { id: 'flo', name: 'FLO', playable: true, mesh3d: true },
  { id: 'freeman', name: 'FREEMAN', playable: true },
  { id: 'gene', name: 'GENE', playable: true },
  { id: 'kirby', name: 'KIRBY', playable: true },
  { id: 'marzipan', name: 'MARZIPAN', playable: true },
  { id: 'bodhi', name: 'BODHI', playable: true },
  { id: 'cat', name: 'CAT', playable: true },
  { id: 'chebel', name: 'CHEBEL', playable: true },
  { id: 'ygor', name: 'YGOR', playable: true },
  // 3D-only so far: has a baked GLB but no 2D sprite sheet yet
  { id: 'rapha', name: 'RAPHA', playable: false, mesh3d: true },
];
