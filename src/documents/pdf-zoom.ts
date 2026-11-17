export type Zoom = { scale: number; x: number; y: number };

export const fitPage: Zoom = { scale: 1, x: 0, y: 0 };

export function moveZoom(
  start: Zoom,
  from: { x: number; y: number },
  to: { x: number; y: number },
  ratio: number,
  width: number,
  height: number,
): Zoom {
  const scale = Math.min(6, Math.max(1, start.scale * ratio));
  const factor = scale / start.scale;
  const maxX = width * (scale - 1) / 2;
  const maxY = height * (scale - 1) / 2;
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, to.x - (from.x - start.x) * factor)),
    y: Math.min(maxY, Math.max(-maxY, to.y - (from.y - start.y) * factor)),
  };
}
