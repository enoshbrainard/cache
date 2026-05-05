// Shared color palette derived from /app/design_guidelines.json
// "Color is Function Only" - reserved for status only.

export const COLORS = {
  bg: '#0A0A0A',
  card: '#141414',
  border: 'rgba(255,255,255,0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  primary: '#3366FF',
  success: '#00CC66',
  warning: '#FFCC00',
  danger: '#FF3333',
  info: '#00A8FF',
};

// Stable per-node color from a small palette (visualization only).
const NODE_HUES = ['#3366FF', '#00A8FF', '#7C5CFF', '#00CC66', '#FFCC00', '#FF7A1A', '#FF3D9A', '#5DD9FF', '#A0FF6E', '#FF7676'];

export function colorForNode(nodeId) {
  if (!nodeId) return '#666';
  const n = parseInt(String(nodeId).replace(/\D/g, ''), 10) || 0;
  return NODE_HUES[(n - 1 + NODE_HUES.length) % NODE_HUES.length];
}
