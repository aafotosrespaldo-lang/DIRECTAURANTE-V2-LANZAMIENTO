import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { directApi } from '../api/client.ts';
import { realtimeClient } from '../services/realtimeClient.ts';
import { Order, OrderStatus, Product, Restaurant, ProductVariantGroup, ProductTopping, OrderMessage } from '../types.ts';
import { RestaurantSalesCrmView } from './RestaurantSalesCrmView.tsx';
import { RestaurantSettingsView } from './RestaurantSettingsView.tsx';
import {
  Store,
  RotateCw,
  CheckCircle,
  XCircle,
  Clock,
  ChefHat,
  PackageCheck,
  AlertTriangle,
  LogIn,
  Eye,
  ShieldCheck,
  Bike,
  X,
  MapPin,
  Phone,
  User as UserIcon,
  Package,
  DollarSign,
  Bell,
  Settings,
  Save,
  Plus,
  Minus,
  Sparkles,
  Edit,
  Trash2,
  CheckCheck,
  CheckCircle2,
  Filter,
  TrendingUp,
  LogOut,
  Upload,
  Image as ImageIcon,
  Camera,
  MessageSquare,
  Send,
  Radio,
  Ban,
} from 'lucide-react';

// Fast client-side image compression for dish photos (<150KB)
const compressProductImage = (
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error leyendo archivo de imagen.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error cargando los datos de la imagen.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const FOOD_IMAGE_PRESETS = [
  { label: 'Tacos Pastor', url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80' },
  { label: 'Hamburguesa', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80' },
  { label: 'Pizza Italiana', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80' },
  { label: 'Sushi Especial', url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80' },
  { label: 'Postre', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80' },
  { label: 'Bebida', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80' },
];

export const RestaurantPortalView: React.FC = () => {
  const { user, login, logout, addToast, restaurants, loadRestaurants, setActiveView, setIsAuthOpen } = useApp();

  // Navigation: Comandas en Vivo (Inicio), Inventario, Ventas e Historial, Notificaciones, Perfil
  const [navTab, setNavTab] = useState<'pedidos' | 'inventario' | 'ventas' | 'notificaciones' | 'perfil'>('pedidos');
  const [liveStatusFilter, setLiveStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'ready'>('all');
  const [activeOrderTab, setActiveOrderTab] = useState<'active' | 'history' | 'all'>('active');

  const [restaurantOrders, setRestaurantOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // Chat de Pedido en Vivo (Restaurante <-> Driver <-> Cliente)
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<OrderMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingOrderChat, setIsSendingOrderChat] = useState(false);

  // Sales summary
  const [salesSummary, setSalesSummary] = useState<{
    today_cents: number;
    month_cents: number;
    year_cents: number;
    active_orders: number;
  } | null>(null);

  // Product & Inventory state
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [tempStockValue, setTempStockValue] = useState<number>(0);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('todas');

  // Product CRUD Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodFormName, setProdFormName] = useState('');
  const [prodFormDesc, setProdFormDesc] = useState('');
  const [prodFormPrice, setProdFormPrice] = useState('');
  const [prodFormCategory, setProdFormCategory] = useState('Especialidades');
  const [prodFormImage, setProdFormImage] = useState('');
  const [prodFormAvailable, setProdFormAvailable] = useState(true);
  const [prodFormIsUnlimitedStock, setProdFormIsUnlimitedStock] = useState(true);
  const [prodFormStock, setProdFormStock] = useState<number>(20);
  const [prodFormLowStock, setProdFormLowStock] = useState<number>(3);
  const [prodFormVariants, setProdFormVariants] = useState<ProductVariantGroup[]>([]);
  const [prodFormToppings, setProdFormToppings] = useState<ProductTopping[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Product Image Upload & Real-Time Preview State
  const [prodImageInputMode, setProdImageInputMode] = useState<'upload' | 'url'>('upload');
  const [isUploadingProdImage, setIsUploadingProdImage] = useState(false);
  const prodImageFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleProductImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProdImage(true);
    try {
      const dataUrl = await compressProductImage(file, 800, 800, 0.85);
      setProdFormImage(dataUrl);
      addToast('success', '¡Imagen cargada! Vista previa actualizada en vivo');
    } catch (err: any) {
      addToast('error', err.message || 'Error al procesar imagen del platillo');
    } finally {
      setIsUploadingProdImage(false);
      if (prodImageFileInputRef.current) prodImageFileInputRef.current.value = '';
    }
  };

  // Restaurant Profile state
  const [profileData, setProfileData] = useState<Partial<Restaurant>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Real-time notifications log with unread tracking
  const [recentEvents, setRecentEvents] = useState<Array<{ id: string; type: string; message: string; timestamp: string; is_read: boolean }>>([]);
  const [notifFilter, setNotifFilter] = useState<'todas' | 'no_leidas'>('todas');

  const isRestaurantRole = user?.role === 'restaurant';
  const isMasterRole = user?.role === 'master' || (user?.role as any) === 'admin';
  const isAuthorized = isRestaurantRole || isMasterRole;

  const ownedRestaurant: Restaurant | undefined = user
    ? restaurants.find((r) => r.owner_id === user.id) || (isRestaurantRole ? restaurants.find((r) => r.id === 'rest_tacos_guero') : undefined)
    : undefined;

  const [masterSelectedRestId, setMasterSelectedRestId] = useState<string>('rest_tacos_guero');

  const currentRestaurantId = isRestaurantRole
    ? ownedRestaurant?.id || 'rest_tacos_guero'
    : isMasterRole
    ? masterSelectedRestId
    : '';

  const activeRestaurantInfo = restaurants.find((r) => r.id === currentRestaurantId) || ownedRestaurant;

  // Load Orders & Sales Summary
  const fetchOrdersAndSales = async (silent: boolean = false) => {
    if (!isAuthorized || !currentRestaurantId) return;
    if (!silent) setIsLoading(true);
    try {
      const [orders, sales] = await Promise.all([
        directApi.getRestaurantOrders(currentRestaurantId),
        directApi.getRestaurantSalesSummary(currentRestaurantId).catch(() => null),
      ]);
      setRestaurantOrders(orders);
      if (sales) setSalesSummary(sales);
    } catch (err: any) {
      if (!silent) addToast('error', err.message || 'Error cargando datos del restaurante');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Chat de Pedido: Cargar y Enviar Mensajes
  const fetchChatMessages = async (orderId: string) => {
    try {
      const msgs = await directApi.getOrderMessages(orderId);
      setChatMessages(msgs);
    } catch {
      // non-fatal
    }
  };

  const openOrderChat = async (orderId: string) => {
    setChatOrderId(orderId);
    await fetchChatMessages(orderId);
  };

  const handleSendOrderMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatOrderId || !chatInput.trim()) return;

    setIsSendingOrderChat(true);
    try {
      const sent = await directApi.sendOrderMessage(chatOrderId, chatInput.trim());
      setChatMessages((prev) => [...prev, sent]);
      setChatInput('');
    } catch (err: any) {
      addToast('error', err.message || 'Error al enviar mensaje al repartidor');
    } finally {
      setIsSendingOrderChat(false);
    }
  };

  // Load Products & Inventory
  const fetchInventory = async () => {
    if (!isAuthorized || !currentRestaurantId) return;
    setIsLoadingInventory(true);
    try {
      const prods = await directApi.getRestaurantInventory(currentRestaurantId);
      setInventoryProducts(prods);
    } catch (err: any) {
      addToast('error', err.message || 'Error cargando inventario');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Load Profile with server rehydration and localStorage cache fallback
  const fetchProfile = async () => {
    if (!isAuthorized) return;
    // Check localStorage cache first for instant UI response
    if (currentRestaurantId) {
      try {
        const cached = localStorage.getItem(`direct_rest_profile_${currentRestaurantId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.name) {
            setProfileData(parsed);
          }
        }
      } catch {}
    }

    try {
      const prof = await directApi.getRestaurantProfile();
      if (prof && prof.id) {
        setProfileData(prof);
        if (currentRestaurantId) {
          localStorage.setItem(`direct_rest_profile_${currentRestaurantId}`, JSON.stringify(prof));
        }
      }
    } catch {
      if (activeRestaurantInfo) {
        setProfileData(activeRestaurantInfo);
      }
    }
  };

  const [isTogglingClosed, setIsTogglingClosed] = useState(false);
  const handleQuickToggleClosed = async () => {
    const isCurrentlyClosed = Boolean(profileData.is_temporarily_closed ?? (!profileData.is_open));
    const targetClosed = !isCurrentlyClosed;
    setProfileData((prev) => ({
      ...prev,
      is_temporarily_closed: targetClosed,
      is_open: !targetClosed,
    }));
    try {
      setIsTogglingClosed(true);
      const res = await directApi.toggleRestaurantClosed(targetClosed);
      if (res && res.data) {
        setProfileData(res.data);
      }
      addToast(
        targetClosed ? 'info' : 'success',
        targetClosed ? 'Restaurante puesto Fuera de Servicio' : 'Restaurante Abierto en Servicio'
      );
    } catch (err: any) {
      addToast('error', err.message || 'Error al cambiar estado operativo');
      setProfileData((prev) => ({
        ...prev,
        is_temporarily_closed: isCurrentlyClosed,
        is_open: !isCurrentlyClosed,
      }));
    } finally {
      setIsTogglingClosed(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      if (restaurants.length === 0) {
        loadRestaurants();
      }
      if (currentRestaurantId) {
        fetchOrdersAndSales();
        fetchInventory();
        fetchProfile();

        // Background heartbeat poll (4s) ensures kitchen orders are 100% resilient and never miss a command
        const interval = setInterval(() => {
          fetchOrdersAndSales(true);
        }, 4000);
        return () => clearInterval(interval);
      }
    }
  }, [isAuthorized, currentRestaurantId, restaurants.length]);

  // Real-time Event Listener: SSE
  useEffect(() => {
    const unsub = realtimeClient.subscribe((event) => {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isOrderRelated =
        event.type.startsWith('ORDER_') ||
        event.type === 'DRIVER_ASSIGNED' ||
        event.type === 'PAYMENT_UPDATED';

      if (isOrderRelated) {
        // 1. Instant in-memory update (0ms latency)
        if (event.data && event.data.id) {
          setRestaurantOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === event.data.id);
            if (idx >= 0) {
              return prev.map((o) => (o.id === event.data.id ? { ...o, ...event.data } : o));
            } else if (!event.restaurant_id || event.restaurant_id === currentRestaurantId) {
              return [event.data, ...prev];
            }
            return prev;
          });
        }

        // 2. Play kitchen bell on incoming orders
        if (event.type === 'ORDER_CREATED') {
          realtimeClient.playNotificationSound('ORDER_CREATED');
        }

        // 3. Parallel fetch to reconcile sales and totals
        fetchOrdersAndSales(true);

        const displayFolio = (event as any).folio || (event.data && (event.data as any).folio) || (event.order_id ? `#${event.order_id.slice(-4).toUpperCase()}` : '');
        setRecentEvents((prev) => [
          {
            id: `evt_${Date.now()}_${Math.random()}`,
            type: event.type,
            message: `Pedido ${displayFolio} actualizado (${event.type === 'ORDER_CREATED' ? 'Nueva orden' : event.type})`,
            timestamp: nowStr,
            is_read: false,
          },
          ...prev.slice(0, 49),
        ]);
      } else if (event.type === 'INVENTORY_UPDATED') {
        fetchInventory();
        setRecentEvents((prev) => [
          {
            id: `evt_${Date.now()}_${Math.random()}`,
            type: event.type,
            message: `Inventario y productos actualizados`,
            timestamp: nowStr,
            is_read: false,
          },
          ...prev.slice(0, 49),
        ]);
      } else if (event.type === 'MESSAGE_CREATED') {
        if (chatOrderId && event.order_id === chatOrderId) {
          fetchChatMessages(chatOrderId);
        }
        const orderFolio = (event as any).folio || (event.order_id ? `#${event.order_id.slice(-4).toUpperCase()}` : '');
        setRecentEvents((prev) => [
          {
            id: `evt_${Date.now()}_${Math.random()}`,
            type: 'MESSAGE_CREATED',
            message: `Nuevo mensaje en pedido ${orderFolio}`,
            timestamp: nowStr,
            is_read: false,
          },
          ...prev.slice(0, 49),
        ]);
      } else if (
        (event.type === 'RESTAURANT_STATUS_CHANGED' || event.type === 'PROFILE_UPDATED') &&
        (!event.restaurant_id || event.restaurant_id === currentRestaurantId)
      ) {
        if (event.data) {
          setProfileData((prev) => ({ ...prev, ...event.data }));
        } else {
          fetchProfile();
        }
      }
    });

    return () => unsub();
  }, [currentRestaurantId]);

  const unreadEventsCount = recentEvents.filter((e) => !e.is_read).length;
  const markEventAsRead = (id: string) => {
    setRecentEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
  };
  const markAllEventsAsRead = () => {
    setRecentEvents((prev) => prev.map((e) => ({ ...e, is_read: true })));
  };

  const handleAccept = async (orderId: string) => {
    try {
      await directApi.acceptRestaurantOrder(orderId);
      addToast('success', `Pedido #${orderId.slice(-4).toUpperCase()} confirmado`);
      await fetchOrdersAndSales();
      await fetchInventory();
    } catch (err: any) {
      addToast('error', err.message || 'Error al aceptar pedido');
    }
  };

  const handleReject = async (orderId: string) => {
    try {
      await directApi.rejectRestaurantOrder(orderId, 'Capacidad máxima de cocina');
      addToast('info', `Pedido #${orderId.slice(-4).toUpperCase()} rechazado`);
      await fetchOrdersAndSales();
    } catch (err: any) {
      addToast('error', err.message || 'Error al rechazar pedido');
    }
  };

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await directApi.updateRestaurantOrderStatus(orderId, nextStatus);
      addToast('success', `Pedido #${orderId.slice(-4).toUpperCase()} actualizado a: ${nextStatus}`);
      await fetchOrdersAndSales();
      if (selectedOrderDetail?.id === orderId) {
        const updated = await directApi.getOrderById(orderId);
        setSelectedOrderDetail(updated);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Error al actualizar estado');
    }
  };

  // Stock Quick Adjust
  const handleSaveStock = async (productId: string) => {
    try {
      await directApi.updateRestaurantInventory(productId, { stock: tempStockValue });
      addToast('success', 'Stock actualizado');
      setEditingStockId(null);
      await fetchInventory();
    } catch (err: any) {
      addToast('error', err.message || 'Error al actualizar stock');
    }
  };

  const handleToggleProductAvailability = async (product: Product) => {
    try {
      await directApi.updateRestaurantInventory(product.id, { is_available: !product.is_available });
      addToast('success', `${product.name} marcado como ${!product.is_available ? 'Disponible' : 'Agotado'}`);
      await fetchInventory();
    } catch (err: any) {
      addToast('error', err.message || 'Error al cambiar disponibilidad');
    }
  };

  // Product CRUD Full Management
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProdFormName('');
    setProdFormDesc('');
    setProdFormPrice('');
    setProdFormCategory('Especialidades');
    setProdFormImage('https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80');
    setProdFormAvailable(true);
    setProdFormIsUnlimitedStock(true);
    setProdFormStock(20);
    setProdFormLowStock(3);
    setProdFormVariants([]);
    setProdFormToppings([]);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdFormName(prod.name);
    setProdFormDesc(prod.description || '');
    setProdFormPrice((prod.price / 100).toFixed(2));
    setProdFormCategory(prod.category || 'General');
    setProdFormImage(prod.image_url || '');
    setProdFormAvailable(prod.is_available);
    setProdFormIsUnlimitedStock(prod.stock === null || prod.stock === undefined);
    setProdFormStock(prod.stock ?? 20);
    setProdFormLowStock(prod.low_stock_threshold ?? 3);
    setProdFormVariants(prod.variants || []);
    setProdFormToppings(prod.toppings || []);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodFormName.trim() || !prodFormPrice) {
      addToast('error', 'El nombre y precio son obligatorios');
      return;
    }

    const priceCents = Math.round(parseFloat(prodFormPrice) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      addToast('error', 'Ingresa un precio válido mayor a 0');
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload: Partial<Product> = {
        name: prodFormName.trim(),
        description: prodFormDesc.trim(),
        price: priceCents,
        category: prodFormCategory.trim() || 'General',
        image_url: prodFormImage.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        is_available: prodFormAvailable,
        stock: prodFormIsUnlimitedStock ? null : prodFormStock,
        low_stock_threshold: prodFormLowStock,
        variants: prodFormVariants,
        toppings: prodFormToppings,
      };

      if (editingProduct) {
        await directApi.updateRestaurantProduct(editingProduct.id, payload);
        addToast('success', `Producto "${prodFormName}" actualizado`);
      } else {
        await directApi.createRestaurantProduct(payload);
        addToast('success', `Producto "${prodFormName}" creado`);
      }

      setIsProductModalOpen(false);
      await fetchInventory();
    } catch (err: any) {
      addToast('error', err.message || 'Error al guardar producto');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`¿Confirmas eliminar el producto "${productName}" del catálogo?`)) return;
    try {
      await directApi.deleteRestaurantProduct(productId);
      addToast('success', `Producto "${productName}" eliminado`);
      await fetchInventory();
    } catch (err: any) {
      addToast('error', err.message || 'Error al eliminar producto');
    }
  };

  // Add Variant helper
  const handleAddVariantGroup = () => {
    const newGroup: ProductVariantGroup = {
      id: `grp_${Date.now()}`,
      name: 'Opciones de Preparación',
      required: false,
      min_selections: 0,
      max_selections: 1,
      options: [
        { id: `opt_${Date.now()}_1`, name: 'Normal', price_delta: 0 },
        { id: `opt_${Date.now()}_2`, name: 'Grande', price_delta: 1500 },
      ],
    };
    setProdFormVariants((prev) => [...prev, newGroup]);
  };

  // Add Topping helper
  const handleAddTopping = () => {
    const newTop: ProductTopping = {
      id: `top_${Date.now()}`,
      name: 'Extra Queso',
      price: 1500, // $15 MXN
      is_available: true,
    };
    setProdFormToppings((prev) => [...prev, newTop]);
  };

  const handleSaveRestaurantProfile = async (data?: Partial<Restaurant> | React.FormEvent) => {
    if (data && 'preventDefault' in (data as any)) {
      (data as React.FormEvent).preventDefault();
    }
    const payload = (data && !('preventDefault' in (data as any))) ? (data as Partial<Restaurant>) : profileData;
    setIsSavingProfile(true);
    try {
      const updated = await directApi.updateRestaurantProfile(payload);
      setProfileData(updated);
      await loadRestaurants();
      if (currentRestaurantId) {
        localStorage.setItem(`direct_rest_profile_${currentRestaurantId}`, JSON.stringify(updated));
      }
      addToast('success', '¡Configuraciones y credencial del restaurante guardadas con éxito!');
    } catch (err: any) {
      addToast('error', err.message || 'Error al guardar configuraciones');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Orders filters: Strictly processing orders in kitchen & delivery lifecycle (Aceptar -> Preparar -> Listo / En Ruta)
  const processingOrders = restaurantOrders.filter(
    (o) =>
      o.status === 'pending' ||
      o.status === 'confirmed' ||
      o.status === 'preparing' ||
      o.status === 'ready' ||
      o.status === 'assigned' ||
      o.status === 'picked_up' ||
      o.status === 'delivering'
  );
  const pendingOrders = processingOrders.filter((o) => o.status === 'pending');
  const inKitchenOrders = processingOrders.filter((o) => o.status === 'confirmed' || o.status === 'preparing');
  const waitingDriverOrders = processingOrders.filter(
    (o) => o.status === 'ready' || o.status === 'assigned' || o.status === 'picked_up' || o.status === 'delivering'
  );

  const historyOrders = restaurantOrders.filter(
    (o) => o.status === 'delivered' || o.status === 'cancelled'
  );

  const displayedLiveOrders =
    liveStatusFilter === 'pending'
      ? pendingOrders
      : liveStatusFilter === 'preparing'
      ? inKitchenOrders
      : liveStatusFilter === 'ready'
      ? waitingDriverOrders
      : processingOrders;

  // Filtered inventory products
  const filteredProducts = inventoryProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.description || '').toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat = productCategoryFilter === 'todas' || p.category === productCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const categoriesList = Array.from(new Set(inventoryProducts.map((p) => p.category).filter(Boolean)));

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#060919] text-white flex flex-col justify-center items-center px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#05268F] border border-[#FFD318]/40 flex items-center justify-center mx-auto mb-4 text-[#FFD318]">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acceso a Operador de Restaurante</h2>
        <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
          Este panel está reservado para operadores de restaurantes y personal de cocina para gestionar comandas, inventario y catálogo.
        </p>
        <div className="flex flex-wrap items-center gap-3 justify-center">
          <button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/40 font-semibold text-[#FFD318] transition"
          >
            Iniciar Sesión como Restaurante
          </button>
          <button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-100 font-bold text-[#101828] transition"
          >
            Registrar Cuenta de Restaurante
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060919] text-white flex flex-col font-sans">
      {/* Barra de Control y Navegación de Cocina */}
      <header className="sticky top-0 z-30 bg-[#07091a]/95 backdrop-blur-md border-b border-[#05268F]/30 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Identificación del Restaurante */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#05268F] border border-[#FFD318]/40 overflow-hidden flex items-center justify-center text-[#FFD318] shadow-sm shrink-0">
                {profileData.logo_url || activeRestaurantInfo?.logo_url ? (
                  <img
                    src={profileData.logo_url || activeRestaurantInfo?.logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ChefHat className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-black text-white tracking-tight">
                    {profileData.name || activeRestaurantInfo?.name || 'Mi Cocina Directaurante'}
                  </h1>
                  {profileData.is_temporarily_closed || !profileData.is_open ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950/90 text-rose-300 border border-rose-600/80 animate-pulse">
                        <Ban className="w-3 h-3 text-rose-400" />
                        FUERA DE SERVICIO
                      </span>
                      <button
                        type="button"
                        onClick={handleQuickToggleClosed}
                        disabled={isTogglingClosed}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
                        title="Poner en servicio para recibir órdenes"
                      >
                        {isTogglingClosed ? '...' : 'Poner en Servicio'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        EN SERVICIO
                      </span>
                      <button
                        type="button"
                        onClick={handleQuickToggleClosed}
                        disabled={isTogglingClosed}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-950/70 hover:bg-rose-900 border border-rose-800/70 text-rose-300 hover:text-white transition"
                        title="Pausar restaurante y mostrar como Fuera de Servicio a clientes"
                      >
                        {isTogglingClosed ? '...' : 'Poner Fuera de Servicio'}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  {processingOrders.length} comanda{processingOrders.length === 1 ? '' : 's'} en proceso
                </p>
              </div>
            </div>

            {/* Selector de restaurante si está en modo Master */}
            {isMasterRole && (
              <select
                value={masterSelectedRestId}
                onChange={(e) => setMasterSelectedRestId(e.target.value)}
                className="bg-[#0a0f30] border border-[#05268F]/40 text-xs rounded-xl px-2.5 py-1.5 text-[#FFD318] focus:outline-none focus:border-[#FFD318]"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#070728] text-white">
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Navegación por Pestañas */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1">
            <button
              onClick={() => setNavTab('pedidos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                navTab === 'pedidos'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Comandas en Vivo</span>
              {processingOrders.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  pendingOrders.length > 0 ? 'bg-[#FFD318] text-[#05268F] animate-pulse' : 'bg-zinc-800 text-zinc-200'
                }`}>
                  {processingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setNavTab('inventario')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                navTab === 'inventario'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Menú y Stock ({inventoryProducts.length})</span>
            </button>
            <button
              onClick={() => setNavTab('ventas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                navTab === 'ventas'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Ventas, Historial y CRM</span>
            </button>
            <button
              onClick={() => setNavTab('notificaciones')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                navTab === 'notificaciones'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Avisos</span>
              {unreadEventsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FFD318] text-[#05268F]">
                  {unreadEventsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setNavTab('perfil')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                navTab === 'perfil'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          </div>

          {/* Botones de acción directos */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => fetchOrdersAndSales(false)}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#0a0f30] border border-[#05268F]/30 text-zinc-300 hover:text-white transition shadow-sm"
              title="Recargar comandas"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-rose-500/50 hover:bg-rose-950/30 text-zinc-300 hover:text-rose-300 transition text-xs font-semibold shadow-xs"
              title="Cerrar sesión de restaurante"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5 w-full flex-1">
        {/* TAB 1: COMANDAS EN VIVO - DIRECTO Y SIN DISTRACCIONES */}
        {navTab === 'pedidos' && (
          <div className="space-y-4">
            {/* Sub-barra de filtros rápidos por etapa de proceso */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0a0f30]/80 border border-[#05268F]/40 p-3 rounded-2xl shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ChefHat className="w-4 h-4 text-[#FFD318]" />
                  En Proceso Activo:
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 shadow-xs">
                  {processingOrders.length} {processingOrders.length === 1 ? 'comanda' : 'comandas'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => setLiveStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    liveStatusFilter === 'all'
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  Todas ({processingOrders.length})
                </button>
                <button
                  onClick={() => setLiveStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    liveStatusFilter === 'pending'
                      ? 'bg-[#FFD318] text-[#05268F] font-black border border-[#FFD318] shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {pendingOrders.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                  Por Aceptar ({pendingOrders.length})
                </button>
                <button
                  onClick={() => setLiveStatusFilter('preparing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    liveStatusFilter === 'preparing'
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/50 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  En Cocina ({inKitchenOrders.length})
                </button>
                <button
                  onClick={() => setLiveStatusFilter('ready')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    liveStatusFilter === 'ready'
                      ? 'bg-emerald-600 text-white font-black border border-emerald-400 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  Esperando Repartidor ({waitingDriverOrders.length})
                </button>
              </div>
            </div>

            {/* Grid de Comandas en Vivo */}
            {displayedLiveOrders.length === 0 ? (
              <div className="bg-[#0a0f30]/40 border border-[#05268F]/30 rounded-3xl p-16 text-center text-zinc-400">
                <div className="w-16 h-16 rounded-3xl bg-[#05268F]/30 border border-[#FFD318]/30 flex items-center justify-center mx-auto mb-4 text-[#FFD318]">
                  <ChefHat className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {liveStatusFilter === 'all'
                    ? 'No hay pedidos en proceso en este momento'
                    : `Sin pedidos en la etapa "${liveStatusFilter === 'pending' ? 'Por Aceptar' : liveStatusFilter === 'preparing' ? 'En Cocina' : 'Esperando Repartidor'}"`}
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Los nuevos pedidos aparecerán aquí automáticamente desde que ingresan para Aceptar hasta la Espera del Repartidor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedLiveOrders.map((order) => {
                  const isPending = order.status === 'pending';
                  const isConfirmed = order.status === 'confirmed';
                  const isPreparing = order.status === 'preparing';
                  const isReady = order.status === 'ready';
                  const isDelivering = order.status === 'delivering' || order.status === 'picked_up' || order.status === 'assigned';
                  const isPickup = order.order_type === 'pickup';
                  const isLocalDelivery =
                    (profileData as any)?.delivery_mode === 'local_driver' ||
                    (activeRestaurantInfo as any)?.delivery_mode === 'local_driver' ||
                    (order as any)?.delivery_mode === 'local_driver' ||
                    Boolean(order.driver_name && order.driver_name.toLowerCase().includes('local'));

                  return (
                    <div
                      key={order.id}
                      className={`bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition ${
                        isPending
                          ? 'border-[#FFD318]/80 ring-1 ring-[#FFD318]/50 shadow-[0_0_20px_rgba(255,211,24,0.15)]'
                          : isReady
                          ? 'border-emerald-500/60'
                          : isDelivering
                          ? 'border-blue-500/60'
                          : 'border-[#05268F]/50 hover:border-[#05268F]'
                      }`}
                    >
                      <div>
                        {/* Cabecera del Ticket */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-black text-[#FFD318] flex items-center gap-1.5">
                            <ChefHat className="w-3.5 h-3.5" />
                            {order.folio || order.order_code || `#${order.id.replace(/^ord_/, '').slice(0, 5).toUpperCase()}`}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              isPending
                                ? 'bg-[#FFD318] text-[#05268F] animate-pulse shadow-xs'
                                : isConfirmed
                                ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                                : isPreparing
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                                : isReady
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                                : isDelivering
                                ? 'bg-blue-950/80 text-blue-300 border border-blue-700/60'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {isPending && '⚡ NUEVO • POR ACEPTAR'}
                            {isConfirmed && 'ACEPTADO • INICIAR'}
                            {isPreparing && '🔥 EN PREPARACIÓN'}
                            {isReady && (isPickup ? '📦 LISTO EN MOSTRADOR' : isLocalDelivery ? '🛵 LISTO • CONDUCTOR LOCAL' : '📦 ESPERANDO REPARTIDOR')}
                            {isDelivering && (isLocalDelivery ? '🛵 EN RUTA (CONDUCTOR LOCAL)' : '🛵 EN RUTA DE ENTREGA')}
                          </span>
                        </div>

                        {/* Datos del Cliente y Dirección */}
                        <div className="space-y-1 mb-4 text-xs">
                          <p className="text-white font-bold flex items-center justify-between">
                            <span>{order.customer_name}</span>
                            <span className="text-[11px] font-mono text-[#FFD318] font-bold">
                              ${(order.total / 100).toFixed(2)}
                            </span>
                          </p>
                          <p className="text-zinc-400 text-[11px] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span className="truncate">{order.delivery_address || 'Entrega en tienda (Pickup)'}</span>
                          </p>
                          {order.notes && (
                            <p className="text-[#FFD318] text-[11px] bg-[#05268F]/25 border border-[#FFD318]/20 p-2 rounded-xl mt-1">
                              <strong>Nota:</strong> {order.notes}
                            </p>
                          )}
                        </div>

                        {/* Lista de Platillos / Comanda */}
                        <div className="border-t border-zinc-800/80 pt-3 space-y-1.5 mb-4">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-zinc-200">
                                <strong className="text-[#FFD318] bg-[#05268F]/40 px-1.5 py-0.5 rounded mr-1">
                                  {item.quantity}x
                                </strong>{' '}
                                <span className="text-white font-medium">{item.product_name}</span>
                                {item.variants && item.variants.length > 0 && (
                                  <span className="block text-[10px] text-zinc-400 pl-6">
                                    {item.variants.map((v) => `${v.group_name}: ${v.option_name}`).join(', ')}
                                  </span>
                                )}
                                {item.toppings && item.toppings.length > 0 && (
                                  <span className="block text-[10px] text-[#FFD318]/80 pl-6">
                                    +{item.toppings.map((t) => t.name).join(', ')}
                                  </span>
                                )}
                              </span>
                              <span className="text-zinc-400 text-[11px] shrink-0">${(item.subtotal / 100).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Acciones de la Comanda */}
                      <div className="space-y-2 pt-3 border-t border-zinc-800">
                        {isPending && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleAccept(order.id)}
                              className="bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aceptar Pedido
                            </button>
                            <button
                              onClick={() => handleReject(order.id)}
                              className="bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                            >
                              <XCircle className="w-4 h-4" />
                              Rechazar
                            </button>
                          </div>
                        )}

                        {isConfirmed && (
                          <button
                            onClick={() => handleAdvanceStatus(order.id, 'preparing')}
                            className="w-full bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
                          >
                            <ChefHat className="w-4 h-4" />
                            Iniciar Preparación en Cocina
                          </button>
                        )}

                        {isPreparing && (
                          <button
                            onClick={() => handleAdvanceStatus(order.id, 'ready')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
                          >
                            <PackageCheck className="w-4 h-4" />
                            Marcar Listo para Entrega
                          </button>
                        )}

                        {isReady && (
                          <div className="space-y-2">
                            {isPickup ? (
                              <button
                                onClick={() => handleAdvanceStatus(order.id, 'delivered')}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar Entrega en Mostrador (Pickup)
                              </button>
                            ) : isLocalDelivery ? (
                              <div className="space-y-1.5">
                                <button
                                  onClick={() => handleAdvanceStatus(order.id, 'delivering')}
                                  className="w-full bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
                                >
                                  <Bike className="w-4 h-4" />
                                  Despachar con Conductor Local ({order.driver_name || (profileData as any)?.local_driver_name || 'Repartidor Propio'})
                                </button>
                                <button
                                  onClick={() => handleAdvanceStatus(order.id, 'delivered')}
                                  className="w-full bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Marcar como Entregado Directamente
                                </button>
                              </div>
                            ) : (
                              <div className="text-[11px] text-emerald-300 font-bold text-center py-2 px-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Listo en Mostrador • Esperando Recolección de Repartidor de Red
                              </div>
                            )}
                          </div>
                        )}

                        {isDelivering && (isLocalDelivery || isPickup) && (
                          <button
                            onClick={() => handleAdvanceStatus(order.id, 'delivered')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Confirmar Pedido Entregado al Cliente
                          </button>
                        )}

                        {/* Botón de Chat para Pedidos Asignados o en Curso */}
                        {Boolean(order.driver_id || ['assigned', 'picked_up', 'delivering', 'ready', 'preparing', 'confirmed'].includes(order.status)) && (
                          <button
                            onClick={() => openOrderChat(order.id)}
                            className="w-full bg-[#05268F]/30 hover:bg-[#05268F]/50 text-[#FFD318] border border-[#FFD318]/40 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat con Repartidor / Cliente</span>
                            {order.driver_name && (
                              <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-white font-normal truncate max-w-[120px]">
                                {order.driver_name}
                              </span>
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedOrderDetail(order)}
                          className="w-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 font-medium py-1.5 rounded-xl text-[11px] border border-zinc-800 flex items-center justify-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Detalles del Pedido
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB DE VENTAS, HISTORIAL Y CRM BÁSICO */}
        {navTab === 'ventas' && (
          <RestaurantSalesCrmView
            orders={restaurantOrders}
            restaurantId={currentRestaurantId}
            restaurantName={activeRestaurantInfo?.name || 'Mi Cocina Directaurante'}
            onSelectOrderDetail={(order) => setSelectedOrderDetail(order)}
            onRefreshData={() => fetchOrdersAndSales(false)}
            onOpenChat={(orderId) => openOrderChat(orderId)}
          />
        )}

      {/* TAB 2: PRODUCTOS Y GESTIÓN DE STOCK (CRUD REAL) */}
      {navTab === 'inventario' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">Catálogo de Productos y Control de Stock</h2>
              <p className="text-xs text-zinc-400">
                Crea y edita productos, administra disponibilidad, stock atómico, variantes y complementos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreateProduct}
                className="bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Nuevo Producto
              </button>
              <button
                onClick={fetchInventory}
                disabled={isLoadingInventory}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-2 bg-[#101828] border border-zinc-800 rounded-xl"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoadingInventory ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Search and Category Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] p-3 rounded-2xl border border-[#05268F]/30 shadow-md">
            <input
              type="text"
              placeholder="Buscar producto por nombre o descripción..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full sm:flex-1 bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD318]"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD318] w-full sm:w-auto"
              >
                <option value="todas">Todas las Categorías</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((prod) => {
              const isLowStock = prod.stock !== null && prod.stock !== undefined && prod.stock <= (prod.low_stock_threshold || 3);

              return (
                <div
                  key={prod.id}
                  className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-2xl p-4 shadow-md flex flex-col justify-between hover:border-[#05268F]/60 transition"
                >
                  <div>
                    <div className="flex items-start gap-3 mb-2">
                      {prod.image_url && (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-14 h-14 rounded-xl object-cover border border-zinc-800 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-bold text-white text-sm truncate">{prod.name}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              prod.is_available
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            }`}
                          >
                            {prod.is_available ? 'Disponible' : 'Agotado'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#FFD318]">${(prod.price / 100).toFixed(2)} MXN</span>
                        <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{prod.description}</p>
                      </div>
                    </div>

                    {/* Category badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                        {prod.category}
                      </span>
                      {prod.variants && prod.variants.length > 0 && (
                        <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                          {prod.variants.length} variante(s)
                        </span>
                      )}
                      {prod.toppings && prod.toppings.length > 0 && (
                        <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                          {prod.toppings.length} topping(s)
                        </span>
                      )}
                    </div>

                    {/* Stock status indicator */}
                    <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 mb-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Stock:</span>
                      <div className="flex items-center gap-2">
                        {prod.stock === null || prod.stock === undefined ? (
                          <span className="text-xs font-semibold text-zinc-300">Ilimitado</span>
                        ) : (
                          <span
                            className={`text-xs font-black font-mono ${
                              isLowStock ? 'text-[#FFD318]' : 'text-white'
                            }`}
                          >
                            {prod.stock} un.
                          </span>
                        )}
                        {isLowStock && (
                          <span className="text-[10px] font-bold text-[#FFD318] bg-[#05268F]/40 px-1.5 py-0.5 rounded border border-[#FFD318]/40">
                            Bajo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Product action controls */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                    {editingStockId === prod.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTempStockValue((v) => Math.max(0, v - 1))}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          value={tempStockValue}
                          onChange={(e) => setTempStockValue(parseInt(e.target.value, 10) || 0)}
                          className="w-16 bg-zinc-950 border border-zinc-700 text-center text-xs py-1 text-white rounded-lg focus:outline-none"
                        />
                        <button
                          onClick={() => setTempStockValue((v) => v + 1)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSaveStock(prod.id)}
                          className="flex-1 bg-[#05268F] text-[#FFD318] py-1 rounded-lg text-xs font-semibold hover:bg-[#0732b3]"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingStockId(null)}
                          className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-xs"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          onClick={() => {
                            setEditingStockId(prod.id);
                            setTempStockValue(prod.stock ?? 10);
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-1.5 rounded-xl text-[11px] font-semibold border border-zinc-800 text-center"
                          title="Ajuste rápido de inventario"
                        >
                          Stock
                        </button>
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="bg-zinc-900 hover:bg-zinc-800 text-[#FFD318] py-1.5 rounded-xl text-[11px] font-semibold border border-zinc-800 flex items-center justify-center gap-1"
                          title="Editar producto completo"
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleProductAvailability(prod)}
                          className={`py-1.5 rounded-xl text-[11px] font-semibold border text-center ${
                            prod.is_available
                              ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                              : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                          }`}
                        >
                          {prod.is_available ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICACIONES REALTIME */}
      {navTab === 'notificaciones' && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-bold">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Eventos y Notificaciones de Cocina
                </h2>
                <p className="text-xs text-zinc-400">Historial de pedidos, despachos e inventario en tiempo real.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                SSE Conectado
              </span>
              {unreadEventsCount > 0 && (
                <button
                  onClick={markAllEventsAsRead}
                  className="text-xs text-[#FFD318] hover:underline flex items-center gap-1 font-semibold"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas leídas
                </button>
              )}
            </div>
          </div>

          {/* Filter options */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setNotifFilter('todas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                notifFilter === 'todas'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todas ({recentEvents.length})
            </button>
            <button
              onClick={() => setNotifFilter('no_leidas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                notifFilter === 'no_leidas'
                  ? 'bg-[#05268F] text-[#FFD318]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              No leídas ({unreadEventsCount})
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <p className="text-xs text-zinc-400 py-8 text-center">
              No se han registrado eventos en esta sesión. Los cambios de comandas o inventario se recibirán automáticamente.
            </p>
          ) : (
            <div className="divide-y divide-[#05268F]/20">
              {recentEvents
                .filter((evt) => (notifFilter === 'no_leidas' ? !evt.is_read : true))
                .map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => markEventAsRead(evt.id)}
                    className={`py-3 px-3 rounded-xl flex items-center justify-between gap-4 text-xs transition cursor-pointer hover:bg-[#05268F]/20 ${
                      !evt.is_read ? 'bg-[#05268F]/15' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: !evt.is_read ? '#FFD318' : '#667085' }} />
                      <span className="font-mono text-[10px] text-[#FFD318] bg-[#05268F] px-2 py-0.5 rounded font-bold">
                        {evt.type}
                      </span>
                      <span className="text-zinc-200">{evt.message}</span>
                    </div>
                    <span className="text-zinc-500 font-mono text-[11px] shrink-0">{evt.timestamp}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONFIGURACIONES Y CREDENCIAL DEL RESTAURANTE */}
      {navTab === 'perfil' && (
        <RestaurantSettingsView
          initialRestaurant={profileData.name ? profileData : (activeRestaurantInfo || {})}
          currentRestaurantId={currentRestaurantId}
          onSave={handleSaveRestaurantProfile}
          isSaving={isSavingProfile}
        />
      )}

      {/* PRODUCT CREATE / EDIT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FFD318]" />
                {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
              </h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Nombre del Producto *</label>
                  <input
                    type="text"
                    value={prodFormName}
                    onChange={(e) => setProdFormName(e.target.value)}
                    placeholder="Ej. Tacos al Pastor Especiales (Orden de 5)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#05268F]"
                    required
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Precio en Pesos ($ MXN) *</label>
                  <input
                    type="number"
                    step="0.50"
                    value={prodFormPrice}
                    onChange={(e) => setProdFormPrice(e.target.value)}
                    placeholder="Ej. 85.00"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#05268F]"
                    required
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Categoría *</label>
                  <input
                    type="text"
                    value={prodFormCategory}
                    onChange={(e) => setProdFormCategory(e.target.value)}
                    placeholder="Ej. Tacos, Bebidas, Postres"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#05268F]"
                    required
                  />
                </div>
              </div>

              {/* Product Image Upload & Live Client Preview (Actualización en Vivo y Persistencia) */}
              <div className="p-4 bg-gradient-to-br from-[#0c123b] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#05268F]/30 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#05268F] text-[#FFD318] border border-[#FFD318]/30">
                      <Camera className="w-4 h-4" />
                    </span>
                    <div>
                      <label className="text-white font-bold block text-xs">
                        Foto del Platillo / Producto para el Cliente
                      </label>
                      <span className="text-[10px] text-zinc-400">
                        Sube una foto o ingresa una URL. Se actualiza en vivo y al guardar se mantiene.
                      </span>
                    </div>
                  </div>

                  {/* Mode switcher */}
                  <div className="flex items-center bg-[#070728] border border-[#05268F]/30 rounded-xl p-0.5 text-[11px] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setProdImageInputMode('upload')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        prodImageInputMode === 'upload'
                          ? 'bg-[#05268F] text-[#FFD318]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Subir archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setProdImageInputMode('url')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        prodImageInputMode === 'url'
                          ? 'bg-[#05268F] text-[#FFD318]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Pegar URL
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {/* Left Column: Upload Controls & Presets */}
                  <div className="space-y-3">
                    {prodImageInputMode === 'upload' ? (
                      <div>
                        <input
                          ref={prodImageFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleProductImageFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => prodImageFileInputRef.current?.click()}
                          disabled={isUploadingProdImage}
                          className="w-full py-3.5 px-4 rounded-xl border border-dashed border-[#FFD318]/40 hover:border-[#FFD318] bg-[#05268F]/20 hover:bg-[#05268F]/35 text-white font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50"
                        >
                          <Upload className={`w-4 h-4 text-[#FFD318] ${isUploadingProdImage ? 'animate-bounce' : ''}`} />
                          <span>
                            {isUploadingProdImage
                              ? 'Optimizando foto del platillo...'
                              : 'Subir Foto desde este dispositivo (Cámara o Galería)'}
                          </span>
                        </button>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Compatible con fotos tomadas con el celular, capturas o archivos (JPG, PNG, WebP).
                        </p>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="url"
                          value={prodFormImage}
                          onChange={(e) => setProdFormImage(e.target.value)}
                          placeholder="https://ejemplo.com/foto-platillo.jpg"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#05268F]"
                        />
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Pega un enlace web directo a la imagen del platillo.
                        </p>
                      </div>
                    )}

                    {/* Presets */}
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-1.5 font-semibold">
                        O selecciona una foto rápida sugerida:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {FOOD_IMAGE_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setProdFormImage(preset.url)}
                            className={`p-1.5 rounded-lg border text-[10px] font-semibold truncate transition text-center ${
                              prodFormImage === preset.url
                                ? 'bg-[#05268F] border-[#FFD318] text-[#FFD318]'
                                : 'bg-[#070728] border-zinc-800 text-zinc-300 hover:border-[#05268F]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {prodFormImage && (
                      <button
                        type="button"
                        onClick={() => setProdFormImage('')}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Quitar foto del platillo</span>
                      </button>
                    )}
                  </div>

                  {/* Right Column: VISTA PREVIA EN VIVO PARA EL CLIENTE */}
                  <div className="p-3 rounded-xl bg-[#070728]/90 border border-[#05268F]/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#FFD318] uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Vista Previa en Vivo (Cliente)
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {prodFormCategory || 'Categoría'}
                      </span>
                    </div>

                    {/* Simulated Diner Card exactly as shown in RestaurantDetail */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 shadow-inner">
                      {/* Product Thumbnail */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#070728] shrink-0 border border-[#05268F]/40 relative">
                        {prodFormImage ? (
                          <img
                            src={prodFormImage}
                            alt={prodFormName || 'Platillo'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/60">
                            <ImageIcon className="w-5 h-5 text-zinc-500" />
                            <span className="text-[8px] text-zinc-500 mt-0.5">Sin foto</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-white text-xs truncate">
                          {prodFormName.trim() || 'Nombre del platillo'}
                        </h4>
                        <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                          {prodFormDesc.trim() || 'Descripción de ingredientes o porción...'}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs font-black text-[#FFD318]">
                            ${(parseFloat(prodFormPrice) || 0).toFixed(2)} MXN
                          </span>
                          <span className="text-[9px] bg-[#05268F] text-[#FFD318] px-2 py-0.5 rounded font-bold border border-[#FFD318]/30">
                            + Agregar
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Al guardar este producto, la foto y cambios se mantienen activos para los clientes.</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={prodFormDesc}
                  onChange={(e) => setProdFormDesc(e.target.value)}
                  placeholder="Detalles sobre ingredientes, tamaño o porción..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#05268F]"
                />
              </div>

              {/* Stock and Availability Controls */}
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <span className="font-bold text-white block">Control de Stock e Inventario</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="unlimitedStock"
                      checked={prodFormIsUnlimitedStock}
                      onChange={(e) => setProdFormIsUnlimitedStock(e.target.checked)}
                      className="rounded accent-[#05268F]"
                    />
                    <label htmlFor="unlimitedStock" className="text-zinc-300">
                      Stock Ilimitado
                    </label>
                  </div>

                  {!prodFormIsUnlimitedStock && (
                    <>
                      <div>
                        <label className="text-zinc-400 block mb-1">Stock Disponible</label>
                        <input
                          type="number"
                          value={prodFormStock}
                          onChange={(e) => setProdFormStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">Alerta Stock Mínimo</label>
                        <input
                          type="number"
                          value={prodFormLowStock}
                          onChange={(e) => setProdFormLowStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isAvailableProd"
                    checked={prodFormAvailable}
                    onChange={(e) => setProdFormAvailable(e.target.checked)}
                    className="rounded accent-[#05268F]"
                  />
                  <label htmlFor="isAvailableProd" className="text-zinc-300 font-semibold">
                    Producto Activo y Disponible en Menú
                  </label>
                </div>
              </div>

              {/* Variants Section */}
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Grupos de Variantes ({prodFormVariants.length})</span>
                  <button
                    type="button"
                    onClick={handleAddVariantGroup}
                    className="text-[11px] text-[#FFD318] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Grupo
                  </button>
                </div>

                {prodFormVariants.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Sin variantes configuradas (ej. tamaño, preparación, salsas).</p>
                ) : (
                  <div className="space-y-3">
                    {prodFormVariants.map((grp, gIdx) => (
                      <div key={grp.id} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={grp.name}
                            onChange={(e) => {
                              const updated = [...prodFormVariants];
                              updated[gIdx].name = e.target.value;
                              setProdFormVariants(updated);
                            }}
                            className="bg-zinc-950 border border-zinc-700 px-2.5 py-1 rounded-lg text-white font-bold flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => setProdFormVariants((prev) => prev.filter((_, idx) => idx !== gIdx))}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {grp.options.map((opt) => (
                            <span key={opt.id} className="inline-block bg-zinc-950 px-2 py-0.5 rounded mr-1.5 mb-1 border border-zinc-800">
                              {opt.name} (+${(opt.price_delta / 100).toFixed(2)})
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toppings / Extras Section */}
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Toppings y Complementos ({prodFormToppings.length})</span>
                  <button
                    type="button"
                    onClick={handleAddTopping}
                    className="text-[11px] text-[#FFD318] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Topping
                  </button>
                </div>

                {prodFormToppings.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Sin complementos extras (ej. queso extra, aguacate, tocino).</p>
                ) : (
                  <div className="space-y-2">
                    {prodFormToppings.map((top, tIdx) => (
                      <div key={top.id} className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                        <input
                          type="text"
                          value={top.name}
                          onChange={(e) => {
                            const updated = [...prodFormToppings];
                            updated[tIdx].name = e.target.value;
                            setProdFormToppings(updated);
                          }}
                          className="bg-zinc-950 border border-zinc-700 px-2 py-1 rounded-lg text-white flex-1"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-500">$</span>
                          <input
                            type="number"
                            step="1"
                            value={top.price / 100}
                            onChange={(e) => {
                              const updated = [...prodFormToppings];
                              updated[tIdx].price = Math.round(parseFloat(e.target.value || '0') * 100);
                              setProdFormToppings(updated);
                            }}
                            className="w-16 bg-zinc-950 border border-zinc-700 px-2 py-1 rounded-lg text-white text-right"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setProdFormToppings((prev) => prev.filter((_, idx) => idx !== tIdx))}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-5 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  {isSavingProduct ? 'Guardando...' : editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Pedido {selectedOrderDetail.folio || selectedOrderDetail.order_code || `#${selectedOrderDetail.id.replace(/^ord_/, '').slice(0, 5).toUpperCase()}`}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {new Date(selectedOrderDetail.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
              <p className="text-white font-bold flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#FFD318]" />
                {selectedOrderDetail.customer_name}
              </p>
              <p className="text-zinc-400 flex items-center gap-2">
                <Phone className="w-4 h-4 text-zinc-500" />
                {selectedOrderDetail.customer_phone}
              </p>
              <p className="text-zinc-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#FFD318]" />
                {selectedOrderDetail.delivery_address || 'Entrega en tienda (Pickup)'}
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-white block">Productos en Comanda</span>
              <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950">
                {selectedOrderDetail.items.map((item, idx) => (
                  <div key={idx} className="p-3 space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span>${(item.subtotal / 100).toFixed(2)}</span>
                    </div>
                    {item.variants && item.variants.length > 0 && (
                      <p className="text-[10px] text-zinc-400">
                        {item.variants.map((v) => `${v.group_name}: ${v.option_name}`).join(' • ')}
                      </p>
                    )}
                    {item.toppings && item.toppings.length > 0 && (
                      <p className="text-[10px] text-[#FFD318]">
                        Toppings: {item.toppings.map((t) => t.name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[10px] text-zinc-400 italic">Nota: {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-1.5">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal Comida:</span>
                <span>${(selectedOrderDetail.subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Envío:</span>
                <span>${(selectedOrderDetail.delivery_fee / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Comisión Restaurante Aplicada:</span>
                <span>${((selectedOrderDetail.restaurant_commission ?? 1000) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-1 border-t border-zinc-800">
                <span>Total Pedido:</span>
                <span className="text-[#FFD318]">${(selectedOrderDetail.total / 100).toFixed(2)} MXN</span>
              </div>
            </div>

            {/* BOTÓN DE CHAT DIRECTO DEL PEDIDO */}
            <button
              onClick={() => {
                const oid = selectedOrderDetail.id;
                setSelectedOrderDetail(null);
                openOrderChat(oid);
              }}
              className="w-full bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98"
            >
              <MessageSquare className="w-4 h-4" />
              Abrir Chat en Vivo de este Pedido
              {selectedOrderDetail.driver_name ? ` (Repartidor: ${selectedOrderDetail.driver_name})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CHAT EN VIVO DE PEDIDO (RESTAURANTE <-> DRIVER <-> CLIENTE) */}
      {chatOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/60 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col h-[520px]">
            {/* Header del Chat */}
            <div className="flex items-center justify-between pb-3 border-b border-[#05268F]/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center border border-[#FFD318]/30">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">
                    Chat del Pedido {restaurantOrders.find((o) => o.id === chatOrderId)?.folio || `#${chatOrderId.slice(-4).toUpperCase()}`}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {restaurantOrders.find((o) => o.id === chatOrderId)?.driver_name
                      ? `Repartidor: ${restaurantOrders.find((o) => o.id === chatOrderId)?.driver_name}`
                      : 'Coordinación con repartidor y cliente'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatOrderId(null)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista de Mensajes con Scroll */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2">
                  <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400 font-medium">
                    Sin mensajes aún en este pedido.
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Escribe para coordinar la salida de cocina con el repartidor o detalles con el cliente.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender_role === 'restaurant' || msg.sender_id === user?.id;
                  const isDriver = msg.sender_role === 'driver';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                          isMe
                            ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/30 rounded-br-xs'
                            : isDriver
                            ? 'bg-emerald-950 text-emerald-200 border border-emerald-700/50 rounded-bl-xs'
                            : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-bl-xs'
                        }`}
                      >
                        <span className="text-[10px] block opacity-80 mb-0.5 font-bold">
                          {isMe ? 'Tú (Cocina)' : isDriver ? `Repartidor (${msg.sender_name})` : `Cliente (${msg.sender_name})`}
                        </span>
                        <p className="text-xs leading-relaxed">{msg.message}</p>
                      </div>
                      <span className="text-[9px] text-zinc-500 mt-0.5 px-1 font-mono">
                        {new Date(msg.timestamp || (msg as any).created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input y Botón Enviar */}
            <form onSubmit={handleSendOrderMessage} className="pt-3 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe un mensaje al repartidor..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFD318]"
              />
              <button
                type="submit"
                disabled={isSendingOrderChat || !chatInput.trim()}
                className="px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold transition disabled:opacity-50 flex items-center gap-1 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
