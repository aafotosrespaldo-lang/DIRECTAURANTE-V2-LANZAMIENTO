import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { X, Lock, Mail, User as UserIcon, Phone, UserCheck, Bike, Store, ArrowRight, ShieldCheck } from 'lucide-react';
import { PasswordRecoveryModal } from './PasswordRecoveryModal.tsx';
import { DirectauranteLogo } from './DirectauranteLogo.tsx';

type PublicRole = 'customer' | 'driver' | 'restaurant';

export const AuthScreen: React.FC = () => {
  const { isAuthOpen, setIsAuthOpen, login, register, user, activeView } = useApp();

  // Mode: login or registration for any role
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Selected access role (3 public roles: Cliente, Repartidor, Restaurante)
  const [selectedRole, setSelectedRole] = useState<PublicRole>('customer');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('4621234567');
  const [vehicleInfo, setVehicleInfo] = useState('Moto Italika FT150');
  const [restaurantName, setRestaurantName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password recovery modal state
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  // Check if running in dedicated mobile client app mode
  const isMobileClientMode = typeof window !== 'undefined' && (
    window.location.search.includes('app=client') ||
    window.location.search.includes('mode=client_app') ||
    window.location.hash.includes('client_app')
  );

  // Pre-select role if user was previously in that role, or based on active view
  useEffect(() => {
    if (user?.role === 'restaurant' || activeView === 'restaurant_portal') {
      setSelectedRole('restaurant');
    } else if (user?.role === 'driver' || activeView === 'driver_app') {
      setSelectedRole('driver');
    } else {
      setSelectedRole('customer');
    }
  }, [user, activeView]);

  if (!isAuthOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (authMode === 'login') {
        const trimmedEmail = email.trim().toLowerCase();
        const isMaster =
          trimmedEmail === 'admin@directaurante.com' ||
          trimmedEmail === 'master@directaurante.com' ||
          trimmedEmail === 'directaurante@gmail.com';
        const expectedRole = isMaster ? 'master' : selectedRole;
        await login(email.trim(), password, expectedRole);
      } else {
        await register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          role: selectedRole,
          restaurant_name: selectedRole === 'restaurant' ? (restaurantName.trim() || name.trim()) : undefined,
          vehicle_info: selectedRole === 'driver' ? (vehicleInfo.trim() || 'Motocicleta') : undefined,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-[#E5E7EB] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-[#101828]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsAuthOpen(false)}
          className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#101828] hover:bg-[#F4F6F8] rounded-full transition"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-1 mb-5">
          <div className="flex justify-center mb-2">
            <DirectauranteLogo size="lg" variant="light" showText={false} />
          </div>
          <h2 className="text-xl font-extrabold text-[#101828] tracking-tight">
            {isMobileClientMode
              ? authMode === 'login'
                ? 'Directaurante Cliente'
                : 'Registro de Cliente'
              : authMode === 'login'
              ? selectedRole === 'driver'
                ? 'Acceso de Repartidor'
                : selectedRole === 'restaurant'
                ? 'Acceso de Restaurante'
                : 'Acceso a Directaurante'
              : selectedRole === 'driver'
              ? 'Registro de Repartidor'
              : selectedRole === 'restaurant'
              ? 'Registro de Restaurante'
              : 'Crear Cuenta de Cliente'}
          </h2>
          <p className="text-xs text-[#667085] max-w-sm mx-auto">
            {authMode === 'login'
              ? 'Ingresa tus credenciales para acceder al sistema'
              : selectedRole === 'driver'
              ? 'Únete a la flota local: entregas justas y liquidación transparente'
              : selectedRole === 'restaurant'
              ? 'Vende directo sin comisiones abusivas y recibe comandas en vivo'
              : 'Pide directo a tus restaurantes locales sin intermediarios inflados'}
          </p>
        </div>

        {/* Login / Register Toggle (Always visible for all roles) */}
        <div className="grid grid-cols-2 p-1 bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMsg('');
            }}
            className={`py-2 rounded-xl transition ${
              authMode === 'login'
                ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMsg('');
            }}
            className={`py-2 rounded-xl transition ${
              authMode === 'register'
                ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            Registrar Cuenta
          </button>
        </div>

        {/* 3 PUBLIC ROLE OPTIONS — Cliente, Repartidor, Restaurante */}
        {!isMobileClientMode && (
          <div className="space-y-2 mb-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
              {authMode === 'login' ? 'Tipo de Acceso' : 'Tipo de Cuenta a Registrar'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option 1: Cliente */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('customer');
                  setErrorMsg('');
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                  selectedRole === 'customer'
                    ? 'border-[#05268F] bg-[#EAF0FF] shadow-sm ring-2 ring-[#05268F]/20'
                    : 'border-[#E5E7EB] bg-white hover:bg-[#F4F6F8]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    selectedRole === 'customer' ? 'bg-[#05268F]' : 'bg-[#F4F6F8]'
                  }`}>
                    <UserCheck className={`w-4 h-4 ${selectedRole === 'customer' ? 'text-[#FFD318]' : 'text-[#667085]'}`} />
                  </div>
                  {selectedRole === 'customer' && (
                    <span className="w-2 h-2 rounded-full bg-[#05268F]" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#101828]">Cliente</p>
                  <p className="text-[10px] text-[#667085] leading-tight">Pedir y comer</p>
                </div>
              </button>

              {/* Option 2: Repartidor */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('driver');
                  setErrorMsg('');
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                  selectedRole === 'driver'
                    ? 'border-[#05268F] bg-[#EAF0FF] shadow-sm ring-2 ring-[#05268F]/20'
                    : 'border-[#E5E7EB] bg-white hover:bg-[#F4F6F8]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    selectedRole === 'driver' ? 'bg-[#05268F]' : 'bg-[#F4F6F8]'
                  }`}>
                    <Bike className={`w-4 h-4 ${selectedRole === 'driver' ? 'text-[#FFD318]' : 'text-[#667085]'}`} />
                  </div>
                  {selectedRole === 'driver' && (
                    <span className="w-2 h-2 rounded-full bg-[#05268F]" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#101828]">Repartidor</p>
                  <p className="text-[10px] text-[#667085] leading-tight">Entregas y ruta</p>
                </div>
              </button>

              {/* Option 3: Restaurante */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('restaurant');
                  setErrorMsg('');
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                  selectedRole === 'restaurant'
                    ? 'border-[#05268F] bg-[#EAF0FF] shadow-sm ring-2 ring-[#05268F]/20'
                    : 'border-[#E5E7EB] bg-white hover:bg-[#F4F6F8]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    selectedRole === 'restaurant' ? 'bg-[#05268F]' : 'bg-[#F4F6F8]'
                  }`}>
                    <Store className={`w-4 h-4 ${selectedRole === 'restaurant' ? 'text-[#FFD318]' : 'text-[#667085]'}`} />
                  </div>
                  {selectedRole === 'restaurant' && (
                    <span className="w-2 h-2 rounded-full bg-[#05268F]" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#101828]">Restaurante</p>
                  <p className="text-[10px] text-[#667085] leading-tight">Cocina y menú</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {authMode === 'register' && (
            <>
              <div>
                <label className="text-[#667085] block mb-1 font-bold text-[11px] uppercase tracking-wider">
                  {selectedRole === 'restaurant' ? 'Nombre del Encargado / Propietario' : 'Nombre Completo'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedRole === 'restaurant' ? 'Pepe Morales' : 'Carlos Pérez'}
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2.5 text-[#101828] font-medium focus:outline-none focus:border-[#05268F]"
                    required
                  />
                  <UserIcon className="w-4 h-4 text-[#667085] absolute left-3 top-3" />
                </div>
              </div>

              {selectedRole === 'restaurant' && (
                <div>
                  <label className="text-[#667085] block mb-1 font-bold text-[11px] uppercase tracking-wider">
                    Nombre del Restaurante
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Taquería El Güero"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2.5 text-[#101828] font-medium focus:outline-none focus:border-[#05268F]"
                      required
                    />
                    <Store className="w-4 h-4 text-[#667085] absolute left-3 top-3" />
                  </div>
                </div>
              )}

              {selectedRole === 'driver' && (
                <div>
                  <label className="text-[#667085] block mb-1 font-bold text-[11px] uppercase tracking-wider">
                    Vehículo (Moto / Bici / Auto)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={vehicleInfo}
                      onChange={(e) => setVehicleInfo(e.target.value)}
                      placeholder="Moto Italika FT150 Rojo (Placas GTO-223)"
                      className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2.5 text-[#101828] font-medium focus:outline-none focus:border-[#05268F]"
                      required
                    />
                    <Bike className="w-4 h-4 text-[#667085] absolute left-3 top-3" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[#667085] block mb-1 font-bold text-[11px] uppercase tracking-wider">
                  Teléfono (WhatsApp)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="4621234567"
                    className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2.5 text-[#101828] font-medium focus:outline-none focus:border-[#05268F]"
                    required
                  />
                  <Phone className="w-4 h-4 text-[#667085] absolute left-3 top-3" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[#667085] block mb-1 font-bold text-[11px] uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@email.com"
                className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2.5 text-[#101828] font-medium focus:outline-none focus:border-[#05268F]"
                required
              />
              <Mail className="w-4 h-4 text-[#667085] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#667085] font-bold text-[11px] uppercase tracking-wider">
                Contraseña
              </label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(true)}
                  className="text-xs text-[#05268F] hover:underline font-bold"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2.5 text-[#101828] font-medium focus:outline-none focus:border-[#05268F]"
                required
              />
              <Lock className="w-4 h-4 text-[#667085] absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 mt-3 disabled:opacity-50"
          >
            <span>
              {isSubmitting
                ? 'Validando...'
                : authMode === 'register'
                ? selectedRole === 'driver'
                  ? 'Registrar Cuenta de Repartidor'
                  : selectedRole === 'restaurant'
                  ? 'Registrar Cuenta de Restaurante'
                  : 'Registrar Cuenta de Cliente'
                : selectedRole === 'driver'
                ? 'Iniciar Sesión como Repartidor'
                : selectedRole === 'restaurant'
                ? 'Iniciar Sesión como Restaurante'
                : 'Iniciar Sesión como Cliente'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Password Recovery Modal */}
        <PasswordRecoveryModal
          isOpen={isRecoveryOpen}
          onClose={() => setIsRecoveryOpen(false)}
          initialEmail={email}
        />
      </div>
    </div>
  );
};
