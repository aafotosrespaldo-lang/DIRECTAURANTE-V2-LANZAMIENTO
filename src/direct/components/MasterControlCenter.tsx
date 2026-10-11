import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { directApi } from '../api/client.ts';
import { realtimeClient } from '../services/realtimeClient.ts';
import {
  Order,
  OrderStatus,
  User,
  Restaurant,
  OrderEvidence,
  Conversation,
  ChatMessage,
  Incident,
  CommercialSolution,
  CommercialPlan,
  RestaurantEntitlement,
  ConversationPriority,
  SystemFinancialConfig,
} from '../types.ts';
import {
  ShieldAlert,
  Activity,
  Server,
  Database,
  Radio,
  RefreshCw,
  Search,
  Filter,
  Bike,
  Store,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Camera,
  Send,
  Users,
  DollarSign,
  ChevronRight,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Phone,
  MapPin,
  Eye,
  LogOut,
  Bell,
  Sliders,
  MessageSquare,
  MessageCircle,
  LifeBuoy,
  Briefcase,
  Layers,
  Sparkles,
  Award,
  Check,
  Plus,
  ArrowRight,
  PhoneCall,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Tag,
  CheckCheck,
  ShoppingBag,
  Receipt,
  Percent,
  Edit,
  Trash2,
  Ban,
  PlayCircle,
  PauseCircle,
  Copy,
  Calendar,
  CreditCard,
  Infinity as InfinityIcon,
  CheckSquare,
  Square,
  Building2,
} from 'lucide-react';

type MasterTab =
  | 'dashboard'
  | 'orders'
  | 'alerts'
  | 'communication'
  | 'incidents'
  | 'fleet'
  | 'restaurants'
  | 'users'
  | 'solutions'
  | 'plans'
  | 'entitlements'
  | 'finances'
  | 'commissions'
  | 'evidence'
  | 'audit';

