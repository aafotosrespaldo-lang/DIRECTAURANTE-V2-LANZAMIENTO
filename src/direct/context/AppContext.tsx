import React, { createContext, useContext, useEffect, useState } from 'react';
import { directApi } from '../api/client.ts';
import { realtimeClient } from '../services/realtimeClient.ts';
import { Address, CartItem, FeesInfo, Order, Product, Restaurant, User } from '../types.ts';

export type AppView = 'explore' | 'restaurant' | 'orders' | 'profile' | 'restaurant_portal' | 'driver_app' | 'master_noc';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ClientNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  order_id?: string;
  timestamp: string;
  is_read: boolean;
}

interface AppContextType {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoadingUser: boolean;
  login: (email: string, pass: string, expectedRole?: User['role']) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    vehicle_info?: string;
    vehicleInfo?: string;
    restaurant_name?: string;
    restaurantName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Navigation
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  // Restaurants & Catalog
  restaurants: Restaurant[];
  isLoadingRestaurants: boolean;
  loadRestaurants: (params?: { category?: string; query?: string }, silent?: boolean) => Promise<void>;
  selectedRestaurant: Restaurant | null;
  setSelectedRestaurant: (r: Restaurant | null) => void;
  openRestaurant: (id: string) => Promise<void>;
  restaurantProducts: Product[];
  isLoadingProducts: boolean;
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;

  // Cart
  cart: CartItem[];
  cartRestaurant: Restaurant | null;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotalCents: number;

