import React, { useState, useMemo, useEffect } from 'react';
import { Order, OrderStatus } from '../types.ts';
import { directApi } from '../api/client.ts';
import { realtimeClient } from '../services/realtimeClient.ts';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Users,
  ShoppingBag,
  DollarSign,
  Clock,
  Search,
  Filter,
  Download,
  Printer,
  Phone,
  MessageCircle,
  MessageSquare,
  Star,
  Award,
  UserCheck,
  UserPlus,
  ShieldAlert,
  Edit3,
  Save,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Banknote,
  ArrowUpRight,
  Bike,
  Store,
  Sparkles,
  BarChart3,
  PieChart,
  HelpCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export type Granularity = 'dia' | 'semana' | 'mes' | 'ano' | 'todo' | 'custom';

interface RestaurantSalesCrmViewProps {
  orders: Order[];
  restaurantId: string;
  restaurantName?: string;
  onSelectOrderDetail: (order: Order) => void;
  onRefreshData?: () => void;
  onOpenChat?: (orderId: string) => void;
}

export interface CrmCustomer {
  id: string;
  name: string;
  phone: string;
  address: string;
  firstOrderDate: string;
  lastOrderDate: string;
  totalOrders: number;
  totalSpentCents: number;
  deliveredOrders: number;
  cancelledOrders: number;
  periodOrders: number;
  periodSpentCents: number;
  favoriteItems: { name: string; count: number }[];
  tier: 'vip' | 'recurrent' | 'new';
  hasAllergies: boolean;
  allergyNotes: string;
  notes: string;
}