export const MasterControlCenter: React.FC = () => {
  const { user, isLoadingUser, setIsAuthOpen, addToast, setActiveView, logout } = useApp();

  // Authorization check (Master or Admin)
  const isMasterAuthorized = Boolean(user && (user.role === 'master' || (user.role as any) === 'admin'));

  // Active Tab
  const [activeTab, setActiveTab] = useState<MasterTab>('dashboard');

  // Overview Data
  const [overview, setOverview] = useState<any | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string>(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');

  // Fleet State
  const [fleet, setFleet] = useState<User[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState<boolean>(false);

  // Restaurants State
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState<boolean>(false);
  const [selectedRestaurantForCommercial, setSelectedRestaurantForCommercial] = useState<any | null>(null);
  const [restaurantEntitlements, setRestaurantEntitlements] = useState<any[]>([]);
  const [isLoadingEntitlements, setIsLoadingEntitlements] = useState<boolean>(false);

  // Users State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  // Evidence & Audit
  const [evidenceList, setEvidenceList] = useState<OrderEvidence[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState<boolean>(false);
  const [selectedEvidencePreview, setSelectedEvidencePreview] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Modals for Order Action
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);
  const [overrideStatus, setOverrideStatus] = useState<OrderStatus>('delivered');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);

  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState<boolean>(false);

  // Broadcast Modal
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all');
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState<boolean>(false);

  // --- COMMUNICATION CENTER STATE ---
  const [conversations, setConversations] = useState<(Conversation & { presence: Record<string, boolean> })[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [messageInput, setMessageInput] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [convStatusFilter, setConvStatusFilter] = useState<string>('all');
  const [convPriorityFilter, setConvPriorityFilter] = useState<string>('all');
  const [convSearchQuery, setConvSearchQuery] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Order Communication Room State (Contextual Order Chat)
  const [orderCommunicationContext, setOrderCommunicationContext] = useState<any | null>(null);
  const [isLoadingOrderComm, setIsLoadingOrderComm] = useState<boolean>(false);

  // Start Direct Chat Modal
  const [isDirectChatModalOpen, setIsDirectChatModalOpen] = useState<boolean>(false);
  const [directTargetUserId, setDirectTargetUserId] = useState<string>('');
  const [directInitialMessage, setDirectInitialMessage] = useState<string>('');
  const [directPriority, setDirectPriority] = useState<ConversationPriority>('normal');
  const [isSubmittingDirectChat, setIsSubmittingDirectChat] = useState<boolean>(false);

  // --- INCIDENTS STATE ---
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState<boolean>(false);
  const [supportOverview, setSupportOverview] = useState<any | null>(null);
  const [isCreateIncidentModalOpen, setIsCreateIncidentModalOpen] = useState<boolean>(false);
  const [incidentTitle, setIncidentTitle] = useState<string>('');
  const [incidentDescription, setIncidentDescription] = useState<string>('');
  const [incidentSeverity, setIncidentSeverity] = useState<'normal' | 'importante' | 'urgente' | 'critica'>('urgente');
  const [incidentEntityType, setIncidentEntityType] = useState<'order' | 'restaurant' | 'driver' | 'customer'>('order');
  const [incidentEntityId, setIncidentEntityId] = useState<string>('');
  const [isSubmittingIncident, setIsSubmittingIncident] = useState<boolean>(false);

  // --- COMMERCIAL STATE ---
  const [commercialProductTab, setCommercialProductTab] = useState<'directaurante' | 'directpost'>('directaurante');
  const [solutions, setSolutions] = useState<CommercialSolution[]>([]);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [commercialOverview, setCommercialOverview] = useState<any | null>(null);
  const [isLoadingCommercial, setIsLoadingCommercial] = useState<boolean>(false);
  const [isAssignPlanModalOpen, setIsAssignPlanModalOpen] = useState<boolean>(false);
  const [selectedPlanToAssign, setSelectedPlanToAssign] = useState<string>('');
  const [isGrantTrialModalOpen, setIsGrantTrialModalOpen] = useState<boolean>(false);
  const [selectedSolutionForTrial, setSelectedSolutionForTrial] = useState<string>('sol_post_pos');
  const [isSubmittingCommercialAction, setIsSubmittingCommercialAction] = useState<boolean>(false);

  // --- SUB-VIEW FOR PLANS & RESTAURANT SUBSCRIPTIONS ---
  const [plansViewTab, setPlansViewTab] = useState<'catalog' | 'restaurants'>('catalog');
  const [restaurantSubSearch, setRestaurantSubSearch] = useState<string>('');
  const [restaurantSubFilterStatus, setRestaurantSubFilterStatus] = useState<string>('all');

  // --- COMMERCIAL PLANS EDITING STATE (MODAL 10) ---
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<CommercialPlan | null>(null);
  const [planFormPlanId, setPlanFormPlanId] = useState<string>('');
  const [planFormName, setPlanFormName] = useState<string>('');
  const [planFormProduct, setPlanFormProduct] = useState<'directaurante' | 'directpost'>('directaurante');
  const [planFormPricePesos, setPlanFormPricePesos] = useState<string>('499.00');
  const [planFormBillingPeriod, setPlanFormBillingPeriod] = useState<string>('monthly');
  const [planFormDescription, setPlanFormDescription] = useState<string>('');
  const [planFormStatus, setPlanFormStatus] = useState<'active' | 'inactive'>('active');
  const [planFormMaxOrders, setPlanFormMaxOrders] = useState<string>('');
  const [planFormMaxProducts, setPlanFormMaxProducts] = useState<string>('');
  const [planFormMaxStaff, setPlanFormMaxStaff] = useState<string>('');
  const [planFormMaxTables, setPlanFormMaxTables] = useState<string>('');
  const [planFormSolutions, setPlanFormSolutions] = useState<string[]>([]);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState<boolean>(false);

  // --- GLOBAL TRIAL DAYS & SUBSCRIPTION REQUIREMENT CONFIG ---
  const [editDefaultTrialDays, setEditDefaultTrialDays] = useState<number>(15);
  const [editEnforceSubscription, setEditEnforceSubscription] = useState<boolean>(true);
  const [isSavingTrialConfig, setIsSavingTrialConfig] = useState<boolean>(false);

  // --- RESTAURANT LICENSE & TRIAL MANAGEMENT MODAL (MODAL 11) ---
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [selectedRestaurantForLicense, setSelectedRestaurantForLicense] = useState<Restaurant | null>(null);
  const [licenseTargetStatus, setLicenseTargetStatus] = useState<'active' | 'trial' | 'lifetime' | 'expired' | 'paused' | 'none'>('trial');
  const [licenseTrialDays, setLicenseTrialDays] = useState<number>(15);
  const [licenseTrialEndsAt, setLicenseTrialEndsAt] = useState<string>('');
  const [licenseSelectedPlanId, setLicenseSelectedPlanId] = useState<string>('');
  const [licensePlanName, setLicensePlanName] = useState<string>('');
  const [licensePricePesos, setLicensePricePesos] = useState<string>('');
  const [licenseBillingPeriod, setLicenseBillingPeriod] = useState<string>('monthly');
  const [licenseStartsAt, setLicenseStartsAt] = useState<string>('');
  const [licenseEndsAt, setLicenseEndsAt] = useState<string>('');
  const [licenseNotes, setLicenseNotes] = useState<string>('');
  const [licenseMaxOrders, setLicenseMaxOrders] = useState<string>('');
  const [licenseMaxProducts, setLicenseMaxProducts] = useState<string>('');
  const [licenseMaxStaff, setLicenseMaxStaff] = useState<string>('');
  const [licenseSolutions, setLicenseSolutions] = useState<string[]>([]);
  const [isLoadingLicenseSolutions, setIsLoadingLicenseSolutions] = useState<boolean>(false);
  const [isSubmittingLicense, setIsSubmittingLicense] = useState<boolean>(false);

  // --- SETTLEMENTS & DEPOSITS STATE (DRIVER FINANCIAL RECONCILIATION) ---
  const [masterSettlements, setMasterSettlements] = useState<any[]>([]);
  const [isLoadingSettlements, setIsLoadingSettlements] = useState<boolean>(false);
  const [settlementDepositFilter, setSettlementDepositFilter] = useState<string>('all');
  const [isReviewingDepositId, setIsReviewingDepositId] = useState<string | null>(null);

  // --- FINANCIAL & COMMISSION RATES CONFIGURATION ---
  const [financialConfig, setFinancialConfig] = useState<SystemFinancialConfig | null>(null);
  const [isLoadingFinancialConfig, setIsLoadingFinancialConfig] = useState<boolean>(false);
  const [isSavingFinancialConfig, setIsSavingFinancialConfig] = useState<boolean>(false);
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState<boolean>(false);
  const [financialAuditLogs, setFinancialAuditLogs] = useState<any[]>([]);

  // Form values (editable in Pesos MXN)
  const [editCommissionPesos, setEditCommissionPesos] = useState<string>('10.00');
  const [editDriverPayPesos, setEditDriverPayPesos] = useState<string>('20.00');
  const [editDeliveryFeePesos, setEditDeliveryFeePesos] = useState<string>('25.00');
  const [editCommissionActive, setEditCommissionActive] = useState<boolean>(true);

  // Datos para depositar configurables para repartidores
  const [editDepositBankName, setEditDepositBankName] = useState<string>('BBVA Bancomer');
  const [editDepositHolder, setEditDepositHolder] = useState<string>('Directaurante S.A.P.I. de C.V.');
  const [editDepositClabe, setEditDepositClabe] = useState<string>('012 180 00123456789 0');
  const [editDepositInstructions, setEditDepositInstructions] = useState<string>('Realiza la transferencia interbancaria o depósito en ventanilla/practicaja. Usa tu número de repartidor en el concepto y sube tu comprobante a continuación.');

  // Modal para validar comprobante y registrar diferencias con auditoría
  const [settlementToReview, setSettlementToReview] = useState<any | null>(null);
  const [reviewVerifiedAmount, setReviewVerifiedAmount] = useState<string>('');
  const [reviewDiscrepancyNotes, setReviewDiscrepancyNotes] = useState<string>('');
  const [reviewReconciled, setReviewReconciled] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // -------------------------------------------------------------
  // DATA LOADERS
  // -------------------------------------------------------------
  const loadOverview = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      const data = await directApi.getMasterOverview();
      setOverview(data);
    } catch (err: any) {
      addToast('error', `Error al cargar NOC Overview: ${err.message}`);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [addToast]);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoadingOrders(true);
      const filters: any = {};
      if (orderStatusFilter !== 'all') filters.status = orderStatusFilter;
      if (orderSearchQuery.trim()) filters.search = orderSearchQuery.trim();
      const list = await directApi.getMasterOrders(filters);
      setOrders(list);
    } catch (err: any) {
      addToast('error', `Error al consultar pedidos: ${err.message}`);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [orderStatusFilter, orderSearchQuery, addToast]);

  const loadFleet = useCallback(async () => {
    try {
      setIsLoadingFleet(true);
      const drivers = await directApi.getMasterDrivers();
      setFleet(drivers);
    } catch (err: any) {
      addToast('error', `Error al cargar flota: ${err.message}`);
    } finally {
      setIsLoadingFleet(false);
    }
  }, [addToast]);

  const loadRestaurants = useCallback(async () => {
    try {
      setIsLoadingRestaurants(true);
      const rests = await directApi.getMasterRestaurants();
      setRestaurants(rests);
    } catch (err: any) {
      addToast('error', `Error al cargar restaurantes: ${err.message}`);
    } finally {
      setIsLoadingRestaurants(false);
    }
  }, [addToast]);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const list = await directApi.getMasterUsers(userRoleFilter !== 'all' ? userRoleFilter : undefined, userSearchQuery);
      setUsersList(list);
    } catch (err: any) {
      addToast('error', `Error al cargar usuarios: ${err.message}`);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userRoleFilter, userSearchQuery, addToast]);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const filters: any = {};
      if (convStatusFilter !== 'all') filters.status = convStatusFilter;
      if (convPriorityFilter !== 'all') filters.priority = convPriorityFilter;
      if (convSearchQuery.trim()) filters.search = convSearchQuery.trim();
      const data = await directApi.getMasterConversations(filters);
      setConversations(data);
    } catch (err: any) {
      addToast('error', `Error al cargar centro de comunicación: ${err.message}`);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [convStatusFilter, convPriorityFilter, convSearchQuery, addToast]);

  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      setIsLoadingMessages(true);
      const msgs = await directApi.getMasterMessages(convId);
      setConversationMessages(msgs);
    } catch (err: any) {
      addToast('error', `Error al cargar mensajes: ${err.message}`);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [addToast]);

  const openOrderCommunication = useCallback(async (orderId: string) => {
    try {
      setIsLoadingOrderComm(true);
      setActiveTab('communication');
      const ctx = await directApi.getMasterOrderCommunication(orderId);
      setOrderCommunicationContext(ctx);
      setActiveConversation(ctx.conversation);
      setConversationMessages(ctx.messages);
    } catch (err: any) {
      addToast('error', `Error al abrir comunicación del pedido: ${err.message}`);
    } finally {
      setIsLoadingOrderComm(false);
    }
  }, [addToast]);

  const loadIncidents = useCallback(async () => {
    try {
      setIsLoadingIncidents(true);
      const [list, supOverview] = await Promise.all([
        directApi.getMasterIncidents(),
        directApi.getMasterSupportOverview(),
      ]);
      setIncidents(list);
      setSupportOverview(supOverview);
    } catch (err: any) {
      addToast('error', `Error al cargar incidencias: ${err.message}`);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, [addToast]);

  const loadCommercialData = useCallback(async () => {
    try {
      setIsLoadingCommercial(true);
      const [ov, sols, pls] = await Promise.all([
        directApi.getMasterCommercialOverview(),
        directApi.getMasterCommercialSolutions(),
        directApi.getMasterCommercialPlans(),
      ]);
      setCommercialOverview(ov);
      setSolutions(sols);
      setPlans(pls);
    } catch (err: any) {
      addToast('error', `Error al cargar catálogo comercial: ${err.message}`);
    } finally {
      setIsLoadingCommercial(false);
    }
  }, [addToast]);

  const loadEvidence = useCallback(async () => {
    try {
      setIsLoadingEvidence(true);
      const evs = await directApi.getMasterEvidence(100);
      setEvidenceList(evs);
    } catch (err: any) {
      addToast('error', `Error al cargar evidencias: ${err.message}`);
    } finally {
      setIsLoadingEvidence(false);
    }
  }, [addToast]);

  const loadAuditLogs = useCallback(async () => {
    try {
      setIsLoadingAudit(true);
      const logs = await directApi.getMasterAuditLogs(100);
      setAuditLogs(logs);
    } catch (err: any) {
      addToast('error', `Error al cargar auditoría: ${err.message}`);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [addToast]);

  const loadSettlements = useCallback(async () => {
    try {
      setIsLoadingSettlements(true);
      const filters: any = {};
      if (settlementDepositFilter !== 'all') filters.deposit_status = settlementDepositFilter;
      const list = await directApi.getMasterSettlements(filters);
      setMasterSettlements(list);
    } catch (err: any) {
      addToast('error', `Error al cargar liquidaciones y depósitos: ${err.message}`);
    } finally {
      setIsLoadingSettlements(false);
    }
  }, [settlementDepositFilter, addToast]);

  const openReviewModal = (settlement: any) => {
    setSettlementToReview(settlement);
    const defaultVerified = ((settlement.deposit_amount || settlement.cash_collected || 0) / 100).toFixed(2);
    setReviewVerifiedAmount(defaultVerified);
    setReviewDiscrepancyNotes(settlement.discrepancy_notes || '');
    setReviewReconciled(settlement.is_reconciled || false);
  };

  const handleReviewDeposit = async (settlementId: string, status: 'confirmed' | 'rejected') => {
    try {
      setIsReviewingDepositId(settlementId);
      await directApi.reviewMasterDeposit(settlementId, status);
      addToast('success', `Comprobante de depósito marcado como ${status === 'confirmed' ? 'Confirmado' : 'Rechazado'}`);
      await loadSettlements();
      await loadOverview();
    } catch (err: any) {
      addToast('error', err.message || 'Error al revisar depósito');
    } finally {
      setIsReviewingDepositId(null);
    }
  };

  const submitSettlementReview = async (status: 'confirmed' | 'rejected') => {
    if (!settlementToReview) return;
    try {
      setIsSubmittingReview(true);
      const verifiedFloat = parseFloat(reviewVerifiedAmount);
      const verifiedCents = isNaN(verifiedFloat) ? undefined : Math.round(verifiedFloat * 100);

      await directApi.reviewMasterDeposit(
        settlementToReview.id,
        status,
        undefined,
        verifiedCents,
        reviewDiscrepancyNotes,
        reviewReconciled
      );

      addToast(
        'success',
        `Depósito de ${settlementToReview.driver_name} ${status === 'confirmed' ? 'validado' : 'rechazado'} exitosamente con registro de auditoría.`
      );
      setSettlementToReview(null);
      await loadSettlements();
      await loadOverview();
    } catch (err: any) {
      addToast('error', err.message || 'Error al validar depósito');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const loadFinancialConfig = useCallback(async () => {
    try {
      setIsLoadingFinancialConfig(true);
      const cfg = await directApi.getMasterFinancialConfig();
      if (cfg) {
        setFinancialConfig(cfg);
        setEditCommissionPesos(((cfg.restaurant_commission_cents ?? 1000) / 100).toFixed(2));
        setEditDriverPayPesos(((cfg.driver_payment_cents ?? 2000) / 100).toFixed(2));
        setEditDeliveryFeePesos(((cfg.default_delivery_fee_cents ?? 2500) / 100).toFixed(2));
        setEditCommissionActive(cfg.is_commission_active !== false);
        setEditDefaultTrialDays(cfg.default_trial_days ?? 15);
        setEditEnforceSubscription(cfg.enforce_subscription_check !== false);
        if (cfg.deposit_bank_name) setEditDepositBankName(cfg.deposit_bank_name);
        if (cfg.deposit_account_holder) setEditDepositHolder(cfg.deposit_account_holder);
        if (cfg.deposit_clabe_or_account) setEditDepositClabe(cfg.deposit_clabe_or_account);
        if (cfg.deposit_instructions) setEditDepositInstructions(cfg.deposit_instructions);
      }
      try {
        const audit = await directApi.getMasterFinancialAudit();
        if (audit) setFinancialAuditLogs(audit);
      } catch {
        // non-fatal
      }
    } catch (err: any) {
      addToast('error', `Error al cargar tarifas: ${err.message}`);
    } finally {
      setIsLoadingFinancialConfig(false);
    }
  }, [addToast]);

  const handleSaveFinancialConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const commVal = parseFloat(editCommissionPesos);
    const driverVal = parseFloat(editDriverPayPesos);
    const delivVal = parseFloat(editDeliveryFeePesos);

    if (isNaN(commVal) || commVal < 0) {
      addToast('error', 'Por favor ingresa un monto válido para la comisión del restaurante');
      return;
    }
    if (isNaN(driverVal) || driverVal < 0) {
      addToast('error', 'Por favor ingresa un monto válido para el costo de envío del repartidor');
      return;
    }
    if (isNaN(delivVal) || delivVal < 0) {
      addToast('error', 'Por favor ingresa un monto válido para la tarifa base de envío');
      return;
    }

    try {
      setIsSavingFinancialConfig(true);
      const updated = await directApi.updateMasterFinancialConfig({
        restaurant_commission_cents: Math.round(commVal * 100),
        driver_payment_cents: Math.round(driverVal * 100),
        default_delivery_fee_cents: Math.round(delivVal * 100),
        is_commission_active: editCommissionActive,
        deposit_bank_name: editDepositBankName.trim(),
        deposit_account_holder: editDepositHolder.trim(),
        deposit_clabe_or_account: editDepositClabe.trim(),
        deposit_instructions: editDepositInstructions.trim(),
      });
      setFinancialConfig(updated);
      addToast('success', 'Tarifas y Datos para depositar actualizados con éxito en MongoDB');
      setIsFinancialModalOpen(false);
      try {
        const audit = await directApi.getMasterFinancialAudit();
        if (audit) setFinancialAuditLogs(audit);
      } catch {
        // non-fatal
      }
    } catch (err: any) {
      addToast('error', `Error al guardar tarifas: ${err.message}`);
    } finally {
      setIsSavingFinancialConfig(false);
    }
  };

  // Initial Data & Continuous Live Polling Heartbeat
  useEffect(() => {
    if (!isMasterAuthorized) return;
    
    // Ensure SSE is connected with current auth token
    const token = directApi.getToken();
    if (token) {
      realtimeClient.connect(token);
    }

    loadOverview();
    loadOrders();
    loadFleet();
    loadRestaurants();
    loadFinancialConfig();

    // 4.5-second live heartbeat interval guarantees NOC screen is 100% live even across network drops
    const liveInterval = setInterval(() => {
      loadOverview();
      loadOrders();
      setLastLiveSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 4500);

    return () => clearInterval(liveInterval);
  }, [isMasterAuthorized, loadOverview, loadOrders, loadFleet, loadRestaurants, loadFinancialConfig]);

  // Tab change triggers
  useEffect(() => {
    if (!isMasterAuthorized) return;
    if (activeTab === 'communication' && conversations.length === 0) loadConversations();
    if (activeTab === 'incidents' && incidents.length === 0) loadIncidents();
    if (activeTab === 'users' && usersList.length === 0) loadUsers();
    if ((activeTab === 'solutions' || activeTab === 'plans' || activeTab === 'entitlements' || activeTab === 'finances') && solutions.length === 0) {
      loadCommercialData();
    }
    if (activeTab === 'finances') {
      loadSettlements();
      loadFinancialConfig();
    }
    if (activeTab === 'commissions') {
      loadFinancialConfig();
    }
    if (activeTab === 'evidence' && evidenceList.length === 0) loadEvidence();
    if (activeTab === 'audit' && auditLogs.length === 0) loadAuditLogs();
  }, [
    isMasterAuthorized,
    activeTab,
    conversations.length,
    incidents.length,
    usersList.length,
    solutions.length,
    evidenceList.length,
    auditLogs.length,
    loadConversations,
    loadIncidents,
    loadUsers,
    loadCommercialData,
    loadEvidence,
    loadAuditLogs,
  ]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Real-time SSE listener
  useEffect(() => {
    if (!isMasterAuthorized) return;
    const unsub = realtimeClient.subscribe((event) => {
      // Message events: append message if active conversation matches
      if (event.type === 'MESSAGE_CREATED' && event.data) {
        if (
          activeConversation &&
          (event.data.conversation_id === activeConversation.conversation_id ||
            event.data.order_id === activeConversation.order_id)
        ) {
          setConversationMessages((prev) => {
            if (prev.some((m) => m.id === event.data.id || m.message_id === event.data.message_id)) return prev;
            return [...prev, event.data];
          });
        }
        // Refresh conversations list to update unread badge / last_message
        loadConversations();
      }

      if (event.type === 'CONVERSATION_UPDATED' || event.type === 'MESSAGE_CLOSED') {
        loadConversations();
      }

      if (event.type === 'INCIDENT_CREATED' || event.type === 'INCIDENT_UPDATED') {
        loadIncidents();
      }

      if (event.type === 'ENTITLEMENT_UPDATED') {
        loadCommercialData();
        if (selectedRestaurantForCommercial) {
          directApi.getMasterRestaurantEntitlements(selectedRestaurantForCommercial.id).then(setRestaurantEntitlements);
        }
      }

      if (
        event.type.startsWith('ORDER_') ||
        event.type === 'DRIVER_ASSIGNED' ||
        event.type === 'DRIVER_OFFER_CREATED' ||
        event.type === 'PAYMENT_UPDATED' ||
        event.type === 'DRIVER_LOCATION_UPDATED'
      ) {
        loadOverview();
        loadOrders();
      }
    });

    return () => unsub();
  }, [activeConversation, loadConversations, loadIncidents, loadCommercialData, selectedRestaurantForCommercial, loadOverview, loadOrders]);

  // -------------------------------------------------------------
  // ACTIONS: COMMUNICATIONS
  // -------------------------------------------------------------
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversation) return;

    try {
      setIsSendingMessage(true);
      const sent = await directApi.sendMasterMessage(activeConversation.conversation_id, messageInput.trim());
      setConversationMessages((prev) => [...prev, sent]);
      setMessageInput('');
      loadConversations();
    } catch (err: any) {
      addToast('error', `Error al enviar mensaje: ${err.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleChangePriority = async (convId: string, priority: string) => {
    try {
      const updated = await directApi.updateMasterConversationPriority(convId, priority);
      addToast('success', `Prioridad actualizada a ${priority.toUpperCase()}`);
      if (activeConversation?.conversation_id === convId) {
        setActiveConversation((prev: any) => ({ ...prev, priority }));
      }
      loadConversations();
    } catch (err: any) {
      addToast('error', `Error al cambiar prioridad: ${err.message}`);
    }
  };

  const handleCloseConversation = async (convId: string) => {
    if (!confirm('¿Seguro que deseas cerrar esta conversación?')) return;
    try {
      await directApi.closeMasterConversation(convId, 'Resolución de caso por Master NOC');
      addToast('success', 'Conversación marcada como cerrada');
      if (activeConversation?.conversation_id === convId) {
        setActiveConversation((prev: any) => ({ ...prev, status: 'closed' }));
      }
      loadConversations();
    } catch (err: any) {
      addToast('error', `Error al cerrar conversación: ${err.message}`);
    }
  };

  const handleStartDirectChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTargetUserId) {
      addToast('error', 'Selecciona el usuario destino');
      return;
    }

    try {
      setIsSubmittingDirectChat(true);
      const conv = await directApi.startMasterDirectConversation(
        directTargetUserId,
        directInitialMessage.trim() || undefined,
        directPriority,
        `Chat Directo con Operador Master`
      );
      addToast('success', 'Conversación directa iniciada');
      setIsDirectChatModalOpen(false);
      setDirectInitialMessage('');
      setActiveConversation(conv);
      loadConversationMessages(conv.conversation_id);
      loadConversations();
    } catch (err: any) {
      addToast('error', `Error al iniciar chat directo: ${err.message}`);
    } finally {
      setIsSubmittingDirectChat(false);
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: INCIDENTS
  // -------------------------------------------------------------
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim() || !incidentDescription.trim() || !incidentEntityId.trim()) {
      addToast('error', 'Por favor completa todos los campos');
      return;
    }

    try {
      setIsSubmittingIncident(true);
      await directApi.createMasterIncident({
        title: incidentTitle.trim(),
        description: incidentDescription.trim(),
        entity_type: incidentEntityType,
        entity_id: incidentEntityId.trim(),
        severity: incidentSeverity,
      });
      addToast('success', 'Incidencia reportada y registrada con auditoría');
      setIsCreateIncidentModalOpen(false);
      setIncidentTitle('');
      setIncidentDescription('');
      setIncidentEntityId('');
      loadIncidents();
    } catch (err: any) {
      addToast('error', `Error al reportar incidencia: ${err.message}`);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    const notes = prompt('Ingresa las notas de resolución para la auditoría:');
    if (notes === null) return;

    try {
      await directApi.updateMasterIncident(incidentId, {
        status: 'resolved',
        resolution_notes: notes.trim() || 'Resuelto y verificado por operador Master',
      });
      addToast('success', 'Incidencia resuelta y archivada');
      loadIncidents();
    } catch (err: any) {
      addToast('error', `Error al resolver incidencia: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: COMMERCIAL & ENTITLEMENTS
  // -------------------------------------------------------------
  const handleOpenRestaurantCommercial = async (rest: any) => {
    setSelectedRestaurantForCommercial(rest);
    try {
      setIsLoadingEntitlements(true);
      const ents = await directApi.getMasterRestaurantEntitlements(rest.id);
      setRestaurantEntitlements(ents);
    } catch (err: any) {
      addToast('error', `Error al consultar capacidades del restaurante: ${err.message}`);
    } finally {
      setIsLoadingEntitlements(false);
    }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurantForCommercial || !selectedPlanToAssign) return;

    try {
      setIsSubmittingCommercialAction(true);
      await directApi.masterAssignPlan(selectedRestaurantForCommercial.id, selectedPlanToAssign);
      addToast('success', 'Plan comercial asignado y capacidades activadas');
      setIsAssignPlanModalOpen(false);
      handleOpenRestaurantCommercial(selectedRestaurantForCommercial);
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al asignar plan: ${err.message}`);
    } finally {
      setIsSubmittingCommercialAction(false);
    }
  };

  const handleGrantTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurantForCommercial || !selectedSolutionForTrial) return;

    try {
      setIsSubmittingCommercialAction(true);
      await directApi.masterGrantTrial(selectedRestaurantForCommercial.id, selectedSolutionForTrial, 30);
      addToast('success', 'Período de prueba de 30 días activado exitosamente');
      setIsGrantTrialModalOpen(false);
      handleOpenRestaurantCommercial(selectedRestaurantForCommercial);
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al otorgar trial: ${err.message}`);
    } finally {
      setIsSubmittingCommercialAction(false);
    }
  };

  const handleToggleEntitlement = async (solutionId: string, currentStatus: string) => {
    if (!selectedRestaurantForCommercial) return;
    const newStatus = currentStatus === 'ACTIVE' || currentStatus === 'TRIAL' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await directApi.masterToggleEntitlement(selectedRestaurantForCommercial.id, solutionId, newStatus);
      addToast('success', `Capacidad ${newStatus === 'ACTIVE' ? 'activada' : 'suspendida'} en backend`);
      handleOpenRestaurantCommercial(selectedRestaurantForCommercial);
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al cambiar estado de capacidad: ${err.message}`);
    }
  };

  // --- ACTIONS: GLOBAL TRIAL CONFIGURATION ---
  const handleSaveTrialConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSavingTrialConfig(true);
      const updated = await directApi.updateMasterFinancialConfig({
        default_trial_days: editDefaultTrialDays,
        enforce_subscription_check: editEnforceSubscription,
      });
      setFinancialConfig(updated);
      addToast(
        'success',
        `Parámetros actualizados: Nuevos restaurantes tendrán ${editDefaultTrialDays} días de prueba gratuita.`
      );
    } catch (err: any) {
      addToast('error', `Error al guardar parámetros de prueba: ${err.message}`);
    } finally {
      setIsSavingTrialConfig(false);
    }
  };

  // --- ACTIONS: COMMERCIAL PLANS MANAGEMENT ---
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanFormPlanId(`plan_${commercialProductTab === 'directaurante' ? 'dir' : 'post'}_${Date.now().toString(36)}`);
    setPlanFormName('');
    setPlanFormProduct(commercialProductTab);
    setPlanFormPricePesos('499.00');
    setPlanFormBillingPeriod('monthly');
    setPlanFormDescription('');
    setPlanFormStatus('active');
    setPlanFormMaxOrders('');
    setPlanFormMaxProducts('');
    setPlanFormMaxStaff('');
    setPlanFormMaxTables('');
    setPlanFormSolutions(
      commercialProductTab === 'directaurante'
        ? ['sol_dir_online_orders', 'sol_dir_delivery', 'sol_dir_tracking']
        : ['sol_post_pos', 'sol_post_kds']
    );
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: CommercialPlan) => {
    setEditingPlan(plan);
    setPlanFormPlanId(plan.plan_id);
    setPlanFormName(plan.name);
    setPlanFormProduct(plan.product);
    setPlanFormPricePesos(((plan.price_cents ?? 0) / 100).toFixed(2));
    setPlanFormBillingPeriod(plan.billing_period || 'monthly');
    setPlanFormDescription(plan.description);
    setPlanFormStatus(plan.status);
    setPlanFormMaxOrders(plan.limits?.max_orders_month ? String(plan.limits.max_orders_month) : '');
    setPlanFormMaxProducts(plan.limits?.max_products ? String(plan.limits.max_products) : '');
    setPlanFormMaxStaff(plan.limits?.max_staff ? String(plan.limits.max_staff) : '');
    setPlanFormMaxTables(plan.limits?.max_tables ? String(plan.limits.max_tables) : '');
    setPlanFormSolutions(plan.included_solutions || []);
    setIsPlanModalOpen(true);
  };

  const handleDuplicatePlan = (plan: CommercialPlan) => {
    setEditingPlan(null);
    setPlanFormPlanId(`${plan.plan_id}_copia_${Date.now().toString(36).slice(-4)}`);
    setPlanFormName(`${plan.name} (Copia)`);
    setPlanFormProduct(plan.product);
    setPlanFormPricePesos(((plan.price_cents ?? 0) / 100).toFixed(2));
    setPlanFormBillingPeriod(plan.billing_period || 'monthly');
    setPlanFormDescription(plan.description);
    setPlanFormStatus('active');
    setPlanFormMaxOrders(plan.limits?.max_orders_month ? String(plan.limits.max_orders_month) : '');
    setPlanFormMaxProducts(plan.limits?.max_products ? String(plan.limits.max_products) : '');
    setPlanFormMaxStaff(plan.limits?.max_staff ? String(plan.limits.max_staff) : '');
    setPlanFormMaxTables(plan.limits?.max_tables ? String(plan.limits.max_tables) : '');
    setPlanFormSolutions([...(plan.included_solutions || [])]);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planFormName.trim()) {
      addToast('error', 'El nombre del plan es obligatorio');
      return;
    }
    const priceVal = parseFloat(planFormPricePesos);
    if (isNaN(priceVal) || priceVal < 0) {
      addToast('error', 'El precio del plan no es válido');
      return;
    }

    try {
      setIsSubmittingPlan(true);
      const planPayload: Partial<CommercialPlan> = {
        name: planFormName.trim(),
        product: planFormProduct,
        description: planFormDescription.trim(),
        price_cents: Math.round(priceVal * 100),
        billing_period: planFormBillingPeriod as any,
        status: planFormStatus,
        included_solutions: planFormSolutions,
        limits: {
          max_orders_month: planFormMaxOrders ? parseInt(planFormMaxOrders, 10) : undefined,
          max_products: planFormMaxProducts ? parseInt(planFormMaxProducts, 10) : undefined,
          max_staff: planFormMaxStaff ? parseInt(planFormMaxStaff, 10) : undefined,
          max_tables: planFormMaxTables ? parseInt(planFormMaxTables, 10) : undefined,
        },
      };

      if (editingPlan) {
        await directApi.updateMasterCommercialPlan(editingPlan.plan_id, planPayload);
        addToast('success', `Plan "${planFormName}" actualizado completamente con éxito`);
      } else {
        const idToUse = planFormPlanId.trim() || `plan_${planFormProduct === 'directaurante' ? 'dir' : 'post'}_${Date.now().toString(36)}`;
        await directApi.createMasterCommercialPlan({
          ...planPayload,
          plan_id: idToUse,
        });
        addToast('success', `Plan "${planFormName}" creado con éxito`);
      }
      setIsPlanModalOpen(false);
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al guardar plan: ${err.message}`);
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleTogglePlanStatus = async (plan: CommercialPlan) => {
    const nextStatus = plan.status === 'active' ? 'inactive' : 'active';
    try {
      await directApi.updateMasterCommercialPlan(plan.plan_id, { status: nextStatus });
      addToast('success', `Plan "${plan.name}" cambiado a estado ${nextStatus.toUpperCase()}`);
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al cambiar estado del plan: ${err.message}`);
    }
  };

  const handleDeletePlan = async (plan: CommercialPlan) => {
    if (!confirm(`¿Eliminar de forma segura el plan comercial "${plan.name}"?`)) return;
    try {
      await directApi.deleteMasterCommercialPlan(plan.plan_id);
      addToast('success', `Plan "${plan.name}" eliminado correctamente`);
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al eliminar plan: ${err.message}`);
    }
  };

  // --- ACTIONS: RESTAURANT LICENSE & SUBSCRIPTION COMPLETE MANAGEMENT ---
  const handleOpenManageLicense = async (restaurant: Restaurant) => {
    setSelectedRestaurantForLicense(restaurant);
    const currentStatus = (restaurant.subscription_status as any) || 'trial';
    const validStatus = ['active', 'trial', 'lifetime', 'expired', 'paused', 'none'].includes(currentStatus)
      ? currentStatus
      : 'trial';
    setLicenseTargetStatus(validStatus);

    const initialPlanId = restaurant.subscription_plan_id || plans[0]?.plan_id || '';
    setLicenseSelectedPlanId(initialPlanId);

    const matchingPlan = plans.find((p) => p.plan_id === initialPlanId);
    setLicensePlanName(
      restaurant.subscription_plan_name || matchingPlan?.name || 'Directaurante Pro'
    );
    setLicensePricePesos(
      restaurant.subscription_price_cents !== undefined && restaurant.subscription_price_cents !== null
        ? ((restaurant.subscription_price_cents / 100).toFixed(2))
        : matchingPlan ? ((matchingPlan.price_cents / 100).toFixed(2)) : '499.00'
    );
    setLicenseBillingPeriod(
      restaurant.subscription_billing_period || matchingPlan?.billing_period || 'monthly'
    );
    setLicenseStartsAt(
      restaurant.subscription_starts_at
        ? restaurant.subscription_starts_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setLicenseEndsAt(
      restaurant.subscription_ends_at ? restaurant.subscription_ends_at.slice(0, 10) : ''
    );
    setLicenseTrialEndsAt(
      restaurant.trial_ends_at
        ? restaurant.trial_ends_at.slice(0, 10)
        : new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
    );
    setLicenseTrialDays(15);
    setLicenseNotes(restaurant.subscription_notes || '');
    setLicenseMaxOrders(
      restaurant.subscription_limits?.max_orders_month ? String(restaurant.subscription_limits.max_orders_month) : ''
    );
    setLicenseMaxProducts(
      restaurant.subscription_limits?.max_products ? String(restaurant.subscription_limits.max_products) : ''
    );
    setLicenseMaxStaff(
      restaurant.subscription_limits?.max_staff ? String(restaurant.subscription_limits.max_staff) : ''
    );

    setIsLicenseModalOpen(true);

    // Load actual entitlements for this restaurant
    try {
      setIsLoadingLicenseSolutions(true);
      const res = await directApi.getMasterRestaurantEntitlements(restaurant.id);
      if (Array.isArray(res) && res.length > 0) {
        const activeIds = res
          .filter((e: any) => e.status === 'ACTIVE' || e.status === 'TRIAL')
          .map((e: any) => e.solution_id);
        setLicenseSolutions(
          activeIds.length > 0
            ? activeIds
            : matchingPlan?.included_solutions || ['sol_dir_online_orders', 'sol_dir_delivery']
        );
      } else {
        setLicenseSolutions(
          matchingPlan?.included_solutions || ['sol_dir_online_orders', 'sol_dir_delivery', 'sol_dir_tracking']
        );
      }
    } catch {
      setLicenseSolutions(
        matchingPlan?.included_solutions || ['sol_dir_online_orders', 'sol_dir_delivery', 'sol_dir_tracking']
      );
    } finally {
      setIsLoadingLicenseSolutions(false);
    }
  };

  const handleApplyPlanToLicense = (planId: string) => {
    setLicenseSelectedPlanId(planId);
    const chosen = plans.find((p) => p.plan_id === planId);
    if (chosen) {
      setLicensePlanName(chosen.name);
      setLicensePricePesos(((chosen.price_cents || 0) / 100).toFixed(2));
      setLicenseBillingPeriod(chosen.billing_period || 'monthly');
      if (chosen.included_solutions && chosen.included_solutions.length > 0) {
        setLicenseSolutions([...chosen.included_solutions]);
      }
      if (chosen.limits) {
        if (chosen.limits.max_orders_month) setLicenseMaxOrders(String(chosen.limits.max_orders_month));
        if (chosen.limits.max_products) setLicenseMaxProducts(String(chosen.limits.max_products));
        if (chosen.limits.max_staff) setLicenseMaxStaff(String(chosen.limits.max_staff));
      }
      addToast('info', `Valores precargados del plan "${chosen.name}"`);
    }
  };

  const handleAddDaysToLicense = (days: number) => {
    const baseDate = licenseTargetStatus === 'trial'
      ? (licenseTrialEndsAt ? new Date(licenseTrialEndsAt).getTime() : Date.now())
      : (licenseEndsAt ? new Date(licenseEndsAt).getTime() : Date.now());
    const newTarget = new Date(baseDate + days * 86400000).toISOString().slice(0, 10);
    if (licenseTargetStatus === 'trial') {
      setLicenseTrialEndsAt(newTarget);
    } else {
      setLicenseEndsAt(newTarget);
    }
  };

  const handleSaveRestaurantLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurantForLicense) return;

    try {
      setIsSubmittingLicense(true);
      const priceVal = parseFloat(licensePricePesos);
      const priceCents = isNaN(priceVal) ? 0 : Math.round(priceVal * 100);

      let computedEndsAt: string | null = null;
      if (licenseTargetStatus === 'active') {
        computedEndsAt = licenseEndsAt ? new Date(licenseEndsAt).toISOString() : null;
      }

      let computedTrialEndsAt: string | null = null;
      if (licenseTargetStatus === 'trial') {
        computedTrialEndsAt = licenseTrialEndsAt
          ? new Date(licenseTrialEndsAt).toISOString()
          : new Date(Date.now() + (licenseTrialDays || 15) * 86400000).toISOString();
      }

      await directApi.masterUpdateRestaurantSubscription(selectedRestaurantForLicense.id, {
        subscription_status: licenseTargetStatus,
        plan_id: licenseSelectedPlanId || undefined,
        subscription_plan_name: licensePlanName.trim() || undefined,
        subscription_price_cents: priceCents,
        subscription_billing_period: licenseBillingPeriod || undefined,
        subscription_starts_at: licenseStartsAt ? new Date(licenseStartsAt).toISOString() : undefined,
        subscription_ends_at: computedEndsAt,
        trial_ends_at: computedTrialEndsAt,
        trial_days: licenseTargetStatus === 'trial' ? licenseTrialDays : undefined,
        subscription_notes: licenseNotes.trim() || undefined,
        subscription_limits: {
          max_orders_month: licenseMaxOrders ? parseInt(licenseMaxOrders, 10) : undefined,
          max_products: licenseMaxProducts ? parseInt(licenseMaxProducts, 10) : undefined,
          max_staff: licenseMaxStaff ? parseInt(licenseMaxStaff, 10) : undefined,
        },
        solutions: licenseSolutions,
      });

      addToast(
        'success',
        `Suscripción de "${selectedRestaurantForLicense.name}" actualizada completamente (${licenseTargetStatus.toUpperCase()})`
      );
      setIsLicenseModalOpen(false);
      loadRestaurants();
      loadCommercialData();
      if (selectedRestaurantForCommercial?.id === selectedRestaurantForLicense.id) {
        handleOpenRestaurantCommercial(selectedRestaurantForLicense);
      }
    } catch (err: any) {
      addToast('error', `Error al actualizar suscripción: ${err.message}`);
    } finally {
      setIsSubmittingLicense(false);
    }
  };

  const handleQuickRenewSubscription = async (restaurant: Restaurant, days = 30) => {
    try {
      const now = Date.now();
      const currentEnd = restaurant.subscription_ends_at
        ? Math.max(now, new Date(restaurant.subscription_ends_at).getTime())
        : now;
      const newEnd = new Date(currentEnd + days * 86400000).toISOString();

      await directApi.masterUpdateRestaurantSubscription(restaurant.id, {
        subscription_status: 'active',
        subscription_ends_at: newEnd,
      });
      addToast('success', `+${days} días añadidos a la suscripción de "${restaurant.name}"`);
      loadRestaurants();
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error al renovar suscripción: ${err.message}`);
    }
  };

  const handleToggleRestaurantSubscriptionPause = async (restaurant: Restaurant) => {
    const isPaused = restaurant.subscription_status === 'paused';
    const nextStatus = isPaused ? 'active' : 'paused';
    try {
      await directApi.masterUpdateRestaurantSubscription(restaurant.id, {
        subscription_status: nextStatus,
      });
      addToast(
        'success',
        `Suscripción de "${restaurant.name}" ${isPaused ? 'reactivada' : 'pausada temporalmente'}`
      );
      loadRestaurants();
      loadCommercialData();
    } catch (err: any) {
      addToast('error', `Error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: ORDERS OVERRIDE
  // -------------------------------------------------------------
  const handleForceOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !overrideReason.trim()) {
      addToast('error', 'Motivo obligatorio para auditoría');
      return;
    }

    try {
      setIsSubmittingOverride(true);
      const updated = await directApi.masterForceOrderStatus(selectedOrder.id, overrideStatus, overrideReason.trim());
      addToast('success', `Pedido actualizado soberanamente a ${overrideStatus.toUpperCase()}`);
      setIsOverrideModalOpen(false);
      setOverrideReason('');
      setSelectedOrder(updated);
      loadOrders();
      loadOverview();
    } catch (err: any) {
      addToast('error', `Error al forzar estado: ${err.message}`);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleReassignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedDriverId) {
      addToast('error', 'Selecciona un repartidor');
      return;
    }

    try {
      setIsSubmittingReassign(true);
      const updated = await directApi.masterAssignDriver(selectedOrder.id, selectedDriverId);
      addToast('success', 'Repartidor reasignado exitosamente con notificación en vivo');
      setIsReassignModalOpen(false);
      setSelectedOrder(updated);
      loadOrders();
      loadOverview();
    } catch (err: any) {
      addToast('error', `Error al reasignar: ${err.message}`);
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    try {
      setIsSubmittingBroadcast(true);
      await directApi.masterBroadcastAlert(broadcastTitle.trim(), broadcastMessage.trim(), broadcastTarget);
      addToast('success', 'Alerta emitida al ecosistema en tiempo real');
      setIsBroadcastModalOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      addToast('error', `Error al emitir alerta: ${err.message}`);
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  // Guard: Strictly accessible only by Master or Admin role
  if (!isMasterAuthorized) {
    if (isLoadingUser) {
      return (
        <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#05268F] text-[#FFD318] flex items-center justify-center mx-auto animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#667085] font-medium">Verificando credencial de acceso Master...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
        <div className="max-w-md w-full my-16 p-8 bg-white border border-rose-200 rounded-3xl shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#101828]">Acceso Restringido</h2>
          <p className="text-xs text-[#667085] leading-relaxed">
            Este módulo está reservado exclusivamente para operadores del Centro de Control Master (NOC 24/7).
            {user ? ` Tu rol actual (${user.role}) no tiene autorización.` : ' No has iniciado sesión con una credencial Master autorizada.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {!user && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#05268F] text-[#FFD318] font-bold text-xs hover:bg-[#0732b3] transition shadow-md"
              >
                Iniciar Sesión Master
              </button>
            )}
            <button
              onClick={() => setActiveView('explore')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md ${
                !user ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'bg-[#05268F] text-[#FFD318] hover:bg-[#0732b3]'
              }`}
            >
              Volver a Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#101828] flex flex-col font-sans select-none selection:bg-[#05268F] selection:text-[#FFD318]">
      {/* 1. TOP BAR: COMMAND CENTER HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-black shadow-md border border-[#05268F]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-[#101828]">DIRECTAURANTE NOC</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20">
                MASTER V2 · 24/7
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                CORE EN VIVO · {lastLiveSyncTime}
              </span>
            </div>
            <p className="text-[11px] text-[#667085] hidden sm:block">
              Centro de Operaciones, Soporte 24/7 y Gestión Comercial Soberana
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsBroadcastModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF7D6] text-[#05268F] hover:bg-[#FFD318] transition text-xs font-bold border border-[#FFD318]/40 shadow-sm"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Emitir Alerta</span>
          </button>

          <button
            onClick={() => {
              loadOverview();
              loadOrders();
              loadConversations();
              addToast('info', 'Sincronizando estado con MongoDB Core...');
            }}
            className="p-2 rounded-xl bg-[#F4F6F8] hover:bg-[#E5E7EB] text-[#101828] transition border border-[#E5E7EB]"
            title="Refrescar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveView('explore')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4F6F8] hover:bg-[#E5E7EB] text-[#101828] transition text-xs font-bold border border-[#E5E7EB]"
            title="Ir a Tienda / Explorar"
          >
            <Store className="w-3.5 h-3.5 text-[#05268F]" />
            <span className="hidden sm:inline">Tienda</span>
          </button>

          <div className="h-6 w-px bg-[#E5E7EB] mx-1"></div>

          <div className="flex items-center gap-2 pl-1">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-[#101828]">{user?.name || 'Operador Master'}</div>
              <div className="text-[10px] font-semibold text-[#05268F] uppercase tracking-wider">Operador Master</div>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition border border-rose-200"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-NAVIGATION TABS BAR */}
      <div className="bg-[#F4F6F8] border-b border-[#E5E7EB] px-4 lg:px-8 py-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {/* Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'dashboard'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Vista General
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] mx-1"></div>

          {/* Operación */}
          <span className="text-[10px] font-black uppercase text-[#667085] tracking-wider px-1">Operación:</span>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'orders'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Pedidos
            {overview?.metrics?.active_orders_count ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#FFD318] text-[#101828] font-black">
                {overview?.metrics?.active_orders_count}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'alerts'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Alertas
            {overview?.recent_alerts?.length ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-black">
                {overview?.recent_alerts?.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'incidents'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Soporte & Incidencias
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] mx-1"></div>

          {/* Comunicación */}
          <span className="text-[10px] font-black uppercase text-[#667085] tracking-wider px-1">Comunicación:</span>

          <button
            onClick={() => setActiveTab('communication')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'communication'
                ? 'bg-[#05268F] text-[#FFD318] shadow-sm font-black'
                : 'text-[#05268F] bg-[#EAF0FF] hover:bg-[#d8e4ff]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Centro de Comunicación
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5"></span>
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] mx-1"></div>

          {/* Gestión */}
          <span className="text-[10px] font-black uppercase text-[#667085] tracking-wider px-1">Gestión:</span>

          <button
            onClick={() => setActiveTab('restaurants')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'restaurants'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Restaurantes
          </button>

          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'fleet'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            Repartidores
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'users'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Usuarios
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] mx-1"></div>

          {/* Comercial */}
          <span className="text-[10px] font-black uppercase text-[#667085] tracking-wider px-1">Comercial:</span>

          <button
            onClick={() => setActiveTab('solutions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'solutions'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Soluciones
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'plans'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Planes
          </button>

          <button
            onClick={() => setActiveTab('entitlements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'entitlements'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Funciones Incluidas
          </button>

          <button
            onClick={() => setActiveTab('finances')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'finances'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Finanzas
          </button>

          {/* BOTÓN NUEVO: COMISIONES Y COSTO DE ENVÍO REPARTIDOR */}
          <button
            onClick={() => {
              setActiveTab('commissions');
              setIsFinancialModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'commissions'
                ? 'bg-[#05268F] text-white shadow-sm ring-2 ring-[#FFD318]'
                : 'text-[#05268F] bg-[#FFF7D6] hover:bg-[#FFD318] border border-[#FFD318]/60 shadow-xs'
            }`}
            title="Modificar cobro de comisión por venta de restaurante y costo de envío que le corresponde al repartidor"
          >
            <Percent className="w-3.5 h-3.5 text-[#05268F]" />
            <span>Comisiones & Repartidor</span>
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] mx-1"></div>

          {/* Sistema */}
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'evidence'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Evidencias
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'audit'
                ? 'bg-[#05268F] text-white shadow-sm'
                : 'text-[#667085] hover:text-[#101828] hover:bg-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Auditoría
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE CONTENT */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* ======================================================== */}
        {/* TAB 1: DASHBOARD (VISTA GENERAL NOC 24/7) */}
        {/* ======================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Live Core Health Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#667085] mb-2 font-semibold">
                  <span>Base de Datos MongoDB</span>
                  <Database className="w-4 h-4 text-[#05268F]" />
                </div>
                <div className="text-xl font-black text-[#101828]">
                  {overview?.system?.database?.connected ? 'Conectado (Real)' : 'Conectando...'}
                </div>
                <div className="text-[11px] text-[#667085] mt-1 font-mono">
                  DB: {overview?.system?.database?.databaseName || 'directaurante'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#667085] mb-2 font-semibold">
                  <span>Clientes SSE Conectados</span>
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                </div>
                <div className="text-xl font-black text-[#101828]">
                  {overview?.system?.realtime?.connectedClients ?? 0} activos
                </div>
                <div className="text-[11px] text-[#667085] mt-1">
                  Event Stream 24/7 sin polling
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#667085] mb-2 font-semibold">
                  <span>Pedidos Activos</span>
                  <ShoppingBag className="w-4 h-4 text-[#05268F]" />
                </div>
                <div className="text-xl font-black text-[#101828]">
                  {overview?.metrics?.active_orders_count ?? 0}
                </div>
                <div className="text-[11px] text-[#667085] mt-1">
                  Total acumulado: {overview?.metrics?.total_orders ?? 0}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#667085] mb-2 font-semibold">
                  <span>Flota en Turno</span>
                  <Bike className="w-4 h-4 text-[#05268F]" />
                </div>
                <div className="text-xl font-black text-[#101828]">
                  {overview?.metrics?.ecosystem?.available_drivers ?? 0} disponibles
                </div>
                <div className="text-[11px] text-[#667085] mt-1">
                  Total conductores: {overview?.metrics?.ecosystem?.total_drivers ?? 0}
                </div>
              </div>
            </div>

            {/* Critical Live Alerts Box */}
            <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-black text-[#101828]">Alertas Operativas Críticas</h3>
                </div>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className="text-xs font-bold text-[#05268F] hover:underline"
                >
                  Ver todas las alertas ({overview?.recent_alerts?.length || 0})
                </button>
              </div>

              {overview?.recent_alerts && overview.recent_alerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(overview?.recent_alerts || []).slice(0, 4).map((alt: any) => (
                    <div
                      key={alt.id}
                      className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-black text-rose-700">
                          <span>{alt.title}</span>
                          <span className="text-[10px] text-rose-500 font-mono">
                            {new Date(alt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-[#101828] mt-1">{alt.message}</p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-rose-200/60">
                        {alt.entity_id && (
                          <button
                            onClick={() => openOrderCommunication(alt.entity_id)}
                            className="px-2.5 py-1 rounded-lg bg-[#05268F] text-[#FFD318] text-[11px] font-bold hover:bg-[#0732b3] transition flex items-center gap-1 shadow-sm"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Ver Comunicación
                          </button>
                        )}
                        <button
                          onClick={() => setActiveTab('incidents')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-[#101828] text-[11px] font-bold hover:bg-[#F4F6F8] transition"
                        >
                          Crear Incidencia
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#667085] flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  No hay alertas críticas en curso. Todos los pedidos y restaurantes operan normalmente.
                </div>
              )}
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => {
                  setActiveTab('communication');
                  setIsDirectChatModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-[#EAF0FF] hover:bg-[#d8e4ff] border border-[#05268F]/20 text-left transition space-y-1"
              >
                <div className="w-8 h-8 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-[#05268F]">Iniciar Chat Directo</div>
                <div className="text-[11px] text-[#667085]">Conectar con Cliente, Restaurante o Driver</div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('incidents');
                  setIsCreateIncidentModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-[#FFF7D6] hover:bg-[#feeebb] border border-[#FFD318]/40 text-left transition space-y-1"
              >
                <div className="w-8 h-8 rounded-xl bg-[#101828] text-[#FFD318] flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-[#101828]">Crear Incidencia</div>
                <div className="text-[11px] text-[#667085]">Registrar problema con orden o flota</div>
              </button>

              <button
                onClick={() => setActiveTab('solutions')}
                className="p-4 rounded-2xl bg-[#F4F6F8] hover:bg-[#E5E7EB] border border-[#E5E7EB] text-left transition space-y-1"
              >
                <div className="w-8 h-8 rounded-xl bg-[#05268F] text-white flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-[#101828]">Catálogo Soluciones</div>
                <div className="text-[11px] text-[#667085]">Directaurante & DirectPost Core</div>
              </button>

              <button
                onClick={() => setActiveTab('entitlements')}
                className="p-4 rounded-2xl bg-[#F4F6F8] hover:bg-[#E5E7EB] border border-[#E5E7EB] text-left transition space-y-1"
              >
                <div className="w-8 h-8 rounded-xl bg-[#101828] text-[#FFD318] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs font-black text-[#101828]">Asignar Plan / Trial</div>
                <div className="text-[11px] text-[#667085]">Capacidades contratadas y 30d trial</div>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CENTRO DE COMUNICACIÓN 24/7 (FASE 2 CORE) */}
        {/* ======================================================== */}
        {activeTab === 'communication' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB]">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#05268F]" />
                  Centro de Comunicación 24/7
                </h2>
                <p className="text-xs text-[#667085]">
                  Supervisión y mensajería en vivo multi-actor con persistencia en MongoDB y SSE en tiempo real.
                </p>
              </div>
              <button
                onClick={() => setIsDirectChatModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] font-bold text-xs hover:bg-[#0732b3] transition flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Iniciar Chat Directo
              </button>
            </div>

            {/* Split View: Left List of Conversations | Right Active Chat + Context */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: CONVERSATION LIST (5 cols) */}
              <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-3xl p-4 shadow-sm space-y-3">
                {/* Search & Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-[#667085]" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, restaurante, driver o DIR-..."
                      value={convSearchQuery}
                      onChange={(e) => setConvSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadConversations()}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={convStatusFilter}
                      onChange={(e) => {
                        setConvStatusFilter(e.target.value);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-[#F4F6F8] text-[11px] font-bold border border-[#E5E7EB]"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="active">Activas</option>
                      <option value="pending">Pendientes</option>
                      <option value="closed">Cerradas</option>
                    </select>

                    <select
                      value={convPriorityFilter}
                      onChange={(e) => {
                        setConvPriorityFilter(e.target.value);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-[#F4F6F8] text-[11px] font-bold border border-[#E5E7EB]"
                    >
                      <option value="all">Toda prioridad</option>
                      <option value="normal">Normal</option>
                      <option value="importante">Importante</option>
                      <option value="urgente">Urgente</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                </div>

                {/* Conversation Items */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {isLoadingConversations ? (
                    <div className="py-12 text-center text-xs text-[#667085]">
                      Cargando conversaciones...
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#667085] space-y-2">
                      <MessageCircle className="w-8 h-8 text-[#667085] mx-auto opacity-40" />
                      <div>No se encontraron conversaciones activas con los filtros actuales.</div>
                    </div>
                  ) : (
                    conversations.map((c) => {
                      const isSelected = activeConversation?.conversation_id === c.conversation_id;
                      const priorityColor =
                        c.priority === 'critica'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : c.priority === 'urgente'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : c.priority === 'importante'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-200';

                      return (
                        <div
                          key={c.conversation_id}
                          onClick={() => {
                            setActiveConversation(c);
                            loadConversationMessages(c.conversation_id);
                            if (c.order_id) {
                              directApi.getMasterOrderCommunication(c.order_id).then(setOrderCommunicationContext);
                            } else {
                              setOrderCommunicationContext(null);
                            }
                          }}
                          className={`p-3 rounded-2xl border transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#EAF0FF] border-[#05268F] shadow-sm'
                              : 'bg-white border-[#E5E7EB] hover:bg-[#F4F6F8]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-black text-[#101828] truncate max-w-[200px]">
                              {c.title}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase border ${priorityColor}`}>
                              {c.priority}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#667085] line-clamp-1 mb-2 font-normal">
                            {c.last_message || 'Sin mensajes aún'}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-[#667085]">
                            <div className="flex items-center gap-1.5">
                              {c.type === 'order' ? (
                                <span className="px-1.5 py-0.5 rounded bg-[#FFF7D6] text-[#05268F] font-bold">
                                  {c.order_code || 'PEDIDO'}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-bold">
                                  DIRECTO
                                </span>
                              )}
                              {c.unread_master && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                              )}
                            </div>
                            <span>
                              {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ACTIVE CONVERSATION + CONTEXT (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {activeConversation ? (
                  <div className="bg-white border border-[#E5E7EB] rounded-3xl p-5 shadow-sm space-y-4">
                    {/* Header with Title, Participants & Priority Switch */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-[#101828]">{activeConversation.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              activeConversation.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            {activeConversation.status}
                          </span>
                        </div>
                        {activeConversation.order_id && (
                          <div className="text-[11px] text-[#05268F] font-bold mt-0.5">
                            ID Universal: {activeConversation.order_id}
                          </div>
                        )}
                      </div>

                      {/* Controls: Priority selector & Close button */}
                      <div className="flex items-center gap-2">
                        <select
                          value={activeConversation.priority}
                          onChange={(e) => handleChangePriority(activeConversation.conversation_id, e.target.value)}
                          className="py-1 px-2 rounded-lg bg-[#F4F6F8] text-[11px] font-bold border border-[#E5E7EB]"
                        >
                          <option value="normal">NORMAL</option>
                          <option value="importante">IMPORTANTE</option>
                          <option value="urgente">URGENTE</option>
                          <option value="critica">CRÍTICA</option>
                        </select>

                        {activeConversation.status !== 'closed' && (
                          <button
                            onClick={() => handleCloseConversation(activeConversation.conversation_id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition"
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* REAL-TIME PARTICIPANTS PRESENCE BAR (Requirement #5 & #22) */}
                    <div className="p-3 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB]">
                      <div className="text-[10px] font-black uppercase text-[#667085] tracking-wider mb-2">
                        Participantes en Vivo (Presencia Real 24/7):
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {activeConversation.participants?.map((p: any) => {
                          const isOnline = activeConversation.presence?.[p.id];
                          const roleLabel =
                            p.role === 'customer'
                              ? 'CLIENTE'
                              : p.role === 'restaurant'
                              ? 'RESTAURANTE'
                              : p.role === 'driver'
                              ? 'DRIVER'
                              : 'MASTER';

                          return (
                            <div
                              key={p.id}
                              className="p-2 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-between gap-1 text-[11px]"
                            >
                              <div className="truncate">
                                <div className="font-bold text-[#101828] truncate">{p.name}</div>
                                <div className="text-[10px] text-[#667085] font-semibold">{roleLabel}</div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isOnline || p.role === 'master'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-zinc-100 text-zinc-500'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isOnline || p.role === 'master' ? 'bg-emerald-500' : 'bg-zinc-400'
                                  }`}
                                ></span>
                                {isOnline || p.role === 'master' ? 'En línea' : 'Desconectado'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ORDER CONTEXT ACCORDION (If linked to order) */}
                    {orderCommunicationContext?.order && (
                      <div className="p-3.5 rounded-2xl bg-[#FFF7D6]/60 border border-[#FFD318]/40 text-xs space-y-2">
                        <div className="flex items-center justify-between font-black text-[#101828]">
                          <span className="flex items-center gap-1.5">
                            <ShoppingBag className="w-3.5 h-3.5 text-[#05268F]" />
                            Contexto del Pedido: {orderCommunicationContext.order.order_code}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#05268F] text-[#FFD318] text-[10px]">
                            {orderCommunicationContext.order.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#101828]">
                          <div>
                            <span className="text-[#667085]">Restaurante:</span>{' '}
                            <strong>{orderCommunicationContext.order.restaurant_name}</strong>
                          </div>
                          <div>
                            <span className="text-[#667085]">Repartidor:</span>{' '}
                            <strong>{orderCommunicationContext.order.driver_name || 'Sin asignar'}</strong>
                          </div>
                          <div>
                            <span className="text-[#667085]">Total:</span>{' '}
                            <strong>${(orderCommunicationContext.order.total / 100).toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-[#667085]">Evidencias:</span>{' '}
                            <strong>{orderCommunicationContext.evidence?.length || 0} fotos</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MESSAGES THREAD (Persisted in MongoDB) */}
                    <div className="h-[360px] overflow-y-auto space-y-2.5 p-2 bg-[#F4F6F8]/60 rounded-2xl border border-[#E5E7EB]">
                      {isLoadingMessages ? (
                        <div className="py-16 text-center text-xs text-[#667085]">
                          Cargando historial de mensajes...
                        </div>
                      ) : conversationMessages.length === 0 ? (
                        <div className="py-16 text-center text-xs text-[#667085]">
                          No hay mensajes todavía en esta conversación.
                        </div>
                      ) : (
                        conversationMessages.map((msg) => {
                          const isMasterSender = msg.sender_role === 'master';
                          return (
                            <div
                              key={msg.id || msg.message_id}
                              className={`flex flex-col ${isMasterSender ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-1.5 text-[10px] text-[#667085] mb-0.5 px-1 font-semibold">
                                <span className={isMasterSender ? 'text-[#05268F] font-bold' : 'text-[#101828]'}>
                                  {msg.sender_name} ({msg.sender_role.toUpperCase()})
                                </span>
                                <span>·</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div
                                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                  isMasterSender
                                    ? 'bg-[#05268F] text-white rounded-tr-none shadow-sm'
                                    : 'bg-white text-[#101828] border border-[#E5E7EB] rounded-tl-none shadow-sm'
                                }`}
                              >
                                {msg.message}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* MESSAGE INPUT */}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Escribe una respuesta como Master NOC..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        disabled={isSendingMessage || activeConversation.status === 'closed'}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F] disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={isSendingMessage || !messageInput.trim() || activeConversation.status === 'closed'}
                        className="px-4 py-2.5 rounded-xl bg-[#05268F] text-[#FFD318] hover:bg-[#0732b3] transition text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="bg-white border border-[#E5E7EB] rounded-3xl p-12 text-center text-xs text-[#667085] space-y-3">
                    <MessageSquare className="w-10 h-10 text-[#05268F] mx-auto opacity-30" />
                    <div className="font-bold text-[#101828]">Selecciona una conversación del listado</div>
                    <p className="max-w-md mx-auto text-[11px]">
                      Puedes seleccionar una conversación existente, o abrir una comunicación vinculada a un pedido específico para supervisar a Cliente, Restaurante y Driver simultáneamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PEDIDOS (OPERACIÓN UNIVERSAL) */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#667085]" />
                <input
                  type="text"
                  placeholder="Buscar por código DIR-..., cliente o restaurante..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl bg-[#F4F6F8] text-xs font-bold border border-[#E5E7EB]"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="preparing">En preparación</option>
                  <option value="ready">Listos</option>
                  <option value="assigned">Asignados</option>
                  <option value="delivering">En camino</option>
                  <option value="delivered">Entregados</option>
                  <option value="cancelled">Cancelados</option>
                </select>

                <button
                  onClick={loadOrders}
                  className="px-3 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition"
                >
                  Filtrar
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F6F8] border-b border-[#E5E7EB] text-[10px] uppercase font-black tracking-wider text-[#667085]">
                    <tr>
                      <th className="py-3 px-4">Pedido / ID</th>
                      <th className="py-3 px-4">Restaurante</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Repartidor</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {isLoadingOrders ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          Cargando pedidos soberanos desde MongoDB...
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          No se encontraron pedidos.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-[#F4F6F8]/60 transition">
                          <td className="py-3 px-4">
                            <div className="font-black text-[#101828]">{ord.order_code || ord.id.slice(-6)}</div>
                            <div className="text-[10px] text-[#667085] font-mono">{new Date(ord.createdAt).toLocaleTimeString()}</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-[#101828]">{ord.restaurant_name}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#101828]">{ord.customer_name}</div>
                            <div className="text-[10px] text-[#667085]">{ord.customer_phone}</div>
                          </td>
                          <td className="py-3 px-4">
                            {ord.driver_name ? (
                              <span className="font-semibold text-emerald-700">{ord.driver_name}</span>
                            ) : (
                              <span className="text-[#667085] italic">Sin asignar</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#EAF0FF] text-[#05268F]">
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-[#101828]">
                            ${(ord.total / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open contextual order communication */}
                              <button
                                onClick={() => openOrderCommunication(ord.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#EAF0FF] text-[#05268F] font-bold text-[11px] hover:bg-[#d8e4ff] transition flex items-center gap-1"
                                title="Abrir Comunicación del Pedido"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Chat
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setIsOverrideModalOpen(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#F4F6F8] hover:bg-[#E5E7EB] text-[11px] font-bold text-[#101828] transition"
                              >
                                Forzar Estado
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setIsReassignModalOpen(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#FFF7D6] hover:bg-[#FFD318] text-[11px] font-bold text-[#05268F] transition"
                              >
                                Reasignar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: ALERTAS OPERATIVAS */}
        {/* ======================================================== */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  Alertas Operativas del Ecosistema
                </h2>
                <p className="text-xs text-[#667085]">
                  Detección en tiempo real de pedidos demorados, mostrador sin repartidor o flota saturada.
                </p>
              </div>
              <button
                onClick={loadOverview}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold hover:bg-[#F4F6F8] transition"
              >
                Actualizar Alertas
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview?.recent_alerts && overview.recent_alerts.length > 0 ? (
                (overview?.recent_alerts || []).map((alt: any) => (
                  <div
                    key={alt.id}
                    className="p-5 rounded-3xl bg-white border border-rose-200 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-black text-rose-700">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          {alt.title}
                        </span>
                        <span className="text-[10px] text-[#667085] font-mono">
                          {new Date(alt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#101828] mt-2 leading-relaxed">{alt.message}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E5E7EB]">
                      {alt.entity_id && (
                        <>
                          <button
                            onClick={() => openOrderCommunication(alt.entity_id)}
                            className="px-3 py-1.5 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition flex items-center gap-1 shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Ver Comunicación
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('orders');
                              setOrderSearchQuery(alt.entity_id);
                              loadOrders();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#F4F6F8] text-[#101828] text-xs font-bold hover:bg-[#E5E7EB] transition"
                          >
                            Ver Pedido
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setActiveTab('incidents');
                          setIncidentTitle(alt.title);
                          setIncidentDescription(alt.message);
                          setIncidentEntityId(alt.entity_id || 'system');
                          setIsCreateIncidentModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#FFF7D6] text-[#05268F] text-xs font-bold hover:bg-[#FFD318] transition"
                      >
                        Escalar Incidencia
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-16 text-center text-xs text-[#667085] bg-white rounded-3xl border border-[#E5E7EB]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  No hay alertas activas en este momento.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: SOPORTE & INCIDENCIAS */}
        {/* ======================================================== */}
        {activeTab === 'incidents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB]">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-[#05268F]" />
                  Centro de Soporte Operativo
                </h2>
                <p className="text-xs text-[#667085]">
                  Gestión de incidencias, tickets de soporte y auditoría de intervenciones.
                </p>
              </div>
              <button
                onClick={() => setIsCreateIncidentModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] font-bold text-xs hover:bg-[#0732b3] transition flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nueva Incidencia
              </button>
            </div>

            {/* Incidents Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Abiertas</div>
                <div className="text-xl font-black text-rose-700">{supportOverview?.counts?.open ?? 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">En Investigación</div>
                <div className="text-xl font-black text-amber-600">{supportOverview?.counts?.investigating ?? 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Resueltas</div>
                <div className="text-xl font-black text-emerald-600">{supportOverview?.counts?.resolved ?? 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Severidad Crítica</div>
                <div className="text-xl font-black text-rose-800">
                  {supportOverview?.counts?.by_severity?.critica ?? 0}
                </div>
              </div>
            </div>

            {/* Incidents Table */}
            <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F6F8] border-b border-[#E5E7EB] text-[10px] uppercase font-black tracking-wider text-[#667085]">
                    <tr>
                      <th className="py-3 px-4">Incidencia</th>
                      <th className="py-3 px-4">Entidad</th>
                      <th className="py-3 px-4">Severidad</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Reportado por</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {isLoadingIncidents ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          Cargando incidencias...
                        </td>
                      </tr>
                    ) : incidents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          No hay incidencias registradas.
                        </td>
                      </tr>
                    ) : (
                      incidents.map((inc) => (
                        <tr key={inc.id} className="hover:bg-[#F4F6F8]/60 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#101828]">{inc.title}</div>
                            <div className="text-[11px] text-[#667085] line-clamp-1">{inc.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-[#101828]">
                              {inc.entity_type.toUpperCase()}: {inc.order_code || inc.entity_id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                inc.severity === 'critica'
                                  ? 'bg-rose-100 text-rose-800'
                                  : inc.severity === 'urgente'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {inc.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inc.status === 'resolved' || inc.status === 'closed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inc.status === 'investigating'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {inc.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#667085]">{inc.reported_by?.name || 'Master'}</td>
                          <td className="py-3 px-4 text-[#667085] font-mono">
                            {new Date(inc.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {inc.status !== 'resolved' && inc.status !== 'closed' ? (
                              <button
                                onClick={() => handleResolveIncident(inc.incident_id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold transition border border-emerald-200"
                              >
                                Resolver
                              </button>
                            ) : (
                              <span className="text-emerald-600 text-xs font-bold">Resuelto ✓</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: RESTAURANTES & PERFIL COMERCIAL */}
        {/* ======================================================== */}
        {activeTab === 'restaurants' && (
          <div className="space-y-4">
            <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#05268F]" />
                  Directorio de Restaurantes & Capacidades Comerciales
                </h2>
                <p className="text-xs text-[#667085]">
                  Gestión operativa de locales y consulta de soluciones contratadas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {restaurants.map((r) => {
                const now = Date.now();
                const trialEnd = r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : null;
                const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : null;
                const isTemporarilyClosed = Boolean(r.is_temporarily_closed || !r.is_open);

                return (
                  <div key={r.id} className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <img
                          src={r.logo_url}
                          alt={r.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-[#E5E7EB] shrink-0"
                        />
                        <div className="flex-1 truncate">
                          <div className="font-black text-sm text-[#101828] truncate">{r.name}</div>
                          <div className="text-[11px] text-[#667085] truncate">{r.address}</div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="mt-3 pt-2 border-t border-[#E5E7EB] space-y-1.5 text-xs">
                        {/* Estado Operativo */}
                        <div className="flex items-center justify-between">
                          <span className="text-[#667085]">Operación:</span>
                          {isTemporarilyClosed ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              Cerrado Temp. (Fuera de Servicio)
                            </span>
                          ) : r.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              En Servicio ✓
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Suspendido por Master
                            </span>
                          )}
                        </div>

                        {/* Licencia / Suscripción */}
                        <div className="flex items-center justify-between">
                          <span className="text-[#667085]">Licencia / Pase:</span>
                          {r.subscription_status === 'active' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Suscrito ({r.subscription_plan_name || 'Plan Pro'})
                            </span>
                          ) : r.subscription_status === 'trial' ? (
                            daysLeft !== null && daysLeft > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                                Prueba ({daysLeft}d restantes)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                Prueba Vencida (Fuera de Servicio)
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              Sin Suscripción (Fuera de Servicio)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-1.5 pt-2 border-t border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenManageLicense(r)}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition text-center shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Licencia / Prueba</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenRestaurantCommercial(r)}
                          className="py-1.5 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-[#101828] transition"
                          title="Ver soluciones contratadas"
                        >
                          Capacidades
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await directApi.masterToggleRestaurant(r.id, !r.is_active);
                            addToast('success', `Restaurante ${!r.is_active ? 'activado' : 'inactivado'}`);
                            loadRestaurants();
                          }}
                          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition border ${
                            r.is_active
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={r.is_active ? 'Suspender restaurante' : 'Activar restaurante'}
                        >
                          {r.is_active ? 'Pausar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: REPARTIDORES (FLEET) */}
        {/* ======================================================== */}
        {activeTab === 'fleet' && (
          <div className="space-y-4">
            <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Bike className="w-5 h-5 text-[#05268F]" />
                  Supervisión de Flota de Repartidores
                </h2>
                <p className="text-xs text-[#667085]">
                  Control de estado de disponibilidad, verificación de cuentas y telemetría.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fleet.map((d) => (
                <div key={d.id} className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={d.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                      alt={d.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-[#E5E7EB]"
                    />
                    <div className="flex-1 truncate">
                      <div className="font-black text-sm text-[#101828] truncate">{d.name}</div>
                      <div className="text-[11px] text-[#667085]">{d.phone}</div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs py-2 border-y border-[#E5E7EB]">
                    <div className="flex justify-between">
                      <span className="text-[#667085]">Disponibilidad:</span>
                      <span className="font-bold text-[#05268F] uppercase">{d.driver_status || 'offline'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#667085]">Transporte:</span>
                      <span className="font-bold text-[#101828] capitalize">
                        {d.vehicle_type || 'Motocicleta'} ({d.vehicle_info || 'Estándar'})
                      </span>
                    </div>
                    {d.documents && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[#667085]">Expediente:</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          d.documents.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {d.documents.status === 'approved' ? 'Aprobado ✓' : 'Documentos Cargados'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDirectTargetUserId(d.id);
                        setIsDirectChatModalOpen(true);
                      }}
                      className="flex-1 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition text-center shadow-sm"
                    >
                      Contactar Driver
                    </button>
                    <button
                      onClick={async () => {
                        await directApi.masterUpdateDriver(d.id, { is_verified: !d.is_verified });
                        addToast('success', `Verificación de ${d.name} actualizada`);
                        loadFleet();
                      }}
                      className="py-2 px-3 rounded-xl bg-[#F4F6F8] hover:bg-[#E5E7EB] text-xs font-bold text-[#101828] transition"
                    >
                      {d.is_verified ? 'Verificado ✓' : 'Verificar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: USUARIOS (CLIENTES & CUENTAS) */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#667085]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl bg-[#F4F6F8] text-xs font-bold border border-[#E5E7EB]"
                >
                  <option value="all">Todos los roles</option>
                  <option value="customer">Clientes</option>
                  <option value="restaurant">Restaurantes</option>
                  <option value="driver">Repartidores</option>
                  <option value="master">Master</option>
                </select>

                <button
                  onClick={loadUsers}
                  className="px-3 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition"
                >
                  Filtrar
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4F6F8] border-b border-[#E5E7EB] text-[10px] uppercase font-black tracking-wider text-[#667085]">
                  <tr>
                    <th className="py-3 px-4">Nombre / Teléfono</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Creado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F4F6F8]/60 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#101828]">{u.name}</div>
                        <div className="text-[10px] text-[#667085]">{u.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-[#667085]">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#EAF0FF] text-[#05268F]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={u.is_active ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                          {u.is_active ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#667085] font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setDirectTargetUserId(u.id);
                            setIsDirectChatModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#05268F] text-[#FFD318] text-[11px] font-bold hover:bg-[#0732b3] transition shadow-sm"
                        >
                          Chat Directo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: SOLUCIONES (CATÁLOGO COMERCIAL SEPARADO) */}
        {/* ======================================================== */}
        {activeTab === 'solutions' && (
          <div className="space-y-6">
            <div className="bg-[#F4F6F8] p-5 rounded-3xl border border-[#E5E7EB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#05268F]" />
                  Catálogo de Soluciones Comerciales
                </h2>
                <p className="text-xs text-[#667085]">
                  Capacidades del ecosistema separadas rigurosamente entre DIRECTAURANTE y DIRECTPOST.
                </p>
              </div>

              {/* Product Selector */}
              <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-[#E5E7EB]">
                <button
                  onClick={() => setCommercialProductTab('directaurante')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    commercialProductTab === 'directaurante'
                      ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                      : 'text-[#667085] hover:text-[#101828]'
                  }`}
                >
                  DIRECTAURANTE (9)
                </button>
                <button
                  onClick={() => setCommercialProductTab('directpost')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                    commercialProductTab === 'directpost'
                      ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                      : 'text-[#667085] hover:text-[#101828]'
                  }`}
                >
                  DIRECTPOST (14)
                </button>
              </div>
            </div>

            {/* Solutions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {solutions
                .filter((s) => s.product === commercialProductTab)
                .map((sol) => (
                  <div
                    key={sol.solution_id}
                    className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF0FF] text-[#05268F]">
                          {sol.category}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            sol.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {sol.status === 'active' ? 'Activa Core' : 'Catálogo'}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-[#101828]">{sol.name}</h3>
                      <p className="text-xs text-[#667085] mt-1 leading-relaxed">{sol.description}</p>

                      <div className="mt-3 space-y-1">
                        {sol.features?.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[#101828]">
                            <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[10px] text-[#667085]">Precio futuro estimado:</div>
                        <div className="font-black text-[#101828]">
                          ${(sol.price_cents / 100).toFixed(2)} MXN / mes
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#667085]">v{sol.version}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 10: PLANES COMERCIALES */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* TAB 10: PLANES COMERCIALES Y SUSCRIPCIONES */}
        {/* ======================================================== */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="bg-[#F4F6F8] p-5 rounded-3xl border border-[#E5E7EB] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#05268F]" />
                  Planes Comerciales y Gestión Integral de Suscripciones
                </h2>
                <p className="text-xs text-[#667085]">
                  Controla, crea y edita completamente los planes comerciales y las suscripciones individuales de todos los restaurantes.
                </p>
              </div>

              {/* Sub-view Switch */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#E5E7EB] shadow-xs">
                  <button
                    onClick={() => setPlansViewTab('catalog')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      plansViewTab === 'catalog'
                        ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                        : 'text-[#667085] hover:text-[#101828]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Catálogo de Planes ({plans.length})</span>
                  </button>
                  <button
                    onClick={() => setPlansViewTab('restaurants')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      plansViewTab === 'restaurants'
                        ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                        : 'text-[#667085] hover:text-[#101828]'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Suscripciones de Restaurantes ({restaurants.length})</span>
                  </button>
                </div>

                {plansViewTab === 'catalog' && (
                  <button
                    onClick={handleOpenCreatePlan}
                    className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-black hover:bg-[#0732b3] transition shadow-md flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Nuevo Plan</span>
                  </button>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SUB-VISTA 1: CATÁLOGO DE PLANES COMERCIALES */}
            {/* ======================================================== */}
            {plansViewTab === 'catalog' && (
              <div className="space-y-6">
                {/* Product Selector for Catalog */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#E5E7EB]">
                    <button
                      onClick={() => setCommercialProductTab('directaurante')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                        commercialProductTab === 'directaurante'
                          ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                          : 'text-[#667085] hover:text-[#101828]'
                      }`}
                    >
                      DIRECTAURANTE ({plans.filter((p) => p.product === 'directaurante').length})
                    </button>
                    <button
                      onClick={() => setCommercialProductTab('directpost')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                        commercialProductTab === 'directpost'
                          ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                          : 'text-[#667085] hover:text-[#101828]'
                      }`}
                    >
                      DIRECTPOST ({plans.filter((p) => p.product === 'directpost').length})
                    </button>
                  </div>

                  <span className="text-xs text-[#667085]">
                    Haz clic en <strong>"Editar Plan"</strong> o <strong>"Duplicar"</strong> para modificar cualquier parámetro.
                  </span>
                </div>

                {/* CONFIGURACIÓN GLOBAL DE PRUEBA (15 DÍAS) PARA NUEVOS RESTAURANTES */}
                <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50/80 via-white to-amber-50/50 border border-blue-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[#101828]">
                          Condición de Licencias de Prueba para Nuevos Restaurantes
                        </h3>
                        <p className="text-xs text-[#667085]">
                          Define los días de gracia iniciales. Al caducar, el restaurante pasará automáticamente a estado "Fuera de Servicio" para los clientes hasta contratar una suscripción.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveTrialConfig}
                      disabled={isSavingTrialConfig}
                      className="px-4 py-2 rounded-xl bg-[#05268F] text-white text-xs font-bold hover:bg-[#0732b3] transition shadow-sm disabled:opacity-50"
                    >
                      {isSavingTrialConfig ? 'Guardando...' : 'Guardar Configuración de Prueba'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB]">
                      <label className="block text-xs font-bold text-[#101828] mb-1">
                        Días de Prueba Gratuita Inicial (Default: 15 días):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={editDefaultTrialDays}
                          onChange={(e) => setEditDefaultTrialDays(Math.max(1, parseInt(e.target.value, 10) || 15))}
                          className="w-28 p-2 rounded-xl bg-[#F4F6F8] text-xs font-bold border border-[#E5E7EB] text-[#101828] text-center focus:outline-none focus:border-[#05268F]"
                        />
                        <span className="text-xs text-[#667085]">días de acceso completo para nuevos registros</span>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-bold text-[#101828]">Exigir Suscripción / Pase Válido:</span>
                        <span className="text-[11px] text-[#667085]">
                          Si caduca la prueba, mostrar tarjeta como "Fuera de Servicio"
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditEnforceSubscription(!editEnforceSubscription)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          editEnforceSubscription ? 'bg-emerald-600' : 'bg-zinc-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            editEnforceSubscription ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* LISTADO Y TARJETAS DE PLANES EDITABLES */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans
                    .filter((p) => p.product === commercialProductTab)
                    .map((plan) => (
                      <div
                        key={plan.plan_id}
                        className="p-6 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#EAF0FF] text-[#05268F]">
                              {plan.product.toUpperCase()}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                plan.status === 'active'
                                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                  : 'text-zinc-600 bg-zinc-100 border border-zinc-200'
                              }`}
                            >
                              {plan.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-lg font-black text-[#101828]">{plan.name}</h3>
                            <span className="text-[10px] text-[#667085] font-mono">ID: {plan.plan_id}</span>
                          </div>
                          <p className="text-xs text-[#667085] mt-1 line-clamp-2">{plan.description}</p>

                          <div className="my-4">
                            <div className="text-2xl font-black text-[#05268F]">
                              ${(plan.price_cents / 100).toFixed(2)}{' '}
                              <span className="text-xs font-normal text-[#667085]">
                                MXN / {plan.billing_period === 'annual' ? 'año' : plan.billing_period === 'quarterly' ? 'trimestre' : plan.billing_period === 'lifetime' ? 'vitalicio' : 'mes'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-[#E5E7EB]">
                            <div className="text-[11px] font-black uppercase text-[#667085]">
                              Soluciones incluidas ({(plan.included_solutions || []).length}):
                            </div>
                            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                              {(plan.included_solutions || []).map((solId) => {
                                const solObj = solutions.find((s) => s.solution_id === solId);
                                return (
                                  <div key={solId} className="flex items-center gap-1.5 text-xs text-[#101828]">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    <span className="truncate">{solObj?.name || solId}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-[#E5E7EB]">
                          <div className="text-[11px] text-[#667085] bg-[#F4F6F8] p-2.5 rounded-xl space-y-0.5">
                            <div>
                              <strong>Pedidos:</strong> {plan?.limits?.max_orders_month ? `${plan.limits.max_orders_month}/mes` : 'Ilimitados'}
                            </div>
                            <div>
                              <strong>Carta:</strong> {plan?.limits?.max_products ? `${plan.limits.max_products} productos` : 'Ilimitados'} ·{' '}
                              <strong>Personal:</strong> {plan?.limits?.max_staff ? `${plan.limits.max_staff} empleados` : 'Ilimitado'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-between">
                            <button
                              type="button"
                              onClick={() => handleOpenEditPlan(plan)}
                              className="flex-1 py-1.5 px-3 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition flex items-center justify-center gap-1 shadow-sm"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Editar Plan</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicatePlan(plan)}
                              className="p-2 rounded-xl text-xs font-bold bg-[#F4F6F8] text-[#101828] border border-[#E5E7EB] hover:bg-white transition"
                              title="Duplicar / Clonar Plan"
                            >
                              <Copy className="w-4 h-4 text-[#05268F]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePlanStatus(plan)}
                              className={`p-2 rounded-xl text-xs font-bold transition border ${
                                plan.status === 'active'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={plan.status === 'active' ? 'Pausar Plan' : 'Activar Plan'}
                            >
                              {plan.status === 'active' ? (
                                <PauseCircle className="w-4 h-4" />
                              ) : (
                                <PlayCircle className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePlan(plan)}
                              className="p-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                              title="Eliminar Plan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-VISTA 2: GESTOR COMPLETO DE SUSCRIPCIONES DE RESTAURANTES */}
            {/* ======================================================== */}
            {plansViewTab === 'restaurants' && (
              <div className="space-y-6">
                {/* Métricas Resumen de Suscripciones */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
                    <div className="text-xs text-[#667085] font-semibold">Suscripciones Activas</div>
                    <div className="text-xl font-black text-emerald-700">
                      {restaurants.filter((r) => r.subscription_status === 'active' || r.subscription_status === 'lifetime').length}
                    </div>
                    <span className="text-[10px] text-emerald-600">Al día con servicio</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
                    <div className="text-xs text-[#667085] font-semibold">En Prueba (Trials)</div>
                    <div className="text-xl font-black text-amber-600">
                      {restaurants.filter((r) => r.subscription_status === 'trial').length}
                    </div>
                    <span className="text-[10px] text-amber-700">Días de gracia vigentes</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
                    <div className="text-xs text-[#667085] font-semibold">Pases Caducados / Expirados</div>
                    <div className="text-xl font-black text-rose-600">
                      {restaurants.filter((r) => r.subscription_status === 'expired' || (!r.subscription_status && r.is_out_of_service)).length}
                    </div>
                    <span className="text-[10px] text-rose-700">Fuera de servicio</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
                    <div className="text-xs text-[#667085] font-semibold">Vitalicios / Cortesía</div>
                    <div className="text-xl font-black text-[#05268F]">
                      {restaurants.filter((r) => r.subscription_status === 'lifetime').length}
                    </div>
                    <span className="text-[10px] text-blue-600">Sin caducidad</span>
                  </div>
                </div>

                {/* Filtros de Búsqueda y Estado */}
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar restaurante por nombre o ID..."
                      value={restaurantSubSearch}
                      onChange={(e) => setRestaurantSubSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-[#667085]" />
                    <select
                      value={restaurantSubFilterStatus}
                      onChange={(e) => setRestaurantSubFilterStatus(e.target.value)}
                      className="py-2 px-3 rounded-xl bg-[#F4F6F8] text-xs font-bold border border-[#E5E7EB] text-[#101828]"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="active">Suscripción Activa</option>
                      <option value="trial">Pase de Prueba</option>
                      <option value="lifetime">Vitalicio</option>
                      <option value="paused">Pausada</option>
                      <option value="expired">Caducada / Expirada</option>
                    </select>
                  </div>
                </div>

                {/* Tabla Detallada de Suscripciones por Restaurante */}
                <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F4F6F8] border-b border-[#E5E7EB] text-[10px] uppercase font-black tracking-wider text-[#667085]">
                        <tr>
                          <th className="py-3.5 px-4">Restaurante</th>
                          <th className="py-3.5 px-4">Estado Suscripción</th>
                          <th className="py-3.5 px-4">Plan & Tarifa</th>
                          <th className="py-3.5 px-4">Vigencia / Vencimiento</th>
                          <th className="py-3.5 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {restaurants
                          .filter((r) => {
                            if (restaurantSubSearch.trim()) {
                              const q = restaurantSubSearch.toLowerCase();
                              const matchName = r.name.toLowerCase().includes(q);
                              const matchId = r.id.toLowerCase().includes(q);
                              if (!matchName && !matchId) return false;
                            }
                            if (restaurantSubFilterStatus !== 'all') {
                              const st = (r.subscription_status as any) || 'trial';
                              if (st !== restaurantSubFilterStatus) return false;
                            }
                            return true;
                          })
                          .map((r) => {
                            const now = Date.now();
                            const trialEnd = r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : 0;
                            const subEnd = r.subscription_ends_at ? new Date(r.subscription_ends_at).getTime() : 0;
                            const trialDaysLeft = Math.ceil((trialEnd - now) / 86400000);
                            const subDaysLeft = Math.ceil((subEnd - now) / 86400000);

                            return (
                              <tr key={r.id} className="hover:bg-[#F4F6F8]/60 transition">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    {r.logo_url ? (
                                      <img
                                        src={r.logo_url}
                                        alt={r.name}
                                        className="w-9 h-9 rounded-xl object-cover border border-[#E5E7EB] shrink-0"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-black text-xs shrink-0">
                                        {r.name.slice(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-bold text-[#101828] text-sm flex items-center gap-2">
                                        <span>{r.name}</span>
                                        {r.is_temporarily_closed && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                            Cerrado temp.
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-[#667085] flex items-center gap-1.5">
                                        <span className="font-mono">ID: {r.id}</span>
                                        <span>·</span>
                                        <span>{r.address}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  {r.subscription_status === 'active' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <Check className="w-3 h-3" />
                                      <span>Activa</span>
                                    </span>
                                  ) : r.subscription_status === 'lifetime' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-[#05268F] border border-blue-200">
                                      <InfinityIcon className="w-3 h-3" />
                                      <span>Vitalicia</span>
                                    </span>
                                  ) : r.subscription_status === 'trial' ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                        trialDaysLeft > 0
                                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                                          : 'bg-rose-100 text-rose-800 border-rose-200'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3" />
                                      <span>{trialDaysLeft > 0 ? `Prueba (${trialDaysLeft}d)` : 'Prueba Vencida'}</span>
                                    </span>
                                  ) : r.subscription_status === 'paused' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-zinc-100 text-zinc-700 border border-zinc-300">
                                      <PauseCircle className="w-3 h-3" />
                                      <span>Pausada</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                      <Ban className="w-3 h-3" />
                                      <span>Caducada / Fuera Servicio</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-[#101828]">
                                    {r.subscription_plan_name || 'Plan Estándar'}
                                  </div>
                                  <div className="text-[11px] text-[#667085]">
                                    {r.subscription_price_cents !== undefined && r.subscription_price_cents !== null
                                      ? `$${(r.subscription_price_cents / 100).toFixed(2)} MXN`
                                      : 'Tarifa de catálogo'}{' '}
                                    <span className="text-[10px]">
                                      ({r.subscription_billing_period || 'mensual'})
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  {r.subscription_status === 'lifetime' ? (
                                    <span className="text-[11px] font-bold text-[#05268F]">Permanente (Sin caducidad)</span>
                                  ) : r.subscription_status === 'active' ? (
                                    <div>
                                      {r.subscription_ends_at ? (
                                        <>
                                          <div className="font-bold text-[#101828]">
                                            {new Date(r.subscription_ends_at).toLocaleDateString()}
                                          </div>
                                          <div className={`text-[10px] font-semibold ${subDaysLeft > 5 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                            {subDaysLeft > 0 ? `${subDaysLeft} días restantes` : 'Vencida hoy'}
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-xs text-[#667085]">Renovación mensual continua</span>
                                      )}
                                    </div>
                                  ) : r.subscription_status === 'trial' ? (
                                    <div>
                                      {r.trial_ends_at ? (
                                        <>
                                          <div className="font-bold text-[#101828]">
                                            {new Date(r.trial_ends_at).toLocaleDateString()}
                                          </div>
                                          <div className={`text-[10px] font-semibold ${trialDaysLeft > 3 ? 'text-amber-700' : 'text-rose-600'}`}>
                                            {trialDaysLeft > 0 ? `${trialDaysLeft} días de gracia` : 'Expiró'}
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-xs text-[#667085]">15 días iniciales</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-rose-700 font-bold">Vencida / Inactiva</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenManageLicense(r)}
                                      className="px-3 py-1.5 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition shadow-xs flex items-center gap-1"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      <span>Editar Suscripción Completa</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleQuickRenewSubscription(r, 30)}
                                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition"
                                      title="Añadir +30 días a la vigencia actual"
                                    >
                                      +30d
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleRestaurantSubscriptionPause(r)}
                                      className={`p-1.5 rounded-xl border text-xs font-bold transition ${
                                        r.subscription_status === 'paused'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                          : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                                      }`}
                                      title={r.subscription_status === 'paused' ? 'Reactivar Suscripción' : 'Pausar Suscripción'}
                                    >
                                      {r.subscription_status === 'paused' ? (
                                        <PlayCircle className="w-4 h-4" />
                                      ) : (
                                        <PauseCircle className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 11: ENTITLEMENTS (CENTRO COMERCIAL MASTER) */}
        {/* ======================================================== */}
        {activeTab === 'entitlements' && (
          <div className="space-y-6">
            <div className="bg-[#F4F6F8] p-5 rounded-3xl border border-[#E5E7EB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#05268F]" />
                  Centro Comercial & Funciones Incluidas 24/7
                </h2>
                <p className="text-xs text-[#667085]">
                  Control autoritativo de capacidades activas, planes asignados y trials de 30 días en backend.
                </p>
              </div>
            </div>

            {/* Commercial Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Con Directaurante</div>
                <div className="text-xl font-black text-[#05268F]">
                  {commercialOverview?.restaurants?.with_directaurante ?? 0}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Con DirectPost</div>
                <div className="text-xl font-black text-[#101828]">
                  {commercialOverview?.restaurants?.with_directpost ?? 0}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Períodos de Prueba (Trials)</div>
                <div className="text-xl font-black text-amber-600">
                  {commercialOverview?.solutions?.trials_count ?? 0} activos
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Capacidades Suspendidas</div>
                <div className="text-xl font-black text-rose-700">
                  {commercialOverview?.solutions?.suspended_count ?? 0}
                </div>
              </div>
            </div>

            {/* Restaurant Entitlements Inspector */}
            <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-sm font-black text-[#101828]">
                  Capacidades por Restaurante
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRestaurantForCommercial?.id || ''}
                    onChange={(e) => {
                      const found = restaurants.find((r) => r.id === e.target.value);
                      if (found) handleOpenRestaurantCommercial(found);
                    }}
                    className="py-1.5 px-3 rounded-xl bg-[#F4F6F8] text-xs font-bold border border-[#E5E7EB]"
                  >
                    <option value="">Selecciona un restaurante...</option>
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  {selectedRestaurantForCommercial && (
                    <>
                      <button
                        onClick={() => handleOpenManageLicense(selectedRestaurantForCommercial)}
                        className="px-3 py-1.5 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition shadow-sm flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Licencia / Pase de Prueba</span>
                      </button>
                      <button
                        onClick={() => setIsAssignPlanModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-100 text-[#101828] text-xs font-bold hover:bg-zinc-200 transition"
                      >
                        Asignar Plan
                      </button>
                      <button
                        onClick={() => setIsGrantTrialModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-[#FFF7D6] text-[#05268F] text-xs font-bold hover:bg-[#FFD318] transition"
                      >
                        Trial Capacidad
                      </button>
                    </>
                  )}
                </div>
              </div>

              {selectedRestaurantForCommercial ? (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB] flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-[#101828]">{selectedRestaurantForCommercial.name}</h4>
                      <p className="text-xs text-[#667085]">
                        ID: {selectedRestaurantForCommercial.id} · {selectedRestaurantForCommercial.address}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#05268F]">
                      {restaurantEntitlements.length} capacidades registradas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {restaurantEntitlements.map((ent) => {
                      const isActive = ent.status === 'ACTIVE' || ent.status === 'TRIAL';
                      return (
                        <div
                          key={ent.solution_id}
                          className="p-4 rounded-2xl bg-white border border-[#E5E7EB] space-y-2 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-[#05268F] bg-[#EAF0FF] px-2 py-0.5 rounded">
                                {ent.product}
                              </span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  ent.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ent.status === 'TRIAL'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {ent.status}
                              </span>
                            </div>
                            <div className="font-bold text-xs text-[#101828] mt-1">{ent.solution_name}</div>
                            <div className="text-[11px] text-[#667085] line-clamp-1">{ent.solution_description}</div>
                            {ent.trial_end && (
                              <div className="text-[10px] text-amber-700 font-semibold mt-1">
                                Trial hasta: {new Date(ent.trial_end).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                            <span className="text-[10px] text-[#667085]">Origen: {ent.source}</span>
                            <button
                              onClick={() => handleToggleEntitlement(ent.solution_id, ent.status)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                                isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isActive ? 'Suspender' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#667085]">
                  Selecciona un restaurante arriba para consultar sus soluciones contratadas y administrar planes.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 12: FINANZAS (VISTA COMERCIAL PREPARADA SIN MP) */}
        {/* ======================================================== */}
        {activeTab === 'finances' && (
          <div className="space-y-6">
            <div className="bg-[#F4F6F8] p-5 rounded-3xl border border-[#E5E7EB]">
              <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#05268F]" />
                Métricas Financieras del Ecosistema
              </h2>
              <p className="text-xs text-[#667085]">
                Cálculo soberano en backend. Integración de pagos con Mercado Pago reservada para fase posterior.
              </p>
            </div>

            {/* Quick banner: Comisiones y Tarifas */}
            <div className="bg-gradient-to-r from-[#EAF0FF] to-white p-4 rounded-2xl border border-[#05268F]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-black">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#101828]">
                    Tarifas Activas: Comisión Restaurante ${((financialConfig?.restaurant_commission_cents ?? 1000) / 100).toFixed(2)} MXN · Pago a Repartidor ${((financialConfig?.driver_payment_cents ?? 2000) / 100).toFixed(2)} MXN
                  </h4>
                  <p className="text-[11px] text-[#667085]">
                    Tarifa base cliente: ${((financialConfig?.default_delivery_fee_cents ?? 2500) / 100).toFixed(2)} MXN · Estado comisión: {financialConfig?.is_commission_active !== false ? 'Activo' : 'Pausado'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFinancialModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] text-xs font-bold transition shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Modificar Comisiones</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Facturación de Pedidos Acumulada</div>
                <div className="text-2xl font-black text-[#05268F] mt-1">
                  ${((overview?.metrics?.revenue?.total_cents || 0) / 100).toFixed(2)} MXN
                </div>
                <div className="text-[11px] text-[#667085] mt-1">Solo pedidos entregados</div>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Facturación del Día</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  ${((overview?.metrics?.revenue?.today_cents || 0) / 100).toFixed(2)} MXN
                </div>
                <div className="text-[11px] text-[#667085] mt-1">Desde 00:00 hrs</div>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm">
                <div className="text-xs text-[#667085] font-semibold">Ticket Promedio</div>
                <div className="text-2xl font-black text-[#101828] mt-1">
                  ${((overview?.metrics?.revenue?.average_order_cents || 0) / 100).toFixed(2)} MXN
                </div>
                <div className="text-[11px] text-[#667085] mt-1">Por pedido finalizado</div>
              </div>
            </div>

            {/* RECONCILIACIÓN Y DEPÓSITOS DE REPARTIDORES (CONTROL DE ARQUEO) */}
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#101828] flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#05268F]" />
                    Control de Arqueo y Depósitos de Repartidores
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Validación de efectivo cobrado, comprobantes de depósito bancario y saldos a favor o en deuda.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={settlementDepositFilter}
                    onChange={(e) => setSettlementDepositFilter(e.target.value)}
                    className="py-1.5 px-3 rounded-xl bg-[#F4F6F8] text-xs font-bold border border-[#E5E7EB] text-[#101828]"
                  >
                    <option value="all">Todos los depósitos</option>
                    <option value="deposit_uploaded">Por comprobar / Revisar</option>
                    <option value="confirmed">Confirmados</option>
                    <option value="pending_proof">Pendientes de subir</option>
                    <option value="rejected">Rechazados</option>
                  </select>

                  <button
                    onClick={loadSettlements}
                    className="p-2 rounded-xl bg-[#05268F] text-[#FFD318] hover:bg-[#0732b3] transition shadow-xs"
                    title="Actualizar liquidaciones"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isLoadingSettlements ? (
                <div className="py-8 text-center text-xs text-[#667085]">
                  Cargando liquidaciones y comprobantes...
                </div>
              ) : masterSettlements.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#667085]">
                  No hay liquidaciones de repartidores registradas con los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4F6F8] border-b border-[#E5E7EB] text-[10px] uppercase font-black tracking-wider text-[#667085]">
                      <tr>
                        <th className="py-3 px-4">Corte / Fecha</th>
                        <th className="py-3 px-4">Repartidor</th>
                        <th className="py-3 px-4">Cobrado en Mano</th>
                        <th className="py-3 px-4">Ganancia Repartidor</th>
                        <th className="py-3 px-4">Estado Financiero</th>
                        <th className="py-3 px-4">Comprobante</th>
                        <th className="py-3 px-4 text-right">Acción Master</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {masterSettlements.map((set) => {
                        const netBal = set.net_balance / 100;
                        const isDebt = netBal > 0;
                        const isFavor = netBal < 0;

                        return (
                          <tr key={set.id} className="hover:bg-[#F4F6F8]/60 transition">
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-[#101828]">#{set.id.slice(-6)}</span>
                              <div className="text-[10px] text-[#667085]">{new Date(set.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#101828]">{set.driver_name}</div>
                              <div className="text-[10px] text-[#667085] font-mono">{set.driver_phone || set.driver_id}</div>
                            </td>
                            <td className="py-3 px-4 font-black font-mono text-amber-800">
                              ${((set.cash_collected || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 font-black font-mono text-emerald-700">
                              ${((set.earnings_total || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              {isDebt ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                  Deuda ${netBal.toFixed(2)}
                                </span>
                              ) : isFavor ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                  Saldo a Favor ${Math.abs(netBal).toFixed(2)}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#F4F6F8] text-[#667085]">
                                  Saldado $0.00
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {set.deposit_proof_url ? (
                                <button
                                  onClick={() => setSelectedEvidencePreview(set.deposit_proof_url)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-[#05268F] hover:underline"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>Ver Foto</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#667085] italic">Sin foto</span>
                              )}
                              <div className="mt-0.5">
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                    set.deposit_status === 'confirmed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : set.deposit_status === 'deposit_uploaded'
                                      ? 'bg-blue-100 text-[#05268F]'
                                      : set.deposit_status === 'rejected'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {set.deposit_status === 'confirmed'
                                    ? 'Confirmado'
                                    : set.deposit_status === 'deposit_uploaded'
                                    ? 'Por Comprobar'
                                    : set.deposit_status === 'rejected'
                                    ? 'Rechazado'
                                    : 'Pendiente'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {set.deposit_status === 'deposit_uploaded' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openReviewModal(set)}
                                    className="px-2.5 py-1 rounded-lg bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-bold text-[10px] shadow-xs transition"
                                  >
                                    Validar / Diferencias
                                  </button>
                                  <button
                                    onClick={() => handleReviewDeposit(set.id, 'confirmed')}
                                    disabled={isReviewingDepositId === set.id}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition"
                                    title="Aprobación directa"
                                  >
                                    Aprobar
                                  </button>
                                </div>
                              ) : set.deposit_status === 'confirmed' ? (
                                <div className="text-right">
                                  <span className="text-[11px] font-bold text-emerald-700 block">Validado ✓</span>
                                  {set.discrepancy_amount ? (
                                    <span className="text-[9px] font-bold text-amber-700">
                                      Dif: ${(set.discrepancy_amount / 100).toFixed(2)}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <button
                                  onClick={() => openReviewModal(set)}
                                  className="text-[10px] font-bold text-[#667085] hover:text-[#05268F] underline"
                                >
                                  Detalles
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm space-y-3">
              <h3 className="text-sm font-black text-[#101828]">Arquitectura de Pagos (Preparada)</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                El sistema mantiene la separación estricta: los planes y entitlements están estructurados en MongoDB para asociarse a suscripciones sin acoplamiento a pasarelas de pago.
              </p>
              <div className="p-4 rounded-2xl bg-[#EAF0FF] border border-[#05268F]/20 text-xs font-mono text-[#05268F]">
                Flujo Futuro: Mercado Pago → Payment Service → Core → Subscription → Plan → Entitlements → Restaurant
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: COMISIONES & TARIFA AL REPARTIDOR */}
        {/* ======================================================== */}
        {activeTab === 'commissions' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-[#F4F6F8] p-5 rounded-3xl border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Percent className="w-5 h-5 text-[#05268F]" />
                  Gestión de Comisión por Venta y Costo de Envío para Repartidores
                </h2>
                <p className="text-xs text-[#667085] mt-0.5">
                  Modifica de forma centralizada la comisión cobrada a los restaurantes por cada venta y la tarifa de envío otorgada al repartidor.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadFinancialConfig}
                  disabled={isLoadingFinancialConfig}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-zinc-50 border border-[#E5E7EB] text-xs font-bold text-[#101828] shadow-xs transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFinancialConfig ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
                <button
                  onClick={() => setIsFinancialModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] text-xs font-bold shadow-md transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Modificar Tarifas
                </button>
              </div>
            </div>

            {/* Current Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Comisión por Venta a Restaurante */}
              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#667085] font-semibold">Comisión por Venta (Restaurante)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      financialConfig?.is_commission_active !== false
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {financialConfig?.is_commission_active !== false ? 'Activa' : 'Pausada'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#05268F] mt-2">
                    ${((financialConfig?.restaurant_commission_cents ?? 1000) / 100).toFixed(2)} MXN
                  </div>
                  <p className="text-[11px] text-[#667085] mt-1">
                    Cobrado al restaurante por cada pedido completado
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F4F6F8] flex items-center justify-between text-[11px]">
                  <span className="text-[#667085]">Modo:</span>
                  <span className="font-bold text-[#101828]">Por Venta / Pedido</span>
                </div>
              </div>

              {/* Card 2: Costo de Envío al Repartidor */}
              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#667085] font-semibold">Costo de Envío (Al Repartidor)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-[#05268F]">
                      Pago Repartidor
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mt-2">
                    ${((financialConfig?.driver_payment_cents ?? 2000) / 100).toFixed(2)} MXN
                  </div>
                  <p className="text-[11px] text-[#667085] mt-1">
                    Ganancia fija correspondiente al repartidor por entrega
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F4F6F8] flex items-center justify-between text-[11px]">
                  <span className="text-[#667085]">Asignación:</span>
                  <span className="font-bold text-emerald-700">100% al repartidor (+ propinas)</span>
                </div>
              </div>

              {/* Card 3: Tarifa Base al Comensal */}
              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#667085] font-semibold">Tarifa de Envío al Cliente</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      Cobro Cliente
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#101828] mt-2">
                    ${((financialConfig?.default_delivery_fee_cents ?? 2500) / 100).toFixed(2)} MXN
                  </div>
                  <p className="text-[11px] text-[#667085] mt-1">
                    Costo estándar cargado al comensal en checkout
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F4F6F8] flex items-center justify-between text-[11px]">
                  <span className="text-[#667085]">Margen Logístico:</span>
                  <span className="font-bold text-[#05268F]">
                    +${(((financialConfig?.default_delivery_fee_cents ?? 2500) - (financialConfig?.driver_payment_cents ?? 2000)) / 100).toFixed(2)} MXN
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Edit Form Container */}
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
                <div>
                  <h3 className="text-sm font-black text-[#101828] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#05268F]" />
                    Modificar Valores Financieros
                  </h3>
                  <p className="text-xs text-[#667085]">
                    Ajusta los montos y guarda directamente para aplicar a las nuevas órdenes.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveFinancialConfig} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Campo 1: Comisión por Venta */}
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                    <label className="text-xs font-bold text-[#1E293B] block">
                      Cobro de Comisión por Venta (Restaurante)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={editCommissionPesos}
                        onChange={(e) => setEditCommissionPesos(e.target.value)}
                        placeholder="10.00"
                        className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-8 pr-16 py-2.5 text-sm font-black text-[#0F172A] focus:outline-none focus:border-[#05268F] focus:ring-1 focus:ring-[#05268F]"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Monto en pesos descontado al restaurante por cada pedido.
                    </p>
                  </div>

                  {/* Campo 2: Costo de Envío al Repartidor */}
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                    <label className="text-xs font-bold text-[#1E293B] block">
                      Costo de Envío para el Repartidor
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={editDriverPayPesos}
                        onChange={(e) => setEditDriverPayPesos(e.target.value)}
                        placeholder="20.00"
                        className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-8 pr-16 py-2.5 text-sm font-black text-[#0F172A] focus:outline-none focus:border-[#05268F] focus:ring-1 focus:ring-[#05268F]"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Tarifa transferida al conductor por viaje finalizado.
                    </p>
                  </div>

                  {/* Campo 3: Tarifa Base al Cliente */}
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                    <label className="text-xs font-bold text-[#1E293B] block">
                      Tarifa Base de Envío al Cliente
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={editDeliveryFeePesos}
                        onChange={(e) => setEditDeliveryFeePesos(e.target.value)}
                        placeholder="25.00"
                        className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-8 pr-16 py-2.5 text-sm font-black text-[#0F172A] focus:outline-none focus:border-[#05268F] focus:ring-1 focus:ring-[#05268F]"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Costo mostrado al comensal para entrega a domicilio.
                    </p>
                  </div>
                </div>

                {/* Toggle Estado de Comisión */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] block">
                      Cobro de Comisión Activo
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      Si se desactiva, los restaurantes no pagarán comisión por venta temporalmente.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditCommissionActive(!editCommissionActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editCommissionActive ? 'bg-[#05268F]' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editCommissionActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingFinancialConfig}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] text-xs font-bold transition shadow-md disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingFinancialConfig ? 'Guardando...' : 'Guardar Nuevas Tarifas'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Simulador Interactivo de Flujo Financiero por Pedido */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-[#1E293B] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#05268F]" />
                Simulador de Flujo Financiero por Orden (Ejemplo con Venta de $250.00 MXN)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block font-semibold">Subtotal Platillos</span>
                  <span className="text-base font-black text-[#1E293B]">$250.00 MXN</span>
                  <span className="text-[10px] text-[#64748B] block mt-1">Cobrado por la comida</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block font-semibold">Comisión Restaurante</span>
                  <span className="text-base font-black text-rose-600">
                    -${editCommissionActive ? (parseFloat(editCommissionPesos) || 0).toFixed(2) : '0.00'} MXN
                  </span>
                  <span className="text-[10px] text-[#64748B] block mt-1">
                    Restaurante neto: ${(250 - (editCommissionActive ? (parseFloat(editCommissionPesos) || 0) : 0)).toFixed(2)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block font-semibold">Pago al Repartidor</span>
                  <span className="text-base font-black text-emerald-600">
                    ${(parseFloat(editDriverPayPesos) || 0).toFixed(2)} MXN
                  </span>
                  <span className="text-[10px] text-[#64748B] block mt-1">Costo cubierto por la entrega</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0]">
                  <span className="text-[11px] text-[#64748B] block font-semibold">Margen Neto Plataforma</span>
                  <span className="text-base font-black text-[#05268F]">
                    +${(
                      (editCommissionActive ? (parseFloat(editCommissionPesos) || 0) : 0) +
                      ((parseFloat(editDeliveryFeePesos) || 0) - (parseFloat(editDriverPayPesos) || 0))
                    ).toFixed(2)} MXN
                  </span>
                  <span className="text-[10px] text-[#64748B] block mt-1">Comisión + Margen de Envío</span>
                </div>
              </div>
            </div>

            {/* Auditoría de Cambios Recientes */}
            {financialAuditLogs.length > 0 && (
              <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-[#101828] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#05268F]" />
                  Historial de Auditoría de Tarifas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-[#667085] font-bold">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Operador</th>
                        <th className="py-2.5 px-3">Modificaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {financialAuditLogs.slice(0, 10).map((log: any, i: number) => (
                        <tr key={log._id || i} className="hover:bg-[#F4F6F8]">
                          <td className="py-2.5 px-3 text-[#667085]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#101828]">
                            {log.actor?.name || log.actor?.id || 'Sistema'}
                          </td>
                          <td className="py-2.5 px-3 text-[#101828]">
                            {log.details ? JSON.stringify(log.details) : 'Tarifas actualizadas'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 13: EVIDENCIAS */}
        {/* ======================================================== */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#05268F]" />
                  Bóveda Universal de Evidencias
                </h2>
                <p className="text-xs text-[#667085]">
                  Comprobantes de transferencia bancaria, fotos de entrega en domicilio e incidencias de pedidos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {evidenceList.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvidencePreview(ev.file_url)}
                  className="p-3 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm hover:border-[#05268F] transition cursor-pointer space-y-2"
                >
                  <img
                    src={ev.file_url}
                    alt={ev.type}
                    className="w-full h-36 object-cover rounded-xl border border-[#E5E7EB]"
                  />
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-[#05268F]">{ev.type}</span>
                      <span className="text-[10px] text-[#667085]">{new Date(ev.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs font-bold text-[#101828] truncate mt-0.5">
                      Orden: {ev.order_id?.slice(-8)}
                    </div>
                    {ev.notes && <p className="text-[11px] text-[#667085] truncate">{ev.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 14: AUDITORÍA */}
        {/* ======================================================== */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#05268F]" />
                  Registro Soberano de Auditoría
                </h2>
                <p className="text-xs text-[#667085]">
                  Traza inmutable en MongoDB de todas las acciones administrativas, cambios de estado e intervenciones Master.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4F6F8] border-b border-[#E5E7EB] text-[10px] uppercase font-black tracking-wider text-[#667085]">
                  <tr>
                    <th className="py-3 px-4">Evento</th>
                    <th className="py-3 px-4">Entidad</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Detalles</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-[#F4F6F8]/60 transition font-mono text-[11px]">
                      <td className="py-3 px-4 font-bold text-[#05268F]">{l.event}</td>
                      <td className="py-3 px-4 text-[#101828]">
                        {l.entity_type}: {l.entity_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[#101828] font-bold">{l.actor_id}</span>{' '}
                        <span className="text-[#667085]">({l.actor_role})</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[#667085]">
                        {JSON.stringify(l.details)}
                      </td>
                      <td className="py-3 px-4 text-right text-[#667085]">
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: START DIRECT CHAT (Master ↔ Client/Rest/Driver) */}
      {/* ------------------------------------------------------------- */}
      {isDirectChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#05268F]" />
                Iniciar Conversación Directa
              </h3>
              <button
                onClick={() => setIsDirectChatModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartDirectChat} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">
                  Selecciona el Destinatario:
                </label>
                <select
                  value={directTargetUserId}
                  onChange={(e) => setDirectTargetUserId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <option value="">Seleccionar participante...</option>
                  <optgroup label="Restaurantes">
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.owner_id || r.id}>
                        {r.name} ({r.address})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Repartidores">
                    {fleet.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.phone})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Usuarios / Clientes">
                    {usersList.slice(0, 20).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.role.toUpperCase()} ({u.email})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Prioridad:</label>
                <select
                  value={directPriority}
                  onChange={(e) => setDirectPriority(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <option value="normal">Normal</option>
                  <option value="importante">Importante</option>
                  <option value="urgente">Urgente</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Mensaje Inicial:</label>
                <textarea
                  rows={3}
                  value={directInitialMessage}
                  onChange={(e) => setDirectInitialMessage(e.target.value)}
                  placeholder="Escribe el mensaje de apertura desde el Centro de Control..."
                  className="w-full p-3 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDirectChatModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDirectChat || !directTargetUserId}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Iniciar Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CREAR INCIDENCIA */}
      {/* ------------------------------------------------------------- */}
      {isCreateIncidentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-[#05268F]" />
                Registrar Incidencia Operativa
              </h3>
              <button
                onClick={() => setIsCreateIncidentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Título:</label>
                <input
                  type="text"
                  required
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  placeholder="Ej: Pedido retenido en cocina por falta de insumos"
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#101828] mb-1">Tipo de Entidad:</label>
                  <select
                    value={incidentEntityType}
                    onChange={(e) => setIncidentEntityType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                  >
                    <option value="order">Pedido</option>
                    <option value="restaurant">Restaurante</option>
                    <option value="driver">Repartidor</option>
                    <option value="customer">Cliente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#101828] mb-1">Severidad:</label>
                  <select
                    value={incidentSeverity}
                    onChange={(e) => setIncidentSeverity(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                  >
                    <option value="normal">Normal</option>
                    <option value="importante">Importante</option>
                    <option value="urgente">Urgente</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">ID de Entidad / Pedido:</label>
                <input
                  type="text"
                  required
                  value={incidentEntityId}
                  onChange={(e) => setIncidentEntityId(e.target.value)}
                  placeholder="ID del pedido (ej: ord_...), restaurante o conductor"
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Descripción Detallada:</label>
                <textarea
                  rows={3}
                  required
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Explica qué ocurrió, impactos y acciones recomendadas..."
                  className="w-full p-3 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateIncidentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIncident}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Crear Incidencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: ASIGNAR PLAN COMERCIAL */}
      {/* ------------------------------------------------------------- */}
      {isAssignPlanModalOpen && selectedRestaurantForCommercial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828]">Asignar Plan Comercial</h3>
              <button
                onClick={() => setIsAssignPlanModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPlan} className="space-y-3">
              <p className="text-xs text-[#667085]">
                Asignando plan a <strong>{selectedRestaurantForCommercial.name}</strong>. Esto activará autoritativamente todas las capacidades incluidas en el plan dentro del Core.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Selecciona el Plan:</label>
                <select
                  value={selectedPlanToAssign}
                  onChange={(e) => setSelectedPlanToAssign(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <option value="">Seleccionar plan...</option>
                  <optgroup label="Planes Directaurante">
                    {plans
                      .filter((p) => p.product === 'directaurante')
                      .map((p) => (
                        <option key={p.plan_id} value={p.plan_id}>
                          {p.name} — ${(p.price_cents / 100).toFixed(2)} MXN ({p.included_solutions.length} soluciones)
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Planes DirectPost">
                    {plans
                      .filter((p) => p.product === 'directpost')
                      .map((p) => (
                        <option key={p.plan_id} value={p.plan_id}>
                          {p.name} — ${(p.price_cents / 100).toFixed(2)} MXN ({p.included_solutions.length} soluciones)
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCommercialAction || !selectedPlanToAssign}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Confirmar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: OTORGAR TRIAL 30 DÍAS */}
      {/* ------------------------------------------------------------- */}
      {isGrantTrialModalOpen && selectedRestaurantForCommercial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828]">Otorgar Período de Prueba (Trial)</h3>
              <button
                onClick={() => setIsGrantTrialModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGrantTrial} className="space-y-3">
              <p className="text-xs text-[#667085]">
                Habilitará una solución durante 30 días gratuitos a <strong>{selectedRestaurantForCommercial.name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Selecciona la Solución:</label>
                <select
                  value={selectedSolutionForTrial}
                  onChange={(e) => setSelectedSolutionForTrial(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <optgroup label="DirectPost Suite">
                    {solutions
                      .filter((s) => s.product === 'directpost')
                      .map((s) => (
                        <option key={s.solution_id} value={s.solution_id}>
                          {s.name} ({s.category})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Directaurante">
                    {solutions
                      .filter((s) => s.product === 'directaurante')
                      .map((s) => (
                        <option key={s.solution_id} value={s.solution_id}>
                          {s.name} ({s.category})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGrantTrialModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCommercialAction}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Otorgar 30 Días
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: FORZAR ESTADO DE PEDIDO */}
      {/* ------------------------------------------------------------- */}
      {isOverrideModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828]">Intervención Soberana Master</h3>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleForceOrderStatus} className="space-y-3">
              <p className="text-xs text-[#667085]">
                Forzar cambio de estado para pedido <strong>{selectedOrder.order_code || selectedOrder.id}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Nuevo Estado:</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <option value="delivered">DELIVERED (Entregado)</option>
                  <option value="cancelled">CANCELLED (Cancelado)</option>
                  <option value="confirmed">CONFIRMED (Confirmado)</option>
                  <option value="ready">READY (Listo)</option>
                  <option value="delivering">DELIVERING (En camino)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Motivo Obligatorio (Auditoría):</label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explica la razón operativa del cambio forzado..."
                  className="w-full p-3 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride || !overrideReason.trim()}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Aplicar Intervención
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: REASIGNAR REPARTIDOR */}
      {/* ------------------------------------------------------------- */}
      {isReassignModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828]">Reasignar Repartidor</h3>
              <button
                onClick={() => setIsReassignModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignDriver} className="space-y-3">
              <p className="text-xs text-[#667085]">
                Asignar un repartidor manualmente al pedido <strong>{selectedOrder.order_code || selectedOrder.id}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Repartidor:</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <option value="">Selecciona conductor...</option>
                  {fleet.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.driver_status || 'offline'}) · {d.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign || !selectedDriverId}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Reasignar Conductor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 7: BROADCAST ALERT */}
      {/* ------------------------------------------------------------- */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#05268F]" />
                Emitir Alerta al Ecosistema
              </h3>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBroadcastAlert} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Título de la Alerta:</label>
                <input
                  type="text"
                  required
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Ej: Clima adverso - Posibles demoras en entregas"
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Audiencia Objetivo:</label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB]"
                >
                  <option value="all">Todo el Ecosistema</option>
                  <option value="restaurant">Solo Restaurantes</option>
                  <option value="driver">Solo Repartidores</option>
                  <option value="customer">Solo Clientes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] mb-1">Mensaje:</label>
                <textarea
                  rows={3}
                  required
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Detalla las instrucciones operativas..."
                  className="w-full p-3 rounded-xl bg-[#F4F6F8] text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#05268F]"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBroadcast}
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] disabled:opacity-50"
                >
                  Emitir Ahora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 8: IMAGE PREVIEW */}
      {/* ------------------------------------------------------------- */}
      {selectedEvidencePreview && (
        <div
          onClick={() => setSelectedEvidencePreview(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={selectedEvidencePreview}
              alt="Evidencia"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setSelectedEvidencePreview(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-white text-zinc-900 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 9: MODIFICAR COMISIÓN DE RESTAURANTE Y COSTO AL REPARTIDOR */}
      {/* ------------------------------------------------------------- */}
      {isFinancialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Percent className="w-5 h-5 text-[#05268F]" />
                  Modificar Comisiones y Envíos
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Establece la comisión por venta de restaurante y costo que corresponde al repartidor.
                </p>
              </div>
              <button
                onClick={() => setIsFinancialModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinancialConfig} className="space-y-4">
              {/* Comisión por Venta Restaurante */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#101828] flex items-center justify-between">
                  <span>Comisión por Venta a Restaurantes</span>
                  <span className="text-[11px] text-[#667085] font-normal">Por pedido concretado</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={editCommissionPesos}
                    onChange={(e) => setEditCommissionPesos(e.target.value)}
                    placeholder="10.00"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-8 pr-16 py-2.5 text-sm font-black text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
                </div>
              </div>

              {/* Costo de Envío al Repartidor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#101828] flex items-center justify-between">
                  <span>Costo de Envío para el Repartidor</span>
                  <span className="text-[11px] text-emerald-600 font-bold">100% para el conductor</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={editDriverPayPesos}
                    onChange={(e) => setEditDriverPayPesos(e.target.value)}
                    placeholder="20.00"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-8 pr-16 py-2.5 text-sm font-black text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
                </div>
              </div>

              {/* Tarifa Base de Envío al Cliente */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#101828] flex items-center justify-between">
                  <span>Tarifa Base de Envío (Costo al Cliente)</span>
                  <span className="text-[11px] text-[#667085] font-normal">Cobrada al comensal</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={editDeliveryFeePesos}
                    onChange={(e) => setEditDeliveryFeePesos(e.target.value)}
                    placeholder="25.00"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-8 pr-16 py-2.5 text-sm font-black text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
                </div>
              </div>

              {/* Switch Activar/Desactivar Comisión */}
              <div className="flex items-center justify-between p-3.5 bg-[#F4F6F8] rounded-2xl border border-[#E5E7EB]">
                <div>
                  <span className="text-xs font-bold text-[#101828] block">Activar Cobro de Comisión</span>
                  <span className="text-[10px] text-[#667085]">Aplica deducción en cada venta de restaurante</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditCommissionActive(!editCommissionActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    editCommissionActive ? 'bg-[#05268F]' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editCommissionActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Margen Calculado Preview */}
              <div className="p-3 bg-[#EAF0FF] rounded-2xl border border-[#05268F]/20 flex items-center justify-between text-xs">
                <span className="text-[#05268F] font-bold">Margen logístico por orden:</span>
                <span className="font-black text-[#05268F]">
                  +${(((parseFloat(editDeliveryFeePesos) || 0) - (parseFloat(editDriverPayPesos) || 0))).toFixed(2)} MXN
                </span>
              </div>

              {/* SECCIÓN CONFIGURABLE: DATOS PARA DEPOSITAR (REPARTIDORES) */}
              <div className="pt-3 border-t border-[#E5E7EB] space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#05268F]" />
                  <h4 className="text-xs font-black uppercase text-[#05268F] tracking-wider">
                    Tarjeta “Datos para depositar” (Repartidores)
                  </h4>
                </div>
                <p className="text-[11px] text-[#667085]">
                  Configura la cuenta bancaria oficial donde los repartidores deben depositar el arqueo de efectivo cobrado.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#101828] block mb-1">Nombre del Banco</label>
                    <input
                      type="text"
                      value={editDepositBankName}
                      onChange={(e) => setEditDepositBankName(e.target.value)}
                      placeholder="BBVA Bancomer"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#101828] block mb-1">Titular de la Cuenta</label>
                    <input
                      type="text"
                      value={editDepositHolder}
                      onChange={(e) => setEditDepositHolder(e.target.value)}
                      placeholder="Directaurante S.A.P.I. de C.V."
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#101828] block mb-1">CLABE Interbancaria o Número de Cuenta</label>
                  <input
                    type="text"
                    value={editDepositClabe}
                    onChange={(e) => setEditDepositClabe(e.target.value)}
                    placeholder="012 180 00123456789 0"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#05268F] focus:bg-white focus:outline-none focus:border-[#05268F]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#101828] block mb-1">Instrucciones para el Repartidor</label>
                  <textarea
                    rows={2}
                    value={editDepositInstructions}
                    onChange={(e) => setEditDepositInstructions(e.target.value)}
                    placeholder="Instrucciones sobre concepto, comprobantes o practicajas..."
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFinancialModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingFinancialConfig}
                  className="px-5 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition shadow-md disabled:opacity-50"
                >
                  {isSavingFinancialConfig ? 'Guardando...' : 'Guardar Nuevas Tarifas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 9.5: VALIDAR DEPÓSITO Y REGISTRAR DIFERENCIAS (AUDITORÍA) */}
      {/* ------------------------------------------------------------- */}
      {settlementToReview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#05268F]" />
                  Validación de Depósito — Corte #{settlementToReview.id.slice(-6)}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Repartidor: <strong className="text-[#101828]">{settlementToReview.driver_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSettlementToReview(null)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Financiero del Corte */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#F4F6F8] p-3 rounded-2xl border border-[#E5E7EB]">
                <span className="text-[10px] font-bold uppercase text-[#667085] block">Efectivo Cobrado</span>
                <span className="text-base font-black font-mono text-[#101828]">
                  ${((settlementToReview.cash_collected || 0) / 100).toFixed(2)} MXN
                </span>
              </div>
              <div className="bg-[#F4F6F8] p-3 rounded-2xl border border-[#E5E7EB]">
                <span className="text-[10px] font-bold uppercase text-[#667085] block">Monto Reportado</span>
                <span className="text-base font-black font-mono text-[#05268F]">
                  ${((settlementToReview.deposit_amount || settlementToReview.cash_collected || 0) / 100).toFixed(2)} MXN
                </span>
              </div>
            </div>

            {/* Ver Comprobante adjunto */}
            {settlementToReview.deposit_proof_url ? (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#101828] block">Comprobante Adjunto:</span>
                <div className="relative rounded-2xl overflow-hidden border border-[#E5E7EB] max-h-52 bg-black flex items-center justify-center">
                  <img
                    src={settlementToReview.deposit_proof_url}
                    alt="Comprobante"
                    className="max-h-52 w-full object-contain"
                  />
                  <button
                    onClick={() => setSelectedEvidencePreview(settlementToReview.deposit_proof_url)}
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ampliar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                El repartidor no ha adjuntado foto de comprobante aún.
              </div>
            )}

            {/* Monto Real Verificado en Banco */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#101828] flex items-center justify-between">
                <span>Monto Real Verificado en Cuenta Bancaria (MXN)</span>
                <span className="text-[11px] text-[#667085] font-normal">Revisado en app de banco</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">$</span>
                <input
                  type="number"
                  step="0.50"
                  value={reviewVerifiedAmount}
                  onChange={(e) => setReviewVerifiedAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-8 pr-16 py-2 text-sm font-mono font-black text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#64748B]">MXN</span>
              </div>
            </div>

            {/* Cálculo de Diferencia en Vivo */}
            {(() => {
              const expectedCents = settlementToReview.deposit_amount || settlementToReview.cash_collected || 0;
              const verifiedCents = Math.round((parseFloat(reviewVerifiedAmount) || 0) * 100);
              const diffCents = expectedCents - verifiedCents;
              const diffPesos = (diffCents / 100).toFixed(2);

              if (Math.abs(diffCents) > 0) {
                return (
                  <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                    diffCents > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <span className="font-bold">
                      {diffCents > 0 ? 'Faltante detectado (Diferencia):' : 'Excedente detectado:'}
                    </span>
                    <span className="font-black font-mono text-sm">
                      ${Math.abs(Number(diffPesos)).toFixed(2)} MXN
                    </span>
                  </div>
                );
              }
              return (
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Monto coincide exactamente con el reporte.</span>
                </div>
              );
            })()}

            {/* Observaciones de la Diferencia / Auditoría */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#101828] block">
                Observaciones y Justificación de Auditoría
              </label>
              <textarea
                rows={2}
                value={reviewDiscrepancyNotes}
                onChange={(e) => setReviewDiscrepancyNotes(e.target.value)}
                placeholder="Registra detalles de la ficha, motivo de diferencias o acuerdos autorizados..."
                className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
              />
            </div>

            {/* Protección estricta contra descuentos automáticos no autorizados */}
            <div className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#E5E7EB] flex items-start gap-2.5">
              <input
                type="checkbox"
                id="checkReconciled"
                checked={reviewReconciled}
                onChange={(e) => setReviewReconciled(e.target.checked)}
                className="mt-0.5 rounded border-[#E5E7EB] text-[#05268F] focus:ring-[#05268F]"
              />
              <label htmlFor="checkReconciled" className="text-[11px] text-[#667085] leading-snug cursor-pointer">
                <strong className="text-[#101828] block">Conciliación autorizada por Master</strong>
                No aplicar descuentos automáticos por diferencias sin conciliación y reglas expresamente autorizadas.
              </label>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setSettlementToReview(null)}
                className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB] transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={() => submitSettlementReview('rejected')}
                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition disabled:opacity-50"
              >
                Rechazar Depósito
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={() => submitSettlementReview('confirmed')}
                className="px-5 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition shadow-md disabled:opacity-50"
              >
                {isSubmittingReview ? 'Guardando...' : 'Validar y Registrar Auditoría'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 10: CREAR / EDITAR PLAN DE SUSCRIPCIÓN COMERCIAL */}
      {/* ------------------------------------------------------------- */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#05268F]" />
                  {editingPlan ? `Editar Plan: ${editingPlan.name}` : 'Crear Nuevo Plan de Suscripción'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Configura todas las propiedades comerciales, precio, límites y módulos incluidos.
                </p>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#101828] mb-1">Nombre Comercial del Plan *</label>
                  <input
                    type="text"
                    required
                    value={planFormName}
                    onChange={(e) => setPlanFormName(e.target.value)}
                    placeholder="Ej. Directaurante Profesional"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#101828] font-bold focus:bg-white focus:outline-none focus:border-[#05268F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Identificador / Código Plan *</label>
                  <input
                    type="text"
                    required
                    value={planFormPlanId}
                    onChange={(e) => setPlanFormPlanId(e.target.value)}
                    placeholder="plan_dir_pro"
                    disabled={Boolean(editingPlan)}
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#101828] font-mono text-[11px] disabled:opacity-60 focus:bg-white focus:outline-none focus:border-[#05268F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-[#101828] mb-1">Ecosistema *</label>
                  <select
                    value={planFormProduct}
                    onChange={(e) => {
                      const nextProd = e.target.value as 'directaurante' | 'directpost';
                      setPlanFormProduct(nextProd);
                      setPlanFormSolutions(
                        nextProd === 'directaurante'
                          ? ['sol_dir_online_orders', 'sol_dir_delivery', 'sol_dir_tracking']
                          : ['sol_post_pos', 'sol_post_kds']
                      );
                    }}
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-2 text-[#101828] font-bold"
                  >
                    <option value="directaurante">DIRECTAURANTE</option>
                    <option value="directpost">DIRECTPOST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Precio ($ MXN) *</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-zinc-500 font-bold">$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={planFormPricePesos}
                      onChange={(e) => setPlanFormPricePesos(e.target.value)}
                      placeholder="499.00"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-6 pr-2 py-2 text-[#101828] font-black focus:bg-white focus:outline-none focus:border-[#05268F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Período Cobro *</label>
                  <select
                    value={planFormBillingPeriod}
                    onChange={(e) => setPlanFormBillingPeriod(e.target.value)}
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2 py-2 text-[#101828] font-bold"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                    <option value="lifetime">Vitalicio / Único</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Disponibilidad *</label>
                  <select
                    value={planFormStatus}
                    onChange={(e) => setPlanFormStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-2 text-[#101828] font-bold"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo / Pausado</option>
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-[#101828] mb-1">Descripción del Paquete</label>
                <textarea
                  rows={2}
                  value={planFormDescription}
                  onChange={(e) => setPlanFormDescription(e.target.value)}
                  placeholder="Describe los beneficios y alcance de este plan de suscripción comercial..."
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#101828] focus:bg-white focus:outline-none focus:border-[#05268F]"
                />
              </div>

              {/* Límites de Uso */}
              <div className="space-y-1.5 pt-1 text-xs">
                <label className="block font-bold text-[#101828]">Límites y Restricciones Operativas:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <span className="block text-[11px] text-[#667085] mb-0.5">Pedidos / Mes:</span>
                    <input
                      type="number"
                      min="0"
                      value={planFormMaxOrders}
                      onChange={(e) => setPlanFormMaxOrders(e.target.value)}
                      placeholder="Ilimitados"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-[#101828] text-xs font-semibold focus:bg-white focus:border-[#05268F]"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-[#667085] mb-0.5">Productos en Carta:</span>
                    <input
                      type="number"
                      min="0"
                      value={planFormMaxProducts}
                      onChange={(e) => setPlanFormMaxProducts(e.target.value)}
                      placeholder="Ilimitados"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-[#101828] text-xs font-semibold focus:bg-white focus:border-[#05268F]"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-[#667085] mb-0.5">Personal / Usuarios:</span>
                    <input
                      type="number"
                      min="0"
                      value={planFormMaxStaff}
                      onChange={(e) => setPlanFormMaxStaff(e.target.value)}
                      placeholder="Ilimitados"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-[#101828] text-xs font-semibold focus:bg-white focus:border-[#05268F]"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-[#667085] mb-0.5">Mesas / Sucursales:</span>
                    <input
                      type="number"
                      min="0"
                      value={planFormMaxTables}
                      onChange={(e) => setPlanFormMaxTables(e.target.value)}
                      placeholder="Ilimitadas"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-[#101828] text-xs font-semibold focus:bg-white focus:border-[#05268F]"
                    />
                  </div>
                </div>
              </div>

              {/* Soluciones comerciales incluidas con Select All */}
              <div className="space-y-2 pt-2 border-t border-[#E5E7EB] text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-black text-[#101828]">
                    Soluciones y Capacidades Incluidas ({planFormProduct.toUpperCase()}):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allForProduct = solutions
                          .filter((s) => s.product === planFormProduct)
                          .map((s) => s.solution_id);
                        setPlanFormSolutions(allForProduct);
                      }}
                      className="text-[11px] text-[#05268F] font-bold hover:underline"
                    >
                      Seleccionar Todas
                    </button>
                    <span className="text-[#667085]">·</span>
                    <button
                      type="button"
                      onClick={() => setPlanFormSolutions([])}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Deseleccionar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 bg-[#F4F6F8] rounded-2xl border border-[#E5E7EB]">
                  {solutions
                    .filter((s) => s.product === planFormProduct)
                    .map((sol) => {
                      const isChecked = planFormSolutions.includes(sol.solution_id);
                      return (
                        <label
                          key={sol.solution_id}
                          className={`p-2 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                            isChecked
                              ? 'bg-white border-[#05268F] text-[#05268F] shadow-xs'
                              : 'bg-transparent border-transparent text-[#667085] hover:bg-white/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPlanFormSolutions([...planFormSolutions, sol.solution_id]);
                              } else {
                                setPlanFormSolutions(planFormSolutions.filter((id) => id !== sol.solution_id));
                              }
                            }}
                            className="mt-0.5 rounded text-[#05268F] focus:ring-0"
                          />
                          <div className="text-[11px] leading-tight">
                            <span className="font-bold block">{sol.name}</span>
                            <span className="text-[10px] text-[#667085]">{sol.category}</span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPlan}
                  className="px-5 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] shadow-md disabled:opacity-50"
                >
                  {isSubmittingPlan ? 'Guardando...' : editingPlan ? 'Actualizar Plan' : 'Crear Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 11: GESTIÓN Y EDICIÓN COMPLETA DE SUSCRIPCIÓN DE RESTAURANTE */}
      {/* ------------------------------------------------------------- */}
      {isLicenseModalOpen && selectedRestaurantForLicense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#05268F]" />
                  Edición Integral de Suscripción y Licencia
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Restaurante: <strong className="text-[#101828]">{selectedRestaurantForLicense.name}</strong> (ID: {selectedRestaurantForLicense.id})
                </p>
              </div>
              <button
                onClick={() => setIsLicenseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F4F6F8] text-[#667085]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRestaurantLicense} className="space-y-4 text-xs">
              {/* 1. Selector de Condición / Estado de Licencia */}
              <div className="space-y-2">
                <label className="block font-bold text-[#101828]">1. Condición / Estado de Suscripción:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLicenseTargetStatus('active')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      licenseTargetStatus === 'active'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-500'
                        : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#667085] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    <span className="font-black text-xs block text-emerald-800">Suscripción Activa</span>
                    <span className="text-[10px] block mt-0.5 text-[#667085]">Plan de pago vigente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLicenseTargetStatus('trial')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      licenseTargetStatus === 'trial'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-xs ring-1 ring-amber-500'
                        : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#667085] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    <span className="font-black text-xs block text-amber-800">Pase de Prueba</span>
                    <span className="text-[10px] block mt-0.5 text-[#667085]">Días de gracia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLicenseTargetStatus('lifetime')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      licenseTargetStatus === 'lifetime'
                        ? 'bg-blue-50 border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-500'
                        : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#667085] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    <span className="font-black text-xs block text-[#05268F]">Vitalicio / Cortesía</span>
                    <span className="text-[10px] block mt-0.5 text-[#667085]">Sin vencimiento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLicenseTargetStatus('paused')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      licenseTargetStatus === 'paused'
                        ? 'bg-zinc-100 border-zinc-500 text-zinc-950 shadow-xs ring-1 ring-zinc-500'
                        : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#667085] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    <span className="font-black text-xs block text-zinc-800">Pausada</span>
                    <span className="text-[10px] block mt-0.5 text-[#667085]">Suspensión temporal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLicenseTargetStatus('expired')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      licenseTargetStatus === 'expired'
                        ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-xs ring-1 ring-rose-500'
                        : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#667085] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    <span className="font-black text-xs block text-rose-800">Pase Caducado</span>
                    <span className="text-[10px] block mt-0.5 text-[#667085]">Fuera de Servicio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLicenseTargetStatus('none')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      licenseTargetStatus === 'none'
                        ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-xs ring-1 ring-rose-500'
                        : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#667085] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    <span className="font-black text-xs block text-rose-800">Sin Suscripción</span>
                    <span className="text-[10px] block mt-0.5 text-[#667085]">Acceso revocado</span>
                  </button>
                </div>
              </div>

              {/* 2. Plan Comercial Base & Carga Rápida */}
              <div className="bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <label className="font-bold text-[#101828]">2. Plan Comercial de Referencia:</label>
                  <button
                    type="button"
                    onClick={() => handleApplyPlanToLicense(licenseSelectedPlanId)}
                    className="text-xs font-bold text-[#05268F] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Cargar valores y soluciones de este plan</span>
                  </button>
                </div>

                <select
                  value={licenseSelectedPlanId}
                  onChange={(e) => handleApplyPlanToLicense(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-[#E5E7EB] font-bold text-xs text-[#101828] focus:border-[#05268F]"
                >
                  <option value="">Selecciona un plan del catálogo...</option>
                  {plans.map((p) => (
                    <option key={p.plan_id} value={p.plan_id}>
                      {p.name} ({p.product.toUpperCase()}) — ${(p.price_cents / 100).toFixed(2)} MXN / {p.billing_period}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Nombre Personalizado, Tarifa y Período */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#101828] mb-1">Nombre Suscripción:</label>
                  <input
                    type="text"
                    required
                    value={licensePlanName}
                    onChange={(e) => setLicensePlanName(e.target.value)}
                    placeholder="Directaurante Pro"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#101828] font-bold focus:bg-white focus:border-[#05268F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Tarifa Mensual ($ MXN):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-zinc-500 font-bold">$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={licensePricePesos}
                      onChange={(e) => setLicensePricePesos(e.target.value)}
                      placeholder="499.00"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-7 pr-3 py-2 text-[#101828] font-black focus:bg-white focus:border-[#05268F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Período de Facturación:</label>
                  <select
                    value={licenseBillingPeriod}
                    onChange={(e) => setLicenseBillingPeriod(e.target.value)}
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#101828] font-bold"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                    <option value="lifetime">Vitalicio</option>
                  </select>
                </div>
              </div>

              {/* 4. Vigencia y Control de Fechas */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 to-emerald-50/70 border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#101828] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#05268F]" />
                    <span>4. Vigencia, Fechas de Renovación y Caducidad:</span>
                  </label>
                  {licenseTargetStatus === 'lifetime' && (
                    <span className="text-[11px] font-bold text-[#05268F] bg-blue-100 px-2 py-0.5 rounded-full">
                      Vitalicio · Permanente
                    </span>
                  )}
                </div>

                {licenseTargetStatus !== 'lifetime' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] text-[#667085] font-semibold mb-1">
                          Fecha de Inicio:
                        </span>
                        <input
                          type="date"
                          value={licenseStartsAt}
                          onChange={(e) => setLicenseStartsAt(e.target.value)}
                          className="w-full p-2 bg-white border border-[#E5E7EB] rounded-xl font-bold text-xs text-[#101828]"
                        />
                      </div>

                      <div>
                        <span className="block text-[11px] text-[#667085] font-semibold mb-1">
                          {licenseTargetStatus === 'trial' ? 'Fecha Fin de Prueba:' : 'Fecha de Vencimiento / Fin:'}
                        </span>
                        <input
                          type="date"
                          value={licenseTargetStatus === 'trial' ? licenseTrialEndsAt : licenseEndsAt}
                          onChange={(e) => {
                            if (licenseTargetStatus === 'trial') {
                              setLicenseTrialEndsAt(e.target.value);
                            } else {
                              setLicenseEndsAt(e.target.value);
                            }
                          }}
                          className="w-full p-2 bg-white border border-[#E5E7EB] rounded-xl font-bold text-xs text-[#101828]"
                        />
                      </div>
                    </div>

                    {/* Botones de extensión rápida de fechas */}
                    <div>
                      <span className="text-[10px] text-[#667085] font-bold uppercase tracking-wider block mb-1">
                        Añadir tiempo rápido de vigencia:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[7, 15, 30, 60, 90, 180, 365].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleAddDaysToLicense(d)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-[#05268F] font-bold text-[10px] hover:bg-blue-100 transition shadow-2xs"
                          >
                            +{d === 365 ? '1 año' : `${d}d`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {licenseTargetStatus === 'expired' && (
                  <div className="p-3 bg-rose-100/80 rounded-xl border border-rose-300 text-rose-900 flex items-center gap-2">
                    <Ban className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>El restaurante se mostrará como <strong>"Fuera de Servicio"</strong> a los clientes y no podrá aceptar pedidos.</span>
                  </div>
                )}
              </div>

              {/* 5. Soluciones y Capacidades Contratadas Específicas */}
              <div className="space-y-2 pt-1 border-t border-[#E5E7EB]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="font-bold text-[#101828] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#05268F]" />
                    <span>5. Capacidades Habilitadas para este Restaurante ({licenseSolutions.length}):</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLicenseSolutions(solutions.map((s) => s.solution_id))}
                      className="text-[#05268F] font-bold hover:underline"
                    >
                      Habilitar Todas
                    </button>
                    <span className="text-[#667085]">·</span>
                    <button
                      type="button"
                      onClick={() => setLicenseSolutions([])}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-[#F4F6F8] rounded-2xl border border-[#E5E7EB]">
                  {solutions.map((sol) => {
                    const isChecked = licenseSolutions.includes(sol.solution_id);
                    return (
                      <label
                        key={sol.solution_id}
                        className={`p-2 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                          isChecked
                            ? 'bg-white border-[#05268F] text-[#05268F] shadow-xs'
                            : 'bg-transparent border-transparent text-[#667085] hover:bg-white/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLicenseSolutions([...licenseSolutions, sol.solution_id]);
                            } else {
                              setLicenseSolutions(licenseSolutions.filter((id) => id !== sol.solution_id));
                            }
                          }}
                          className="mt-0.5 rounded text-[#05268F] focus:ring-0"
                        />
                        <div className="text-[11px] leading-tight">
                          <span className="font-bold block">{sol.name}</span>
                          <span className="text-[10px] text-[#667085]">
                            {sol.product.toUpperCase()} · {sol.category}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 6. Límites y Notas Administrativas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-[#101828] mb-1">Máx. Pedidos / Mes:</label>
                  <input
                    type="number"
                    min="0"
                    value={licenseMaxOrders}
                    onChange={(e) => setLicenseMaxOrders(e.target.value)}
                    placeholder="Ilimitados"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-xs text-[#101828] font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Máx. Productos Carta:</label>
                  <input
                    type="number"
                    min="0"
                    value={licenseMaxProducts}
                    onChange={(e) => setLicenseMaxProducts(e.target.value)}
                    placeholder="Ilimitados"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-xs text-[#101828] font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#101828] mb-1">Máx. Empleados / Staff:</label>
                  <input
                    type="number"
                    min="0"
                    value={licenseMaxStaff}
                    onChange={(e) => setLicenseMaxStaff(e.target.value)}
                    placeholder="Ilimitados"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 text-xs text-[#101828] font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#101828] mb-1">Notas Administrativas / Justificación:</label>
                <textarea
                  rows={2}
                  value={licenseNotes}
                  onChange={(e) => setLicenseNotes(e.target.value)}
                  placeholder="Ej. Suscripción especial pactada con gerencia, renovación programada vía transferencia..."
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-xs text-[#101828] focus:bg-white focus:border-[#05268F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setIsLicenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F6F8] text-xs font-bold text-[#101828] hover:bg-[#E5E7EB]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLicense}
                  className="px-5 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isSubmittingLicense ? 'Guardando...' : 'Guardar Suscripción Completa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
