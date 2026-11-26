/** A dive site: its water, sea floor and who lives there. Counts are per species / flora id. */
export interface Region {
  id: string;
  name: string;
  emoji: string;
  seed: number;
  water: number;
  fog: number;
  /** Multiplier on the scene lights. */
  light: number;
  sand: number;
  mud: number;
  /** Colour of the zone boundary. */
  wall: number;
  fauna: Record<string, number>;
  flora: Record<string, number>;
}

export const REGIONS: Region[] = [
  {
    id: 'clay-bay',
    name: 'Clay Bay',
    emoji: '🌊',
    seed: 7,
    water: 0x1f86b0,
    fog: 0.024,
    light: 1,
    sand: 0xcdb98c,
    mud: 0x8d9aa0,
    wall: 0xbfeeff,
    fauna: {
      ophthalmosaurus: 3,
      cryptoclidus: 3,
      muraenosaurus: 2,
      liopleurodon: 2,
      peloneustes: 2,
      metriorhynchus: 3,
      leedsichthys: 1,
      ammonite: 9,
      belemnite: 9,
    },
    flora: { crinoid: 18, coral: 14, seaweed: 16, sponge: 8 },
  },
  {
    id: 'coral-garden',
    name: 'Coral Garden',
    emoji: '🪸',
    seed: 21,
    water: 0x2bb3c0,
    fog: 0.018,
    light: 1.1,
    sand: 0xf1e3b0,
    mud: 0xc9d8a8,
    wall: 0xfff2c8,
    fauna: {
      ammonite: 14,
      belemnite: 12,
      metriorhynchus: 4,
      cryptoclidus: 3,
      peloneustes: 3,
      ophthalmosaurus: 1,
      liopleurodon: 1,
      muraenosaurus: 1,
    },
    flora: { coral: 34, seaweed: 24, sponge: 14, crinoid: 6 },
  },
  {
    id: 'deep-blue',
    name: 'Deep Blue',
    emoji: '🌌',
    seed: 43,
    water: 0x0f4c75,
    fog: 0.03,
    light: 0.7,
    sand: 0x7d8fa6,
    mud: 0x4d5f78,
    wall: 0x9fc4ff,
    fauna: {
      leedsichthys: 2,
      ophthalmosaurus: 4,
      liopleurodon: 3,
      muraenosaurus: 2,
      cryptoclidus: 1,
      peloneustes: 1,
      metriorhynchus: 1,
      belemnite: 14,
      ammonite: 4,
    },
    flora: { crinoid: 28, sponge: 14, seaweed: 4, coral: 2 },
  },
];
