import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { directApi } from '../api/client.ts';
import { realtimeClient } from '../services/realtimeClient.ts';
import { Order, OrderStatus, OrderMessage } from '../types.ts';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  Truck,
  RotateCw,
  ShoppingBag,
  Store,
  Bike,
  XCircle,
  MessageCircle,
  Send,
  X,
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  CreditCard,
  ExternalLink,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; step: number; color: string; badge: string; icon: any }
> = {
  pending: {
    label: 'Recibido por el restaurante',
    step: 1,
    color: 'text-[#FFD318]',
    badge: 'bg-[#FFD318]/20 text-[#FFD318] border-[#FFD318]/30',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmado por cocina',
    step: 2,
    color: 'text-sky-400',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    icon: CheckCircle,
  },
  preparing: {
    label: 'Preparando tus platillos',
    step: 3,
    color: 'text-[#05268F]',
    badge: 'bg-[#05268F]/20 text-[#05268F] border-[#05268F]/30',
    icon: Store,
  },
  ready: {
    label: 'Listo en mostrador',
    step: 4,
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle,
  },
  assigned: {
    label: 'Repartidor asignado',
    step: 5,
    color: 'text-blue-400',
    badge: 'bg-[#05268F]/40 text-[#FFD318] border-[#FFD318]/30',
    icon: Bike,
  },
  picked_up: {
    label: 'Pedido recolectado',
    step: 6,
    color: 'text-blue-400',
    badge: 'bg-[#05268F]/40 text-[#FFD318] border-[#FFD318]/30',
    icon: Bike,
  },
  delivering: {
    label: 'En camino a tu ubicación',
    step: 7,
    color: 'text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    icon: Truck,
  },
  delivered: {
    label: 'Entregado exitosamente',
    step: 8,
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Pedido Cancelado',
    step: 0,
    color: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: XCircle,
  },
};

interface MyOrdersProps {
  embedded?: boolean;
}

