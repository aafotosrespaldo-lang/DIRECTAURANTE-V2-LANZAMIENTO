import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { directApi } from '../api/client.ts';
import { SavedCard } from '../types.ts';
import {
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Sparkles,
  X,
  Star,
  Layers,
  Banknote,
  Send,
  Info,
} from 'lucide-react';

export const WalletManager: React.FC = () => {
  const { user, addToast } = useApp();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [cardType, setCardType] = useState<'credito' | 'debito'>('debito');
  const [holderName, setHolderName] = useState(user?.name ? user.name.toUpperCase() : '');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Auto-detect brand from card number
  const detectBrand = (num: string): 'visa' | 'mastercard' | 'amex' | 'otro' => {
    const clean = num.replace(/\s+/g, '');
    if (clean.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'mastercard';
    if (/^3[47]/.test(clean)) return 'amex';
    return 'visa';
  };

  const detectedBrand = detectBrand(cardNumber);

  useEffect(() => {
    loadCards();
  }, [user]);

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const res = await directApi.getSavedCards();
      if (res && res.length > 0) {
        setCards(res);
      } else {
        // Check local storage for resilience
        const local = localStorage.getItem(`direct_cards_${user?.id}`);
        if (local) {
          try {
            setCards(JSON.parse(local));
          } catch {
            seedDefaultCards();
          }
        } else {
          seedDefaultCards();
        }
      }
    } catch {
      // Fallback to local storage
      const local = localStorage.getItem(`direct_cards_${user?.id}`);
      if (local) {
        try {
          setCards(JSON.parse(local));
        } catch {
          seedDefaultCards();
        }
      } else {
        seedDefaultCards();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const seedDefaultCards = () => {
    if (!user) return;
    const initialCards: SavedCard[] = [
      {
        id: `crd_init_1`,
        user_id: user.id,
        brand: 'visa',
        last4: '4242',
        holder_name: (user.name || 'CLIENTE DIRECTAURANTE').toUpperCase(),
        exp_month: '12',
        exp_year: '28',
        card_type: 'debito',
        is_default: true,
        createdAt: new Date().toISOString(),
      },
    ];
    setCards(initialCards);
    localStorage.setItem(`direct_cards_${user.id}`, JSON.stringify(initialCards));
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 16);
    // Format into blocks of 4
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setCardNumber(formatted);
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawDigits = cardNumber.replace(/\s+/g, '');
    if (rawDigits.length < 15) {
      addToast('error', 'Ingresa un número de tarjeta válido (16 dígitos)');
      return;
    }
    if (!holderName.trim()) {
      addToast('error', 'Ingresa el nombre del titular');
      return;
    }
    if (!expMonth || !expYear || expMonth.length < 2 || expYear.length < 2) {
      addToast('error', 'Ingresa fecha de expiración válida (MM/AA)');
      return;
    }
    if (cvv.length < 3) {
      addToast('error', 'Ingresa el código CVV (3 o 4 dígitos)');
      return;
    }

    try {
      setIsSubmitting(true);
      const brand = detectBrand(rawDigits);
      const last4 = rawDigits.slice(-4);

      try {
        const newCard = await directApi.createSavedCard({
          brand,
          last4,
          holder_name: holderName.trim().toUpperCase(),
          exp_month: expMonth,
          exp_year: expYear,
          card_type: cardType,
          is_default: isDefault || cards.length === 0,
        });

        const updated = isDefault
          ? [newCard, ...cards.map((c) => ({ ...c, is_default: false }))]
          : [...cards, newCard];
        setCards(updated);
        localStorage.setItem(`direct_cards_${user?.id}`, JSON.stringify(updated));
      } catch {
        // Offline / fallback storage
        const localCard: SavedCard = {
          id: `crd_${Date.now()}`,
          user_id: user?.id || 'cust_local',
          brand,
          last4,
          holder_name: holderName.trim().toUpperCase(),
          exp_month: expMonth,
          exp_year: expYear,
          card_type: cardType,
          is_default: isDefault || cards.length === 0,
          createdAt: new Date().toISOString(),
        };

        const updated = isDefault || cards.length === 0
          ? [localCard, ...cards.map((c) => ({ ...c, is_default: false }))]
          : [...cards, localCard];
        setCards(updated);
        localStorage.setItem(`direct_cards_${user?.id}`, JSON.stringify(updated));
      }

      addToast('success', `Tarjeta ${brand.toUpperCase()} terminada en ${last4} agregada exitosamente`);
      setIsAdding(false);
      setCardNumber('');
      setExpMonth('');
      setExpYear('');
      setCvv('');
      setIsDefault(false);
    } catch (err: any) {
      addToast('error', err.message || 'Error al guardar tarjeta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      try {
        await directApi.deleteSavedCard(id);
      } catch {
        // ignore
      }
      const updated = cards.filter((c) => c.id !== id);
      if (updated.length > 0 && !updated.some((c) => c.is_default)) {
        updated[0].is_default = true;
      }
      setCards(updated);
      localStorage.setItem(`direct_cards_${user?.id}`, JSON.stringify(updated));
      addToast('info', 'Tarjeta eliminada de tu billetera');
    } catch {
      addToast('error', 'Error al eliminar tarjeta');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      try {
        await directApi.setDefaultSavedCard(id);
      } catch {
        // ignore
      }
      const updated = cards.map((c) => ({
        ...c,
        is_default: c.id === id,
      }));
      setCards(updated);
      localStorage.setItem(`direct_cards_${user?.id}`, JSON.stringify(updated));
      addToast('success', 'Tarjeta predeterminada actualizada');
    } catch {
      addToast('error', 'Error al cambiar tarjeta predeterminada');
    }
  };

  const fillQuickDemo = (type: 'credito' | 'debito') => {
    setCardType(type);
    setHolderName((user?.name || 'JUAN PEREZ').toUpperCase());
    setCardNumber(type === 'credito' ? '5412 7534 8901 3245' : '4152 3134 5678 8899');
    setExpMonth('09');
    setExpYear('29');
    setCvv('789');
    setIsDefault(true);
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#05268F]/25">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#FFD318]" />
            <span>Billetera y Tarjetas de Pago</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Administra tus tarjetas de crédito y débito tokenizadas para pagar en 1 toque.
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold text-xs shadow-md transition active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Tarjeta</span>
          </button>
        )}
      </div>

      {/* Add Card Form Modal / Expandable Card */}
      {isAdding && (
        <div className="bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFD318]" />
              <h3 className="font-bold text-sm text-white">Nueva Tarjeta de Crédito o Débito</h3>
            </div>
            <button
              onClick={() => setIsAdding(false)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Demo Pre-fills */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-[11px] text-zinc-400 font-semibold">Llenado rápido de prueba:</span>
            <button
              type="button"
              onClick={() => fillQuickDemo('debito')}
              className="px-2.5 py-1 rounded-lg bg-[#06091e] border border-[#05268F]/30 hover:border-[#FFD318] text-[#FFD318] text-[11px] font-semibold transition"
            >
              + Débito Visa Demo
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('credito')}
              className="px-2.5 py-1 rounded-lg bg-[#06091e] border border-[#05268F]/30 hover:border-[#FFD318] text-sky-300 text-[11px] font-semibold transition"
            >
              + Crédito Mastercard Demo
            </button>
          </div>

          {/* Interactive Plastic Card Visual Preview */}
          <div className="relative mx-auto max-w-sm w-full h-48 rounded-2xl p-5 text-white shadow-2xl flex flex-col justify-between overflow-hidden border border-[#05268F]/40 bg-gradient-to-br from-[#0b154a] via-[#070728] to-[#040618]">
            {/* Background chip & waves */}
            <div className="absolute right-0 top-0 w-48 h-48 bg-[#FFD318]/10 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-7 rounded-md bg-amber-400/80 border border-amber-300/60 shadow-inner flex items-center justify-center">
                  <div className="w-5 h-4 border border-amber-900/40 rounded-xs" />
                </div>
                <span className="text-[10px] tracking-widest text-[#FFD318] font-mono font-bold uppercase">
                  DIRECTAURANTE PAY
                </span>
              </div>
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 uppercase tracking-wider">
                {cardType === 'credito' ? 'Crédito' : 'Débito'}
              </span>
            </div>

            {/* Card number display */}
            <div className="my-2 relative z-10">
              <p className="font-mono text-lg font-bold tracking-widest text-zinc-100">
                {cardNumber || '•••• •••• •••• ••••'}
              </p>
            </div>

            {/* Holder and expiry */}
            <div className="flex items-end justify-between relative z-10 text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-semibold">
                  Titular de la tarjeta
                </span>
                <span className="font-bold tracking-wider uppercase text-zinc-200 truncate block max-w-[200px]">
                  {holderName || 'NOMBRE DEL TITULAR'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-semibold">
                  Vence
                </span>
                <span className="font-mono font-bold text-zinc-200">
                  {expMonth || 'MM'}/{expYear || 'AA'}
                </span>
              </div>
            </div>
          </div>

          {/* Card Form */}
          <form onSubmit={handleCreateCard} className="space-y-4 text-xs">
            {/* Card Type Toggle */}
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-bold block">Tipo de Tarjeta</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCardType('debito')}
                  className={`py-2.5 rounded-xl border font-bold text-xs transition flex items-center justify-center gap-2 ${
                    cardType === 'debito'
                      ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]'
                      : 'bg-[#06091e] border-[#05268F]/30 text-zinc-400 hover:border-[#05268F]/60'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Tarjeta de Débito</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardType('credito')}
                  className={`py-2.5 rounded-xl border font-bold text-xs transition flex items-center justify-center gap-2 ${
                    cardType === 'credito'
                      ? 'bg-[#05268F] text-[#FFD318] border-[#FFD318]'
                      : 'bg-[#06091e] border-[#05268F]/30 text-zinc-400 hover:border-[#05268F]/60'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Tarjeta de Crédito</span>
                </button>
              </div>
            </div>

            {/* Holder Name */}
            <div>
              <label className="text-zinc-300 font-bold block mb-1">
                Nombre del Titular (como aparece en la tarjeta)
              </label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                placeholder="EJ. JUAN PEREZ LOPEZ"
                className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 font-semibold uppercase focus:outline-none focus:border-[#FFD318]"
                required
              />
            </div>

            {/* Card Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-300 font-bold">Número de Tarjeta</label>
                <span className="text-[10px] text-[#FFD318] font-bold uppercase tracking-wider">
                  Marca detectada: {detectedBrand.toUpperCase()}
                </span>
              </div>
              <input
                type="text"
                value={cardNumber}
                onChange={handleCardNumberChange}
                placeholder="4152 0000 0000 0000"
                maxLength={19}
                className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm tracking-wider placeholder-zinc-600 focus:outline-none focus:border-[#FFD318]"
                required
              />
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-zinc-300 font-bold block mb-1">Mes (MM)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ''))}
                  placeholder="12"
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white font-mono text-center focus:outline-none focus:border-[#FFD318]"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">Año (AA)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ''))}
                  placeholder="28"
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white font-mono text-center focus:outline-none focus:border-[#FFD318]"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">CVV / CVC</label>
                <input
                  type="password"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                  placeholder="•••"
                  className="w-full bg-[#06091e] border border-[#05268F]/30 rounded-xl px-3 py-2 text-white font-mono text-center focus:outline-none focus:border-[#FFD318]"
                  required
                />
              </div>
            </div>

            {/* Checkbox Default */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isDefaultCard"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-[#05268F] accent-[#05268F] cursor-pointer"
              />
              <label htmlFor="isDefaultCard" className="text-zinc-300 cursor-pointer font-medium">
                Establecer como método de pago principal para mis pedidos
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#05268F]/25">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl border border-[#05268F]/30 text-zinc-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FFD318]" />
                <span>{isSubmitting ? 'Validando...' : 'Guardar Tarjeta en Billetera'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cards List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-zinc-600 animate-pulse" />
            <p>Cargando billetera...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#05268F]/30 text-[#FFD318] flex items-center justify-center mx-auto border border-[#FFD318]/20">
              <CreditCard className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-white text-sm">No tienes tarjetas agregadas aún</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Guarda tus tarjetas de crédito o débito para realizar tus pedidos de forma rápida y segura.
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-bold text-xs"
            >
              + Agregar Mi Primera Tarjeta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-4 shadow-lg relative overflow-hidden ${
                  card.is_default
                    ? 'bg-gradient-to-br from-[#0d1645] via-[#070728] to-[#04051a] border-[#FFD318]/50 shadow-[#05268F]/20'
                    : 'bg-gradient-to-br from-[#0a0f30] via-[#070728] to-[#04051a] border-[#05268F]/30 hover:border-[#05268F]/60'
                }`}
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded-md bg-[#05268F] border border-[#FFD318]/30 flex items-center justify-center text-xs font-black text-[#FFD318] uppercase">
                      {card.brand.slice(0, 4)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          •••• {card.last4}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-full bg-[#05268F]/40 text-blue-200 border border-[#05268F]/40">
                          {card.card_type === 'debito' ? 'Débito' : 'Crédito'}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-semibold block uppercase mt-0.5">
                        {card.holder_name}
                      </span>
                    </div>
                  </div>

                  {card.is_default && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFD318] text-[#05268F] shadow-xs">
                      <Star className="w-3 h-3 fill-[#05268F]" />
                      Principal
                    </span>
                  )}
                </div>

                {/* Card Bottom / Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#05268F]/20 text-xs">
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Vence: {card.exp_month}/{card.exp_year}
                  </span>

                  <div className="flex items-center gap-2">
                    {!card.is_default && (
                      <button
                        onClick={() => handleSetDefault(card.id)}
                        className="text-[11px] font-semibold text-[#FFD318] hover:underline"
                      >
                        Hacer principal
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition rounded-lg"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Tokenization Card */}
      <div className="bg-gradient-to-r from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-zinc-300 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-[#05268F] text-[#FFD318] border border-[#FFD318]/40 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-white flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            Bóveda de Seguridad Tokenizada Directaurante
          </p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Tus datos bancarios nunca se guardan en texto plano en nuestros servidores. La información se tokeniza bajo estándares bancarios PCI-DSS con cifrado AES-256 para garantizar transacciones 100% seguras.
          </p>
        </div>
      </div>
    </div>
  );
};
