import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Product } from '../types.ts';
import { ArrowLeft, Star, Clock, Bike, MapPin, Phone, Plus, Info, Image as ImageIcon, AlertTriangle, Ban } from 'lucide-react';
import { getRestaurantOperationalStatus } from '../utils/restaurantStatus.ts';

export const RestaurantDetail: React.FC = () => {
  const {
    selectedRestaurant,
    restaurantProducts,
    isLoadingProducts,
    setSelectedProduct,
    setActiveView,
    addToast,
  } = useApp();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  if (!selectedRestaurant) return null;

  const status = getRestaurantOperationalStatus(selectedRestaurant);

  const categories = Array.from(new Set(restaurantProducts.map((p) => p.category)));

  const filteredProducts = activeCategoryFilter
    ? restaurantProducts.filter((p) => p.category === activeCategoryFilter)
    : restaurantProducts;

  const deliveryFeeText =
    selectedRestaurant.delivery_fee === 0
      ? 'Envío Gratis'
      : `$${(selectedRestaurant.delivery_fee / 100).toFixed(2)} MXN`;

  const handleProductClick = (product: Product) => {
    if (status.is_out_of_service) {
      addToast('error', `Restaurante Fuera de Servicio: ${status.reason_label}. No es posible agregar platillos al carrito.`);
      return;
    }
    setSelectedProduct(product);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('explore')}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition px-3 py-1.5 rounded-xl bg-white border border-zinc-300 shadow-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Restaurantes</span>
        </button>

        {status.is_out_of_service && (
          <span className="flex items-center gap-1.5 bg-rose-600/95 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-md">
            <Ban className="w-3.5 h-3.5" />
            Fuera de servicio
          </span>
        )}
      </div>

      {/* Prominent Warning Banner if Out of Service */}
      {status.is_out_of_service && (
        <div className="bg-gradient-to-r from-rose-950/90 via-rose-900/80 to-[#1e070e] border border-rose-700/80 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3.5 text-white shadow-xl animate-in fade-in">
          <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-sm tracking-wide text-white uppercase">
                Restaurante Fuera de Servicio
              </h3>
              <span className="text-[10px] uppercase font-bold bg-black/50 px-2 py-0.5 rounded-full text-rose-300 border border-rose-600/40">
                No acepta pedidos
              </span>
            </div>
            <p className="text-xs text-rose-200 mt-1 leading-relaxed">
              {status.reason_label}. El menú se encuentra disponible únicamente en modo de consulta informativa. No es posible generar pedidos ni solicitar repartidores hasta que el restaurante reactive sus operaciones.
            </p>
          </div>
        </div>
      )}

      {/* Hero Banner Card */}
      <div className="relative rounded-3xl overflow-hidden border border-[#05268F]/30 bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] shadow-2xl">
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <img
            src={selectedRestaurant.banner_url}
            alt={selectedRestaurant.name}
            className={`w-full h-full object-cover ${status.is_out_of_service ? 'filter grayscale-[30%] opacity-80' : ''}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070728] via-[#070728]/60 to-transparent" />
        </div>

        {/* Restaurant Header Info Overlay */}
        <div className="p-6 sm:p-8 -mt-20 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-[#05268F]/50 shadow-2xl bg-[#070728] shrink-0">
              <img
                src={selectedRestaurant.logo_url}
                alt={selectedRestaurant.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {selectedRestaurant.name}
                </h1>
                <span className="flex items-center gap-1 bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-[#FFD318] text-[#FFD318]" />
                  {selectedRestaurant.rating.toFixed(1)}
                </span>
                {status.is_out_of_service ? (
                  <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white border border-rose-400">
                    Fuera de servicio
                  </span>
                ) : (
                  <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-600/80 text-white border border-emerald-400/40">
                    Abierto
                  </span>
                )}
              </div>

              <p className="text-sm text-zinc-300 max-w-2xl">{selectedRestaurant.description}</p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FFD318]" />
                  {selectedRestaurant.address}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  {selectedRestaurant.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#0a0f30]/95 via-[#070728]/95 to-[#091238]/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#05268F]/35 self-start md:self-auto shadow-lg">
            <div className="text-center px-3 border-r border-[#05268F]/30">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Envío</span>
              <p className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-center mt-0.5">
                <Bike className="w-3.5 h-3.5" />
                {deliveryFeeText}
              </p>
            </div>
            <div className="text-center px-3 border-r border-[#05268F]/30">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Tiempo</span>
              <p className="text-xs font-bold text-zinc-200 flex items-center gap-1 justify-center mt-0.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {selectedRestaurant.delivery_time_min || 25}-{selectedRestaurant.delivery_time_max || 40}m
              </p>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Min. Orden</span>
              <p className="text-xs font-bold text-zinc-200 mt-0.5">
                ${(selectedRestaurant.min_order / 100).toFixed(0)} MXN
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Categories Bar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Menú y Especialidades</h2>
          <span className="text-xs text-zinc-500">{filteredProducts.length} platillos disponibles</span>
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveCategoryFilter(null)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                activeCategoryFilter === null
                  ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]/50 shadow-md shadow-[#05268F]/20'
                  : 'bg-gradient-to-b from-[#0a0f30] to-[#070728] text-zinc-300 border-[#05268F]/30 hover:border-[#05268F]/60'
              }`}
            >
              Todos los platillos
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === c ? null : c)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  activeCategoryFilter === c
                    ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]/50 shadow-md shadow-[#05268F]/20'
                    : 'bg-gradient-to-b from-[#0a0f30] to-[#070728] text-zinc-300 border-[#05268F]/30 hover:border-[#05268F]/60'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products Grid */}
      {isLoadingProducts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-zinc-900/60 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900/40 rounded-2xl border border-zinc-800">
          <Info className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No hay productos en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => handleProductClick(product)}
              className={`group bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border rounded-2xl p-4 flex gap-4 transition relative overflow-hidden ${
                status.is_out_of_service
                  ? 'border-rose-900/30 opacity-80 cursor-not-allowed hover:border-rose-700/50'
                  : 'border-[#05268F]/30 hover:border-[#05268F]/70 hover:shadow-xl hover:shadow-[#05268F]/20 cursor-pointer'
              }`}
            >
              {/* Product Info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFD318]">
                    {product.category}
                  </span>
                  <h3 className="font-bold text-sm text-zinc-100 group-hover:text-[#FFD318] transition mt-0.5 line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-zinc-300 line-clamp-2 mt-1 leading-relaxed">
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#05268F]/25">
                  <span className="font-extrabold text-sm text-white">
                    ${(product.price / 100).toFixed(2)} MXN
                  </span>

                  {status.is_out_of_service ? (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-1 bg-rose-950/80 border border-rose-800 text-rose-300 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-not-allowed opacity-80"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Fuera de servicio</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProductClick(product);
                      }}
                      className="flex items-center gap-1 bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/30 text-[#FFD318] px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Product Thumbnail */}
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#070728] shrink-0 border border-[#05268F]/30 flex items-center justify-center relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                      status.is_out_of_service ? 'filter grayscale-[25%]' : 'group-hover:scale-105'
                    }`}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600">
                    <ImageIcon className="w-6 h-6 text-zinc-500" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
