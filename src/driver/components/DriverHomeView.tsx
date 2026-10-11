import React, { useState } from 'react';
import { DriverShiftSummary, DriverStatus } from '../types.ts';
import { Radio, MapPin, DollarSign, PackageCheck, Banknote, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

interface DriverHomeViewProps {
  status: DriverStatus;
  onStatusChange: (status: DriverStatus) => Promise<void>;
  location: { latitude: number; longitude: number; address?: string } | null;
  onRefreshLocation: () => Promise<void>;
  shiftSummary: DriverShiftSummary | null;
  onGoToActiveOrder?: () => void;
  hasActiveOrder: boolean;
  onTriggerTestDispatch?: () => Promise<void>;
}

export const DriverHomeView: React.FC<DriverHomeViewProps> = ({
  status,
  onStatusChange,
  location,
  onRefreshLocation,
  shiftSummary,
  onGoToActiveOrder,
  hasActiveOrder,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setGpsError(null);
      await onRefreshLocation();
    } catch (err: any) {
      setGpsError('No se pudo obtener la posición GPS del dispositivo');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isOnline = status === 'available';
  const hasGps = Boolean(location && location.latitude && location.longitude);

  const handleToggleOnline = (targetStatus: DriverStatus) => {
    if (targetStatus === 'available' && !hasGps) {
      setGpsError('El GPS es obligatorio para conectarse y recibir pedidos.');
      return;
    }
    setGpsError(null);
    onStatusChange(targetStatus);
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto select-none bg-white text-[#101828]">
      {/* Active Order Prompt if Assigned */}
      {hasActiveOrder && (
        <div
          onClick={onGoToActiveOrder}
          className="bg-[#05268F] text-white p-4 rounded-3xl shadow-lg shadow-[#05268F]/20 cursor-pointer active:scale-98 transition flex items-center justify-between border border-[#05268F]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD318] text-[#05268F] flex items-center justify-center font-bold">
              <PackageCheck className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#FFD318] uppercase tracking-wide">Tienes un pedido en curso</p>
              <p className="text-sm font-extrabold text-white">Ver detalles y navegación →</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Radar Card */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 border transition-all ${
          isOnline
            ? 'bg-[#EAF0FF] border-[#05268F]/30 shadow-md'
            : 'bg-[#F4F6F8] border-[#E5E7EB]'
        }`}
      >
        {/* Animated radar rings when online */}
        {isOnline && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-64 h-64 rounded-full border border-[#05268F] animate-ping duration-1000" />
            <div className="w-48 h-48 rounded-full border border-[#05268F] animate-ping duration-700" />
          </div>
        )}

        <div className="relative flex flex-col items-center text-center gap-3">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transition-transform ${
              isOnline
                ? 'bg-[#05268F] text-[#FFD318] scale-105 shadow-[#05268F]/20'
                : 'bg-white text-[#667085] border border-[#E5E7EB]'
            }`}
          >
            <Radio className={`w-10 h-10 ${isOnline ? 'animate-pulse' : ''}`} />
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E5E7EB] mb-2 shadow-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-ping' : 'bg-zinc-400'
                }`}
              />
              <span className="text-xs font-black uppercase tracking-wider text-[#101828]">
                {isOnline ? 'EN LÍNEA • DISPONIBLE' : status === 'busy' ? 'EN REPARTO ACTIVO' : status === 'paused' ? 'PAUSADO' : 'DESCONECTADO'}
              </span>
            </div>

            <h2 className="text-xl font-black text-[#101828]">
              {isOnline
                ? 'Esperando pedidos cercanos'
                : status === 'paused'
                ? 'Jornada en pausa'
                : 'Conéctate para recibir pedidos'}
            </h2>
            <p className="text-xs text-[#667085] mt-1 max-w-xs">
              {isOnline
                ? 'Las ofertas asignadas por el sistema aparecerán con ventana de 40 segundos para responder.'
                : 'Activa tu disponibilidad para recibir ofertas de restaurantes cercanos.'}
            </p>
          </div>

          {/* Large Connect / Disconnect Action Button */}
          {status !== 'busy' && (
            <button
              onClick={() => handleToggleOnline(isOnline ? 'offline' : 'available')}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-md ${
                isOnline
                  ? 'bg-white hover:bg-[#F4F6F8] text-[#101828] border border-[#E5E7EB]'
                  : 'bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] shadow-[#05268F]/25'
              }`}
            >
              {isOnline ? 'Ponerse Fuera de Servicio' : 'CONECTARSE AHORA'}
            </button>
          )}
        </div>
      </div>

      {/* GPS Location & Telemetry Card (Única fuente de visualización y control GPS) */}
      <div className="bg-white border border-[#E5E7EB] p-4 rounded-3xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#EAF0FF] text-[#05268F] flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wide">Ubicación GPS</p>
            <p className="text-xs font-black text-[#101828] truncate">
              {location?.address || (location ? `Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}` : 'Ubicación no disponible')}
            </p>
            <p className="text-[10px] text-[#667085]">
              {hasGps ? '✓ Posición activa del dispositivo' : '⚠️ Ubicación no disponible — Requiere GPS'}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2.5 rounded-xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#05268F] border border-[#E5E7EB] active:scale-95 transition shrink-0 ml-2"
          title="Actualizar coordenadas GPS"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#05268F]' : ''}`} />
        </button>
      </div>

      {gpsError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Mini Corte de Caja Preview */}
      <div className="bg-white border border-[#E5E7EB] p-4 rounded-3xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#101828] uppercase tracking-wider">
            Mini Corte de Caja Actual
          </span>
          <span className="text-[10px] font-bold text-[#05268F] bg-[#EAF0FF] px-2 py-0.5 rounded-full">
            {shiftSummary?.status === 'active' ? 'Turno en curso' : 'Sin turno'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Metric 1: Earnings */}
          <div className="bg-[#F4F6F8] p-3 rounded-2xl flex flex-col justify-between">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-1">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#667085] uppercase">Ganancia</p>
              <p className="text-sm font-black text-emerald-700">
                ${((shiftSummary?.earnings_total || 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Metric 2: Completed Orders */}
          <div className="bg-[#F4F6F8] p-3 rounded-2xl flex flex-col justify-between">
            <div className="w-6 h-6 rounded-lg bg-[#EAF0FF] text-[#05268F] flex items-center justify-center mb-1">
              <PackageCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#667085] uppercase">Entregas</p>
              <p className="text-sm font-black text-[#101828]">
                {shiftSummary?.orders_completed || 0}
              </p>
            </div>
          </div>

          {/* Metric 3: Cash In Hand */}
          <div className="bg-[#F4F6F8] p-3 rounded-2xl flex flex-col justify-between">
            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
              <Banknote className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#667085] uppercase">En Mano</p>
              <p className="text-sm font-black text-amber-800">
                ${((shiftSummary?.cash_collected || 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Official Identity Badge */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#EAF0FF] rounded-2xl border border-[#05268F]/20 text-xs text-[#05268F] font-semibold">
        <ShieldCheck className="w-4 h-4 text-[#05268F] shrink-0" />
        <span>Repartidor Oficial Directaurante</span>
      </div>
    </div>
  );
};
