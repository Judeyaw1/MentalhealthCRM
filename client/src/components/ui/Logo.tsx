import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 24 }: LogoProps) {
  const fontSize = Math.max(size * 0.8, 16); // Scale emoji size based on container size
  
  return (
    <span 
      className={className}
      style={{ fontSize: `${fontSize}px` }}
    >
      🌱
    </span>
  );
}