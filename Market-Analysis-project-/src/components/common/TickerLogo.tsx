import { useState } from 'react';

interface TickerLogoProps {
  ticker: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
};

export function TickerLogo({ ticker, logoUrl, size = 'md', className = '' }: TickerLogoProps) {
  const [imgError, setImgError] = useState(false);
  const showLogo = logoUrl && !imgError;

  return (
    <div className={`rounded-lg bg-gradient-primary flex items-center justify-center text-white font-bold overflow-hidden ${sizeMap[size]} ${className}`}>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${ticker} logo`}
          className="w-full h-full object-contain bg-white"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{ticker.slice(0, 2)}</span>
      )}
    </div>
  );
}
