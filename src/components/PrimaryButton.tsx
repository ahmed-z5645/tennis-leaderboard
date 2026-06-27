import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

/** The chunky green "pressable" CTA used across the app. */
export default function PrimaryButton({ children, disabled, style, ...rest }: PrimaryButtonProps) {
  return (
    <button
      disabled={disabled}
      className="w-full rounded-2xl p-4 text-[17px] font-black disabled:cursor-not-allowed"
      style={{
        background: disabled ? 'var(--color-edge)' : 'var(--color-green)',
        color: disabled ? 'var(--color-muted)' : '#ffffff',
        boxShadow: disabled ? '0 4px 0 #c5c5c5' : '0 4px 0 var(--color-green-dark)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
