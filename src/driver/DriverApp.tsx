import React, { useEffect, useState, useCallback, useRef } from 'react';
import { directApi } from '../direct/api/client.ts';
import {
  DriverOffer,
  DriverSettlement,
  DriverShiftSummary,
  DriverStatus,
  Order,
  OrderMessage,
  SupportTicket,
  User,
} from '../direct/types.ts';
import { DriverNav, DriverTab } from './components/DriverNav.tsx';
import { DriverHomeView } from './components/DriverHomeView.tsx';
import { DriverActiveOrderView } from './components/DriverActiveOrderView.tsx';
import { DriverOfferModal } from './components/DriverOfferModal.tsx';
import { DriverShiftView } from './components/DriverShiftView.tsx';
import { DriverHistoryView } from './components/DriverHistoryView.tsx';
import { DriverChatView } from './components/DriverChatView.tsx';
import { DriverSupportView } from './components/DriverSupportView.tsx';
import { DriverProfileView } from './components/DriverProfileView.tsx';
import { DriverLoginView } from './components/DriverLoginView.tsx';
import { soundNotifier } from './utils/audioAlert.ts';
import { realtimeClient } from '../direct/services/realtimeClient.ts';

interface DriverAppProps {
  onExit?: () => void;
}

export const DriverApp: React.FC<DriverAppProps> = ({ onExit }) => {
  const [currentTab, setCurrentTab] = useState<DriverTab>('home');
  const [driverUser, setDriverUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const [activeOffer, setActiveOffer] = useState<DriverOffer | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [shiftSummary, setShiftSummary] = useState<DriverShiftSummary | null>(null);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [orderMessages, setOrderMessages] = useState<OrderMessage[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Network online/offline event listeners
  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Geolocation tracking - strictly real device GPS
  const refreshLocation = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: 'Ubicación GPS activa',
          };
          setCurrentLocation(loc);
          if (directApi.getToken()) {
            await directApi.updateDriverLocation(loc.latitude, loc.longitude, loc.address).catch(() => {});
          }
        },
        (err) => {
          console.warn('[DriverApp] Geolocation denied or unavailable:', err.message);
          // If device GPS fails and no previous recent valid location exists, location is null
          setCurrentLocation((prev) => (prev && prev.latitude && prev.longitude ? prev : null));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // Fetch driver profile and shift state
  const loadDriverData = useCallback(async () => {
    try {
      const profile = await directApi.getDriverProfile();
      setDriverProfile(profile);
      setDriverStatus(profile.driver_status || 'offline');
      // Only use persisted location if valid and recent (within 24 hours)
      if (
        profile.current_location &&
        typeof profile.current_location.latitude === 'number' &&
        typeof profile.current_location.longitude === 'number' &&
        profile.current_location.latitude !== 0 &&
        profile.current_location.longitude !== 0
      ) {
        const isRecent = profile.current_location.updatedAt
          ? Date.now() - new Date(profile.current_location.updatedAt).getTime() < 24 * 60 * 60 * 1000
          : false;
        if (isRecent) {
          setCurrentLocation(profile.current_location);
        }
      }

      // Check current active order
      const curOrder = await directApi.getCurrentDriverOrder();
      setActiveOrder(curOrder);

      // Check current shift summary
      const shift = await directApi.getShiftSummary();
      setShiftSummary(shift);

      // Check tickets
      const tickets = await directApi.getSupportTickets().catch(() => []);
      setSupportTickets(tickets);
    } catch (err: any) {
      console.warn('[DriverApp] Error loading driver profile:', err.message);
    }
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        const me = await directApi.getMe();
        if (me && me.role === 'driver') {
          setDriverUser(me);
          await loadDriverData();
          await refreshLocation();
        } else {
          setDriverUser(null);
        }
      } catch {
        setDriverUser(null);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, [loadDriverData, refreshLocation]);

  // Periodic polling for incoming offers (Window 40s) and active order updates
  useEffect(() => {
    if (!driverUser || driverStatus === 'offline') return;

    const pollOffersAndOrder = async () => {
      try {
        // 1. Check for incoming offers
        const offer = await directApi.getCurrentOffer();
        if (offer) {
          if (!activeOffer || activeOffer.id !== offer.id) {
            setActiveOffer(offer);
            soundNotifier.playOfferAlert();
          }
        } else {
          setActiveOffer(null);
        }

        // 2. Refresh active order status
        const order = await directApi.getCurrentDriverOrder();
        setActiveOrder(order);

        // 3. Refresh shift summary
        const shift = await directApi.getShiftSummary();
        setShiftSummary(shift);

        // 4. If there's an active order, refresh messages
        if (order) {
          const msgs = await directApi.getOrderMessages(order.id).catch(() => []);
          setOrderMessages(msgs);
        }
      } catch (err) {
        // Polling error silently handled
      }
    };

    pollOffersAndOrder();
    const interval = setInterval(pollOffersAndOrder, 3500);
    return () => clearInterval(interval);
  }, [driverUser, driverStatus, activeOffer]);

  // Real-time SSE Stream Connection
  useEffect(() => {
    if (!driverUser) return;
    const token = directApi.getToken();
    if (token) {
      realtimeClient.connect(token);
    }
  }, [driverUser]);

  // Real-time SSE Event Subscription for Instant Offers & Contextual Chat
  useEffect(() => {
    if (!driverUser) return;
    const unsub = realtimeClient.subscribe((event) => {
      if (event.type === 'DRIVER_OFFER_CREATED' && event.data) {
        setActiveOffer(event.data);
        soundNotifier.playOfferAlert();
      }

      if (
        event.type === 'DRIVER_OFFER_CREATED' ||
        event.type === 'ORDER_READY' ||
        event.type === 'DRIVER_ASSIGNED' ||
        event.type.startsWith('ORDER_')
      ) {
        directApi.getCurrentOffer().then((off) => {
          if (off && (!activeOffer || activeOffer.id !== off.id)) {
            setActiveOffer(off);
            soundNotifier.playOfferAlert();
          } else if (!off && event.type !== 'DRIVER_OFFER_CREATED') {
            setActiveOffer(null);
          }
        }).catch(() => {});

        directApi.getCurrentDriverOrder().then((ord) => {
          setActiveOrder(ord);
        }).catch(() => {});
      }

      if (event.type === 'MESSAGE_CREATED') {
        if (activeOrder && event.order_id === activeOrder.id) {
          directApi.getOrderMessages(activeOrder.id).then((msgs) => {
            setOrderMessages(msgs);
          }).catch(() => {});
        }
      }
    });

    return () => unsub();
  }, [driverUser, activeOrder, activeOffer]);

  // Handler: Update driver status (offline/available/paused)
  const handleStatusChange = async (newStatus: DriverStatus) => {
    if (newStatus === 'available') {
      if (!currentLocation || typeof currentLocation.latitude !== 'number' || typeof currentLocation.longitude !== 'number') {
        throw new Error('Ubicación GPS no disponible. Activa los permisos de ubicación en tu dispositivo para conectarte.');
      }
    }
    const updated = await directApi.updateDriverStatus(newStatus, currentLocation || undefined);
    setDriverStatus(updated.driver_status);
    if (newStatus === 'available') {
      await loadDriverData();
    }
  };

  // Handler: Accept 40-second Offer
  const handleAcceptOffer = async (offerId: string) => {
    const order = await directApi.acceptOffer(offerId);
    setActiveOffer(null);
    setActiveOrder(order);
    setDriverStatus('busy');
    setCurrentTab('active_order');
    soundNotifier.playSuccessChime();
    await loadDriverData();
  };

  // Handler: Reject 40-second Offer
  const handleRejectOffer = async (offerId: string, reason?: string) => {
    await directApi.rejectOffer(offerId, reason);
    setActiveOffer(null);
  };

  // Handler: Order lifecycle operations
  const handleArrivedAtRestaurant = async (orderId: string) => {
    const updated = await directApi.markDriverArrived(orderId);
    setActiveOrder(updated);
  };

  const handlePickupOrder = async (orderId: string) => {
    const updated = await directApi.markDriverPickup(orderId);
    setActiveOrder(updated);
    soundNotifier.playSuccessChime();
  };

  const handleStartDelivering = async (orderId: string) => {
    const updated = await directApi.startDriverDelivering(orderId);
    setActiveOrder(updated);
  };

  const handleCompleteDelivery = async (orderId: string, notes?: string) => {
    const updated = await directApi.completeDriverDelivery(orderId, notes);
    setActiveOrder(updated);
    setDriverStatus('available');
    soundNotifier.playSuccessChime();
    // Refresh history and shift
    await loadDriverData();
  };

  // Handler: Close shift (Corte)
  const handleCloseShift = async (notes?: string) => {
    const settlement = await directApi.closeShift(notes);
    setDriverStatus('offline');
    await loadDriverData();
    return settlement;
  };

  // Handler: Load order history
  const handleRefreshHistory = async () => {
    const hist = await directApi.getDriverOrderHistory();
    setOrderHistory(hist);
  };

  // Handler: Send message in order chat
  const handleSendMessage = async (orderId: string, text: string) => {
    const newMsg = await directApi.sendOrderMessage(orderId, text);
    setOrderMessages((prev) => [...prev, newMsg]);
  };

  // Handler: Refresh order messages
  const handleRefreshMessages = async () => {
    if (activeOrder) {
      const msgs = await directApi.getOrderMessages(activeOrder.id);
      setOrderMessages(msgs);
    }
  };

  // Handler: Create support ticket
  const handleCreateTicket = async (ticket: {
    category: string;
    description: string;
    order_id?: string;
    priority?: 'normal' | 'urgent';
  }) => {
    const created = await directApi.createSupportTicket(ticket);
    setSupportTickets((prev) => [created, ...prev]);
  };

  // Handler: Driver login
  const handleLogin = async (email: string, pass: string) => {
    const res = await directApi.login({ email, password: pass, expectedRole: 'driver' });
    if (res.user.role !== 'driver') {
      await directApi.logout();
      throw new Error('Esta cuenta no tiene permisos de repartidor');
    }
    setDriverUser(res.user);
    await loadDriverData();
    await refreshLocation();
  };

  // Handler: Driver registration
  const handleRegister = async (data: { name: string; email: string; password: string; phone: string; vehicleInfo?: string }) => {
    const res = await directApi.register({
      ...data,
      role: 'driver',
      vehicle_info: data.vehicleInfo,
    });
    setDriverUser(res.user);
    await loadDriverData();
    await refreshLocation();
  };

  // Handler: Driver logout
  const handleLogout = async () => {
    try {
      await directApi.logout().catch(() => {});
    } finally {
      setDriverUser(null);
      setDriverProfile(null);
      setDriverStatus('offline');
      setActiveOrder(null);
      setActiveOffer(null);
      setOrderMessages([]);
    }
  };

  // Handler: Trigger test dispatch for a ready order
  const handleTriggerTestDispatch = async () => {
    // Check if there are ready delivery orders in system and trigger dispatch
    const pendingOffer = await directApi.getCurrentOffer();
    if (pendingOffer) {
      setActiveOffer(pendingOffer);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white text-zinc-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#05268F] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-zinc-500">Iniciando Directaurante Repartidor...</p>
        </div>
      </div>
    );
  }

  // If not logged in as driver, show Driver Login Screen
  if (!driverUser) {
    return <DriverLoginView onLogin={handleLogin} onRegister={handleRegister} onCancel={onExit} />;
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans selection:bg-[#05268F] selection:text-[#FFD318]">
      {/* Main Mobile Screen Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {currentTab === 'home' && (
          <DriverHomeView
            status={driverStatus}
            onStatusChange={handleStatusChange}
            location={currentLocation}
            onRefreshLocation={refreshLocation}
            shiftSummary={shiftSummary}
            hasActiveOrder={!!activeOrder}
            onGoToActiveOrder={() => setCurrentTab('active_order')}
            onTriggerTestDispatch={handleTriggerTestDispatch}
          />
        )}

        {currentTab === 'active_order' && (
          activeOrder ? (
            <DriverActiveOrderView
              order={activeOrder}
              onArrivedAtRestaurant={handleArrivedAtRestaurant}
              onPickupOrder={handlePickupOrder}
              onStartDelivering={handleStartDelivering}
              onCompleteDelivery={handleCompleteDelivery}
              onOpenChat={() => setCurrentTab('chat')}
            />
          ) : (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[50vh]">
              <p className="font-bold text-zinc-300">No tienes ningún pedido asignado actualmente</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Mantente en línea en el Radar para recibir ofertas cuando los restaurantes tengan pedidos listos.
              </p>
              <button
                onClick={() => setCurrentTab('home')}
                className="mt-4 px-4 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold text-xs shadow-md transition"
              >
                Ir al Radar
              </button>
            </div>
          )
        )}

        {currentTab === 'shift' && (
          <DriverShiftView
            shiftSummary={shiftSummary}
            onCloseShift={handleCloseShift}
            onRefresh={loadDriverData}
          />
        )}

        {currentTab === 'chat' && (
          <DriverChatView
            orderId={activeOrder?.id || null}
            orderFolio={activeOrder?.folio || activeOrder?.order_code}
            messages={orderMessages}
            onSendMessage={handleSendMessage}
            currentDriverId={driverUser.id}
            onRefreshMessages={handleRefreshMessages}
          />
        )}

        {currentTab === 'profile' && (
          <DriverProfileView
            profile={driverProfile || driverUser}
            onLogout={handleLogout}
            onRefresh={loadDriverData}
          />
        )}
      </main>

      {/* 40-Second Urgent Offer Modal */}
      {activeOffer && (
        <DriverOfferModal
          offer={activeOffer}
          onAccept={handleAcceptOffer}
          onReject={handleRejectOffer}
        />
      )}

      {/* Fixed Mobile Bottom Navigation */}
      <DriverNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        hasActiveOrder={!!activeOrder}
        unreadMessagesCount={orderMessages.length}
      />
    </div>
  );
};
