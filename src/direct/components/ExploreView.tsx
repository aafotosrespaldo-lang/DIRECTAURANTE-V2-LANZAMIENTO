import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { CategoryCarousel } from './CategoryCarousel.tsx';
import { RestaurantCard } from './RestaurantCard.tsx';
import { Search, Flame, Sparkles } from 'lucide-react';

export const ExploreView: React.FC = () => {
  const {
    restaurants,
    isLoadingRestaurants,
    openRestaurant,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Extract all unique category tags with safe fallback
  const safeRestaurants = Array.isArray(restaurants) ? restaurants : [];

  const allCategoryTags = Array.from(
    new Set(safeRestaurants.flatMap((r) => (Array.isArray(r.category_tags) ? r.category_tags : [])))
  ).map((name, i) => ({ id: `cat_${i}`, name }));

  const filteredRestaurants = safeRestaurants.filter((r) => {
    const tags = Array.isArray(r.category_tags) ? r.category_tags : [];
    if (selectedCategory && !tags.includes(selectedCategory)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-8">
      {/* Hero Banner with Official Palette */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#05268F]/95 via-[#070728] to-indigo-950 border border-[#05268F]/30 p-6 sm:p-10 shadow-2xl">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DIRECTAURANTE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Comida deliciosa, precios justos, directo del restaurante.
          </h1>

          <p className="text-sm text-zinc-300 leading-relaxed">
            Pide en línea con cálculo soberano en tiempo real, sin comisiones infladas de aplicaciones terceras.
          </p>

          {/* Search bar inside hero */}
          <div className="pt-2">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar taquerías, hamburguesas, pizzas..."
                className="w-full bg-[#06091e]/90 border border-[#05268F]/40 rounded-2xl pl-10 pr-4 py-3 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-[#FFD318] focus:ring-1 focus:ring-[#FFD318] shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#05268F]/20 blur-3xl pointer-events-none rounded-full" />
      </div>

      {/* Category filter pills */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-zinc-800 text-xs font-bold">
          <Flame className="w-4 h-4 text-[#FFD318]" />
          <span>Categorías Populares</span>
        </div>
        <CategoryCarousel
          categories={allCategoryTags}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Restaurants Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">
            Restaurantes Disponibles
          </h2>
          <span className="text-xs text-zinc-500">
            {filteredRestaurants.length} establecimientos en Pénjamo
          </span>
        </div>

        {isLoadingRestaurants ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-zinc-200 border border-zinc-300 animate-pulse" />
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-16 bg-zinc-100 rounded-3xl border border-zinc-200">
            <p className="text-sm text-zinc-600">No se encontraron restaurantes con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onClick={() => openRestaurant(restaurant.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
