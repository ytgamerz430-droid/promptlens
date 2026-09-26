/** Original aperture-mark logo. Do not copy any third-party logo. */
export default function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16 2.5 L16 16 L27.7 9.25" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M27.7 22.75 L16 16 L16 29.5" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity="0.55" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}
