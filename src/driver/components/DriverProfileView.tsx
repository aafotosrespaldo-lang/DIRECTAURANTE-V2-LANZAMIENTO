import React, { useState } from 'react';
import { directApi } from '../../direct/api/client.ts';
import {
  ShieldCheck,
  Phone,
  Mail,
  Bike,
  Car,
  Footprints,
  LogOut,
  CheckCircle2,
  Award,
  Camera,
  FileText,
  Upload,
  AlertCircle,
  Save,
} from 'lucide-react';

interface DriverProfileViewProps {
  profile: any;
  onLogout: () => void;
  onRefresh?: () => void;
}

export const DriverProfileView: React.FC<DriverProfileViewProps> = ({ profile, onLogout, onRefresh }) => {
  const [profileImage, setProfileImage] = useState<string>(
    profile?.profile_image ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&q=80'
  );
  const [name, setName] = useState<string>(profile?.name || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [vehicleType, setVehicleType] = useState<'automovil' | 'motocicleta' | 'bicicleta' | 'a_pie'>(
    profile?.vehicle_type || 'motocicleta'
  );
  const [vehicleInfo, setVehicleInfo] = useState<string>(profile?.vehicle_info || '');

  // Documents State
  const [ineFront, setIneFront] = useState<string | null>(profile?.documents?.ine_front_url || null);
  const [ineBack, setIneBack] = useState<string | null>(profile?.documents?.ine_back_url || null);
  const [proofOfAddress, setProofOfAddress] = useState<string | null>(profile?.documents?.proof_of_address_url || null);
  const [proofDate, setProofDate] = useState<string>(
    profile?.documents?.proof_of_address_date || new Date().toISOString().slice(0, 10)
  );
  const [circulationCard, setCirculationCard] = useState<string | null>(profile?.documents?.circulation_card_url || null);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check 3 months expiration for proof of address
  const isProofRecent = () => {
    if (!proofDate) return false;
    const date = new Date(proofDate).getTime();
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return date >= threeMonthsAgo;
  };

  const handleFileUpload = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      setStatusMessage(null);

      if (!isProofRecent()) {
        setStatusMessage({
          type: 'error',
          text: 'El comprobante de domicilio debe tener una antigüedad máxima de 3 meses.',
        });
        return;
      }

      await directApi.updateUserProfile({
        name,
        phone,
        profile_image: profileImage,
        vehicle_info: vehicleInfo,
        ...({
          vehicle_type: vehicleType,
          documents: {
            ine_front_url: ineFront,
            ine_back_url: ineBack,
            proof_of_address_url: proofOfAddress,
            proof_of_address_date: proofDate,
            circulation_card_url: (vehicleType === 'automovil' || vehicleType === 'motocicleta') ? circulationCard : null,
            status: 'pending',
          },
        } as any),
      });

      setStatusMessage({ type: 'success', text: 'Perfil y documentación actualizados correctamente.' });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al guardar cambios' });
    } finally {
      setIsSaving(false);
    }
  };

  const isMotorized = vehicleType === 'automovil' || vehicleType === 'motocicleta';

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-md mx-auto select-none bg-white text-[#101828]">
      {/* Profile Card */}
      <div className="bg-[#F4F6F8] border border-[#E5E7EB] p-6 rounded-3xl flex flex-col items-center text-center gap-3">
        <div className="relative group">
          <img
            src={profileImage}
            alt="Foto de perfil"
            className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-md"
          />
          <label className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-[#05268F] text-[#FFD318] cursor-pointer hover:bg-[#0732b3] transition shadow">
            <Camera className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload(setProfileImage)}
            />
          </label>
        </div>

        <div>
          <h2 className="text-xl font-black text-[#101828]">{profile?.name || 'Repartidor Directaurante'}</h2>
          <p className="text-xs text-[#05268F] font-bold">{profile?.email}</p>
        </div>

        {/* Verification Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF0FF] border border-[#05268F]/20 text-[#05268F] text-xs font-black">
          <ShieldCheck className="w-4 h-4" />
          <span>Repartidor Autorizado Directaurante</span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Datos Personales */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl space-y-3 shadow-xs">
        <span className="text-xs font-black uppercase tracking-wider text-[#667085]">
          Datos Personales
        </span>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-[11px] font-bold text-[#667085]">Nombre Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] font-bold text-[#101828] focus:border-[#05268F] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#667085]">Teléfono de Contacto</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] font-mono font-bold text-[#101828] focus:border-[#05268F] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tipo de Transporte */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl space-y-3 shadow-xs">
        <span className="text-xs font-black uppercase tracking-wider text-[#667085]">
          Tipo de Transporte
        </span>

        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'motocicleta', label: 'Motocicleta', icon: Bike },
            { id: 'automovil', label: 'Automóvil', icon: Car },
            { id: 'bicicleta', label: 'Bicicleta', icon: Bike },
            { id: 'a_pie', label: 'A pie', icon: Footprints },
          ] as const).map((t) => {
            const Icon = t.icon;
            const isSelected = vehicleType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setVehicleType(t.id)}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition active:scale-95 ${
                  isSelected
                    ? 'bg-[#05268F] text-[#FFD318] border-[#05268F] font-black shadow-xs'
                    : 'bg-[#F4F6F8] text-[#101828] border-[#E5E7EB] font-semibold hover:border-[#05268F]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div>
          <label className="text-[11px] font-bold text-[#667085]">Detalle del Vehículo / Modelo</label>
          <input
            type="text"
            value={vehicleInfo}
            onChange={(e) => setVehicleInfo(e.target.value)}
            placeholder="Ej: Italika FT150 negra / Chevrolet Aveo"
            className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828] focus:border-[#05268F] focus:outline-none"
          />
        </div>
      </div>

      {/* 7. DOCUMENTACIÓN REQUERIDA */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-3xl space-y-4 shadow-xs">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#667085]">
            Documentación Obligatoria
          </span>
          <p className="text-[11px] text-[#667085] mt-0.5">
            Documentos oficiales para validación y activación por Master.
          </p>
        </div>

        {/* INE Frontal y Trasera */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#101828] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#05268F]" />
            <span>INE / Identificación Oficial</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="border border-dashed border-[#E5E7EB] bg-[#F4F6F8] hover:border-[#05268F] rounded-2xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition">
              {ineFront ? (
                <span className="text-[10px] font-bold text-emerald-700">✓ Frente Cargado</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-[#667085] mb-1" />
                  <span className="text-[11px] font-bold text-[#101828]">Frente</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload(setIneFront)} />
            </label>

            <label className="border border-dashed border-[#E5E7EB] bg-[#F4F6F8] hover:border-[#05268F] rounded-2xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition">
              {ineBack ? (
                <span className="text-[10px] font-bold text-emerald-700">✓ Reverso Cargado</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-[#667085] mb-1" />
                  <span className="text-[11px] font-bold text-[#101828]">Reverso</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload(setIneBack)} />
            </label>
          </div>
        </div>

        {/* Comprobante de Domicilio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#101828] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#05268F]" />
              <span>Comprobante de Domicilio</span>
            </label>
            <span className="text-[10px] text-[#667085]">Máximo 3 meses</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-[#667085]">Fecha de Emisión</label>
              <input
                type="date"
                value={proofDate}
                onChange={(e) => setProofDate(e.target.value)}
                className="w-full mt-1 px-2.5 py-2 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs font-semibold text-[#101828]"
              />
            </div>

            <label className="border border-dashed border-[#E5E7EB] bg-[#F4F6F8] hover:border-[#05268F] rounded-2xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition">
              {proofOfAddress ? (
                <span className="text-[10px] font-bold text-emerald-700">✓ Comprobante OK</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-[#667085] mb-1" />
                  <span className="text-[11px] font-bold text-[#101828]">Subir Foto</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload(setProofOfAddress)} />
            </label>
          </div>
          {!isProofRecent() && (
            <p className="text-[10px] text-rose-700 font-semibold">
              ⚠️ La fecha excede los 3 meses permitidos. Sube un recibo reciente (agua, luz, etc).
            </p>
          )}
        </div>

        {/* Tarjeta de Circulación (Sólo si vehículo motorizado) */}
        {isMotorized && (
          <div className="space-y-2 p-3 bg-[#EAF0FF]/50 rounded-2xl border border-[#05268F]/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#05268F] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#05268F]" />
                <span>Tarjeta de Circulación Vigente</span>
              </label>
              <span className="text-[10px] font-bold text-[#05268F]">Obligatorio {vehicleType}</span>
            </div>

            <label className="border border-dashed border-[#05268F]/30 bg-white hover:border-[#05268F] rounded-2xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition">
              {circulationCard ? (
                <span className="text-[10px] font-bold text-emerald-700">✓ Tarjeta de Circulación Cargada</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-[#05268F] mb-1" />
                  <span className="text-[11px] font-bold text-[#05268F]">Subir Foto de Tarjeta de Circulación</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload(setCirculationCard)} />
            </label>
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSaveProfile}
        disabled={isSaving}
        className="w-full py-4 rounded-2xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Guardando...' : 'Guardar Perfil y Documentos'}</span>
      </button>

      <button
        onClick={onLogout}
        className="w-full py-3.5 rounded-2xl bg-[#F4F6F8] hover:bg-rose-50 text-rose-700 border border-[#E5E7EB] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95"
      >
        <LogOut className="w-4 h-4" />
        <span>Cerrar Sesión</span>
      </button>
    </div>
  );
};