export const RestaurantSalesCrmView: React.FC<RestaurantSalesCrmViewProps> = ({
  orders,
  restaurantId,
  restaurantName = 'Restaurante',
  onSelectOrderDetail,
  onRefreshData,
  onOpenChat,
}) => {
  // Navigation inside this module
  const [activeSubTab, setActiveSubTab] = useState<'analitica' | 'crm' | 'pedidos'>('analitica');

  // Time Granularity
  const [granularity, setGranularity] = useState<Granularity>('dia');
  
  // Helper to format date in LOCAL browser timezone (YYYY-MM-DD) so evening orders are not pushed to next UTC day
  const formatLocalDate = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Specific date selectors in local time
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }, []);
  const [selectedDay, setSelectedDay] = useState<string>(todayStr); // YYYY-MM-DD
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0); // 0 = current week, 1 = last week, etc.
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<string>(todayStr.slice(0, 4)); // YYYY
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // CRM state
  const [crmSearch, setCrmSearch] = useState('');
  const [crmTierFilter, setCrmTierFilter] = useState<'all' | 'vip' | 'recurrent' | 'new' | 'in_period'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [customerNotesDraft, setCustomerNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [crmNotesMap, setCrmNotesMap] = useState<Record<string, string>>({});

  // Orders History table filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'delivered' | 'processing' | 'cancelled'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'delivery' | 'pickup'>('all');

  // Load CRM notes from backend / local storage
  useEffect(() => {
    let isMounted = true;
    const loadNotes = async () => {
      try {
        const notes = await directApi.getRestaurantCrmNotes(restaurantId);
        if (isMounted) {
          setCrmNotesMap(notes);
        }
      } catch {
        // Fallback to local storage
        try {
          const cached = localStorage.getItem(`crm_notes_${restaurantId}`);
          if (cached && isMounted) {
            setCrmNotesMap(JSON.parse(cached));
          }
        } catch {
          // ignore
        }
      }
    };
    loadNotes();
    return () => {
      isMounted = false;
    };
  }, [restaurantId]);

  // LIVE EVENT LISTENER: Escucha eventos SSE en tiempo real para refrescar ventas y pedidos al instante
  useEffect(() => {
    const unsub = realtimeClient.subscribe((event) => {
      if (
        event.type.startsWith('ORDER_') ||
        event.type === 'PAYMENT_UPDATED' ||
        event.type === 'DRIVER_ASSIGNED'
      ) {
        if (onRefreshData) {
          onRefreshData();
        }
      }
    });

    // Heartbeat periódico (3.5 segundos) mientras el restaurante visualiza analítica / ventas en vivo
    const pollInterval = setInterval(() => {
      if (onRefreshData) {
        onRefreshData();
      }
    }, 3500);

    return () => {
      unsub();
      clearInterval(pollInterval);
    };
  }, [onRefreshData]);

  // Compute Active Date Range [startDateObj, endDateObj]
  const dateRange = useMemo(() => {
    const now = new Date();

    if (granularity === 'dia') {
      const [year, month, day] = selectedDay.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterdayDate);

      const isToday = selectedDay === todayStr;
      const isYesterday = selectedDay === yesterdayStr;
      const label = isToday
        ? 'Hoy'
        : isYesterday
        ? 'Ayer'
        : start.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
      return { start, end, label, code: 'dia' };
    }

    if (granularity === 'semana') {
      // Current week: Monday 00:00 to Sunday 23:59
      const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - currentDayOfWeek - selectedWeekOffset * 7);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const label =
        selectedWeekOffset === 0
          ? `Esta Semana (${monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})`
          : selectedWeekOffset === 1
          ? `Semana Pasada (${monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})`
          : `Semana del ${monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} al ${sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;

      return { start: monday, end: sunday, label, code: 'semana' };
    }

    if (granularity === 'mes') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1), code: 'mes' };
    }

    if (granularity === 'ano') {
      const year = parseInt(selectedYear, 10);
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      return { start, end, label: `Año ${year}`, code: 'ano' };
    }

    if (granularity === 'todo') {
      const start = new Date(0);
      const end = new Date(Date.now() + 86400000);
      return { start, end, label: 'Histórico Total (Todos los pedidos)', code: 'todo' };
    }

    // custom
    const [sy, sm, sd] = customStartDate.split('-').map(Number);
    const [ey, em, ed] = customEndDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    return {
      start,
      end,
      label: `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} a ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      code: 'custom',
    };
  }, [granularity, selectedDay, selectedWeekOffset, selectedMonth, selectedYear, customStartDate, customEndDate, todayStr]);

  // Orders filtered by the selected period
  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      const dateVal = o.createdAt || (o as any).created_at || (o as any).timestamp || o.updatedAt;
      const createdAt = dateVal ? new Date(dateVal) : new Date();
      return createdAt >= dateRange.start && createdAt <= dateRange.end;
    });
  }, [orders, dateRange]);

  // Calculations for Period Metrics
  const metrics = useMemo(() => {
    const validOrders = periodOrders.filter((o) => o.status !== 'cancelled');
    const deliveredOrders = periodOrders.filter((o) => o.status === 'delivered');
    const cancelledOrders = periodOrders.filter((o) => o.status === 'cancelled');

    const totalGrossSalesCents = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalCommissionCents = validOrders.reduce((sum, o) => sum + (o.restaurant_commission || 0), 0);
    const totalNetSalesCents = Math.max(0, totalGrossSalesCents - totalCommissionCents);

    const totalOrdersCount = periodOrders.length;
    const deliveredCount = deliveredOrders.length;
    const cancelledCount = cancelledOrders.length;
    const completionRate = totalOrdersCount > 0 ? Math.round((deliveredCount / totalOrdersCount) * 100) : 0;

    const avgTicketCents = validOrders.length > 0 ? Math.round(totalGrossSalesCents / validOrders.length) : 0;

    // Delivery vs Pickup
    const deliveryOrders = validOrders.filter((o) => o.order_type === 'delivery');
    const pickupOrders = validOrders.filter((o) => o.order_type === 'pickup');

    // Payment methods breakdown
    const paymentBreakdown = {
      cash: { count: 0, cents: 0 },
      card: { count: 0, cents: 0 },
      transfer: { count: 0, cents: 0 },
      digital: { count: 0, cents: 0 },
    };

    validOrders.forEach((o) => {
      const method = (o.payment_method || 'cash') as keyof typeof paymentBreakdown;
      if (paymentBreakdown[method]) {
        paymentBreakdown[method].count++;
        paymentBreakdown[method].cents += o.total || 0;
      }
    });

    // Top selling items
    const productSalesMap: Record<string, { name: string; quantity: number; subtotalCents: number }> = {};
    validOrders.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.product_id || item.product_name;
        if (!productSalesMap[key]) {
          productSalesMap[key] = {
            name: item.product_name,
            quantity: 0,
            subtotalCents: 0,
          };
        }
        productSalesMap[key].quantity += item.quantity || 1;
        productSalesMap[key].subtotalCents += item.subtotal || 0;
      });
    });

    const topProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);

    // Unique customers in period
    const uniqueCustomerIdsInPeriod = new Set(validOrders.map((o) => o.customer_id || o.customer_phone));

    return {
      grossSalesCents: totalGrossSalesCents,
      netSalesCents: totalNetSalesCents,
      commissionCents: totalCommissionCents,
      totalOrders: totalOrdersCount,
      deliveredOrders: deliveredCount,
      cancelledOrders: cancelledCount,
      completionRate,
      avgTicketCents,
      deliveryOrdersCount: deliveryOrders.length,
      pickupOrdersCount: pickupOrders.length,
      deliverySalesCents: deliveryOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      pickupSalesCents: pickupOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      paymentBreakdown,
      topProducts,
      uniqueCustomersCount: uniqueCustomerIdsInPeriod.size,
    };
  }, [periodOrders]);

  // Timeline chart data based on granularity
  const chartData = useMemo(() => {
    if (granularity === 'dia') {
      // Hours blocks: 0-4, 4-8, 8-11, 11-14, 14-17, 17-20, 20-23
      const blocks = [
        { label: '08:00', startH: 8, endH: 10, cents: 0, count: 0 },
        { label: '11:00', startH: 11, endH: 13, cents: 0, count: 0 },
        { label: '14:00', startH: 14, endH: 16, cents: 0, count: 0 },
        { label: '17:00', startH: 17, endH: 19, cents: 0, count: 0 },
        { label: '20:00', startH: 20, endH: 22, cents: 0, count: 0 },
        { label: '23:00', startH: 23, endH: 24, cents: 0, count: 0 },
      ];
      periodOrders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const h = new Date(o.createdAt || Date.now()).getHours();
        const block = blocks.find((b) => h >= b.startH && h <= b.endH) || blocks[blocks.length - 1];
        if (block) {
          block.cents += o.total || 0;
          block.count++;
        }
      });
      return blocks;
    }

    if (granularity === 'semana') {
      // 7 days of the week: Lun, Mar, Mié, Jue, Vie, Sáb, Dom
      const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const weekBlocks = days.map((dayLabel, idx) => ({
        label: dayLabel,
        dayIndex: idx, // 0 = Mon, 6 = Sun
        cents: 0,
        count: 0,
      }));

      periodOrders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const d = new Date(o.createdAt || Date.now());
        const dayIdx = (d.getDay() + 6) % 7; // Convert Sun(0) to 6, Mon(1) to 0
        if (weekBlocks[dayIdx]) {
          weekBlocks[dayIdx].cents += o.total || 0;
          weekBlocks[dayIdx].count++;
        }
      });
      return weekBlocks;
    }

    if (granularity === 'mes') {
      // 4 weeks of the month
      const weeks = [
        { label: 'Sem 1 (1-7)', startD: 1, endD: 7, cents: 0, count: 0 },
        { label: 'Sem 2 (8-14)', startD: 8, endD: 14, cents: 0, count: 0 },
        { label: 'Sem 3 (15-21)', startD: 15, endD: 21, cents: 0, count: 0 },
        { label: 'Sem 4 (22-fin)', startD: 22, endD: 31, cents: 0, count: 0 },
      ];
      periodOrders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const d = new Date(o.createdAt || Date.now()).getDate();
        const w = weeks.find((wk) => d >= wk.startD && d <= wk.endD) || weeks[weeks.length - 1];
        if (w) {
          w.cents += o.total || 0;
          w.count++;
        }
      });
      return weeks;
    }

    if (granularity === 'ano') {
      // 12 months
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthBlocks = months.map((mLabel, idx) => ({
        label: mLabel,
        monthIndex: idx,
        cents: 0,
        count: 0,
      }));

      periodOrders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const m = new Date(o.createdAt || Date.now()).getMonth();
        if (monthBlocks[m]) {
          monthBlocks[m].cents += o.total || 0;
          monthBlocks[m].count++;
        }
      });
      return monthBlocks;
    }

    if (granularity === 'todo') {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthMap: Record<string, { label: string; cents: number; count: number }> = {};
      periodOrders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const d = new Date(o.createdAt || Date.now());
        const key = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        if (!monthMap[key]) {
          monthMap[key] = { label: key, cents: 0, count: 0 };
        }
        monthMap[key].cents += o.total || 0;
        monthMap[key].count++;
      });
      const list = Object.values(monthMap);
      return list.length > 0 ? list : [{ label: 'Histórico', cents: 0, count: 0 }];
    }

    // Default 5 buckets for custom
    const buckets = [
      { label: 'Inicio', cents: 0, count: 0 },
      { label: 'Medio', cents: 0, count: 0 },
      { label: 'Fin', cents: 0, count: 0 },
    ];
    periodOrders.forEach((o, idx) => {
      if (o.status === 'cancelled') return;
      const bIdx = idx % 3;
      buckets[bIdx].cents += o.total || 0;
      buckets[bIdx].count++;
    });
    return buckets;
  }, [periodOrders, granularity]);

  const maxChartValue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.cents), 10000); // minimum $100 MXN height
    return max;
  }, [chartData]);

  // Build Comprehensive CRM Customer Database from all Orders
  const crmCustomers = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      phone: string;
      address: string;
      firstDate: string;
      lastDate: string;
      totalOrders: number;
      totalSpentCents: number;
      delivered: number;
      cancelled: number;
      periodOrders: number;
      periodSpentCents: number;
      itemsMap: Record<string, number>;
      hasAllergies: boolean;
      allergyNotes: string;
    }>();

    // Sort orders oldest to newest to compute first & last dates correctly
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    sortedOrders.forEach((ord) => {
      const key = ord.customer_id || ord.customer_phone || ord.customer_name;
      if (!key) return;

      const ordDate = ord.createdAt || ord.updatedAt || new Date().toISOString();
      const inCurrentPeriod = new Date(ordDate) >= dateRange.start && new Date(ordDate) <= dateRange.end;
      const isValid = ord.status !== 'cancelled';
      const orderTotal = ord.total || 0;

      if (!map.has(key)) {
        map.set(key, {
          id: ord.customer_id || key,
          name: ord.customer_name || 'Cliente sin nombre',
          phone: ord.customer_phone || '',
          address: ord.delivery_address || 'Entrega en tienda',
          firstDate: ordDate,
          lastDate: ordDate,
          totalOrders: 0,
          totalSpentCents: 0,
          delivered: 0,
          cancelled: 0,
          periodOrders: 0,
          periodSpentCents: 0,
          itemsMap: {},
          hasAllergies: !!ord.has_allergies,
          allergyNotes: ord.allergies || '',
        });
      }

      const rec = map.get(key)!;
      rec.totalOrders++;
      rec.lastDate = ordDate;
      if (ord.delivery_address && ord.delivery_address !== 'Entrega en tienda') {
        rec.address = ord.delivery_address;
      }
      if (ord.has_allergies) {
        rec.hasAllergies = true;
        if (ord.allergies) rec.allergyNotes = ord.allergies;
      }

      if (ord.status === 'delivered') rec.delivered++;
      if (ord.status === 'cancelled') rec.cancelled++;

      if (isValid) {
        rec.totalSpentCents += orderTotal;
        // Count items
        ord.items.forEach((item) => {
          rec.itemsMap[item.product_name] = (rec.itemsMap[item.product_name] || 0) + (item.quantity || 1);
        });

        if (inCurrentPeriod) {
          rec.periodOrders++;
          rec.periodSpentCents += orderTotal;
        }
      }
    });

    const list: CrmCustomer[] = Array.from(map.values()).map((c) => {
      const favoriteItems = Object.entries(c.itemsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      // Customer tier logic:
      // VIP: 3+ orders or spent over $1,000 MXN (100,000 cents)
      // Recurrent: 2 orders
      // New: 1 order
      let tier: 'vip' | 'recurrent' | 'new' = 'new';
      if (c.totalOrders >= 3 || c.totalSpentCents >= 100000) {
        tier = 'vip';
      } else if (c.totalOrders >= 2) {
        tier = 'recurrent';
      }

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        firstOrderDate: c.firstDate,
        lastOrderDate: c.lastDate,
        totalOrders: c.totalOrders,
        totalSpentCents: c.totalSpentCents,
        deliveredOrders: c.delivered,
        cancelledOrders: c.cancelled,
        periodOrders: c.periodOrders,
        periodSpentCents: c.periodSpentCents,
        favoriteItems,
        tier,
        hasAllergies: c.hasAllergies,
        allergyNotes: c.allergyNotes,
        notes: crmNotesMap[c.id] || '',
      };
    });

    // Default sort: highest total spend
    return list.sort((a, b) => b.totalSpentCents - a.totalSpentCents);
  }, [orders, dateRange, crmNotesMap]);

  // Filtered CRM Customers for display
  const filteredCrmCustomers = useMemo(() => {
    return crmCustomers.filter((cust) => {
      // Search
      const searchLower = crmSearch.toLowerCase();
      const matchSearch =
        !crmSearch ||
        cust.name.toLowerCase().includes(searchLower) ||
        cust.phone.includes(searchLower) ||
        cust.address.toLowerCase().includes(searchLower);

      if (!matchSearch) return false;

      // Tier filter
      if (crmTierFilter === 'all') return true;
      if (crmTierFilter === 'vip') return cust.tier === 'vip';
      if (crmTierFilter === 'recurrent') return cust.tier === 'recurrent';
      if (crmTierFilter === 'new') return cust.tier === 'new';
      if (crmTierFilter === 'in_period') return cust.periodOrders > 0;

      return true;
    });
  }, [crmCustomers, crmSearch, crmTierFilter]);

  // Orders for the "Historial de Pedidos" tab
  const filteredPeriodOrders = useMemo(() => {
    return periodOrders.filter((ord) => {
      // Status filter
      if (orderStatusFilter === 'delivered' && ord.status !== 'delivered') return false;
      if (orderStatusFilter === 'cancelled' && ord.status !== 'cancelled') return false;
      if (
        orderStatusFilter === 'processing' &&
        !['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'delivering'].includes(ord.status)
      ) {
        return false;
      }

      // Type filter
      if (orderTypeFilter !== 'all' && ord.order_type !== orderTypeFilter) return false;

      // Search filter
      if (orderSearch) {
        const q = orderSearch.toLowerCase();
        const code = (ord.order_code || ord.id).toLowerCase();
        const customer = (ord.customer_name || '').toLowerCase();
        const phone = ord.customer_phone || '';
        return code.includes(q) || customer.includes(q) || phone.includes(q);
      }

      return true;
    });
  }, [periodOrders, orderStatusFilter, orderTypeFilter, orderSearch]);

  // Open customer dossier modal
  const handleOpenCustomerModal = (customer: CrmCustomer) => {
    setSelectedCustomer(customer);
    setCustomerNotesDraft(customer.notes || '');
  };

  // Save CRM Note
  const handleSaveCustomerNote = async () => {
    if (!selectedCustomer) return;
    setIsSavingNotes(true);
    try {
      await directApi.saveRestaurantCrmNote(selectedCustomer.id, customerNotesDraft, restaurantId);
      const updatedMap = { ...crmNotesMap, [selectedCustomer.id]: customerNotesDraft };
      setCrmNotesMap(updatedMap);
      try {
        localStorage.setItem(`crm_notes_${restaurantId}`, JSON.stringify(updatedMap));
      } catch {
        // ignore
      }
      setSelectedCustomer((prev) => (prev ? { ...prev, notes: customerNotesDraft } : null));
    } catch {
      // Local fallback
      const updatedMap = { ...crmNotesMap, [selectedCustomer.id]: customerNotesDraft };
      setCrmNotesMap(updatedMap);
      localStorage.setItem(`crm_notes_${restaurantId}`, JSON.stringify(updatedMap));
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Export orders to CSV
  const handleExportCsv = () => {
    if (periodOrders.length === 0) return;
    const headers = [
      'ID Pedido',
      'Código',
      'Fecha',
      'Cliente',
      'Teléfono',
      'Tipo Entrega',
      'Dirección',
      'Método Pago',
      'Estado',
      'Subtotal MXN',
      'Envío MXN',
      'Total MXN',
      'Comisión Restaurante MXN',
    ];

    const rows = periodOrders.map((o) => [
      o.id,
      o.order_code || o.id.slice(-6).toUpperCase(),
      new Date(o.createdAt || Date.now()).toLocaleString('es-MX'),
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      o.customer_phone || '',
      o.order_type === 'delivery' ? 'A Domicilio' : 'Para Llevar',
      `"${(o.delivery_address || '').replace(/"/g, '""')}"`,
      o.payment_method || 'Efectivo',
      o.status,
      ((o.subtotal || 0) / 100).toFixed(2),
      ((o.delivery_fee || 0) / 100).toFixed(2),
      ((o.total || 0) / 100).toFixed(2),
      (((o.restaurant_commission || 0) / 100)).toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ventas_${granularity}_${dateRange.start.toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Cashier/Sales Report
  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL: TÍTULO, SUB-PESTAÑAS Y HERRAMIENTAS */}
      <div className="bg-gradient-to-r from-[#07091a] via-[#09102c] to-[#05268F]/30 border border-[#05268F]/40 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#05268F] border border-[#FFD318]/50 flex items-center justify-center text-[#FFD318] shadow-md">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  Ventas, Historial y CRM
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFD318]/10 text-[#FFD318] border border-[#FFD318]/30">
                    Directaurante Intelligence
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    CORE EN VIVO · SSE
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Panel analítico comercial y gestión directa de clientes frecuentes de {restaurantName}
                </p>
              </div>
            </div>
          </div>

          {/* Sub-Pestañas: Analítica | CRM Clientes | Historial Pedidos */}
          <div className="flex items-center gap-1.5 bg-[#050818]/90 p-1.5 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setActiveSubTab('analitica')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'analitica'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analítica y Ventas</span>
            </button>
            <button
              onClick={() => setActiveSubTab('crm')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 relative ${
                activeSubTab === 'crm'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>CRM Clientes</span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                {crmCustomers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('pedidos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'pedidos'
                  ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Historial ({periodOrders.length})</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS TEMPORALES: DÍA | SEMANA | MES | AÑO */}
        <div className="mt-5 pt-4 border-t border-[#05268F]/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Selector de Granularidad */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-[#FFD318]" />
              Filtrar por:
            </span>

            <button
              onClick={() => setGranularity('dia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                granularity === 'dia'
                  ? 'bg-[#FFD318] text-[#05268F] shadow-md font-black'
                  : 'bg-[#101828] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              Día
            </button>

            <button
              onClick={() => setGranularity('semana')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                granularity === 'semana'
                  ? 'bg-[#FFD318] text-[#05268F] shadow-md font-black'
                  : 'bg-[#101828] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              Semana
            </button>

            <button
              onClick={() => setGranularity('mes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                granularity === 'mes'
                  ? 'bg-[#FFD318] text-[#05268F] shadow-md font-black'
                  : 'bg-[#101828] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              Mes
            </button>

            <button
              onClick={() => setGranularity('ano')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                granularity === 'ano'
                  ? 'bg-[#FFD318] text-[#05268F] shadow-md font-black'
                  : 'bg-[#101828] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              Año
            </button>

            <button
              onClick={() => setGranularity('todo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                granularity === 'todo'
                  ? 'bg-[#FFD318] text-[#05268F] shadow-md font-black'
                  : 'bg-[#101828] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              Histórico Total
            </button>
          </div>

          {/* Selector dinámico dependiente de la granularidad */}
          <div className="flex items-center gap-2 flex-wrap">
            {granularity === 'dia' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDay(todayStr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    selectedDay === todayStr
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setSelectedDay(yesterdayStr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    selectedDay === yesterdayStr
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Ayer
                </button>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="bg-[#0a0f30] border border-[#05268F]/40 text-xs text-white rounded-xl px-2.5 py-1 focus:outline-none focus:border-[#FFD318]"
                />
              </div>
            )}

            {granularity === 'todo' && (
              <span className="text-xs text-[#FFD318] font-bold bg-[#05268F]/40 border border-[#FFD318]/30 px-3 py-1 rounded-xl">
                Mostrando todos los pedidos ({orders.length} pedidos registrados)
              </span>
            )}

            {granularity === 'semana' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedWeekOffset(0)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    selectedWeekOffset === 0
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setSelectedWeekOffset(1)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    selectedWeekOffset === 1
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Semana Pasada
                </button>
                <button
                  onClick={() => setSelectedWeekOffset(2)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    selectedWeekOffset === 2
                      ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Hace 2 semanas
                </button>
              </div>
            )}

            {granularity === 'mes' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-[#0a0f30] border border-[#05268F]/40 text-xs text-[#FFD318] font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#FFD318]"
                />
              </div>
            )}

            {granularity === 'ano' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-[#0a0f30] border border-[#05268F]/40 text-xs text-[#FFD318] font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#FFD318]"
                >
                  <option value="2026">Año 2026</option>
                  <option value="2025">Año 2025</option>
                  <option value="2024">Año 2024</option>
                </select>
              </div>
            )}

            {/* Acciones de exportación / imprimir */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={handleExportCsv}
                title="Exportar a CSV"
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:text-white transition text-xs flex items-center gap-1 px-2.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={handlePrintSummary}
                title="Imprimir Corte de Caja"
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:text-white transition text-xs flex items-center gap-1 px-2.5"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Corte</span>
              </button>
              {onRefreshData && (
                <button
                  onClick={onRefreshData}
                  title="Recargar datos"
                  className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:text-white transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Banner de Contexto del Período Seleccionado */}
        <div className="mt-3 py-1.5 px-3 rounded-xl bg-[#050818]/80 border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              Período activo: <strong className="text-white">{dateRange.label}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>
              <strong className="text-white">{metrics.totalOrders}</strong> pedidos registrados
            </span>
            <span>
              Ventas: <strong className="text-[#FFD318]">${(metrics.grossSalesCents / 100).toFixed(2)} MXN</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 1: ANALÍTICA Y RESUMEN DE VENTAS                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'analitica' && (
        <div className="space-y-6">
          {/* Aviso contextual si no hay pedidos en la fecha seleccionada pero sí en el histórico */}
          {periodOrders.length === 0 && orders.length > 0 && (
            <div className="bg-gradient-to-r from-blue-950/70 via-[#0a1240] to-indigo-950/70 border border-[#05268F] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center shrink-0 border border-[#FFD318]/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">
                    No se registran pedidos para: <span className="text-[#FFD318]">{dateRange.label}</span>
                  </p>
                  <p className="text-zinc-300 text-[11px] mt-0.5">
                    Tu restaurante cuenta con <strong>{orders.length} pedidos registrados</strong> en la plataforma. Puedes explorar días anteriores o el acumulado total.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setSelectedDay(yesterdayStr);
                    setGranularity('dia');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition border border-zinc-700"
                >
                  Ver Ayer
                </button>
                <button
                  onClick={() => setGranularity('todo')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FFD318] hover:bg-[#ffe054] text-[#05268F] font-black text-xs transition shadow-md"
                >
                  Ver Histórico Total ({orders.length})
                </button>
              </div>
            </div>
          )}

          {/* Tarjetas KPI Principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Ventas Brutas */}
            <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Ventas Totales</span>
                  <div className="w-7 h-7 rounded-xl bg-[#FFD318]/10 text-[#FFD318] flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#FFD318] tracking-tight">
                  ${(metrics.grossSalesCents / 100).toFixed(2)}
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">En el período ({dateRange.label})</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 space-y-1 text-[11px] text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Comisión Directaurante:</span>
                  <span className="font-bold text-amber-400">
                    -${(metrics.commissionCents / 100).toFixed(2)} MXN
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>Ingreso Neto Restaurante:</span>
                  <span>${(metrics.netSalesCents / 100).toFixed(2)} MXN</span>
                </div>
                <p className="text-[9px] text-zinc-500 pt-0.5">
                  * La comisión de venta la paga el restaurante (no el cliente). Tarifa regulada exclusivamente por Master.
                </p>
              </div>
            </div>

            {/* KPI 2: Pedidos Totales y Efectividad */}
            <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Pedidos</span>
                  <div className="w-7 h-7 rounded-xl bg-[#05268F]/40 text-blue-400 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {metrics.totalOrders}
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {metrics.deliveredOrders} entregados • {metrics.cancelledOrders} cancelados
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Tasa de entrega:</span>
                <span className="font-bold text-white">{metrics.completionRate}%</span>
              </div>
            </div>

            {/* KPI 3: Ticket Promedio */}
            <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Ticket Promedio</span>
                  <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  ${(metrics.avgTicketCents / 100).toFixed(2)}
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Promedio por orden</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Por comanda:</span>
                <span className="font-bold text-zinc-300">MXN</span>
              </div>
            </div>

            {/* KPI 4: Clientes Atendidos en el período */}
            <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Clientes Atendidos</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {metrics.uniqueCustomersCount}
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Compradores únicos</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                <span>En cartera CRM:</span>
                <button
                  onClick={() => setActiveSubTab('crm')}
                  className="font-bold text-[#FFD318] hover:underline"
                >
                  Ver {crmCustomers.length} clientes &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Gráfico Interactivo de Barras y Canales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Barras Temporal */}
            <div className="lg:col-span-2 bg-[#0a0f30] border border-[#05268F]/30 rounded-3xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#FFD318]" />
                    Distribución de Ventas ({dateRange.label})
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Ingresos generados según el desglose temporal seleccionado
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#FFD318]">
                  ${(metrics.grossSalesCents / 100).toFixed(2)} MXN
                </span>
              </div>

              {/* Render de barras SVG/CSS */}
              <div className="h-48 sm:h-56 flex items-end gap-2 sm:gap-3 pt-8 pb-4 px-2 border-b border-zinc-800/80">
                {chartData.map((bar, i) => {
                  const heightPercent = maxChartValue > 0 ? Math.max(8, Math.round((bar.cents / maxChartValue) * 100)) : 8;
                  const isPositive = bar.cents > 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-zinc-900 border border-zinc-700 text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-xl z-20">
                        <span className="font-bold text-[#FFD318]">${(bar.cents / 100).toFixed(2)}</span> ({bar.count} ped.)
                      </div>

                      {/* Bar Fill */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-xl transition-all duration-500 relative ${
                          isPositive
                            ? 'bg-gradient-to-t from-[#05268F] to-[#FFD318] group-hover:brightness-125'
                            : 'bg-zinc-800/40'
                        }`}
                      >
                        {isPositive && bar.cents > 2000 && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-zinc-300 hidden sm:block">
                            ${Math.round(bar.cents / 100)}
                          </span>
                        )}
                      </div>

                      {/* Bar Label */}
                      <span className="text-[10px] font-bold text-zinc-400 mt-2 truncate max-w-full">
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                <span>* Las ventas se actualizan automáticamente con cada nueva orden concluida.</span>
                <span className="text-zinc-400">Total en vista: {metrics.deliveredOrders} pedidos</span>
              </div>
            </div>

            {/* Canales y Métodos de Pago */}
            <div className="space-y-4">
              {/* Desglose por Canal: Delivery vs Pickup */}
              <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-3xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Bike className="w-4 h-4 text-emerald-400" />
                  Ventas por Canal
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300 flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-blue-400" /> A Domicilio ({metrics.deliveryOrdersCount})
                      </span>
                      <span className="font-bold text-white font-mono">
                        ${(metrics.deliverySalesCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${metrics.grossSalesCents > 0 ? (metrics.deliverySalesCents / metrics.grossSalesCents) * 100 : 0}%`,
                        }}
                        className="h-full bg-blue-500 rounded-full"
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#FFD318]" /> Para Llevar ({metrics.pickupOrdersCount})
                      </span>
                      <span className="font-bold text-white font-mono">
                        ${(metrics.pickupSalesCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${metrics.grossSalesCents > 0 ? (metrics.pickupSalesCents / metrics.grossSalesCents) * 100 : 0}%`,
                        }}
                        className="h-full bg-[#FFD318] rounded-full"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desglose por Método de Pago */}
              <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-3xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#FFD318]" />
                  Métodos de Pago
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Efectivo contra entrega
                    </span>
                    <span className="font-bold text-white font-mono">
                      ${(metrics.paymentBreakdown.cash.cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Tarjeta Crédito / Débito
                    </span>
                    <span className="font-bold text-white font-mono">
                      ${(metrics.paymentBreakdown.card.cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" /> Transferencia SPEI
                    </span>
                    <span className="font-bold text-white font-mono">
                      ${(metrics.paymentBreakdown.transfer.cents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ranking de Productos Más Vendidos */}
          <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FFD318]" />
                  Top Productos Más Vendidos en este Período
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Platos con mayor preferencia y volumen de compra durante {dateRange.label}
                </p>
              </div>
              <span className="text-xs text-zinc-400">{metrics.topProducts.length} productos diferentes</span>
            </div>

            {metrics.topProducts.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No hay ventas registradas en el período seleccionado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {metrics.topProducts.slice(0, 6).map((item, idx) => {
                  const percentOfTotal =
                    metrics.grossSalesCents > 0
                      ? Math.round((item.subtotalCents / metrics.grossSalesCents) * 100)
                      : 0;
                  return (
                    <div
                      key={idx}
                      className="bg-[#07091a] border border-[#05268F]/20 rounded-2xl p-3.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                            idx === 0
                              ? 'bg-[#FFD318] text-[#05268F]'
                              : idx === 1
                              ? 'bg-zinc-300 text-zinc-900'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-white line-clamp-1">{item.name}</h4>
                          <span className="text-[10px] text-zinc-400">
                            {item.quantity} unidades vendidas
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#FFD318]">
                          ${(item.subtotalCents / 100).toFixed(2)}
                        </span>
                        <span className="text-[9px] text-zinc-500 block">{percentOfTotal}% de ventas</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 2: CRM BÁSICO DE CLIENTES Y FIDELIZACIÓN                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'crm' && (
        <div className="space-y-6">
          {/* Métricas Rápidas del CRM */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Clientes Registrados
              </span>
              <div className="mt-1 text-2xl font-black text-white">{crmCustomers.length}</div>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">Cartera del restaurante</span>
            </div>

            <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-[#FFD318] uppercase tracking-wider block flex items-center gap-1">
                <Award className="w-3 h-3 text-[#FFD318]" /> Clientes VIP
              </span>
              <div className="mt-1 text-2xl font-black text-[#FFD318]">
                {crmCustomers.filter((c) => c.tier === 'vip').length}
              </div>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">3+ pedidos o &gt;$1,000 MXN</span>
            </div>

            <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block flex items-center gap-1">
                <Star className="w-3 h-3 text-blue-400" /> Recurrentes
              </span>
              <div className="mt-1 text-2xl font-black text-blue-400">
                {crmCustomers.filter((c) => c.tier === 'recurrent').length}
              </div>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">2 pedidos completados</span>
            </div>

            <div className="bg-[#0a0f30] border border-[#05268F]/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                <UserPlus className="w-3 h-3 text-emerald-400" /> Clientes Nuevos
              </span>
              <div className="mt-1 text-2xl font-black text-emerald-400">
                {crmCustomers.filter((c) => c.tier === 'new').length}
              </div>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">Primer pedido reciente</span>
            </div>
          </div>

          {/* Barra de Búsqueda y Filtros de Clientes */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0f30] border border-[#05268F]/30 p-3 rounded-2xl">
            {/* Buscador de clientes */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o dirección..."
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                className="w-full bg-[#07091a] border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD318]"
              />
            </div>

            {/* Filtros de Categoría */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                onClick={() => setCrmTierFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  crmTierFilter === 'all'
                    ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40'
                    : 'bg-[#07091a] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Todos ({crmCustomers.length})
              </button>
              <button
                onClick={() => setCrmTierFilter('vip')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                  crmTierFilter === 'vip'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-[#07091a] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <Award className="w-3 h-3" /> VIP
              </button>
              <button
                onClick={() => setCrmTierFilter('recurrent')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                  crmTierFilter === 'recurrent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#07091a] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <Star className="w-3 h-3" /> Recurrentes
              </button>
              <button
                onClick={() => setCrmTierFilter('new')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  crmTierFilter === 'new'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#07091a] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Nuevos
              </button>
              <button
                onClick={() => setCrmTierFilter('in_period')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                  crmTierFilter === 'in_period'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#07091a] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <Calendar className="w-3 h-3" /> En este período ({metrics.uniqueCustomersCount})
              </button>
            </div>
          </div>

          {/* Grid de Clientes CRM */}
          {filteredCrmCustomers.length === 0 ? (
            <div className="bg-[#101828] border border-zinc-800 rounded-3xl p-10 text-center text-zinc-400">
              <Users className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
              <p className="text-xs font-bold text-white mb-1">No se encontraron clientes con este filtro</p>
              <p className="text-[11px] text-zinc-500">Prueba cambiando la búsqueda o seleccionando "Todos".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCrmCustomers.map((cust) => {
                const initials = cust.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const avgTicket = cust.totalOrders > 0 ? Math.round(cust.totalSpentCents / cust.totalOrders) : 0;
                const cleanPhone = cust.phone.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/52${cleanPhone}?text=${encodeURIComponent(
                  `¡Hola ${cust.name}! Te saludamos de ${restaurantName}. Muchas gracias por tu preferencia. ¿Te gustaría ordenar algo delicioso hoy?`
                )}`;

                return (
                  <div
                    key={cust.id}
                    className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 hover:border-[#FFD318]/50 rounded-2xl p-4 shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Cabecera Tarjeta: Avatar, Nombre y Badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner shrink-0 ${
                              cust.tier === 'vip'
                                ? 'bg-[#FFD318] text-[#05268F]'
                                : cust.tier === 'recurrent'
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <h3 className="text-xs font-black text-white line-clamp-1">{cust.name}</h3>
                            <p className="text-[11px] text-zinc-400 font-mono">{cust.phone || 'Sin teléfono'}</p>
                          </div>
                        </div>

                        {/* Badge de Tier */}
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                            cust.tier === 'vip'
                              ? 'bg-[#FFD318]/20 text-[#FFD318] border border-[#FFD318]/40'
                              : cust.tier === 'recurrent'
                              ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
                              : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                          }`}
                        >
                          {cust.tier === 'vip' && <Award className="w-2.5 h-2.5" />}
                          {cust.tier === 'recurrent' && <Star className="w-2.5 h-2.5" />}
                          {cust.tier.toUpperCase()}
                        </span>
                      </div>

                      {/* Dirección habitual */}
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mb-3">
                        📍 {cust.address}
                      </p>

                      {/* Alerta de Alergia si tiene */}
                      {cust.hasAllergies && (
                        <div className="mb-3 px-2 py-1 rounded-lg bg-rose-950/60 border border-rose-800/40 text-[10px] text-rose-300 flex items-center gap-1.5">
                          <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                          <span className="line-clamp-1">Alergias: {cust.allergyNotes || 'Declaradas'}</span>
                        </div>
                      )}

                      {/* Métricas clave del cliente */}
                      <div className="grid grid-cols-3 gap-2 bg-[#050818] p-2.5 rounded-xl border border-zinc-800/80 mb-3 text-center">
                        <div>
                          <span className="text-[9px] text-zinc-500 uppercase block">Total Ped.</span>
                          <span className="text-xs font-bold text-white">{cust.totalOrders}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 uppercase block">LTV Gasto</span>
                          <span className="text-xs font-bold text-[#FFD318] font-mono">
                            ${(cust.totalSpentCents / 100).toFixed(0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 uppercase block">Ticket Prom.</span>
                          <span className="text-xs font-bold text-zinc-300 font-mono">
                            ${(avgTicket / 100).toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Platos favoritos */}
                      {cust.favoriteItems.length > 0 && (
                        <div className="mb-3 text-[11px]">
                          <span className="text-[10px] text-zinc-500 block mb-1">Favorito:</span>
                          <div className="flex flex-wrap gap-1">
                            {cust.favoriteItems.slice(0, 2).map((fav, fIdx) => (
                              <span
                                key={fIdx}
                                className="px-1.5 py-0.5 rounded-md bg-[#05268F]/20 text-zinc-300 text-[10px] border border-[#05268F]/30 truncate max-w-full"
                              >
                                {fav.count}x {fav.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nota interna breve si existe */}
                      {cust.notes && (
                        <div className="mb-3 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 italic line-clamp-2">
                          "{cust.notes}"
                        </div>
                      )}
                    </div>

                    {/* Acciones del Cliente: WhatsApp | Llamar | Ficha */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center gap-1.5">
                      {cust.phone && (
                        <>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                            title="Llamar por teléfono"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => handleOpenCustomerModal(cust)}
                        className="flex-1 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ficha CRM</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 3: HISTORIAL DE PEDIDOS CON FILTROS AVANZADOS                */}
      {/* ========================================================================= */}
      {activeSubTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Barra de Filtros del Historial */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0a0f30] border border-[#05268F]/30 p-3.5 rounded-2xl">
            {/* Buscador de pedidos */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por # comanda, cliente o teléfono..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full bg-[#07091a] border border-zinc-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD318]"
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={orderStatusFilter}
                onChange={(e: any) => setOrderStatusFilter(e.target.value)}
                className="bg-[#07091a] border border-zinc-800 text-xs text-zinc-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#FFD318]"
              >
                <option value="all">Todos los estados</option>
                <option value="delivered">Solo Entregados</option>
                <option value="processing">En Proceso / Cocina</option>
                <option value="cancelled">Cancelados</option>
              </select>

              <select
                value={orderTypeFilter}
                onChange={(e: any) => setOrderTypeFilter(e.target.value)}
                className="bg-[#07091a] border border-zinc-800 text-xs text-zinc-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#FFD318]"
              >
                <option value="all">Todos los canales</option>
                <option value="delivery">A Domicilio</option>
                <option value="pickup">Para Llevar (Pickup)</option>
              </select>

              <span className="text-xs text-zinc-400 font-mono">
                {filteredPeriodOrders.length} orden{filteredPeriodOrders.length === 1 ? '' : 'es'}
              </span>
            </div>
          </div>

          {/* Tabla / Lista de Pedidos */}
          {filteredPeriodOrders.length === 0 ? (
            <div className="bg-[#101828] border border-zinc-800 rounded-3xl p-10 text-center text-zinc-400">
              <ShoppingBag className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
              <p className="text-xs font-bold text-white">No hay pedidos con estos filtros en {dateRange.label}</p>
              <p className="text-[11px] text-zinc-500 mt-1">Prueba cambiando el período o el estado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeriodOrders.map((order) => {
                const dateFormatted = new Date(order.createdAt || Date.now()).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <div
                    key={order.id}
                    className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-2xl p-4 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      {/* Cabecera del pedido */}
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="font-mono text-xs font-black text-zinc-200">
                          {order.folio || order.order_code || `#${order.id.replace(/^ord_/, '').slice(0, 5).toUpperCase()}`}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'delivered'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : order.status === 'cancelled'
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {order.status === 'delivered'
                            ? 'ENTREGADO'
                            : order.status === 'cancelled'
                            ? 'CANCELADO'
                            : 'EN PROCESO'}
                        </span>
                      </div>

                      {/* Datos del Cliente y Canal */}
                      <div className="space-y-1 mb-3 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="text-white font-bold">{order.customer_name}</p>
                          <span className="text-[10px] text-zinc-500">{dateFormatted}</span>
                        </div>
                        <p className="text-zinc-400 text-[11px] flex items-center gap-1">
                          {order.order_type === 'delivery' ? (
                            <Bike className="w-3 h-3 text-blue-400 inline" />
                          ) : (
                            <Store className="w-3 h-3 text-[#FFD318] inline" />
                          )}
                          <span className="truncate">{order.delivery_address || 'Entrega en mostrador'}</span>
                        </p>
                      </div>

                      {/* Desglose de ítems */}
                      <div className="border-t border-zinc-800/80 pt-2.5 space-y-1 mb-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                            <span className="text-zinc-300 truncate pr-2">
                              <strong className="text-white">{item.quantity}x</strong> {item.product_name}
                            </span>
                            <span className="text-zinc-400 font-mono shrink-0">
                              ${((item.subtotal || 0) / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total y Botón de Detalle */}
                    <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase block">Total</span>
                        <span className="text-xs font-black text-[#FFD318] font-mono">
                          ${((order.total || 0) / 100).toFixed(2)} MXN
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {onOpenChat && (
                          <button
                            onClick={() => onOpenChat(order.id)}
                            className="bg-[#05268F]/30 hover:bg-[#05268F]/60 text-[#FFD318] border border-[#FFD318]/30 font-bold py-1 px-2.5 rounded-xl text-[11px] transition flex items-center gap-1 shadow-sm"
                            title="Chat del pedido"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Chat</span>
                          </button>
                        )}
                        <button
                          onClick={() => onSelectOrderDetail(order)}
                          className="bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold py-1 px-3 rounded-xl text-[11px] transition"
                        >
                          Ver Comanda
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / FICHA COMPLETA DEL CLIENTE CRM                                   */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#07091a] border border-[#05268F]/50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Header Modal */}
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-gradient-to-r from-[#07091a] to-[#0a0f30]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shadow-md ${
                    selectedCustomer.tier === 'vip'
                      ? 'bg-[#FFD318] text-[#05268F]'
                      : selectedCustomer.tier === 'recurrent'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {selectedCustomer.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">{selectedCustomer.name}</h3>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        selectedCustomer.tier === 'vip'
                          ? 'bg-[#FFD318]/20 text-[#FFD318] border border-[#FFD318]/40'
                          : selectedCustomer.tier === 'recurrent'
                          ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      }`}
                    >
                      {selectedCustomer.tier === 'vip' && <Award className="w-2.5 h-2.5" />}
                      CLIENTE {selectedCustomer.tier.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    {selectedCustomer.phone} • {selectedCustomer.address}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-5 space-y-5 flex-1">
              {/* KPIs del Cliente */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0a0f30] border border-[#05268F]/30 p-3 rounded-2xl text-center">
                  <span className="text-[10px] text-zinc-400 uppercase block">Gasto Histórico</span>
                  <span className="text-base font-black text-[#FFD318] font-mono">
                    ${(selectedCustomer.totalSpentCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#0a0f30] border border-[#05268F]/30 p-3 rounded-2xl text-center">
                  <span className="text-[10px] text-zinc-400 uppercase block">Pedidos Totales</span>
                  <span className="text-base font-black text-white">
                    {selectedCustomer.totalOrders}
                  </span>
                </div>
                <div className="bg-[#0a0f30] border border-[#05268F]/30 p-3 rounded-2xl text-center">
                  <span className="text-[10px] text-zinc-400 uppercase block">Ticket Promedio</span>
                  <span className="text-base font-black text-zinc-300 font-mono">
                    $
                    {(
                      selectedCustomer.totalOrders > 0
                        ? selectedCustomer.totalSpentCents / selectedCustomer.totalOrders / 100
                        : 0
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Bloc de Notas Internas del Restaurante (CRM) */}
              <div className="bg-[#0a0f30] border border-[#05268F]/30 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-[#FFD318]" />
                    Notas Internas del Restaurante sobre el Cliente
                  </h4>
                  <span className="text-[10px] text-zinc-400">Privado para tu personal</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Ej: Prefiere salsa verde bien picante, tocar timbre dos veces, cliente fiel de los domingos..."
                  value={customerNotesDraft}
                  onChange={(e) => setCustomerNotesDraft(e.target.value)}
                  className="w-full bg-[#07091a] border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD318]"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveCustomerNote}
                    disabled={isSavingNotes}
                    className="px-3.5 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingNotes ? 'Guardando...' : 'Guardar Nota'}</span>
                  </button>
                </div>
              </div>

              {/* Platos Favoritos */}
              <div>
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FFD318]" />
                  Platos Más Ordenados por {selectedCustomer.name.split(' ')[0]}
                </h4>
                {selectedCustomer.favoriteItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">Sin historial suficiente.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedCustomer.favoriteItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0a0f30] border border-[#05268F]/20 p-2.5 rounded-xl flex items-center justify-between text-xs"
                      >
                        <span className="text-zinc-200 truncate pr-2">{item.name}</span>
                        <span className="font-bold text-[#FFD318] shrink-0">{item.count} veces</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de Compras de este Cliente */}
              <div>
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Historial de Compras ({selectedCustomer.name})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orders
                    .filter(
                      (o) =>
                        o.customer_id === selectedCustomer.id ||
                        o.customer_phone === selectedCustomer.phone
                    )
                    .map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-[#050818] border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-300">
                              #{ord.order_code || ord.id.slice(-5).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(ord.createdAt || Date.now()).toLocaleDateString('es-MX')}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                                ord.status === 'delivered'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                            {ord.items.map((it) => `${it.quantity}x ${it.product_name}`).join(', ')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-[#FFD318]">
                            ${((ord.total || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-zinc-800 bg-[#07091a] flex items-center justify-between">
              {selectedCustomer.phone && (
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/52${selectedCustomer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `¡Hola ${selectedCustomer.name}! Te saludamos de ${restaurantName}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/40 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={`tel:${selectedCustomer.phone.replace(/\D/g, '')}`}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamar</span>
                  </a>
                </div>
              )}
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold ml-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
