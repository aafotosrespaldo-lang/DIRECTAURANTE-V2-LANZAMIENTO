import React, { useState } from 'react';
import { Order, OrderItem } from '../types.ts';
import {
  MapPin,
  Store,
  Phone,
  Navigation,
  CheckCircle2,
  Package,
  CheckSquare,
  Square,
  Camera,
  Banknote,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface DriverActiveOrderViewProps {
  order: Order;
  onArrivedAtRestaurant: (orderId: string) => Promise<void>;
  onPickupOrder: (orderId: string) => Promise<void>;
  onStartDelivering: (orderId: string) => Promise<void>;
  onCompleteDelivery: (orderId: string, notes?: string) => Promise<void>;
  onOpenChat: (orderId: string) => void;
}

export const DriverActiveOrderView: React.FC<DriverActiveOrderViewProps> = ({
  order,
  onArrivedAtRestaurant,
  onPickupOrder,
  onStartDelivering,
  onCompleteDelivery,
  onOpenChat,
}) => {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [photoEvidence, setPhotoEvidence] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasArrivedAtRest, setHasArrivedAtRest] = useState<boolean>(
    order.status_history?.some((h: any) => h.notes?.includes('llegado al restaurante')) || false
  );

  const toggleCheckItem = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allItemsChecked = order.items.every((_: OrderItem, idx: number) => checkedItems[idx]);

  const handleArrived = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onArrivedAtRestaurant(order.id);
      setHasArrivedAtRest(true);
    } catch (err: any) {
      setActionError(err.message || 'Error al notificar llegada');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickup = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onPickupOrder(order.id);
    } catch (err: any) {
      setActionError(err.message || 'Error al confirmar recolección');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDelivering = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onStartDelivering(order.id);
    } catch (err: any) {
      setActionError(err.message || 'Error al iniciar trayecto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliver = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onCompleteDelivery(order.id, deliveryNotes);
    } catch (err: any) {
      setActionError(err.message || 'Error al finalizar entrega');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoEvidence(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openExternalMaps = (address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      address + ', Pénjamo, Guanajuato'
    )}`;
    window.open(url, '_blank');
  };

  const isAssigned = order.status === 'assigned';
  const isPickedUp = order.status === 'picked_up';
  const isDelivering = order.status === 'delivering';
  const isDelivered = order.status === 'delivered';

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-md mx-auto select-none bg-white text-[#101828]">
      {/* Top Lifecycle Stepper */}
      <div className="bg-[#F4F6F8] border border-[#E5E7EB] p-4 rounded-3xl shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-[#05268F] font-mono font-black text-sm bg-[#FFD318] px-2.5 py-0.5 rounded-lg shadow-xs">
            PEDIDO {order.folio || order.order_code || `#${order.id.slice(-4).toUpperCase()}`}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#EAF0FF] text-[#05268F] font-black uppercase text-[10px]">
            {order.status === 'assigned'
              ? 'Rumbo al Restaurante'
              : order.status === 'picked_up'
              ? 'Pedido Recogido'
              : order.status === 'delivering'
              ? 'Rumbo al Cliente'
              : 'Entregado'}
          </span>
        </div>

        {/* Counter Pickup Help Banner */}
        <div className="bg-[#EAF0FF] border border-[#05268F]/20 p-2.5 rounded-2xl mb-3">
          <span className="text-[10px] uppercase font-bold text-[#667085] block">Frase para mostrador:</span>
          <span className="text-xs font-black text-[#05268F]">
            “Hola, buenos días. Vengo por el pedido {order.folio || order.order_code || order.id.slice(-4).toUpperCase()}”
          </span>
        </div>

        {/* Visual Progress Steps */}
        <div className="grid grid-cols-4 gap-1 relative">
          {/* Step 1: Assigned */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                isAssigned || isPickedUp || isDelivering || isDelivered
                  ? 'bg-[#05268F] text-[#FFD318]'
                  : 'bg-white text-[#667085] border border-[#E5E7EB]'
              }`}
            >
              1
            </div>
            <span className="text-[9px] text-[#667085] font-bold">Asignado</span>
          </div>

          {/* Step 2: Arrived & Picked up */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                isPickedUp || isDelivering || isDelivered
                  ? 'bg-[#05268F] text-[#FFD318]'
                  : isAssigned && hasArrivedAtRest
                  ? 'bg-[#FFD318] text-[#05268F] animate-pulse font-black'
                  : 'bg-white text-[#667085] border border-[#E5E7EB]'
              }`}
            >
              2
            </div>
            <span className="text-[9px] text-[#667085] font-bold">Recolección</span>
          </div>

          {/* Step 3: Delivering */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                isDelivering || isDelivered
                  ? 'bg-[#05268F] text-[#FFD318]'
                  : 'bg-white text-[#667085] border border-[#E5E7EB]'
              }`}
            >
              3
            </div>
            <span className="text-[9px] text-[#667085] font-bold">En ruta</span>
          </div>

          {/* Step 4: Delivered */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                isDelivered ? 'bg-emerald-600 text-white' : 'bg-white text-[#667085] border border-[#E5E7EB]'
              }`}
            >
              ✓
            </div>
            <span className="text-[9px] text-[#667085] font-bold">Entregado</span>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* PHASE 1: RUMBO AL RESTAURANTE & EN EL RESTAURANTE */}
      {isAssigned && (
        <div className="flex flex-col gap-3">
          {/* Restaurant Details Card */}
          <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl flex flex-col gap-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EAF0FF] text-[#05268F] flex items-center justify-center shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#667085] font-bold">Punto de Recolección</p>
                  <h3 className="text-base font-black text-[#101828]">{order.restaurant_name}</h3>
                  <p className="text-xs text-[#667085]">Pénjamo Centro</p>
                </div>
              </div>

              <button
                onClick={() => openExternalMaps(order.restaurant_name)}
                className="p-3 rounded-2xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#05268F] border border-[#E5E7EB] active:scale-95 transition"
                title="Abrir GPS externo"
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openExternalMaps(order.restaurant_name)}
                className="py-3 px-3 rounded-xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#101828] font-bold text-xs flex items-center justify-center gap-2 border border-[#E5E7EB] active:scale-95 transition"
              >
                <Navigation className="w-4 h-4 text-[#05268F]" />
                <span>Navegar GPS</span>
              </button>

              <button
                onClick={() => onOpenChat(order.id)}
                className="py-3 px-3 rounded-xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#101828] font-bold text-xs flex items-center justify-center gap-2 border border-[#E5E7EB] active:scale-95 transition"
              >
                <MessageSquare className="w-4 h-4 text-[#05268F]" />
                <span>Chat Pedido</span>
              </button>
            </div>

            {/* Stage button: Arrived or items verification */}
            {!hasArrivedAtRest ? (
              <button
                onClick={handleArrived}
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
              >
                <MapPin className="w-5 h-5 text-[#FFD318]" />
                <span>{isSubmitting ? 'REGISTRANDO...' : 'HE LLEGADO AL RESTAURANTE'}</span>
              </button>
            ) : (
              <div className="p-3 bg-[#FFF7D6] border border-[#FFD318] rounded-2xl flex items-center gap-2 text-xs text-[#101828] font-bold">
                <Check className="w-4 h-4 text-[#05268F] shrink-0" />
                <span>Llegada confirmada. Verifica los productos con la cocina.</span>
              </div>
            )}
          </div>

          {/* Product Checklist Card */}
          <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#05268F]" />
                <h4 className="text-sm font-black text-[#101828]">Verificación de Comanda</h4>
              </div>
              <span className="text-[11px] font-mono text-[#667085]">
                {order.items.length} productos
              </span>
            </div>

            <p className="text-[11px] text-[#667085]">
              Marca cada producto al verificar que la comanda esté completa:
            </p>

            <div className="space-y-2 mt-1">
              {order.items.map((item: OrderItem, idx: number) => (
                <div
                  key={idx}
                  onClick={() => toggleCheckItem(idx)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                    checkedItems[idx]
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-[#F4F6F8] border-[#E5E7EB] text-[#101828]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checkedItems[idx] ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-[#667085]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">
                        {item.quantity}x {item.product_name}
                      </span>
                    </div>
                    {item.variants && item.variants.length > 0 && (
                      <p className="text-[11px] text-[#667085] mt-0.5">
                        {item.variants.map((v: any) => v.option_name).join(', ')}
                      </p>
                    )}
                    {item.toppings && item.toppings.length > 0 && (
                      <p className="text-[11px] text-[#05268F] font-semibold mt-0.5">
                        +{item.toppings.map((t: any) => t.name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-amber-800 italic mt-0.5">Nota: "{item.notes}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pick Up Confirmation Action */}
            <button
              onClick={handlePickup}
              disabled={isSubmitting}
              className={`w-full mt-2 py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-95 ${
                allItemsChecked
                  ? 'bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318]'
                  : 'bg-[#F4F6F8] hover:bg-[#E5E7EB] text-[#101828] border border-[#E5E7EB]'
              }`}
            >
              <Package className="w-5 h-5" />
              <span>{isSubmitting ? 'CONFIRMANDO...' : 'CONFIRMAR PEDIDO RECOGIDO'}</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: PEDIDO RECOGIDO (TRANSICIÓN A EN RUTA) */}
      {isPickedUp && (
        <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl flex flex-col gap-4 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-[#EAF0FF] text-[#05268F] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#101828]">¡Pedido en tus manos!</h3>
            <p className="text-xs text-[#667085] mt-1">
              Paquete verificado en {order.restaurant_name}. Presiona el botón para comenzar el trayecto al domicilio del cliente.
            </p>
          </div>

          <button
            onClick={handleStartDelivering}
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-95"
          >
            <Navigation className="w-5 h-5" />
            <span>{isSubmitting ? 'INICIANDO...' : 'INICIAR TRAYECTO AL CLIENTE'}</span>
          </button>
        </div>
      )}

      {/* PHASE 3: RUTA HACIA EL CLIENTE & CONFIRMACIÓN DE ENTREGA */}
      {isDelivering && (
        <div className="flex flex-col gap-4">
          {/* Customer & Delivery Destination Card */}
          <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl flex flex-col gap-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#667085] font-bold">Entrega a Domicilio</p>
                  <h3 className="text-base font-black text-[#101828]">{order.customer_name}</h3>
                  <p className="text-xs text-[#667085] font-medium mt-0.5">{order.delivery_address}</p>
                </div>
              </div>

              <button
                onClick={() => openExternalMaps(order.delivery_address || 'Pénjamo')}
                className="p-3 rounded-2xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#05268F] border border-[#E5E7EB] active:scale-95 transition"
                title="Abrir GPS"
              >
                <Navigation className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contact Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${order.customer_phone}`}
                className="py-3 px-3 rounded-xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#101828] font-bold text-xs flex items-center justify-center gap-2 border border-[#E5E7EB] active:scale-95 transition text-center"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Llamar Cliente</span>
              </a>

              <button
                onClick={() => onOpenChat(order.id)}
                className="py-3 px-3 rounded-xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#101828] font-bold text-xs flex items-center justify-center gap-2 border border-[#E5E7EB] active:scale-95 transition"
              >
                <MessageSquare className="w-4 h-4 text-[#05268F]" />
                <span>Chat Directo</span>
              </button>
            </div>

            {order.notes && (
              <div className="p-3 bg-[#F4F6F8] rounded-2xl border border-[#E5E7EB] text-xs">
                <p className="text-[#667085] text-[10px] uppercase font-bold">Instrucciones de entrega:</p>
                <p className="text-[#101828] font-semibold mt-0.5">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Payment Collection Card */}
          <div
            className={`p-5 rounded-3xl border ${
              order.payment_method === 'cash'
                ? 'bg-[#FFF7D6] border-2 border-[#FFD318] shadow-xs'
                : 'bg-white border border-[#E5E7EB]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {order.payment_method === 'cash' ? (
                  <Banknote className="w-5 h-5 text-amber-800" />
                ) : (
                  <CreditCard className="w-5 h-5 text-[#05268F]" />
                )}
                <span className="font-black text-sm uppercase text-[#101828]">
                  {order.payment_method === 'cash' ? 'Cobro en Efectivo' : 'Pago Digital'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[#101828]">
                {order.payment_method.toUpperCase()}
              </span>
            </div>

            {order.payment_method === 'cash' ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-900 font-semibold">
                  ⚠️ Debes cobrar al cliente el total exacto antes de entregar el paquete:
                </p>
                <div className="bg-white p-3 rounded-2xl border border-[#FFD318] flex items-center justify-between">
                  <span className="text-xs text-[#667085] font-bold">TOTAL A COBRAR:</span>
                  <span className="text-2xl font-black text-[#101828] font-mono">
                    ${(order.total / 100).toFixed(2)} MXN
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-700 font-bold">
                ✓ El pedido ya fue pagado digitalmente. No solicites dinero en efectivo al cliente.
              </p>
            )}
          </div>

          {/* Proof of Delivery / Photo Evidence */}
          <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#101828] flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#05268F]" />
                <span>Foto de Evidencia de Entrega</span>
              </span>
              {photoEvidence && (
                <span className="text-[10px] font-bold text-emerald-700">Capturada ✓</span>
              )}
            </div>

            {photoEvidence ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#E5E7EB] max-h-40">
                <img src={photoEvidence} alt="Evidencia" className="w-full object-cover" />
                <button
                  onClick={() => setPhotoEvidence(null)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-[#E5E7EB] hover:border-[#05268F] bg-[#F4F6F8] rounded-2xl p-4 flex flex-col items-center justify-center gap-1 cursor-pointer transition">
                <Camera className="w-6 h-6 text-[#667085]" />
                <span className="text-xs font-bold text-[#101828]">Tomar foto o subir evidencia</span>
                <span className="text-[10px] text-[#667085]">Fachada o paquete entregado</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                />
              </label>
            )}

            {/* Delivery Notes */}
            <input
              type="text"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Notas de entrega (ej: Recibió cliente en puerta)"
              className="w-full px-3 py-2.5 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs text-[#101828] focus:outline-none focus:border-[#05268F]"
            />

            {/* Big Finish Button */}
            <button
              onClick={handleDeliver}
              disabled={isSubmitting}
              className="w-full mt-2 py-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5 text-[#FFD318]" />
              <span>{isSubmitting ? 'FINALIZANDO...' : 'CONFIRMAR ENTREGA COMPLETADA'}</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: ENTREGA COMPLETADA / RESUMEN */}
      {isDelivered && (
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-3xl flex flex-col items-center text-center gap-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-xl font-black text-[#101828]">¡Entrega exitosa!</h3>
            <p className="text-xs text-[#667085] mt-1">El pedido fue completado y registrado en el Core.</p>
          </div>

          <div className="w-full bg-[#F4F6F8] p-4 rounded-2xl border border-[#E5E7EB] flex items-center justify-between text-left">
            <div>
              <p className="text-[10px] text-[#667085] uppercase font-bold">Tu tarifa de entrega</p>
              <p className="text-2xl font-black text-[#05268F]">
                ${(((order.delivery_fee || 2500) + (order.tip_amount || 0)) / 100).toFixed(2)} MXN
              </p>
            </div>
            {order.tip_amount > 0 && (
              <span className="text-xs font-bold text-amber-800 bg-[#FFF7D6] px-2 py-1 rounded-lg border border-[#FFD318]">
                +${(order.tip_amount / 100).toFixed(2)} propina
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
