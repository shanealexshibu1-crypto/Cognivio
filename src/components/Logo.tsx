import React from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="5" y="5" width="90" height="90" rx="28" fill="#FAFCF4" stroke="#E6EBD1" strokeWidth="2.5" />
      <rect 
        x="32.5" 
        y="32.5" 
        width="35" 
        height="35" 
        rx="10" 
        transform="rotate(45 50 50)" 
        fill="#5E6346" 
      />
    </svg>
  );
}