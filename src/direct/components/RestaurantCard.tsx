import React from 'react';
import { Restaurant } from '../types.ts';
import { Star, Clock, Bike, MapPin, Ban, AlertTriangle } from 'lucide-react';
import { getRestaurantOperationalStatus } from '../utils/restaurantStatus.ts';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, onClick }) => {
  const status = getRestaurantOperationalStatus(restaurant);

  const deliveryFeeFormatted =
    restaurant.delivery_fee === 0
      ? 'Envío Gratis'
      : `$${(restaurant.delivery_fee / 100).toFixed(2)} MXN`;

  const timeEst =
    restaurant.delivery_time_min && restaurant.delivery_time_max
      ? `${restaurant.delivery_time_min}-${restaurant.delivery_time_max} min`
      : '30-45 min';

  return (
    <div
      onClick={onClick}
      className={`group relative bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col ${
        status.is_out_of_service
          ? 'border-rose-900/50 opacity-90 hover:border-rose-700/70 hover:shadow-rose-950/30'
          : 'border-[#05268F]/30 hover:border-[#05268F]/70 hover:shadow-[#05268F]/20'
      }`}
    >
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-[#070728]">
        <img
          src={restaurant.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&fit=crop&q=80'}
          alt={restaurant.name}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
            status.is_out_of_service ? 'filter grayscale-[40%] opacity-70' : 'opacity-90'
          }`}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&fit=crop&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070728] via-transparent to-black/40" />

        {/* Operational Status Badge: FUERA DE SERVICIO */}
        {status.is_out_of_service ? (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-rose-600/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-white border border-rose-400 shadow-xl tracking-wide uppercase animate-pulse">
            <Ban className="w-3.5 h-3.5 text-white" />
            <span>Fuera de servicio</span>
          </div>
        ) : (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-white border border-emerald-400/40 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            <span>Abierto</span>
          </div>
        )}

        {/* Rating Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#070728]/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-[#FFD318] border border-[#05268F]/40 shadow-sm">
          <Star className="w-3.5 h-3.5 fill-[#FFD318] text-[#FFD318]" />
          <span>{restaurant.rating.toFixed(1)}</span>
        </div>

        {/* Logo */}
        <div className="absolute -bottom-3 left-4 w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#05268F]/50 shadow-lg bg-[#070728]">
          <img
            src={restaurant.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&fit=crop&q=80'}
            alt={restaurant.name}
            className={`w-full h-full object-cover ${status.is_out_of_service ? 'filter grayscale-[30%]' : ''}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&fit=crop&q=80';
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-[#080d2c] via-[#070728] to-[#04051a] border-t border-[#05268F]/20">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-base text-zinc-100 group-hover:text-[#FFD318] transition tracking-tight">
              {restaurant.name}
            </h3>
            {restaurant.distance_km && (
              <span className="text-[11px] text-zinc-400 flex items-center gap-0.5 shrink-0">
                <MapPin className="w-3 h-3 text-[#FFD318]" />
                {restaurant.distance_km.toFixed(1)} km
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-300 line-clamp-2 mt-1 leading-relaxed">
            {restaurant.description}
          </p>

          {/* FUERA DE SERVICIO Banner Info */}
          {status.is_out_of_service && (
            <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-800/60 flex items-center justify-between text-[11px] text-rose-300 font-bold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                Fuera de servicio
              </span>
              <span className="text-[10px] text-zinc-400 font-normal truncate max-w-[170px]" title={status.reason_label}>
                {status.reason_label}
              </span>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(restaurant.category_tags || []).map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#05268F]/25 text-blue-100 border border-[#05268F]/40"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Footer logistics */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#05268F]/25 text-xs text-zinc-400 font-medium">
          {status.is_out_of_service ? (
            <div className="w-full flex items-center justify-between text-rose-400 font-semibold text-xs">
              <span className="flex items-center gap-1 text-rose-300">
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                No disponible para pedidos
              </span>
              <span className="text-[11px] text-zinc-500">Solo consulta</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>{timeEst}</span>
              </div>

              <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Bike className="w-3.5 h-3.5" />
                <span>{deliveryFeeFormatted}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
