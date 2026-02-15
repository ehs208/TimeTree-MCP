/**
 * TimeTree Label Color Mappings
 *
 * Maps label_id (1-10) to color names and hex codes.
 * These colors are used to visually distinguish events in TimeTree calendars.
 */

export interface LabelColor {
  id: number;
  name: string;
  hex: string;
}

export const LABEL_COLORS: readonly LabelColor[] = [
  { id: 1, name: 'Emerald green', hex: '#2ecc87' },
  { id: 2, name: 'Modern cyan', hex: '#3dc2c8' },
  { id: 3, name: 'Deep sky blue', hex: '#47b2f7' },
  { id: 4, name: 'Pastel brown', hex: '#948078' },
  { id: 5, name: 'Midnight black', hex: '#212121' },
  { id: 6, name: 'Apple red', hex: '#e73b3b' },
  { id: 7, name: 'French rose', hex: '#f35f8c' },
  { id: 8, name: 'Coral pink', hex: '#fb7f77' },
  { id: 9, name: 'Bright orange', hex: '#fdc02d' },
  { id: 10, name: 'Soft violet', hex: '#b38bdc' },
] as const;

/**
 * Get color name from label_id
 */
export function getLabelColorName(labelId: number): string | null {
  const color = LABEL_COLORS.find(c => c.id === labelId);
  return color ? color.name : null;
}

/**
 * Get hex code from label_id
 */
export function getLabelColorHex(labelId: number): string | null {
  const color = LABEL_COLORS.find(c => c.id === labelId);
  return color ? color.hex : null;
}

/**
 * Get full color info from label_id
 */
export function getLabelColor(labelId: number): LabelColor | null {
  return LABEL_COLORS.find(c => c.id === labelId) || null;
}
