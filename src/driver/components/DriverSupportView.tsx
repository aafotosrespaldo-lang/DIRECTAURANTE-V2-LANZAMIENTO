import React, { useState } from 'react';
import { SupportTicket } from '../types.ts';
import {
  LifeBuoy,
  AlertTriangle,
  PhoneCall,
  MapPinOff,
  UserX,
  Wrench,
  CheckCircle2,
  Clock,
  Send,
} from 'lucide-react';

interface DriverSupportViewProps {
  tickets: SupportTicket[];
  onCreateTicket: (ticket: {
    category: string;
    description: string;
    order_id?: string;
    priority?: 'normal' | 'urgent';
  }) => Promise<void>;
  activeOrderId?: string | null;
}

export const DriverSupportView: React.FC<DriverSupportViewProps> = ({
  tickets,
  onCreateTicket,
  activeOrderId,
}) => {
  const [category, setCategory] = useState('Incidente en ruta');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const quickIncidents = [
    {
      title: 'Dirección Inaccesible',
      desc: 'No encuentro la numeración ni la calle indicada por el cliente',
      icon: MapPinOff,
      urgent: false,
    },
    {
      title: 'Cliente no Responde',
      desc: 'He llamado más de 3 veces y nadie abre la puerta en el domicilio',
      icon: UserX,
      urgent: false,
    },
    {
      title: 'Emergencia / Accidente',
      desc: 'Falla mecánica de moto o incidente vial en ruta de entrega',
      icon: Wrench,
      urgent: true,
    },
  ];

  const handleQuickReport = async (item: (typeof quickIncidents)[0]) => {
    try {
      setIsSubmitting(true);
      await onCreateTicket({
        category: item.title,
        description: item.desc,
        order_id: activeOrderId || undefined,
        priority: item.urgent ? 'urgent' : 'normal',
      });
      setSuccessMessage(`Ticket de ${item.title} creado. Soporte te contactará de inmediato.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    try {
      setIsSubmitting(true);
      await onCreateTicket({
        category,
        description,
        order_id: activeOrderId || undefined,
        priority,
      });
      setDescription('');
      setSuccessMessage('Ticket de soporte registrado correctamente.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-md mx-auto select-none">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#05268F]/40 text-[#FFD318] flex items-center justify-center border border-[#05268F]/40 shadow-xs">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-zinc-100">Centro de Ayuda y Soporte</h2>
            <p className="text-xs text-zinc-400">Atención operativa para repartidores</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center gap-2 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Emergency Quick Actions */}
      <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 p-4 rounded-3xl flex flex-col gap-3 shadow-md">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Reportes Rápidos de Incidencias
        </span>

        <div className="space-y-2">
          {quickIncidents.map((inc, idx) => {
            const Icon = inc.icon;
            return (
              <button
                key={idx}
                onClick={() => handleQuickReport(inc)}
                disabled={isSubmitting}
                className="w-full p-3 rounded-2xl bg-[#070728]/80 hover:bg-[#05268F]/20 border border-[#05268F]/25 flex items-center justify-between text-left transition active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      inc.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#05268F]/40 text-[#FFD318] border border-[#FFD318]/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-100">{inc.title}</p>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">{inc.desc}</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-500">→</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Ticket Form */}
      <form onSubmit={handleSubmit} className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 p-4 rounded-3xl flex flex-col gap-3 shadow-md">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Crear Ticket a Soporte
        </span>

        <div>
          <label className="text-[11px] text-zinc-400 font-medium">Categoría</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#06091e] border border-[#05268F]/30 text-xs text-zinc-200 focus:outline-none focus:border-[#FFD318]"
          >
            <option value="Incidente en ruta">Incidente en ruta</option>
            <option value="Problema con el cobro">Problema con el cobro o efectivo</option>
            <option value="Duda de saldo o corte">Duda sobre corte o balance</option>
            <option value="Restaurante demorado">Restaurante demorado</option>
            <option value="Otro">Otro problema</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 font-medium">Prioridad</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => setPriority('normal')}
              className={`py-2 rounded-xl text-xs font-bold transition border ${
                priority === 'normal'
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setPriority('urgent')}
              className={`py-2 rounded-xl text-xs font-bold transition border ${
                priority === 'urgent'
                  ? 'bg-red-950/40 text-red-400 border-red-500/50'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800'
              }`}
            >
              Urgente
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 font-medium">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe lo sucedido con el mayor detalle posible..."
            rows={3}
            className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#FFD318]"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !description.trim()}
          className="w-full py-3.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#05268F]/25 active:scale-95 transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'ENVIANDO...' : 'ENVIAR TICKET'}</span>
        </button>
      </form>

      {/* Ticket History */}
      {tickets.length > 0 && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 p-4 rounded-3xl flex flex-col gap-3 shadow-md">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Tus Tickets Recientes ({tickets.length})
          </span>

          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="p-3 rounded-2xl bg-[#070728]/80 border border-[#05268F]/25 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-zinc-200">{t.category}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      t.status === 'open'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : t.status === 'investigating'
                        ? 'bg-[#05268F]/30 text-blue-300 border border-[#05268F]/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px]">{t.description}</p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 font-mono">
                  <span>#{t.id.slice(-6)}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
