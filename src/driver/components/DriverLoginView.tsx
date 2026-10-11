import React, { useState } from 'react';
import { Lock, Mail, Bike, ArrowRight, User as UserIcon, Phone } from 'lucide-react';
import { PasswordRecoveryModal } from '../../direct/components/PasswordRecoveryModal.tsx';
import { DirectauranteLogo } from '../../direct/components/DirectauranteLogo.tsx';

interface DriverLoginViewProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister?: (data: { name: string; email: string; password: string; phone: string; vehicleInfo?: string }) => Promise<void>;
  onCancel?: () => void;
}

export const DriverLoginView: React.FC<DriverLoginViewProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('4621234567');
  const [vehicleInfo, setVehicleInfo] = useState('Moto Italika FT150');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        if (onRegister) {
          await onRegister({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            phone: phone.trim(),
            vehicleInfo: vehicleInfo.trim(),
          });
        }
      }
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Error al iniciar sesión' : 'Error al registrarse'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#101828] flex flex-col justify-center p-4 max-w-md mx-auto select-none">
      <div className="bg-white border border-[#E5E7EB] p-7 rounded-3xl shadow-xl flex flex-col gap-5">
        {/* Top Branding */}
        <div className="flex flex-col items-center text-center gap-2">
          <DirectauranteLogo size="xl" variant="light" showText={false} />
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-xl font-black text-[#101828]">Directaurante</h1>
              <span className="text-xs bg-[#05268F] text-[#FFD200] font-black px-2 py-0.5 rounded-full border border-[#FFD200]/30">
                Repartidor
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              {mode === 'login'
                ? 'Acceso exclusivo para repartidores autorizados'
                : 'Únete al equipo de repartidores de Directaurante'}
            </p>
          </div>
        </div>

        {/* Tab Toggle: Iniciar Sesión / Registrar Cuenta */}
        <div className="grid grid-cols-2 p-1 bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-xl transition ${
              mode === 'login'
                ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-xl transition ${
              mode === 'register'
                ? 'bg-[#05268F] text-[#FFD318] shadow-sm'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            Registrar Cuenta
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                  Nombre Completo
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Carlos Hernández"
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F]"
                  />
                  <UserIcon className="w-4 h-4 text-[#667085] absolute right-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                  Vehículo (Moto / Bici / Auto)
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    value={vehicleInfo}
                    onChange={(e) => setVehicleInfo(e.target.value)}
                    placeholder="Moto Italika FT150 Rojo"
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F]"
                  />
                  <Bike className="w-4 h-4 text-[#667085] absolute right-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                  Teléfono (WhatsApp)
                </label>
                <div className="mt-1 relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="4621234567"
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F]"
                  />
                  <Phone className="w-4 h-4 text-[#667085] absolute right-3 top-3.5" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
              Correo Electrónico
            </label>
            <div className="mt-1 relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                required
                className="w-full px-4 py-3 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F]"
              />
              <Mail className="w-4 h-4 text-[#667085] absolute right-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
              Contraseña
            </label>
            <div className="mt-1 relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
                className="w-full px-4 py-3 rounded-2xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F]"
              />
              <Lock className="w-4 h-4 text-[#667085] absolute right-3 top-3.5" />
            </div>
          </div>

          {mode === 'login' && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsRecoveryOpen(true)}
                className="text-xs text-[#05268F] hover:underline font-bold"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition disabled:opacity-50"
          >
            <span>
              {isLoading
                ? 'VERIFICANDO...'
                : mode === 'register'
                ? 'REGISTRARME COMO REPARTIDOR'
                : 'INICIAR SESIÓN'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <PasswordRecoveryModal
          isOpen={isRecoveryOpen}
          onClose={() => setIsRecoveryOpen(false)}
          initialEmail={email}
        />
      </div>
    </div>
  );
};