export const MyOrders: React.FC<MyOrdersProps> = ({ embedded = false }) => {
  const { orders, isLoadingOrders, loadOrders, setActiveView, user, addToast, setPayingOrder } = useApp();

  // Chat State
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<OrderMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Evidence Modal State
  const [evidenceOrderId, setEvidenceOrderId] = useState<string | null>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);

  const handlePayMercadoPago = (order: Order) => {
    setPayingOrder(order);
  };

  // Fetch messages when chat open
  const fetchChatMessages = async (orderId: string) => {
    try {
      const msgs = await directApi.getOrderMessages(orderId);
      setChatMessages(msgs);
    } catch {
      // non-fatal
    }
  };

  const openChat = async (orderId: string) => {
    setChatOrderId(orderId);
    await fetchChatMessages(orderId);
  };

  // Real-time chat listener
  useEffect(() => {
    if (!chatOrderId) return;
    const unsub = realtimeClient.subscribe((event) => {
      if (event.type === 'MESSAGE_CREATED' && event.order_id === chatOrderId) {
        fetchChatMessages(chatOrderId);
      }
    });
    return () => unsub();
  }, [chatOrderId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatOrderId || !chatInput.trim()) return;

    setIsSendingMessage(true);
    try {
      const sent = await directApi.sendOrderMessage(chatOrderId, chatInput.trim());
      setChatMessages((prev) => [...prev, sent]);
      setChatInput('');
    } catch (err: any) {
      addToast('error', err.message || 'Error al enviar mensaje');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const openEvidence = async (orderId: string) => {
    setEvidenceOrderId(orderId);
    try {
      const evs = await directApi.getOrderEvidence(orderId);
      setEvidenceList(evs);
    } catch {
      setEvidenceList([]);
    }
  };

  return (
    <div className={embedded ? "space-y-6 w-full" : "max-w-4xl mx-auto px-4 lg:px-8 py-8 space-y-6"}>
      {/* Header */}
      <div className={`flex items-center justify-between pb-4 border-b ${embedded ? 'border-[#05268F]/25' : 'border-zinc-200'}`}>
        <div>
          <h1 className={`text-xl font-extrabold tracking-tight flex items-center gap-2 ${embedded ? 'text-white' : 'text-zinc-900'}`}>
            <ClipboardList className="w-5 h-5 text-[#FFD318]" />
            <span>Historial y Estado de Pedidos</span>
          </h1>
          <p className={`text-xs mt-0.5 ${embedded ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Supervisión y trazabilidad de pedidos en tiempo real
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={isLoadingOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0a0f30] to-[#070728] border border-[#05268F]/30 text-xs font-semibold text-zinc-300 hover:text-white transition shadow-sm"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
          <span>Sincronizar</span>
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-12 text-center space-y-4 shadow-xl">
          <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No tienes pedidos registrados</h3>
            <p className="text-xs text-zinc-400">
              Explora el catálogo y realiza tu primer pedido con cálculo soberano.
            </p>
          </div>
          <button
            onClick={() => setActiveView('explore')}
            className="px-5 py-2.5 rounded-xl bg-[#05268F] text-[#FFD318] border border-[#FFD318]/30 font-semibold text-xs transition"
          >
            Explorar Restaurantes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;
            const canChat = ['assigned', 'picked_up', 'delivering'].includes(order.status);

            return (
              <div
                key={order.id}
                className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-2xl p-5 shadow-xl space-y-4 hover:border-[#05268F]/60 transition"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#05268F]/20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#FFD318] bg-[#05268F] px-2 py-0.5 rounded shadow-xs">
                        {order.folio || order.order_code || `#${order.id.slice(-4).toUpperCase()}`}
                      </span>
                      <h3 className="font-bold text-white text-sm">{order.restaurant_name}</h3>
                    </div>
                    <span className="text-[11px] text-zinc-400 block">
                      {new Date(order.createdAt).toLocaleString()} • {order.order_type === 'delivery' ? 'A Domicilio' : 'Para Recoger'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.badge}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-1.5 text-xs text-zinc-300">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="text-zinc-400 font-mono">${(item.subtotal / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom Bar: Total, Chat and Evidence */}
                <div className="pt-3 border-t border-[#05268F]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="font-bold text-white flex items-center gap-3">
                    <div>
                      Total: <span className="text-[#FFD318]">${(order.total / 100).toFixed(2)} MXN</span>
                    </div>

                    {/* Mercado Pago Badge or Pay Action */}
                    {order.payment_method === 'digital' && order.payment_status === 'approved' && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Pagado (Mercado Pago)
                      </span>
                    )}

                    {order.payment_method === 'digital' && order.payment_status !== 'approved' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => handlePayMercadoPago(order)}
                        className="px-2.5 py-1 rounded-lg bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-bold text-[10px] flex items-center gap-1 shadow-sm transition"
                      >
                        <CreditCard className="w-3 h-3 text-[#FFD318]" />
                        Pagar con Mercado Pago
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Messaging Driver Button */}
                    {canChat && (
                      <button
                        onClick={() => openChat(order.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/30 font-semibold flex items-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat con Repartidor
                      </button>
                    )}

                    {/* View Evidences */}
                    <button
                      onClick={() => openEvidence(order.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#06091e] hover:bg-[#05268F]/20 text-zinc-300 border border-[#05268F]/30 font-medium flex items-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Evidencias
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REAL-TIME CHAT MODAL (Cliente <-> Driver) */}
      {chatOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#05268F]/25">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-[#FFD318]" />
                <h3 className="font-bold text-white text-sm">
                  Chat de Entrega — {orders.find((o) => o.id === chatOrderId)?.folio || orders.find((o) => o.id === chatOrderId)?.order_code || `#${chatOrderId.slice(-4).toUpperCase()}`}
                </h3>
              </div>
              <button
                onClick={() => setChatOrderId(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-8">
                  Sin mensajes aún. Escribe para coordinar la entrega con el repartidor.
                </p>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs ${
                          isMe
                            ? 'bg-[#05268F] text-[#FFD318] border border-[#FFD318]/20'
                            : 'bg-zinc-900 text-white border border-zinc-800'
                        }`}
                      >
                        <span className="text-[10px] block opacity-70 mb-0.5">
                          {msg.sender_name} ({msg.sender_role})
                        </span>
                        {msg.message}
                      </div>
                      <span className="text-[9px] text-zinc-500 mt-0.5 px-1 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="pt-3 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#05268F]"
              />
              <button
                type="submit"
                disabled={isSendingMessage || !chatInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/30 font-bold transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EVIDENCES MODAL */}
      {evidenceOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#101828] border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#FFD318]" />
                <h3 className="font-bold text-white text-sm">Evidencias y Fotografías</h3>
              </div>
              <button
                onClick={() => setEvidenceOrderId(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {evidenceList.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No se han registrado fotografías de entrega o tickets para este pedido.
                </div>
              ) : (
                evidenceList.map((ev) => (
                  <div key={ev.id} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white uppercase">{ev.type}</span>
                      <span className="text-[10px] text-zinc-500">{new Date(ev.created_at).toLocaleString()}</span>
                    </div>
                    {ev.file_url && (
                      <img
                        src={ev.file_url}
                        alt="Evidencia"
                        className="w-full h-44 object-cover rounded-lg border border-zinc-800"
                      />
                    )}
                    {ev.notes && <p className="text-xs text-zinc-400">{ev.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
