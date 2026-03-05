'use client';

interface PulseLogoIconProps {
  className?: string;
  size?: number;
}

/**
 * Pulse app logo icon — blue rounded background with white ECG/heartbeat waveform.
 */
export function PulseLogoIcon({ className, size = 20 }: PulseLogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Blue rounded-square background */}
      <rect width="100" height="100" rx="22" fill="#2563EB" />

      {/* White ECG / heartbeat line:
          - Starts flat from left edge
          - Swoops into an S-curve (stylised Pulse "S" mark)
          - Short flat bridge
          - Sharp QRS spike
          - Returns flat to right edge
      */}
      <path
        d="M4 50
           C4 34 16 22 16 34
           C16 46 28 58 28 46
           L38 46
           L44 20
           L50 80
           L56 46
           L96 46"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
