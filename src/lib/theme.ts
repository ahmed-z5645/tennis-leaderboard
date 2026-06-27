// Avatar palette + small presentational helpers.
// Colors and their paired "pressable" shadows come straight from the design.

export interface AvatarColor {
  color: string;
  shadow: string;
}

export const AVATAR_COLORS: AvatarColor[] = [
  { color: '#5B54E8', shadow: '#4340B0' },
  { color: '#DB3A8C', shadow: '#B02870' },
  { color: '#D97706', shadow: '#B05C00' },
  { color: '#059669', shadow: '#027050' },
  { color: '#DC2626', shadow: '#B01818' },
  { color: '#0891B2', shadow: '#066888' },
  { color: '#7C3AED', shadow: '#5A28C0' },
  { color: '#EA580C', shadow: '#B83C08' },
];

export const DEFAULT_AVATAR_COLOR = AVATAR_COLORS[0].color;

/** Darker shadow paired with an avatar color (fallback for custom colors). */
export function shadowFor(color: string): string {
  return AVATAR_COLORS.find((c) => c.color.toLowerCase() === color.toLowerCase())?.shadow ?? '#333333';
}

/** First character of a display name, uppercased. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}
