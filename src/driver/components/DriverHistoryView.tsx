import React from 'react';
import { Order } from '../types.ts';
import { PackageCheck, Store, MapPin, DollarSign, Calendar, Banknote, CreditCard } from 'lucide-react';

interface DriverHistoryViewProps {
  orders: Order[];
  onRefresh: () => Promise<void>;
}

export const DriverHistoryView: React.FC<DriverHistoryViewProps> = ({ orders, onRefresh }) => {
  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-md mx-auto select-none">
      <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 p-5 rounded-3xl flex items-center justify-between shadow-xl">
        <div>
          <h2 className="text-lg font-black text-zinc-100">Historial de Entregas</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{orders.length} pedidos completados</p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-[#FFD318] hover:text-[#FFD318]/80 font-bold bg-[#05268F] px-3 py-1.5 rounded-xl border border-[#FFD318]/40 shadow-sm"
        >
          Actualizar
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 bg-gradient-to-b from-[#0a0f30]/60 to-[#070728]/60 rounded-3xl border border-[#05268F]/30 shadow-sm">
          <PackageCheck className="w-10 h-10 mx-auto mb-2 text-zinc-500" />
          <p className="font-bold text-sm text-zinc-300">Aún no hay entregas finalizadas</p>
          <p className="text-xs mt-1 text-zinc-400">Tus pedidos completados aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const earning = ((order.delivery_fee || 2500) + (order.tip_amount || 0)) / 100;
            return (
              <div
                key={order.id}
                className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 p-4 rounded-3xl flex flex-col gap-3 shadow-md hover:border-[#05268F]/60 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-400">
                      #{order.id.slice(-6)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      Entregado
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    +${earning.toFixed(2)} MXN
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                    <Store className="w-3.5 h-3.5 text-[#FFD318] shrink-0" />
                    <span className="truncate">{order.restaurant_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{order.delivery_address}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    {order.payment_method === 'cash' ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Banknote className="w-3 h-3" /> Efectivo: ${(order.total / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-400">
                        <CreditCard className="w-3 h-3" /> Digital: ${(order.total / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="font-mono">{new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
