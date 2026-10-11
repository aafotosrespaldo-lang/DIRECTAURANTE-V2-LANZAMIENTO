import React from 'react';

interface CategoryCarouselProps {
  categories: { id: string; name: string }[];
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
}

export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
          selectedCategory === null
            ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]/50 shadow-md shadow-[#05268F]/20'
            : 'bg-gradient-to-b from-[#0a0f30] to-[#070728] text-zinc-300 border-[#05268F]/30 hover:text-white hover:border-[#05268F]/60 shadow-xs'
        }`}
      >
        Todos
      </button>

      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.name;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(isSelected ? null : cat.name)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              isSelected
                ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]/50 shadow-md shadow-[#05268F]/20'
                : 'bg-gradient-to-b from-[#0a0f30] to-[#070728] text-zinc-300 border-[#05268F]/30 hover:text-white hover:border-[#05268F]/60 shadow-xs'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
};
