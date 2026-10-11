import React, { useState, useEffect } from 'react';
import { directApi } from '../../direct/api/client.ts';
import { DriverSettlement, DriverShiftSummary } from '../types.ts';
import {
  DollarSign,
  PackageCheck,
  Banknote,
  Power,
  CreditCard,
  AlertCircle,
  Receipt,
  CheckCircle,
  Camera,
  Upload,
  CheckCircle2,
  Clock,
  Copy,
  Building2,
  HelpCircle,
} from 'lucide-react';

interface DriverShiftViewProps {
  shiftSummary: DriverShiftSummary | null;
  onCloseShift: (notes?: string) => Promise<DriverSettlement>;
  onRefresh: () => Promise<void>;
}

export const DriverShiftView: React.FC<DriverShiftViewProps> = ({
  shiftSummary,
  onCloseShift,
  onRefresh,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [settlementResult, setSettlementResult] = useState<DriverSettlement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Deposit flow state
  const [activeSettlementForDeposit, setActiveSettlementForDeposit] = useState<DriverSettlement | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositProofPhoto, setDepositProofPhoto] = useState<string | null>(null);
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState<boolean>(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [pastSettlements, setPastSettlements] = useState<DriverSettlement[]>([]);

  // Configurable bank deposit details from Master
  const [bankInfo, setBankInfo] = useState<{
    bank_name: string;
    account_holder: string;
    clabe_or_account: string;
    instructions: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load bank info configured by Master
  useEffect(() => {
    const fetchBankInfo = async () => {
      try {
        const info = await directApi.getDriverDepositBankInfo();
        setBankInfo(info);
      } catch {
        // Fallback default
        setBankInfo({
          bank_name: 'BBVA Bancomer',
          account_holder: 'Directaurante S.A.P.I. de C.V.',
          clabe_or_account: '012 180 00123456789 0',
          instructions: 'Realiza tu depósito o transferencia. Usa tu número de repartidor en el concepto y sube tu comprobante a continuación.',
        });
      }
    };
    fetchBankInfo();
  }, []);

  const handleCopy = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  // Load past settlements
  useEffect(() => {
    const loadSettlements = async () => {
      try {
        const list = await directApi.getDriverSettlements();
        setPastSettlements(list);
        // If there is a recent settlement needing deposit, focus it
        const pending = list.find((s) => s.cash_collected > 0 && (!s.deposit_status || s.deposit_status === 'pending_proof'));
        if (pending && !activeSettlementForDeposit && !settlementResult) {
          setActiveSettlementForDeposit(pending);
          setDepositAmount(((pending.cash_collected || 0) / 100).toFixed(2));
        }
      } catch {
        // non-fatal
      }
    };
    loadSettlements();
  }, [settlementResult]);

  const handleConfirmClose = async () => {
    try {
      setIsClosing(true);
      setErrorMessage(null);
      const settlement = await onCloseShift(closeNotes);
      setSettlementResult(settlement);
      setActiveSettlementForDeposit(settlement);
      setDepositAmount(((settlement.cash_collected || 0) / 100).toFixed(2));
      setShowConfirmModal(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cerrar la jornada');
    } finally {
      setIsClosing(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setDepositProofPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDeposit = async () => {
    const target = activeSettlementForDeposit || settlementResult;
    if (!target) return;
    if (!depositProofPhoto) {
      setErrorMessage('Es obligatorio capturar o subir la foto del comprobante de depósito');
      return;
    }

    try {
      setIsSubmittingDeposit(true);
      setErrorMessage(null);
      const parsedAmountCents = Math.round(parseFloat(depositAmount || '0') * 100);

      const updated = await directApi.uploadDepositProof({
        settlement_id: target.id,
        deposit_amount: parsedAmountCents,
        proof_url: depositProofPhoto,
        notes: depositNotes,
      });

      setDepositSuccessMsg('Comprobante de depósito enviado con éxito a revisión por Master.');
      setActiveSettlementForDeposit(updated);
      setDepositProofPhoto(null);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al enviar comprobante de depósito');
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  const cashCollected = (shiftSummary?.cash_collected || 0) / 100;
  const earningsTotal = (shiftSummary?.earnings_total || 0) / 100;
  const netBalance = (shiftSummary?.net_balance || 0) / 100;

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-md mx-auto select-none bg-white text-[#101828]">
      {/* Header */}
      <div className="bg-[#F4F6F8] border border-[#E5E7EB] p-5 rounded-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#101828]">Mi Jornada y Cortes</h2>
            <p className="text-xs text-[#667085] mt-0.5">Control de arqueo, efectivo y comprobantes</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              shiftSummary?.status === 'active'
                ? 'bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/30'
                : 'bg-white text-[#667085] border border-[#E5E7EB]'
            }`}
          >
            {shiftSummary?.status === 'active' ? 'Turno Activo' : 'Sin Turno'}
          </span>
        </div>
      </div>

      {/* Main Net Balance Card */}
      <div className="bg-[#05268F] text-white p-5 rounded-3xl flex flex-col gap-4 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-[#FFD318]">
            Corte de Caja del Repartidor
          </span>
          <Receipt className="w-5 h-5 text-[#FFD318]" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAF0FF]">
            Total a depositar
          </span>
          <p className="text-3xl font-black font-mono text-white mt-0.5">
            ${Math.max(0, netBalance).toFixed(2)}{' '}
            <span className="text-xs font-normal text-[#EAF0FF]">MXN</span>
          </p>
          <p className="text-xs text-[#EAF0FF] mt-1">
            {netBalance > 0
              ? '⚠️ Efectivo cobrado en mano pendiente de depositar a la plataforma.'
              : netBalance < 0
              ? '✓ Saldo a favor tuyo a liquidar por la plataforma.'
              : 'Balance en ceros. Cuentas al corriente.'}
          </p>
        </div>

        {/* Detailed Breakdown: Mis Ganancias vs Efectivo Cobrado */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
          <div className="bg-white/10 p-3 rounded-2xl">
            <div className="flex items-center gap-1.5 text-[#EAF0FF] text-xs font-bold mb-1">
              <DollarSign className="w-3.5 h-3.5 text-[#FFD318]" />
              <span>Mis Ganancias</span>
            </div>
            <p className="text-lg font-black text-white font-mono">${earningsTotal.toFixed(2)}</p>
            <span className="text-[10px] text-white/70">Tarifas de entrega + propinas</span>
          </div>

          <div className="bg-white/10 p-3 rounded-2xl">
            <div className="flex items-center gap-1.5 text-[#FFD318] text-xs font-bold mb-1">
              <Banknote className="w-3.5 h-3.5" />
              <span>Efectivo Cobrado</span>
            </div>
            <p className="text-lg font-black text-white font-mono">${cashCollected.toFixed(2)}</p>
            <span className="text-[10px] text-white/70">Cobros recibidos de clientes</span>
          </div>
        </div>
      </div>

      {/* Operational Metrics of current shift */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl flex flex-col gap-3 shadow-xs">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#667085]">
          Estadísticas de la Jornada
        </h4>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB]">
            <span className="text-[#667085] flex items-center gap-2 font-medium">
              <PackageCheck className="w-4 h-4 text-[#05268F]" />
              <span>Pedidos Entregados</span>
            </span>
            <span className="font-black text-[#101828]">{shiftSummary?.orders_completed || 0}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB]">
            <span className="text-[#667085] flex items-center gap-2 font-medium">
              <CreditCard className="w-4 h-4 text-[#05268F]" />
              <span>Pagos Digitales Procesados</span>
            </span>
            <span className="font-black text-[#101828]">
              ${((shiftSummary?.digital_total || 0) / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB]">
            <span className="text-[#667085] flex items-center gap-2 font-medium">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Propinas Recibidas</span>
            </span>
            <span className="font-black text-emerald-700">
              ${((shiftSummary?.tips_total || 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* End Shift / Corte Action Button */}
      {shiftSummary?.status === 'active' && !settlementResult && (
        <button
          onClick={() => setShowConfirmModal(true)}
          className="w-full py-4 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 border-2 border-rose-300 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition shadow-sm"
        >
          <Power className="w-5 h-5 text-rose-600" />
          <span>FINALIZAR DÍA Y HACER CORTE</span>
        </button>
      )}

      {/* 5. FLUJO DE DEPÓSITO Y COMPROBANTE POST-CORTE */}
      {activeSettlementForDeposit && (
        <div className="bg-[#FFF7D6] border-2 border-[#FFD318] p-5 rounded-3xl flex flex-col gap-4 shadow-sm animate-fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#05268F]" />
              <div>
                <h3 className="text-sm font-black text-[#101828]">
                  Depósito de Arqueo — Corte #{activeSettlementForDeposit.id.slice(-6)}
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Total a depositar:{' '}
                  <strong className="text-[#05268F] font-bold">
                    ${(Math.max(0, (activeSettlementForDeposit.net_balance !== undefined ? activeSettlementForDeposit.net_balance : activeSettlementForDeposit.cash_collected) || 0) / 100).toFixed(2)} MXN
                  </strong>
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                activeSettlementForDeposit.deposit_status === 'confirmed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : activeSettlementForDeposit.deposit_status === 'deposit_uploaded'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {activeSettlementForDeposit.deposit_status === 'confirmed'
                ? 'Validado ✓'
                : activeSettlementForDeposit.deposit_status === 'deposit_uploaded'
                ? 'Pendiente de validación'
                : 'Pendiente de comprobante'}
            </span>
          </div>

          {/* ÚNICA TARJETA: DATOS PARA DEPOSITAR (CONFIGURABLE DESDE PANEL MASTER) */}
          {bankInfo && (
            <div className="bg-white border-2 border-[#05268F]/20 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#05268F]" />
                  <h4 className="text-xs font-black text-[#05268F] uppercase tracking-wider">
                    Datos para depositar
                  </h4>
                </div>
                <span className="text-[10px] font-bold bg-[#EAF0FF] text-[#05268F] px-2 py-0.5 rounded-full">
                  Oficial Directaurante
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Banco */}
                <div className="flex items-center justify-between bg-[#F4F6F8] p-2.5 rounded-xl border border-[#E5E7EB]">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#667085] block">Banco</span>
                    <span className="font-black text-[#101828] text-xs">{bankInfo.bank_name}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(bankInfo.bank_name, 'banco')}
                    className="p-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:bg-[#EAF0FF] text-[#05268F] text-[11px] font-bold flex items-center gap-1 transition"
                    title="Copiar Banco"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedField === 'banco' ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Titular */}
                <div className="flex items-center justify-between bg-[#F4F6F8] p-2.5 rounded-xl border border-[#E5E7EB]">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#667085] block">Titular</span>
                    <span className="font-black text-[#101828] text-xs">{bankInfo.account_holder}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(bankInfo.account_holder, 'titular')}
                    className="p-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:bg-[#EAF0FF] text-[#05268F] text-[11px] font-bold flex items-center gap-1 transition"
                    title="Copiar Titular"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedField === 'titular' ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                {/* CLABE o Cuenta */}
                <div className="flex items-center justify-between bg-[#F4F6F8] p-2.5 rounded-xl border border-[#E5E7EB]">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#667085] block">CLABE / Cuenta</span>
                    <span className="font-mono font-black text-[#05268F] text-xs tracking-wider">
                      {bankInfo.clabe_or_account}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(bankInfo.clabe_or_account, 'clabe')}
                    className="p-1.5 rounded-lg bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] text-[11px] font-black flex items-center gap-1 transition shadow-xs"
                    title="Copiar CLABE"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedField === 'clabe' ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Instrucciones */}
                {bankInfo.instructions && (
                  <div className="p-2.5 bg-[#FFF9E6] border border-[#FFD318]/50 rounded-xl text-[11px] text-[#7A5800] leading-snug">
                    <strong className="font-bold block text-[#101828] mb-0.5">Instrucciones:</strong>
                    {bankInfo.instructions}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSettlementForDeposit.deposit_status === 'confirmed' ? (
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Depósito validado por Master</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Monto verificado: ${((activeSettlementForDeposit.deposit_verified_amount ?? activeSettlementForDeposit.deposit_amount ?? activeSettlementForDeposit.cash_collected) / 100).toFixed(2)} MXN
                </p>
                {activeSettlementForDeposit.discrepancy_amount ? (
                  <p className="text-[10px] text-amber-800 font-bold mt-1">
                    Diferencia conciliada: ${(activeSettlementForDeposit.discrepancy_amount / 100).toFixed(2)} MXN {activeSettlementForDeposit.discrepancy_notes ? `— Obs: ${activeSettlementForDeposit.discrepancy_notes}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          ) : activeSettlementForDeposit.deposit_status === 'deposit_uploaded' ? (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-900 flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <p className="font-bold text-xs">Pendiente de validación</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Comprobante por <strong>${((activeSettlementForDeposit.deposit_amount || 0) / 100).toFixed(2)} MXN</strong> registrado. En espera de revisión por el equipo Master.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Deposit amount input */}
              <div>
                <label className="text-[11px] font-bold text-[#101828] uppercase">Monto Depositado (MXN)</label>
                <input
                  type="number"
                  step="0.5"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-mono font-bold text-[#101828] focus:border-[#05268F] focus:outline-none"
                />
              </div>

              {/* Photo Evidence Capture (Cámara / Archivo) */}
              <div>
                <label className="text-[11px] font-bold text-[#101828] uppercase">Fotografía del Comprobante</label>
                {depositProofPhoto ? (
                  <div className="relative mt-1 rounded-2xl overflow-hidden border border-[#E5E7EB] max-h-48 bg-black">
                    <img src={depositProofPhoto} alt="Comprobante" className="w-full object-contain" />
                    <button
                      onClick={() => setDepositProofPhoto(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 border-2 border-dashed border-[#05268F]/30 hover:border-[#05268F] bg-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition">
                    <Camera className="w-6 h-6 text-[#05268F]" />
                    <span className="text-xs font-bold text-[#05268F]">Tomar Foto con Cámara o Subir</span>
                    <span className="text-[10px] text-[#667085]">Ficha bancaria, ticket OXXO o transferencia</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoCapture}
                    />
                  </label>
                )}
              </div>

              {/* Notes */}
              <input
                type="text"
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                placeholder="Referencia o banco (ej: Depósito Bancomer)"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#101828] focus:outline-none focus:border-[#05268F]"
              />

              {depositSuccessMsg && (
                <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  {depositSuccessMsg}
                </p>
              )}

              {errorMessage && (
                <p className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {errorMessage}
                </p>
              )}

              <button
                onClick={handleSubmitDeposit}
                disabled={isSubmittingDeposit}
                className="w-full py-3.5 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isSubmittingDeposit ? 'Subiendo Comprobante...' : 'Registrar Comprobante de Depósito'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-[#E5E7EB] rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#05268F] font-black text-base">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>¿Confirmar Fin de Jornada?</span>
            </div>

            <p className="text-xs text-[#667085] leading-relaxed">
              Se generará el corte oficial en el Core. El total de efectivo a comprobar es de{' '}
              <strong className="text-[#101828] font-bold">${cashCollected.toFixed(2)} MXN</strong>.
            </p>

            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Notas u observaciones de cierre (opcional)"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs text-[#101828] placeholder-[#667085] focus:outline-none focus:border-[#05268F]"
            />

            {errorMessage && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
                {errorMessage}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isClosing}
                className="py-3 rounded-xl bg-[#F4F6F8] text-[#101828] font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClose}
                disabled={isClosing}
                className="py-3 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-bold text-xs shadow-md"
              >
                {isClosing ? 'Cerrando...' : 'Confirmar Corte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
