export interface ArrowColor {
  fill: string;
  stroke: string;
  glow: string;
  name: string;
}

// 8 cheerful, distinct colors (deliberately avoiding alarm red so blocked-arrow red flash is unmistakable)
export const ARROW_PALETTE: ArrowColor[] = [
  { fill: '#38BDF8', stroke: '#0369A1', glow: 'rgba(56, 189, 248, 0.35)', name: 'Sky' },
  { fill: '#34D399', stroke: '#047857', glow: 'rgba(52, 211, 153, 0.35)', name: 'Mint' },
  { fill: '#FBBF24', stroke: '#B45309', glow: 'rgba(251, 191, 36, 0.35)', name: 'Sun' },
  { fill: '#A78BFA', stroke: '#6D28D9', glow: 'rgba(167, 139, 250, 0.35)', name: 'Lavender' },
  { fill: '#F472B6', stroke: '#BE185D', glow: 'rgba(244, 114, 182, 0.35)', name: 'Blossom' },
  { fill: '#FB923C', stroke: '#C2410C', glow: 'rgba(251, 146, 60, 0.35)', name: 'Tangerine' },
  { fill: '#2DD4BF', stroke: '#0F766E', glow: 'rgba(45, 212, 191, 0.35)', name: 'Teal' },
  { fill: '#818CF8', stroke: '#4338CA', glow: 'rgba(129, 140, 248, 0.35)', name: 'Periwinkle' },
];

export const BLOCKED_COLOR: ArrowColor = {
  fill: '#EF4444',
  stroke: '#991B1B',
  glow: 'rgba(239, 68, 68, 0.5)',
  name: 'Blocked',
};
