import React from 'react';

export const BrandMark: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="var(--accent)" />
    <path d="M8.5 7H18.5L23.5 12V25H8.5V7Z" fill="#FCFAF7" />
    <path d="M18.5 7L23.5 12H18.5V7Z" fill="#F2D0C9" />
    <rect x="11" y="14.5" width="9.5" height="1.6" rx="0.8" fill="#18181B" />
    <rect x="11" y="17.8" width="7.5" height="1.6" rx="0.8" fill="#71717A" />
    <rect x="11" y="21.1" width="5.5" height="1.6" rx="0.8" fill="var(--accent)" />
  </svg>
);
