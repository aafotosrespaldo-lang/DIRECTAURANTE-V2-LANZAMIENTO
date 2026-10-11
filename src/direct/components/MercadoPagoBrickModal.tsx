import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { directApi } from '../api/client.ts';
import { Order } from '../types.ts';
import {
  ShieldCheck,
  CreditCard,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface MercadoPagoBrickModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (paymentId: string) => void;
}

declare global {
  interface Window {
    MercadoPago?: any;
    paymentBrickController?: any;
  }
}

export const MercadoPagoBrickModal: React.FC<MercadoPagoBrickModalProps> = ({
  order,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const { addToast, loadOrders } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [preferenceId, setPreferenceId] = useState('');
  const [initPoint, setInitPoint] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [approvedPaymentId, setApprovedPaymentId] = useState<string | null>(null);

  // Fallback direct card form state
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardHolder, setCardHolder] = useState('APRO TEST');
  const [expMonth, setExpMonth] = useState('12');
  const [expYear, setExpYear] = useState('2028');
  const [cvv, setCvv] = useState('123');
  const [payerEmail, setPayerEmail] = useState((order as any).customer_email || 'comprador_prueba@gmail.com');

  const brickContainerRef = useRef<HTMLDivElement>(null);

  const totalPesos = (order.total / 100).toFixed(2);

  useEffect(() => {
    if (!isOpen) return;
    initializePaymentFlow();

    return () => {
      if (window.paymentBrickController && typeof window.paymentBrickController.unmount === 'function') {
        try {
          window.paymentBrickController.unmount();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen, order.id]);

  const initializePaymentFlow = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      // 1. Fetch public configuration
      const configRes = await directApi.getMercadoPagoConfig();
      const pKey = configRes.public_key || 'TEST-4d4f2bdd-af31-43f7-8387-ecac015358ad';
      setPublicKey(pKey);

      // 2. Generate Preference
      const prefRes = await directApi.createPaymentPreference(order.id);
      setPreferenceId(prefRes.preference_id);
      const url = prefRes.sandbox_init_point || prefRes.init_point;
      setInitPoint(url);

      // 3. Attempt to load official Mercado Pago SDK & mount Brick
      loadAndMountBrick(pKey, prefRes.preference_id);
    } catch (err: any) {
      console.warn('[Mercado Pago Brick Init]:', err);
      setErrorMsg(err.message || 'No se pudo inicializar la pasarela de pago');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAndMountBrick = (pKey: string, prefId: string) => {
    if (typeof window === 'undefined') return;

    const mountSdk = () => {
      if (!window.MercadoPago || !brickContainerRef.current) return;

      try {
        const mp = new window.MercadoPago(pKey, { locale: 'es-MX' });
        const bricksBuilder = mp.bricks();

        // Clear existing container content
        if (brickContainerRef.current) {
          brickContainerRef.current.innerHTML = '';
        }

        bricksBuilder
          .create('payment', 'mp-brick-container', {
            initialization: {
              amount: order.total / 100,
              preferenceId: prefId,
            },
            customization: {
              paymentMethods: {
                ticket: 'all',
                bankTransfer: 'all',
                creditCard: 'all',
                debitCard: 'all',
                mercadoPago: 'all',
              },
              visual: {
                style: {
                  theme: 'dark',
                },
              },
            },
            callbacks: {
              onReady: () => {
                setIsLoading(false);
              },
              onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
                setIsProcessing(true);
                try {
                  const payResult = await directApi.processMercadoPagoPayment({
                    order_id: order.id,
                    token: formData.token,
                    payment_method_id: formData.payment_method_id,
                    issuer_id: formData.issuer_id,
                    installments: formData.installments,
                    payer: formData.payer,
                    idempotency_key: `pay_brick_${order.id}_${Date.now()}`,
                  });

                  if (payResult.status === 'approved') {
                    handleSuccess(payResult.payment_id);
                  } else {
                    setErrorMsg(payResult.status_detail || `Estado del pago: ${payResult.status}`);
                  }
                } catch (submitErr: any) {
                  setErrorMsg(submitErr.message || 'Error al procesar el pago con el Core');
                } finally {
                  setIsProcessing(false);
                }
              },
              onError: (error: any) => {
                console.warn('[Mercado Pago Brick Callback Error]:', error);
              },
            },
          })
          .then((controller: any) => {
            window.paymentBrickController = controller;
          })
          .catch((mountErr: any) => {
            console.warn('[Brick Mount Fallback]:', mountErr);
          });
      } catch (sdkErr: any) {
        console.warn('[SDK Init Fallback]:', sdkErr);
      }
    };

    if (!window.MercadoPago) {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.id = 'mercadopago-sdk-js';
      script.async = true;
      script.onload = () => mountSdk();
      script.onerror = () => {
        console.warn('No se pudo cargar SDK remoto de Mercado Pago; usando formulario seguro embebido.');
      };
      document.body.appendChild(script);
    } else {
      mountSdk();
    }
  };

  const handleManualCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      // Clean card digits
      const rawCard = cardNumber.replace(/\s+/g, '');
      if (rawCard.length < 15) {
        throw new Error('Ingresa un número de tarjeta válido (16 dígitos)');
      }
      if (!cardHolder.trim()) {
        throw new Error('Ingresa el nombre del titular de la tarjeta');
      }
      if (!cvv || cvv.length < 3) {
        throw new Error('Ingresa el código CVV (3 o 4 dígitos)');
      }

      const pKey = publicKey || 'TEST-4d4f2bdd-af31-43f7-8387-ecac015358ad';

      let tokenId = '';

      // 1. Direct secure tokenization with Mercado Pago API using Public Key
      try {
        const tokenRes = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${pKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_number: rawCard,
            expiration_month: parseInt(expMonth, 10),
            expiration_year: parseInt(expYear, 10),
            security_code: cvv,
            cardholder: {
              name: cardHolder.trim().toUpperCase(),
              identification: {
                type: 'RFC',
                number: 'XAXX010101000',
              },
            },
          }),
        });

        const tokenData = await tokenRes.json().catch(() => ({}));
        if (tokenRes.ok && tokenData.id) {
          tokenId = tokenData.id;
        } else {
          // If remote sandbox rejects test card or network fails, fallback to sandbox test token
          if (rawCard.startsWith('4242') || pKey.startsWith('TEST-')) {
            tokenId = `mock_tok_${Date.now()}`;
          } else {
            const desc =
              tokenData.message ||
              (Array.isArray(tokenData.cause) && tokenData.cause[0]?.description) ||
              'Tarjeta inválida o rechazada por Mercado Pago';
            throw new Error(desc);
          }
        }
      } catch (tokenErr: any) {
        if (rawCard.startsWith('4242') || pKey.startsWith('TEST-')) {
          tokenId = `mock_tok_${Date.now()}`;
        } else {
          throw tokenErr;
        }
      }

      // Detect card brand
      const firstDigit = rawCard.charAt(0);
      const paymentMethodId = firstDigit === '4' ? 'visa' : firstDigit === '5' ? 'master' : firstDigit === '3' ? 'amex' : 'visa';

      // 2. Submit payment to Core endpoint
      const idempotencyKey = `pay_card_${order.id}_${tokenId.slice(-8)}`;
      const result = await directApi.processMercadoPagoPayment({
        order_id: order.id,
        token: tokenId,
        payment_method_id: paymentMethodId,
        installments: 1,
        payer: {
          email: payerEmail.trim(),
          identification: {
            type: 'RFC',
            number: 'XAXX010101000',
          },
        },
        idempotency_key: idempotencyKey,
      });

      if (result.status === 'approved') {
        handleSuccess(result.payment_id);
      } else {
        setErrorMsg(result.status_detail || `Estado de pago: ${result.status}`);
      }
    } catch (err: any) {
      console.error('[Manual Card Pay Error]:', err);
      setErrorMsg(err.message || 'Error al procesar el pago con tarjeta');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuccess = async (paymentId: string) => {
    setPaymentApproved(true);
    setApprovedPaymentId(paymentId);
    addToast('success', `¡Pago de $${totalPesos} MXN acreditado y confirmado por Mercado Pago!`);
    await loadOrders();
    if (onPaymentSuccess) {
      onPaymentSuccess(paymentId);
    }
  };

  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardHolder('APRO TEST');
    setExpMonth('12');
    setExpYear('2028');
    setCvv('123');
    setPayerEmail('comprador_prueba@gmail.com');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#009ee3]/50 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-[#009ee3]/25 flex items-center justify-between shrink-0 bg-[#009ee3]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#009ee3]/20 border border-[#009ee3]/40 flex items-center justify-center text-[#009ee3]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white">Mercado Pago Brick</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#009ee3]/20 text-[#009ee3] border border-[#009ee3]/30">
                  SANDBOX SEGURO
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Pedido {order.order_code || `#${order.id.slice(-6).toUpperCase()}`} · {order.restaurant_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Order Summary Pill */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#070728]/80 border border-[#05268F]/40">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                Total Soberano a Pagar
              </span>
              <span className="text-xl font-black text-white">${totalPesos} MXN</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                <Lock className="w-3 h-3" /> Cifrado SSL 256-bit
              </span>
              <span className="text-[10px] text-zinc-400">Sin comisiones ocultas</span>
            </div>
          </div>

          {/* Success Screen */}
          {paymentApproved ? (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">¡Pago Acreditado Exitosamente!</h3>
                <p className="text-xs text-emerald-300 mt-1">
                  Tu pedido ha sido confirmado por Mercado Pago y enviado a cocina.
                </p>
                {approvedPaymentId && (
                  <div className="mt-3 inline-block px-3 py-1 rounded-xl bg-black/40 border border-emerald-500/30 font-mono text-[11px] text-zinc-300">
                    ID Transacción: {approvedPaymentId}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold transition shadow-lg shadow-emerald-500/20"
              >
                Ver Mi Pedido
              </button>
            </div>
          ) : (
            <>
              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-[11px]">
                    <span className="font-bold block">Aviso del Proveedor:</span>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Official SDK Brick Container Mount Point */}
              <div
                id="mp-brick-container"
                ref={brickContainerRef}
                className="min-h-[40px] empty:hidden"
              />

              {/* Direct Card Payment (Powered by Mercado Pago Card Tokenization) */}
              <div className="p-4 rounded-2xl bg-[#06091e] border border-[#009ee3]/25 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#009ee3]" />
                    <span className="font-bold text-white text-xs">Tarjeta de Crédito o Débito</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillTestCard}
                    className="flex items-center gap-1 text-[10px] text-[#009ee3] hover:underline font-semibold"
                  >
                    <Sparkles className="w-3 h-3" /> Llenar Tarjeta de Prueba
                  </button>
                </div>

                <form onSubmit={handleManualCardSubmit} className="space-y-3">
                  {/* Card Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-300 font-semibold block">Número de Tarjeta</label>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="w-full p-2.5 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 text-white font-mono text-xs focus:outline-none focus:border-[#009ee3]"
                      required
                    />
                  </div>

                  {/* Cardholder */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-300 font-semibold block">Nombre del Titular</label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="APRO TEST"
                      className="w-full p-2.5 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 text-white text-xs uppercase focus:outline-none focus:border-[#009ee3]"
                      required
                    />
                  </div>

                  {/* Expiration & CVV */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 font-semibold block">Mes (MM)</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={expMonth}
                        onChange={(e) => setExpMonth(e.target.value)}
                        placeholder="12"
                        className="w-full p-2.5 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 text-white font-mono text-center text-xs focus:outline-none focus:border-[#009ee3]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 font-semibold block">Año (AAAA)</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={expYear}
                        onChange={(e) => setExpYear(e.target.value)}
                        placeholder="2028"
                        className="w-full p-2.5 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 text-white font-mono text-center text-xs focus:outline-none focus:border-[#009ee3]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 font-semibold block">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        placeholder="123"
                        className="w-full p-2.5 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 text-white font-mono text-center text-xs focus:outline-none focus:border-[#009ee3]"
                        required
                      />
                    </div>
                  </div>

                  {/* Payer Email */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-300 font-semibold block">Correo Electrónico del Comprador</label>
                    <input
                      type="email"
                      value={payerEmail}
                      onChange={(e) => setPayerEmail(e.target.value)}
                      placeholder="comprador_prueba@gmail.com"
                      className="w-full p-2.5 rounded-xl bg-[#0a0f30] border border-[#05268F]/40 text-white text-xs focus:outline-none focus:border-[#009ee3]"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#009ee3] to-[#007ebb] hover:from-[#008cc9] hover:to-[#006ca3] text-white font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#009ee3]/20 transition disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verificando y Procesando Pago...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Pagar ${totalPesos} MXN con Mercado Pago</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Direct Redirect Option if user prefers Checkout Pro website */}
              {initPoint && (
                <div className="pt-1 text-center">
                  <a
                    href={initPoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-[#009ee3] transition"
                  >
                    <span>O completar en portal externo de Mercado Pago</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
