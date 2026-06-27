import { initialOf, shadowFor } from '../lib/theme';

interface AvatarCircleProps {
  name: string;
  color: string;
  /** Diameter in px. */
  size?: number;
  /** Render the chunky 3D drop shadow (default true). */
  shadow?: boolean;
}

/** Colored circle with the player's white initial — the app's avatar primitive. */
export default function AvatarCircle({ name, color, size = 46, shadow = true }: AvatarCircleProps) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-black text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.39),
        boxShadow: shadow ? `0 3px 0 ${shadowFor(color)}` : 'none',
      }}
    >
      {initialOf(name)}
    </div>
  );
}
