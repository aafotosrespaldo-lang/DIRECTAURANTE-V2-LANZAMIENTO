import React from 'react';
import { AppContextProvider, useApp } from './direct/context/AppContext.tsx';
import { Header } from './direct/components/Header.tsx';
import { ExploreView } from './direct/components/ExploreView.tsx';
import { RestaurantDetail } from './direct/components/RestaurantDetail.tsx';
import { ProductCustomizeModal } from './direct/components/ProductCustomizeModal.tsx';
import { CartDrawer } from './direct/components/CartDrawer.tsx';
import { CheckoutModal } from './direct/components/CheckoutModal.tsx';
import { MyOrders } from './direct/components/MyOrders.tsx';
import { UserProfile } from './direct/components/UserProfile.tsx';
import { RestaurantPortalView } from './direct/components/RestaurantPortalView.tsx';
import { MasterControlCenter } from './direct/components/MasterControlCenter.tsx';
import { AuthScreen } from './direct/components/AuthScreen.tsx';
import { ToastContainer } from './direct/components/ToastContainer.tsx';
import { DriverApp } from './driver/DriverApp.tsx';
import { MercadoPagoBrickModal } from './direct/components/MercadoPagoBrickModal.tsx';

import { ErrorBoundary } from './direct/components/ErrorBoundary.tsx';

const AppContent: React.FC = () => {
  const {
    user,
    isLoadingUser,
    activeView,
    setActiveView,
    selectedProduct,
    setSelectedProduct,
    setIsAuthOpen,
    payingOrder,
    setPayingOrder,
    loadOrders,
  } = useApp();

  // Guard against unauthorized view restoration once user state is confirmed
  React.useEffect(() => {
    if (isLoadingUser) return;
    const isRestaurantPanel = typeof window !== 'undefined' && (
      window.location.pathname.includes('restaurant-panel') ||
      window.location.search.includes('view=restaurant')
    );
    if (!user) {
      if (activeView === 'master_noc') {
        setActiveView('explore');
        setIsAuthOpen(true);
      } else if (activeView === 'restaurant_portal' && !isRestaurantPanel) {
        // Prompt login if on client path
        setIsAuthOpen(true);
      }
    }
  }, [user, isLoadingUser, activeView, setActiveView, setIsAuthOpen]);

  // Clean splash during session rehydration
  if (isLoadingUser && typeof window !== 'undefined' && localStorage.getItem('direct_auth_token')) {
    return (
      <div className="min-h-screen bg-[#060919] text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#05268F] border border-[#FFD318]/40 flex items-center justify-center text-[#FFD318] animate-pulse mb-3">
          <span className="font-black text-xl">D</span>
        </div>
        <p className="text-xs text-zinc-400 font-medium">Validando sesión de acceso...</p>
      </div>
    );
  }

  // If driver mobile app is active, render dedicated mobile UI
  if (activeView === 'driver_app') {
    return <DriverApp onExit={() => setActiveView('explore')} />;
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans selection:bg-[#05268F] selection:text-[#FFD318]">
      {/* Sticky Header: Oculto en Master NOC y Portal de Restaurante */}
      {activeView !== 'master_noc' && activeView !== 'restaurant_portal' && <Header />}

      {/* Main View Area */}
      <main className={`flex-1 ${activeView === 'master_noc' || activeView === 'restaurant_portal' ? 'pb-0' : 'pb-16'}`}>
        <ErrorBoundary fallbackTitle="Error al renderizar el módulo">
          {activeView === 'explore' && <ExploreView />}
          {activeView === 'restaurant' && <RestaurantDetail />}
          {activeView === 'orders' && <MyOrders />}
          {activeView === 'profile' && <UserProfile />}
          {activeView === 'restaurant_portal' && <RestaurantPortalView />}
          {activeView === 'master_noc' && <MasterControlCenter />}
        </ErrorBoundary>
      </main>

      {/* Modals & Overlays */}
      {selectedProduct && (
        <ProductCustomizeModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      <CartDrawer />
      <CheckoutModal />
      <AuthScreen />
      <ToastContainer />
      {payingOrder && (
        <MercadoPagoBrickModal
          order={payingOrder}
          isOpen={!!payingOrder}
          onClose={() => setPayingOrder(null)}
          onPaymentSuccess={() => {
            setPayingOrder(null);
            loadOrders();
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppContextProvider>
      <AppContent />
    </AppContextProvider>
  );
}
