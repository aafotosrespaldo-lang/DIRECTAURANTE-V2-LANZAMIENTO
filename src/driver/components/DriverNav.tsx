import React from 'react';
import { Radio, Bike, DollarSign, MessageSquare, User } from 'lucide-react';

export type DriverTab = 'home' | 'active_order' | 'shift' | 'chat' | 'profile';

interface DriverNavProps {
  currentTab: DriverTab;
  onSelectTab: (tab: DriverTab) => void;
  hasActiveOrder: boolean;
  unreadMessagesCount?: number;
}

export const DriverNav: React.FC<DriverNavProps> = ({
  currentTab,
  onSelectTab,
  hasActiveOrder,
  unreadMessagesCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] px-2 py-2 max-w-md mx-auto shadow-lg">
      <div className="grid grid-cols-5 gap-1">
        {/* Tab 1: Home / Radar */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition active:scale-95 ${
            currentTab === 'home'
              ? 'text-[#05268F] bg-[#EAF0FF] font-black'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <Radio className={`w-5 h-5 mb-1 ${currentTab === 'home' ? 'text-[#05268F]' : ''}`} />
          <span className="text-[10px] tracking-tight">Radar</span>
        </button>

        {/* Tab 2: Pedido Activo */}
        <button
          onClick={() => onSelectTab('active_order')}
          className={`relative flex flex-col items-center justify-center py-1.5 rounded-2xl transition active:scale-95 ${
            currentTab === 'active_order'
              ? 'text-[#05268F] bg-[#EAF0FF] font-black'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <Bike className={`w-5 h-5 mb-1 ${currentTab === 'active_order' ? 'text-[#05268F]' : ''}`} />
          <span className="text-[10px] tracking-tight">Pedido</span>
          {hasActiveOrder && (
            <span className="absolute top-1 right-3 w-2.5 h-2.5 rounded-full bg-[#FFD318] border-2 border-white animate-pulse" />
          )}
        </button>

        {/* Tab 3: Jornada / Ganancias */}
        <button
          onClick={() => onSelectTab('shift')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition active:scale-95 ${
            currentTab === 'shift'
              ? 'text-[#05268F] bg-[#EAF0FF] font-black'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <DollarSign className={`w-5 h-5 mb-1 ${currentTab === 'shift' ? 'text-[#05268F]' : ''}`} />
          <span className="text-[10px] tracking-tight">Cortes</span>
        </button>

        {/* Tab 4: Chat / Mensajes */}
        <button
          onClick={() => onSelectTab('chat')}
          className={`relative flex flex-col items-center justify-center py-1.5 rounded-2xl transition active:scale-95 ${
            currentTab === 'chat'
              ? 'text-[#05268F] bg-[#EAF0FF] font-black'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <MessageSquare className={`w-5 h-5 mb-1 ${currentTab === 'chat' ? 'text-[#05268F]' : ''}`} />
          <span className="text-[10px] tracking-tight">Mensajes</span>
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1 right-3 px-1.5 py-0.2 rounded-full bg-[#05268F] text-[#FFD318] font-black text-[9px]">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        {/* Tab 5: Perfil */}
        <button
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition active:scale-95 ${
            currentTab === 'profile'
              ? 'text-[#05268F] bg-[#EAF0FF] font-black'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <User className={`w-5 h-5 mb-1 ${currentTab === 'profile' ? 'text-[#05268F]' : ''}`} />
          <span className="text-[10px] tracking-tight">Perfil</span>
        </button>
      </div>
    </nav>
  );
};
