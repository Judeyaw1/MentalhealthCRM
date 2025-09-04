import React from 'react';
import logo from '../assets/logo.png';  // ✅ Import logo directly

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 24 }: LogoProps) {
  return (
    <img
      src={logo}  // ✅ Use imported asset
      alt="NewLife CRM Logo"
      width={size}
      height={size}
      className={className}
    />
  );
}