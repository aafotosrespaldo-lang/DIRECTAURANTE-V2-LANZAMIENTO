import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ShoppingBag, MapPin, User as UserIcon, LogIn, LogOut, ShieldCheck, Bike, Bell, CheckCheck, X, Store } from 'lucide-react';
import { DirectauranteLogo } from './DirectauranteLogo.tsx';

export const Header: React.FC = () => {
  const {
    user,
    isAuthenticated,
    activeView,
    setActiveView,
    cartCount,
    setIsCartOpen,
    setIsAuthOpen,
    logout,
    selectedAddress,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useApp();

  const [isNotifOpen, setIsNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#101828]/95 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="cursor-pointer" onClick={() => setActiveView('explore')}>
          <DirectauranteLogo size="md" variant="dark" showSubtitle={true} />
        </div>

        {/* Address badge (Consumer) */}
        {activeView !== 'restaurant_portal' && (
          <button
            onClick={() => setActiveView('profile')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-700 transition"
          >
            <MapPin className="w-3.5 h-3.5 text-[#FFD318] shrink-0" />
            <span className="truncate max-w-[200px]">
              {selectedAddress
                ? `${selectedAddress.label}: ${selectedAddress.street} #${selectedAddress.number}`
                : 'Pénjamo, GTO (Seleccionar)'}
            </span>
          </button>
        )}

        {/* Right Nav Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Master Control Center NOC */}
          {user?.role === 'master' && (
            <button
              onClick={() => setActiveView('master_noc')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                activeView === 'master_noc'
                  ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318] shadow-md'
                  : 'bg-[#05268F]/80 text-[#FFD318] border-[#FFD318]/50 hover:bg-[#0732b3]'
              }`}
              title="Centro de Control Master 24/7"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>NOC Master</span>
            </button>
          )}

          {/* Driver App Toggle (Only for authorized driver or master) */}
          {(user?.role === 'driver' || user?.role === 'master') && (
            <button
              onClick={() => setActiveView('driver_app')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                activeView === 'driver_app'
                  ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]/40 shadow-md'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
              title="Panel Repartidor"
            >
              <Bike className="w-4 h-4 text-[#FFD318]" />
              <span className="hidden sm:inline">Repartidor</span>
            </button>
          )}

          {/* Restaurant Operator Shortcut (Only if authorized restaurant role, discreet icon without general header clutter) */}
          {user?.role === 'restaurant' && (
            <button
              onClick={() => setActiveView('restaurant_portal')}
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition border ${
                activeView === 'restaurant_portal'
                  ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]/40 shadow-md'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
              title="Panel de Mi Restaurante"
            >
              <Store className="w-4 h-4 text-[#FFD318]" />
              <span className="hidden sm:inline">Mi Cocina</span>
            </button>
          )}

          {/* Client Real-time Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-2 rounded-xl border flex items-center justify-center transition ${
                isNotifOpen || unreadNotificationsCount > 0
                  ? 'bg-[#05268F] border-[#FFD318]/40 text-[#FFD318]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
              title="Notificaciones en tiempo real"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#FFD318] text-[#05268F] text-[10px] font-black shadow-xs">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Drawer */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#101828] border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">Notificaciones</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Realtime activo" />
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadNotificationsCount > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] text-[#FFD318] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Marcar leídas
                      </button>
                    )}
                    <button
                      onClick={() => setIsNotifOpen(false)}
                      className="text-zinc-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      <p>No tienes notificaciones recientes.</p>
                      <p className="text-[11px] text-zinc-500 mt-1">Los cambios de estado de tus pedidos aparecerán aquí en vivo.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          if (n.order_id) {
                            setActiveView('orders');
                            setIsNotifOpen(false);
                          }
                        }}
                        className={`p-3 text-xs transition cursor-pointer hover:bg-zinc-800/40 flex items-start gap-2.5 ${
                          !n.is_read ? 'bg-[#05268F]/15' : 'bg-transparent'
                        }`}
                      >
                        <div className="pt-0.5">
                          {!n.is_read ? (
                            <span className="w-2 h-2 rounded-full bg-[#FFD318] block shrink-0 mt-1" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-zinc-600 block shrink-0 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-white truncate">{n.title}</p>
                            <span className="text-[10px] text-zinc-500 shrink-0">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cart Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/40 text-[#FFD318] px-3.5 py-2 rounded-xl font-semibold text-xs shadow-md transition active:scale-95"
            aria-label="Abrir carrito"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#FFD318] text-[#05268F] font-black text-[11px]">
                {cartCount}
              </span>
            )}
          </button>

          {/* User Profile / Login */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveView('profile')}
                className={`p-2 rounded-xl border flex items-center justify-center transition ${
                  activeView === 'profile'
                    ? 'bg-[#05268F] border-[#FFD318]/40 text-[#FFD318]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
                title={user?.name || 'Perfil'}
              >
                <UserIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => logout()}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-800/50 text-zinc-400 hover:text-rose-400 transition"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 hover:border-zinc-700 transition"
            >
              <LogIn className="w-3.5 h-3.5 text-[#FFD318]" />
              <span className="hidden sm:inline">Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
