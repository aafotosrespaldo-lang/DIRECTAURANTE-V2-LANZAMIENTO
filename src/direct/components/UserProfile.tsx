import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { AddressesManager } from './AddressesManager.tsx';
import { WalletManager } from './WalletManager.tsx';
import { directApi } from '../api/client.ts';
import { SupportTicket } from '../types.ts';
import {
  User,
  UserCheck,
  Mail,
  Phone,
  ShieldCheck,
  LogOut,
  Bike,
  Store,
  ArrowLeft,
  Save,
  Cake,
  AlertCircle,
  HelpCircle,
  Send,
  Lock,
  Calendar,
  CreditCard,
  ClipboardList,
  Wallet,
  MapPin,
  CheckCircle2,
  Camera,
  Sparkles,
  RotateCw,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';

export type ProfileTab = 'pedidos' | 'billetera' | 'direcciones' | 'perfil';

// Preset avatar options for quick profile image personalization
const AVATAR_PRESETS = [
  { id: 'av_1', label: 'Chef', url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80' },
  { id: 'av_2', label: 'Foodie 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: 'av_3', label: 'Foodie 2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 'av_4', label: 'Tacos Fan', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: 'av_5', label: 'Gourmet', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
];

export const UserProfile: React.FC = () => {
  const {
    user,
    isAuthenticated,
    logout,
    setIsAuthOpen,
    setActiveView,
    refreshProfile,
    addToast,
    orders,
    addresses,
    loadOrders,
    isLoadingOrders,
  } = useApp();

  // Active navigation tab among the 4 requested buttons:
  // 'pedidos' | 'billetera' | 'direcciones' | 'perfil'
  const [activeTab, setActiveTab] = useState<ProfileTab>('perfil');

  // Profile Form Fields (specifically First Name, Last Name, Phone, Profile Image, etc.)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [birthday, setBirthday] = useState('');
  const [allergies, setAllergies] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Customer Support Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [ticketCategory, setTicketCategory] = useState('Pedido');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'normal' | 'urgent'>('normal');

  // Initialize form fields when user loads
  useEffect(() => {
    if (user) {
      const parts = (user.name || '').trim().split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setPhone(user.phone || '');
      setProfileImage(user.profile_image || '');
      setBirthday((user as any)?.birthday || (user as any)?.birthdate || '');
      setAllergies((user as any)?.allergies || '');
      setVehicleInfo((user as any)?.vehicle_info || '');
    }
  }, [user]);

  useEffect(() => {
    if (user && isAuthenticated) {
      loadTickets();
    }
  }, [user, isAuthenticated]);

  const loadTickets = async () => {
    try {
      setIsLoadingTickets(true);
      const res = await directApi.getCustomerSupportTickets();
      setTickets(res);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDescription.trim()) {
      addToast('error', 'Por favor describe el motivo de tu consulta');
      return;
    }

    try {
      setIsCreatingTicket(true);
      await directApi.createCustomerSupportTicket({
        category: ticketCategory,
        description: ticketDescription.trim(),
        order_id: ticketOrderId || undefined,
        priority: ticketPriority,
      });
      addToast('success', 'Ticket de soporte enviado. Un operador te responderá a la brevedad.');
      setTicketDescription('');
      setTicketOrderId('');
      await loadTickets();
    } catch (err: any) {
      addToast('error', err.message || 'Error al enviar ticket');
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'master') {
      addToast('error', 'El perfil Master no puede modificarse por autogestión');
      return;
    }

    if (!firstName.trim()) {
      addToast('error', 'El nombre es obligatorio');
      return;
    }

    const fullCombinedName = `${firstName.trim()} ${lastName.trim()}`.trim();

    setIsSaving(true);
    try {
      await directApi.updateUserProfile({
        name: fullCombinedName,
        phone: phone.trim(),
        birthday: birthday || null,
        allergies: allergies.trim() || undefined,
        profile_image: profileImage.trim() || null,
        vehicle_info: user?.role === 'driver' ? vehicleInfo.trim() : undefined,
      });
      await refreshProfile();
      addToast('success', 'Perfil actualizado exitosamente');
    } catch (err: any) {
      addToast('error', err.message || 'Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 flex items-center justify-center mx-auto mb-4 text-[#FFD318] shadow-xl">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Inicia sesión en tu cuenta</h2>
        <p className="text-zinc-400 text-sm mb-6 max-w-sm mx-auto">
          Accede para ver tu perfil, direcciones guardadas, billetera e historial de pedidos.
        </p>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="px-6 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/40 font-semibold text-[#FFD318] shadow-md transition-colors"
        >
          Iniciar sesión o Registrarse
        </button>
      </div>
    );
  }

  const roleLabel = {
    master: 'Administrador Master',
    admin: 'Administrador General',
    driver: 'Repartidor Autorizado',
    restaurant: 'Operador de Restaurante',
    customer: 'Cliente Registrado',
  }[user.role] || user.role;

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setActiveView('explore')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-colors bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-300 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Restaurantes
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 px-3.5 py-1.5 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Identity Banner Card */}
      <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {profileImage || user.profile_image ? (
              <img
                src={profileImage || user.profile_image || ''}
                alt={user.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#FFD318]/50 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#05268F] border-2 border-[#FFD318]/50 flex items-center justify-center text-[#FFD318] font-black text-2xl shrink-0 shadow-md">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {user.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#05268F]/40 border border-[#FFD318]/40 text-[#FFD318]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {roleLabel}
                </span>
              </div>
              <p className="text-xs text-zinc-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                <span>{user.email}</span>
                {user.phone && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{user.phone}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#06091e] border border-[#05268F]/30 text-zinc-300">
              <strong className="text-[#FFD318]">{orders.length}</strong> pedidos
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#06091e] border border-[#05268F]/30 text-zinc-300">
              <strong className="text-emerald-400">{addresses.length}</strong> direcciones
            </span>
          </div>
        </div>

        {/* Role Quick Switches if operator / driver / master */}
        {(user.role === 'driver' || (user.role as any) === 'admin' || user.role === 'master' || user.role === 'restaurant') && (
          <div className="mt-5 pt-4 border-t border-[#05268F]/25 flex flex-wrap gap-2.5">
            {user.role === 'master' && (
              <button
                onClick={() => setActiveView('master_noc')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/40 text-[#FFD318] text-xs font-bold shadow-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Centro de Control Master 24/7
              </button>
            )}
            {(user.role === 'driver' || (user.role as any) === 'admin' || user.role === 'master') && (
              <button
                onClick={() => setActiveView('driver_app')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/30 text-[#FFD318] text-xs font-semibold shadow-xs transition-colors"
              >
                <Bike className="w-4 h-4" />
                Panel Repartidor
              </button>
            )}
            {(user.role === 'restaurant' || (user.role as any) === 'admin' || user.role === 'master') && (
              <button
                onClick={() => setActiveView('restaurant_portal')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#101828] hover:bg-zinc-800 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-colors"
              >
                <Store className="w-4 h-4" />
                Portal Restaurante
              </button>
            )}
          </div>
        )}
      </div>

      {/* 
        ===================================================================
        LOS 4 BOTONES PRINCIPALES DE LA PANTALLA:
        1. Pedidos (Historial de pedidos)
        2. Billetera (Tarjetas de crédito / débito)
        3. Direcciones (Agregar y guardar direcciones)
        4. Perfil de Usuario (Editar nombre, apellido, foto, celular)
        ===================================================================
      */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Módulos de tu Cuenta
          </span>
          <span className="text-[11px] text-zinc-500">
            Selecciona una opción para gestionar
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* BOTÓN 1: PEDIDOS */}
          <button
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 text-left transition-all duration-200 cursor-pointer shadow-md ${
              activeTab === 'pedidos'
                ? 'bg-[#05268F] text-white border-[#FFD318] shadow-lg shadow-[#05268F]/30 scale-[1.02]'
                : 'bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border-[#05268F]/30 text-zinc-300 hover:border-[#05268F]/70 hover:shadow-lg hover:shadow-[#05268F]/20'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activeTab === 'pedidos'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/30'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
              </div>
              {orders.length > 0 && (
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    activeTab === 'pedidos'
                      ? 'bg-[#FFD318] text-[#05268F]'
                      : 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/30'
                  }`}
                >
                  {orders.length}
                </span>
              )}
            </div>
            <div>
              <h3 className={`font-black text-sm tracking-tight ${activeTab === 'pedidos' ? 'text-white' : 'text-zinc-100'}`}>
                Pedidos
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-1 ${activeTab === 'pedidos' ? 'text-[#FFD318]' : 'text-zinc-400'}`}>
                {activeOrdersCount > 0 ? `${activeOrdersCount} en curso` : 'Historial de compras'}
              </p>
            </div>
          </button>

          {/* BOTÓN 2: BILLETERA */}
          <button
            type="button"
            onClick={() => setActiveTab('billetera')}
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 text-left transition-all duration-200 cursor-pointer shadow-md ${
              activeTab === 'billetera'
                ? 'bg-[#05268F] text-white border-[#FFD318] shadow-lg shadow-[#05268F]/30 scale-[1.02]'
                : 'bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border-[#05268F]/30 text-zinc-300 hover:border-[#05268F]/70 hover:shadow-lg hover:shadow-[#05268F]/20'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activeTab === 'billetera'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/30'
                }`}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'billetera'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                Tarjetas
              </span>
            </div>
            <div>
              <h3 className={`font-black text-sm tracking-tight ${activeTab === 'billetera' ? 'text-white' : 'text-zinc-100'}`}>
                Billetera
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-1 ${activeTab === 'billetera' ? 'text-[#FFD318]' : 'text-zinc-400'}`}>
                Crédito y Débito
              </p>
            </div>
          </button>

          {/* BOTÓN 3: DIRECCIONES */}
          <button
            type="button"
            onClick={() => setActiveTab('direcciones')}
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 text-left transition-all duration-200 cursor-pointer shadow-md ${
              activeTab === 'direcciones'
                ? 'bg-[#05268F] text-white border-[#FFD318] shadow-lg shadow-[#05268F]/30 scale-[1.02]'
                : 'bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border-[#05268F]/30 text-zinc-300 hover:border-[#05268F]/70 hover:shadow-lg hover:shadow-[#05268F]/20'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activeTab === 'direcciones'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/30'
                }`}
              >
                <MapPin className="w-5 h-5" />
              </div>
              {addresses.length > 0 && (
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    activeTab === 'direcciones'
                      ? 'bg-[#FFD318] text-[#05268F]'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                  }`}
                >
                  {addresses.length}
                </span>
              )}
            </div>
            <div>
              <h3 className={`font-black text-sm tracking-tight ${activeTab === 'direcciones' ? 'text-white' : 'text-zinc-100'}`}>
                Direcciones
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-1 ${activeTab === 'direcciones' ? 'text-[#FFD318]' : 'text-zinc-400'}`}>
                Entrega y domicilios
              </p>
            </div>
          </button>

          {/* BOTÓN 4: PERFIL DE USUARIO */}
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 text-left transition-all duration-200 cursor-pointer shadow-md ${
              activeTab === 'perfil'
                ? 'bg-[#05268F] text-white border-[#FFD318] shadow-lg shadow-[#05268F]/30 scale-[1.02]'
                : 'bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border-[#05268F]/30 text-zinc-300 hover:border-[#05268F]/70 hover:shadow-lg hover:shadow-[#05268F]/20'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activeTab === 'perfil'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/30'
                }`}
              >
                <UserCheck className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'perfil'
                    ? 'bg-[#FFD318] text-[#05268F]'
                    : 'bg-[#05268F]/30 text-[#FFD318] border border-[#FFD318]/30'
                }`}
              >
                Editar
              </span>
            </div>
            <div>
              <h3 className={`font-black text-sm tracking-tight ${activeTab === 'perfil' ? 'text-white' : 'text-zinc-100'}`}>
                Perfil de Usuario
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-1 ${activeTab === 'perfil' ? 'text-[#FFD318]' : 'text-zinc-400'}`}>
                Configuración y datos
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 
        ===================================================================
        VISTA DINÁMICA SEGÚN EL BOTÓN SELECCIONADO
        ===================================================================
      */}

      {/* TAB 1: PEDIDOS */}
      {activeTab === 'pedidos' && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-bold shadow-md">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">Historial de Pedidos</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFD318] text-[#05268F]">
                    {orders.length} pedidos
                  </span>
                  {activeOrdersCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {activeOrdersCount} en curso
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">Consulta el estado, historial y seguimiento de tus pedidos.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadOrders}
                disabled={isLoadingOrders}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#06091e] border border-[#05268F]/30 text-xs font-semibold text-zinc-300 hover:text-white transition"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
              <button
                onClick={() => setActiveView('orders')}
                className="px-3.5 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <span>Ver en Pantalla Completa</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Orders list */}
          {orders.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400 space-y-3">
              <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">Aún no tienes pedidos registrados</h3>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                Explora el catálogo y disfruta de tus platillos favoritos directo de la cocina a tu puerta.
              </p>
              <button
                onClick={() => setActiveView('explore')}
                className="px-5 py-2 rounded-xl bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 font-bold text-xs transition"
              >
                Explorar Restaurantes
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => setActiveView('orders')}
                  className="p-4 rounded-2xl bg-gradient-to-r from-[#0b1442] via-[#070728] to-[#040618] border border-[#05268F]/30 hover:border-[#05268F]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition cursor-pointer shadow-md hover:shadow-[#05268F]/20"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-[#FFD318] bg-[#05268F] px-2 py-0.5 rounded shadow-xs">
                        #{o.order_code || o.id.replace(/^ord_/, '').slice(0, 5).toUpperCase()}
                      </span>
                      <h4 className="font-bold text-white text-sm">{o.restaurant_name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        o.status === 'delivered'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                          : o.status === 'cancelled'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800/40'
                          : 'bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/30 animate-pulse'
                      }`}>
                        {o.status === 'delivered' ? 'Entregado' : o.status === 'cancelled' ? 'Cancelado' : 'En curso'}
                      </span>
                    </div>

                    <p className="text-zinc-300 text-[11px] truncate">
                      {o.items.map((it) => `${it.quantity}x ${it.product_name}`).join(', ')}
                    </p>
                    <span className="text-[10px] text-zinc-500 font-mono block">
                      {new Date(o.createdAt).toLocaleString()} • {o.order_type === 'delivery' ? 'A Domicilio' : 'Para Recoger'}
                    </span>
                  </div>

                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#05268F]/20 flex sm:flex-col justify-between items-center sm:items-end">
                    <span className="text-[11px] text-zinc-400 sm:hidden">Total a pagar:</span>
                    <div>
                      <p className="font-black text-sm text-[#FFD318]">${(o.total / 100).toFixed(2)} MXN</p>
                      <span className="text-[10px] text-zinc-400 hidden sm:block">Ver trazabilidad →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BILLETERA */}
      {activeTab === 'billetera' && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 shadow-2xl animate-in fade-in duration-200">
          <WalletManager />
        </div>
      )}

      {/* TAB 3: DIRECCIONES */}
      {activeTab === 'direcciones' && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-[#05268F]/25 pb-3">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#FFD318]" />
              <span>Direcciones Guardadas de Entrega</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Administra tus ubicaciones fijas (Casa, Trabajo, etc.) para acelerar tus pedidos.
            </p>
          </div>
          <AddressesManager />
        </div>
      )}

      {/* TAB 4: PERFIL DE USUARIO (CONFIGURACIÓN Y EDICIÓN) */}
      {activeTab === 'perfil' && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-bold shadow-md">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">Editar Perfil de Usuario</h2>
                <p className="text-xs text-zinc-400">
                  Modifica tu nombre, apellido, fotografía de perfil y número celular.
                </p>
              </div>
            </div>

            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#05268F]/30 text-[#FFD318] border border-[#FFD318]/30">
              {roleLabel}
            </span>
          </div>

          {/* Formulario Completo de Edición */}
          <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
            {/* Foto de Perfil Section */}
            <div className="p-4 rounded-2xl bg-[#06091e] border border-[#05268F]/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-zinc-200 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#FFD318]" />
                  <span>Foto de Perfil</span>
                </label>
                <span className="text-[10px] text-zinc-400">Personaliza tu avatar</span>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Preview"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#FFD318] shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#05268F] border-2 border-[#FFD318] flex items-center justify-center text-[#FFD318] font-bold text-2xl shrink-0">
                    {firstName ? firstName[0].toUpperCase() : 'U'}
                  </div>
                )}

                <div className="flex-1 min-w-[200px] space-y-2">
                  <input
                    type="url"
                    placeholder="Pega aquí la URL de tu foto (https://...)"
                    value={profileImage}
                    onChange={(e) => setProfileImage(e.target.value)}
                    className="w-full bg-[#070728] border border-[#05268F]/30 rounded-xl px-3.5 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD318]"
                  />

                  {/* Preset Avatar Selection */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] text-zinc-400">O elige un avatar rápido:</span>
                    {AVATAR_PRESETS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setProfileImage(av.url)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                          profileImage === av.url
                            ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]'
                            : 'bg-[#070728] text-zinc-300 border-[#05268F]/25 hover:border-[#FFD318]'
                        }`}
                      >
                        {av.label}
                      </button>
                    ))}
                    {profileImage && (
                      <button
                        type="button"
                        onClick={() => setProfileImage('')}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Datos Personales: Nombre, Apellido, Celular */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-300 font-bold block mb-1">
                  Nombre(s) <span className="text-[#FFD318]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-[#FFD318]"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">
                  Apellido(s)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Pérez López"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-[#FFD318]"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#FFD318]" />
                  <span>Número Celular / Teléfono</span>
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 469 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#FFD318]"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Correo Electrónico (Registrado)</span>
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-[#06091e]/50 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#FFD318]" />
                  <span>Fecha de Nacimiento (Cumpleaños)</span>
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FFD318]"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#FFD318]" />
                  <span>Alergias o Notas Dietéticas Habituales</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sin cebolla, alérgico a cacahuates, vegetariano..."
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FFD318]"
                />
              </div>

              {user.role === 'driver' && (
                <div className="sm:col-span-2">
                  <label className="text-zinc-300 font-bold block mb-1 flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-[#FFD318]" />
                    <span>Datos del Vehículo de Reparto</span>
                  </label>
                  <input
                    type="text"
                    value={vehicleInfo}
                    onChange={(e) => setVehicleInfo(e.target.value)}
                    placeholder="Ej: Moto Italika FT150 Roja (Placas GTO-223)"
                    className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FFD318]"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#05268F]/25">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold flex items-center gap-2 shadow-lg shadow-[#05268F]/25 active:scale-95 transition"
              >
                <Save className="w-4 h-4 text-[#FFD318]" />
                <span>{isSaving ? 'Guardando cambios...' : 'Guardar Cambios de Perfil'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 
        ===================================================================
        SOPORTE Y TICKETS AL CLIENTE
        ===================================================================
      */}
      <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#FFD318]" />
            <div>
              <h2 className="text-base font-bold text-white">Centro de Ayuda y Soporte</h2>
              <p className="text-xs text-zinc-400">Envía tus consultas o reporta incidencias sobre tus pedidos.</p>
            </div>
          </div>
        </div>

        {/* Ticket Creation Form */}
        <form onSubmit={handleCreateTicket} className="space-y-3 bg-[#070728]/80 p-4 rounded-xl border border-[#05268F]/25 text-xs">
          <p className="font-bold text-zinc-200">Crear Nueva Consulta / Ticket</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-zinc-400 block mb-1">Categoría</label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
              >
                <option value="Pedido">Duda sobre mi Pedido</option>
                <option value="Comida">Problema con la Comida</option>
                <option value="Cobro">Cobro o Facturación</option>
                <option value="Entrega">Retraso o Reparto</option>
                <option value="Otro">Otro Asunto</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Vincular a Pedido (Opcional)</label>
              <select
                value={ticketOrderId}
                onChange={(e) => setTicketOrderId(e.target.value)}
                className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
              >
                <option value="">Ninguno / Consulta General</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.replace(/^ord_/, '').slice(0, 4).toUpperCase()} — {o.restaurant_name} (${(o.total / 100).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Prioridad</label>
              <select
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as any)}
                className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgente (En curso)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Descripción del caso</label>
            <textarea
              rows={2}
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              placeholder="Explica qué sucedió o en qué podemos asistirte..."
              className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318] resize-none"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCreatingTicket}
              className="px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] border border-[#FFD318]/30 font-semibold text-[#FFD318] flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {isCreatingTicket ? 'Enviando...' : 'Enviar Ticket'}
            </button>
          </div>
        </form>

        {/* Existing Tickets List */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300">Historial de Tickets de Soporte</p>
          {isLoadingTickets ? (
            <p className="text-xs text-zinc-500 py-2">Cargando tickets...</p>
          ) : tickets.length === 0 ? (
            <div className="p-4 bg-[#070728]/50 rounded-xl border border-[#05268F]/25 text-center text-xs text-zinc-500">
              No tienes tickets de soporte registrados actualmente.
            </div>
          ) : (
            <div className="divide-y divide-[#05268F]/20 bg-[#070728]/80 rounded-xl border border-[#05268F]/30 overflow-hidden">
              {tickets.map((t) => (
                <div key={t.id} className="p-3.5 text-xs flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white capitalize">{t.category}</span>
                      {t.order_id && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[#FFD318] text-[10px] font-mono">
                          Pedido #{t.order_id.replace(/^ord_/, '').slice(0, 4).toUpperCase()}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'resolved'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : t.status === 'investigating'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          : 'bg-[#05268F]/30 text-[#FFD318] border border-[#FFD318]/30'
                      }`}>
                        {t.status === 'resolved' ? 'Resuelto' : t.status === 'investigating' ? 'En revisión' : 'Abierto'}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-xs leading-relaxed">{t.description}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(t.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