  // Addresses
  addresses: Address[];
  selectedAddress: Address | null;
  setSelectedAddress: (addr: Address | null) => void;
  loadAddresses: () => Promise<void>;
  createAddress: (addr: Omit<Address, 'id' | 'user_id'>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;

  // Orders
  orders: Order[];
  isLoadingOrders: boolean;
  loadOrders: () => Promise<void>;
  fees: FeesInfo | null;

  // Modals & Drawers
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  payingOrder: Order | null;
  setPayingOrder: (order: Order | null) => void;

  // Notifications
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
  notifications: ClientNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [activeView, setActiveView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();

      // Detección automática por subdominio oficial de producción:
      if (hostname.startsWith('repartidores.') || search.includes('view=driver') || hash.includes('driver')) {
        return 'driver_app';
      }
      if (
        hostname.startsWith('restaurantes.') ||
        pathname.includes('restaurant-panel') ||
        search.includes('view=restaurant_portal') ||
        search.includes('view=restaurant') ||
        search.includes('view=portal') ||
        hash.includes('restaurant') ||
        hash.includes('portal')
      ) {
        return 'restaurant_portal';
      }
      if (hostname.startsWith('master.') || search.includes('view=master') || hash.includes('master') || hash.includes('noc')) {
        return 'master_noc';
      }
      if (hostname.startsWith('cliente.')) {
        return 'explore';
      }

      if (search.includes('view=orders') || hash.includes('orders')) {
        return 'orders';
      }
      if (search.includes('view=profile') || hash.includes('profile')) {
        return 'profile';
      }
      const saved = localStorage.getItem('direct_last_active_view') as AppView;
      if (saved && ['explore', 'restaurant', 'orders', 'profile', 'restaurant_portal', 'master_noc', 'driver_app'].includes(saved)) {
        return saved;
      }
    }
    return 'explore';
  });

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [restaurantProducts, setRestaurantProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartRestaurant, setCartRestaurant] = useState<Restaurant | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [fees, setFees] = useState<FeesInfo | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Persistent Client Notifications Center
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

  // 1. Initial User Session Rehydration & Real-time Stream
  useEffect(() => {
    const token = directApi.getToken();
    // Connect to SSE stream for real-time restaurant status and order tracking
    realtimeClient.connect(token || 'guest');

    if (token) {
      directApi
        .getMe()
        .then((u) => {
          setUser(u);
          if (u.role === 'restaurant') {
            setActiveView('restaurant_portal');
            if (typeof window !== 'undefined') localStorage.setItem('direct_last_active_view', 'restaurant_portal');
          } else if (u.role === 'driver') {
            setActiveView('driver_app');
            if (typeof window !== 'undefined') localStorage.setItem('direct_last_active_view', 'driver_app');
          } else if (u.role === 'master' && (activeView === 'explore' || (activeView as string) === 'restaurant_portal')) {
            setActiveView('master_noc');
            if (typeof window !== 'undefined') localStorage.setItem('direct_last_active_view', 'master_noc');
          }
        })
        .catch(() => {
          directApi.logout();
          realtimeClient.connect('guest');
          setUser(null);
          if (typeof window !== 'undefined') localStorage.removeItem('direct_last_active_view');
        })
        .finally(() => {
          setIsLoadingUser(false);
        });
    } else {
      setIsLoadingUser(false);
    }
  }, []);

  // Secret access to Master NOC: Ctrl+Alt+M or Ctrl+Shift+M (completely hidden from public UI)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.altKey || e.shiftKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (user?.role === 'master') {
          handleSetActiveView(activeView === 'master_noc' ? 'explore' : 'master_noc');
        } else {
          setIsAuthOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, activeView]);

  // Sync PWA Web App Manifest and Title dynamically based on activeView
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const isRestaurant = activeView === 'restaurant_portal' || window.location.pathname.includes('restaurant-panel');
    const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifestEl) {
      if (isRestaurant) {
        manifestEl.href = '/restaurant-panel/manifest.json';
      } else if (activeView === 'driver_app') {
        manifestEl.href = '/manifest.json';
      } else {
        manifestEl.href = '/restaurant-panel/manifest.json';
      }
    }
    if (isRestaurant) {
      document.title = 'Directaurante - Portal Restaurante & Comandera';
    }
  }, [activeView]);

  // Real-time Event Subscriber: eliminates dependency on manual "Actualizar"
  useEffect(() => {
    const unsub = realtimeClient.subscribe((event) => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isOrderEvent =
        event.type.startsWith('ORDER_') ||
        event.type === 'DRIVER_ASSIGNED' ||
        event.type === 'PAYMENT_UPDATED' ||
        event.type === 'DRIVER_LOCATION_UPDATED';

      if (isOrderEvent) {
        // Instant in-memory order update (0ms latency)
        if (event.data && event.data.id && event.data.status) {
          setOrders((prev) => {
            const exists = prev.some((o) => o.id === event.data.id);
            if (exists) {
              return prev.map((o) => (o.id === event.data.id ? { ...o, ...event.data } : o));
            } else if (user && (event.customer_id === user.id || event.data.customer_id === user.id)) {
              return [event.data, ...prev];
            }
            return prev;
          });
        }

        // Parallel server re-fetch to ensure complete sync
        loadOrders();

        const displayFolio = (event as any).folio || (event.data && (event.data as any).folio) || (event.order_id ? `#${event.order_id.replace(/^ord_/, '').slice(0, 4).toUpperCase()}` : '');
        const labels: Record<string, string> = {
          ORDER_CREATED: 'Nuevo pedido registrado',
          ORDER_ACCEPTED: 'Pedido aceptado por la cocina',
          ORDER_PREPARING: 'Pedido en preparación en cocina',
          ORDER_READY: 'Pedido listo para entrega',
          DRIVER_ASSIGNED: 'Repartidor asignado',
          ORDER_ON_THE_WAY: 'Tu pedido está en camino',
          ORDER_DELIVERED: '¡Pedido entregado con éxito!',
          ORDER_CANCELLED: 'Pedido cancelado',
          PAYMENT_UPDATED: 'Pago actualizado',
          DRIVER_LOCATION_UPDATED: 'Ubicación de entrega en ruta',
        };
        const msg = labels[event.type] || `Actualización de pedido`;
        if (event.type !== 'DRIVER_LOCATION_UPDATED') {
          addToast('info', `${msg} ${displayFolio}`.trim());
          setNotifications((prev) => [
            {
              id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: msg,
              message: `${msg} ${displayFolio}`.trim(),
              type: event.type,
              order_id: event.order_id,
              timestamp: timeStr,
              is_read: false,
            },
            ...prev.slice(0, 49),
          ]);
        }
      } else if (event.type === 'MESSAGE_CREATED' && event.data) {
        addToast('info', `Mensaje de ${event.data.sender_name || 'Repartidor'}: ${event.data.message}`);
        setNotifications((prev) => [
          {
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `Mensaje de ${event.data.sender_name || 'Repartidor'}`,
            message: event.data.message,
            type: event.type,
            order_id: event.data.order_id,
            timestamp: timeStr,
            is_read: false,
          },
          ...prev.slice(0, 49),
        ]);
      } else if (event.type === 'INVENTORY_UPDATED' && selectedRestaurant) {
        openRestaurant(selectedRestaurant.id);
      } else if (
        event.type === 'RESTAURANT_STATUS_CHANGED' ||
        event.type === 'PROFILE_UPDATED' ||
        event.type === 'RESTAURANT_UPDATED'
      ) {
        // 1. Instant in-memory update with 0ms latency for main explore screen
        if (event.data && event.data.id) {
          setRestaurants((prev) =>
            prev.map((r) => (r.id === event.data.id ? { ...r, ...event.data } : r))
          );
        }

        // 2. Silent reconcile in background
        loadRestaurants(undefined, true);

        // 3. If customer has this restaurant currently open in detail, update it instantly
        const updatedRestId =
          event.restaurant_id ||
          (event.data && (event.data as any).id);
        if (selectedRestaurant && updatedRestId && selectedRestaurant.id === updatedRestId) {
          if (event.data) {
            setSelectedRestaurant((prev) => (prev ? { ...prev, ...event.data } : prev));
          }
          openRestaurant(selectedRestaurant.id);
        }
      }
    });

    return () => unsub();
  }, [selectedRestaurant, user]);

  // 2. Load Core Restaurants & Fees + Resilient Background Sync (5s)
  useEffect(() => {
    loadRestaurants();
    directApi.getFees().then(setFees).catch(() => {});

    // Periodic silent sync (5s) ensures the main screen cards always stay accurate
    const restInterval = setInterval(() => {
      loadRestaurants(undefined, true);
    }, 5000);

    return () => clearInterval(restInterval);
  }, []);

  // 3. Load Addresses & Orders on user change + Resilient Active Orders Polling (5s)
  useEffect(() => {
    if (user) {
      loadAddresses();
      loadOrders();

      // Background heartbeat poll (5s) ensures customer orders never go stale even on reconnect
      const interval = setInterval(() => {
        loadOrders();
      }, 5000);
      return () => clearInterval(interval);
    } else {
      setAddresses([]);
      setSelectedAddress(null);
      setOrders([]);
    }
  }, [user]);

  const loadRestaurants = async (params?: { category?: string; query?: string }, silent: boolean = false) => {
    if (!silent) setIsLoadingRestaurants(true);
    try {
      const list = await directApi.getRestaurants(params);
      setRestaurants(list);
    } catch (err: any) {
      if (!silent) addToast('error', err.message || 'Error cargando restaurantes');
    } finally {
      if (!silent) setIsLoadingRestaurants(false);
    }
  };

  const openRestaurant = async (id: string) => {
    setIsLoadingProducts(true);
    try {
      const rest = await directApi.getRestaurantById(id);
      setSelectedRestaurant(rest);
      const prods = await directApi.getRestaurantProducts(id);
      setRestaurantProducts(prods);
      setActiveView('restaurant');
    } catch (err: any) {
      addToast('error', err.message || 'Error cargando menú');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadAddresses = async () => {
    try {
      const list = await directApi.getAddresses();
      setAddresses(list);
      const defaultAddr = list.find((a) => a.is_default) || list[0] || null;
      setSelectedAddress(defaultAddr);
    } catch {
      // non-fatal
    }
  };

  const createAddress = async (addr: Omit<Address, 'id' | 'user_id'>) => {
    try {
      const created = await directApi.createAddress(addr);
      setAddresses((prev) => [...prev, created]);
      if (created.is_default || !selectedAddress) {
        setSelectedAddress(created);
      }
      addToast('success', 'Dirección agregada');
    } catch (err: any) {
      addToast('error', err.message || 'Error al guardar dirección');
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await directApi.deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      if (selectedAddress?.id === id) {
        setSelectedAddress(addresses.find((a) => a.id !== id) || null);
      }
      addToast('info', 'Dirección eliminada');
    } catch (err: any) {
      addToast('error', err.message || 'Error al eliminar dirección');
    }
  };

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const list = await directApi.getMyOrders();
      setOrders(list);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleSetActiveView = (view: AppView) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('direct_last_active_view', view);
    }
  };

  const login = async (email: string, pass: string, expectedRole?: User['role']) => {
    try {
      const res = await directApi.login({ email, password: pass, expectedRole });
      setUser(res.user);
      setIsAuthOpen(false);
      realtimeClient.connect(res.token);

      // Route automatically according to authenticated identity
      if (res.user.role === 'driver') {
        handleSetActiveView('driver_app');
        addToast('success', `¡Bienvenido al módulo Driver, ${res.user.name}!`);
      } else if (res.user.role === 'restaurant') {
        handleSetActiveView('restaurant_portal');
        addToast('success', `¡Bienvenido al portal de Restaurante, ${res.user.name}!`);
      } else if (res.user.role === 'master' || (res.user.role as any) === 'admin') {
        handleSetActiveView('master_noc');
        addToast('success', `¡Centro de Control Master 24/7 activo, ${res.user.name}!`);
      } else {
        handleSetActiveView('explore');
        addToast('success', `¡Bienvenido, ${res.user.name}!`);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Credenciales inválidas');
      throw err;
    }
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    vehicle_info?: string;
    vehicleInfo?: string;
    restaurant_name?: string;
    restaurantName?: string;
  }) => {
    try {
      const res = await directApi.register(payload);
      setUser(res.user);
      setIsAuthOpen(false);
      realtimeClient.connect(res.token);

      if (res.user.role === 'driver') {
        handleSetActiveView('driver_app');
        addToast('success', `¡Cuenta de Repartidor creada exitosamente, ${res.user.name}!`);
      } else if (res.user.role === 'restaurant') {
        handleSetActiveView('restaurant_portal');
        addToast('success', `¡Restaurante registrado exitosamente, ${res.user.name}!`);
      } else {
        handleSetActiveView('explore');
        addToast('success', `¡Cuenta creada exitosamente, ${res.user.name}!`);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Error al registrarse');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await directApi.logout().catch(() => {});
    } finally {
      realtimeClient.connect('guest');
      setUser(null);
      setAddresses([]);
      setSelectedAddress(null);
      setOrders([]);
      setNotifications([]);
      setCart([]);
      setCartRestaurant(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('direct_last_active_view');
      }
      setActiveView('explore');
      setIsAuthOpen(true);
      addToast('info', 'Sesión cerrada exitosamente');
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const u = await directApi.getMe();
      setUser(u);
    } catch {
      // non-fatal
    }
  };

  // Cart Operations
  const addToCart = (item: Omit<CartItem, 'id'>) => {
    if (cartRestaurant && cartRestaurant.id !== item.product.restaurant_id) {
      setCart([]);
      addToast('info', `Carrito renovado para "${selectedRestaurant?.name || 'nuevo restaurante'}"`);
    }

    if (selectedRestaurant) {
      setCartRestaurant(selectedRestaurant);
    }

    // Generate unique signature for item based on product id, variant options, and topping ids
    const variantSig = item.selectedVariants.map((v) => `${v.group_id}:${v.option_id}`).sort().join('|');
    const toppingSig = item.selectedToppings.map((t) => t.id).sort().join('|');
    const itemSig = `${item.product.id}_${variantSig}_${toppingSig}_${item.notes || ''}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === itemSig);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + item.quantity,
        };
        return next;
      }
      return [...prev, { ...item, id: itemSig }];
    });

    addToast('success', `Agregado: ${item.product.name} (x${item.quantity})`);
    setIsCartOpen(true);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setCartRestaurant(null);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotalCents = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoadingUser,
        login,
        register,
        logout,
        refreshProfile,
        activeView,
        setActiveView: handleSetActiveView,
        restaurants,
        isLoadingRestaurants,
        loadRestaurants,
        selectedRestaurant,
        setSelectedRestaurant,
        openRestaurant,
        restaurantProducts,
        isLoadingProducts,
        selectedProduct,
        setSelectedProduct,
        cart,
        cartRestaurant,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartSubtotalCents,
        addresses,
        selectedAddress,
        setSelectedAddress,
        loadAddresses,
        createAddress,
        deleteAddress,
        orders,
        isLoadingOrders,
        loadOrders,
        fees,
        isCartOpen,
        setIsCartOpen,
        isAuthOpen,
        setIsAuthOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        payingOrder,
        setPayingOrder,
        toasts,
        addToast,
        removeToast,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe ser utilizado dentro de AppContextProvider');
  return context;
};
