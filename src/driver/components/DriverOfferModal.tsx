import React, { useEffect, useState } from 'react';
import { DriverOffer } from '../types.ts';
import { soundNotifier } from '../utils/audioAlert.ts';
import { MapPin, Store, Navigation, Clock, Check, X, ShieldAlert } from 'lucide-react';

interface DriverOfferModalProps {
  offer: DriverOffer;
  onAccept: (offerId: string) => Promise<void>;
  onReject: (offerId: string, reason?: string) => Promise<void>;
}

export const DriverOfferModal: React.FC<DriverOfferModalProps> = ({ offer, onAccept, onReject }) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(40);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    soundNotifier.playOfferAlert();

    const calculateRemaining = () => {
      const expiresTime = new Date(offer.expires_at).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.ceil((expiresTime - now) / 1000));
      return Math.min(40, diffSec);
    };

    setSecondsRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const rem = calculateRemaining();
      setSecondsRemaining(rem);
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [offer.id, offer.expires_at]);

  const handleAccept = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onAccept(offer.id);
      soundNotifier.playSuccessChime();
    } catch (err: any) {
      setActionError(err.message || 'No se pudo aceptar la oferta');
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onReject(offer.id, 'Rechazado por repartidor');
    } catch (err: any) {
      setActionError(err.message || 'Error al rechazar');
      setIsSubmitting(false);
    }
  };

  const progressPercentage = Math.max(0, Math.min(100, (secondsRemaining / 40) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 animate-fade-in">
      <div className="w-full max-w-md bg-white border-2 border-[#05268F] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Urgent Header with 40-Second Countdown */}
        <div className="bg-[#05268F] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD318] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFD318]"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase tracking-wider text-white">¡Nueva Oferta Directa!</span>
              <span className="text-xs font-mono font-black text-[#FFD318]">
                PEDIDO {offer.folio || `#${offer.order_id.slice(-4).toUpperCase()}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full border border-white/20">
            <Clock className="w-4 h-4 text-[#FFD318] animate-pulse" />
            <span className="font-mono font-black text-lg text-white">
              {secondsRemaining}s
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-[#E5E7EB] h-2">
          <div
            className={`h-full transition-all duration-500 ${
              secondsRemaining > 15 ? 'bg-[#FFD318]' : 'bg-red-500 animate-pulse'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Guaranteed Earnings Banner */}
          <div className="bg-[#EAF0FF] p-4 rounded-2xl border border-[#05268F]/20 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#667085] font-bold">Tu Ganancia</p>
              <p className="text-3xl font-black text-[#05268F]">
                ${(offer.driver_earnings / 100).toFixed(2)}{' '}
                <span className="text-xs font-normal text-[#667085]">MXN</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-[#667085] font-bold">Distancia</p>
              <div className="flex items-center gap-1 text-[#101828] font-black text-lg justify-end">
                <Navigation className="w-4 h-4 text-[#05268F]" />
                <span>{offer.distance_km} km</span>
              </div>
            </div>
          </div>

          {/* Route Summary */}
          <div className="space-y-3 bg-[#F4F6F8] p-3.5 rounded-2xl border border-[#E5E7EB] text-sm">
            {/* Step 1: Restaurant */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center shrink-0 mt-0.5">
                <Store className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#667085] font-bold">Recoger en:</p>
                <p className="font-black text-[#101828] truncate">{offer.restaurant_name}</p>
              </div>
            </div>

            <div className="ml-3.5 pl-3 border-l-2 border-dashed border-[#CBD5E1] py-1" />

            {/* Step 2: Customer Delivery */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#667085] font-bold">Entregar a cliente:</p>
                <p className="font-bold text-[#101828] text-xs line-clamp-2">{offer.delivery_address}</p>
              </div>
            </div>
          </div>

          {/* Order Details Mini */}
          <div className="flex items-center justify-between text-xs text-[#667085] px-1">
            <span>Pedido: <strong className="text-[#101828] font-mono">#{offer.order_id.slice(-6)}</strong></span>
            <span>Total comanda: <strong className="text-[#101828]">${(offer.order_total / 100).toFixed(2)}</strong></span>
          </div>

          {/* Large Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleReject}
              disabled={isSubmitting || secondsRemaining <= 0}
              className="py-4 px-3 rounded-2xl bg-[#F4F6F8] hover:bg-[#E5E7EB] text-[#101828] font-black text-sm flex items-center justify-center gap-2 border border-[#E5E7EB] active:scale-95 transition disabled:opacity-50"
            >
              <X className="w-5 h-5 text-[#667085]" />
              <span>RECHAZAR</span>
            </button>

            <button
              onClick={handleAccept}
              disabled={isSubmitting || secondsRemaining <= 0}
              className="py-4 px-3 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#05268F]/30 active:scale-95 transition disabled:opacity-50"
            >
              <Check className="w-5 h-5 text-[#FFD318]" />
              <span>{isSubmitting ? 'ASIGNANDO...' : 'ACEPTAR'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
