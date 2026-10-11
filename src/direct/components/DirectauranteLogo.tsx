import React from 'react';

interface DirectauranteLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dark' | 'light';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export const DirectauranteLogo: React.FC<DirectauranteLogoProps> = ({
  size = 'md',
  variant = 'dark',
  showText = true,
  showSubtitle = false,
  className = '',
  onClick,
}) => {
  // Dimensions for the icon
  const iconSizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const subtitleSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-xs',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Official Global Directaurante Badge Icon */}
      <div
        className={`${iconSizes[size]} shrink-0 relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}
      >
        <img
          src="/DIRECTAURANTE ICONO.PNG"
          alt="Directaurante Icono"
          className="w-full h-full object-contain select-none drop-shadow-[0_4px_10px_rgba(2,33,176,0.35)]"
          onError={(e) => {
            // Fallback to alternative naming if needed
            (e.target as HTMLImageElement).src = '/directaurante-icono.png';
          }}
        />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center">
            <span
              className={`font-black tracking-tight ${
                variant === 'dark' ? 'text-white' : 'text-[#101828]'
              } ${textSizes[size]}`}
            >
              Direct
            </span>
            <span className={`font-black tracking-tight text-[#FFD200] ${textSizes[size]}`}>
              aurante
            </span>
          </div>

          {showSubtitle && (
            <span
              className={`font-semibold tracking-normal mt-0.5 ${
                variant === 'dark' ? 'text-zinc-400' : 'text-[#667085]'
              } ${subtitleSizes[size]}`}
            >
              Plataforma Gastronómica Directa
            </span>
          )}
        </div>
      )}
    </div>
  );
};
