import React, { useState, useEffect } from 'react';
import { X, Mail, KeyRound, Lock, CheckCircle2, AlertCircle, ArrowRight, RotateCw } from 'lucide-react';
import { directApi } from '../api/client.ts';

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess?: () => void;
}

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [codeOrToken, setCodeOrToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Check URL hash parameters for direct password reset link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const fullUrl = hash.includes('?') ? hash : search;
      if (fullUrl.includes('token=')) {
        try {
          const params = new URLSearchParams(fullUrl.split('?')[1]);
          const tokenParam = params.get('token');
          const emailParam = params.get('email');
          if (tokenParam) {
            setCodeOrToken(tokenParam);
            if (emailParam) setEmail(emailParam);
            setStep('reset');
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }, []);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await directApi.forgotPassword(email.trim());
      setInfoMsg(res.message);
      setStep('reset');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!codeOrToken || codeOrToken.trim().length === 0) {
      setErrorMsg('Ingresa el código de 6 dígitos o el token de recuperación');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Verifícalas e intenta nuevamente.');
      return;
    }

    setIsLoading(true);

    try {
      const isSixDigitCode = /^\d{6}$/.test(codeOrToken.trim());
      const payload: any = {
        newPassword,
      };

      if (isSixDigitCode) {
        payload.code = codeOrToken.trim();
        payload.email = email.trim();
      } else {
        payload.token = codeOrToken.trim();
        if (email.trim()) payload.email = email.trim();
      }

      await directApi.resetPassword(payload);
      setStep('success');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo restablecer la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setErrorMsg('');
    setInfoMsg('');
    setStep('request');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-[#E5E7EB] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-[#101828]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#101828] hover:bg-[#F4F6F8] rounded-full transition"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Indicator */}
        <div className="text-center space-y-1 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#05268F] border border-[#FFD318]/50 flex items-center justify-center text-[#FFD318] font-black text-2xl mx-auto shadow-md mb-3">
            D
          </div>
          <h2 className="text-xl font-black text-[#101828]">Recuperar Contraseña</h2>
          <p className="text-xs text-[#667085]">Directaurante · Seguridad y Acceso Seguro</p>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{errorMsg}</div>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-[#EAF0FF] border border-[#05268F]/30 text-[#05268F] text-xs font-medium flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#05268F] shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{infoMsg}</div>
          </div>
        )}

        {/* STEP 1: Solicitar código */}
        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <p className="text-xs text-[#667085] leading-relaxed">
              Introduce el correo electrónico asociado a tu cuenta. Te enviaremos un código de seguridad de 6 dígitos
              para verificar tu identidad y restablecer tu contraseña.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F] focus:bg-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>ENVIANDO CÓDIGO...</span>
                </>
              ) : (
                <>
                  <span>ENVIAR CÓDIGO DE RECUPERACIÓN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('reset')}
                className="text-xs text-[#05268F] hover:underline font-bold"
              >
                ¿Ya tienes un código o token? Haz clic aquí
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Introducir código y nueva contraseña */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <p className="text-xs text-[#667085] leading-relaxed">
              Ingresa el código de 6 dígitos enviado a tu correo o el token de recuperación, junto con tu nueva contraseña.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F] focus:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                Código de 6 Dígitos o Token
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={codeOrToken}
                  onChange={(e) => setCodeOrToken(e.target.value)}
                  placeholder="Ej. 849201"
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-[#05268F] tracking-wider focus:outline-none focus:border-[#05268F] focus:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                Nueva Contraseña (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresa tu nueva contraseña"
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F] focus:bg-white"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block mb-1">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className="w-full bg-[#F4F6F8] border border-[#E5E7EB] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#05268F] focus:bg-white"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>ACTUALIZANDO CONTRASEÑA...</span>
                </>
              ) : (
                <>
                  <span>RESTABLECER Y REVOCAR SESIONES</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-[#667085] hover:text-[#101828] font-bold"
              >
                ← Solicitar otro código
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-[#05268F] hover:underline font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Confirmación exitosa */}
        {step === 'success' && (
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-black text-[#101828]">¡Contraseña Actualizada!</h3>
              <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                Tu contraseña ha sido restablecida con éxito y todas las sesiones anteriores han sido revocadas por
                seguridad. Ahora puedes iniciar sesión normalmente.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-xs uppercase tracking-wider shadow-md transition active:scale-[0.98]"
            >
              INICIAR SESIÓN CON MI NUEVA CONTRASEÑA
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
