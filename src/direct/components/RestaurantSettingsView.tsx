import React, { useState, useRef, useEffect } from 'react';
import { Restaurant } from '../types.ts';
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Save,
  Check,
  Star,
  MapPin,
  Clock,
  DollarSign,
  Phone,
  Store,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Tag,
  Eye,
  CheckCircle2,
  Trash2,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  Unlink,
  Ban,
  AlertTriangle,
  Calendar,
  Award,
  Bike,
  Users,
} from 'lucide-react';
import { directApi } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { getRestaurantOperationalStatus } from '../utils/restaurantStatus.ts';

interface RestaurantSettingsViewProps {
  initialRestaurant: Partial<Restaurant>;
  currentRestaurantId: string;
  onSave: (data: Partial<Restaurant>) => Promise<void>;
  isSaving: boolean;
}

// Preset logos curated for fast 1-click selection
const LOGO_PRESETS = [
  {
    name: 'Tacos al Pastor',
    tag: 'Tacos',
    url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300&h=300&fit=crop&q=80',
  },
  {
    name: 'Burger Grill',
    tag: 'Burgers',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop&q=80',
  },
  {
    name: 'Pizza Napolitana',
    tag: 'Pizza',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=300&fit=crop&q=80',
  },
  {
    name: 'Café & Panadería',
    tag: 'Café',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=300&fit=crop&q=80',
  },
  {
    name: 'Sushi & Ramen',
    tag: 'Asiática',
    url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&h=300&fit=crop&q=80',
  },
  {
    name: 'Mariscos Frescos',
    tag: 'Mariscos',
    url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=300&h=300&fit=crop&q=80',
  },
];

// Preset banners curated for fast 1-click selection
const BANNER_PRESETS = [
  {
    name: 'Tacos & Salsas',
    tag: 'Tacos',
    url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&h=600&fit=crop&q=80',
  },
  {
    name: 'Smash Burgers & Papas',
    tag: 'Burgers',
    url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&h=600&fit=crop&q=80',
  },
  {
    name: 'Pizzas Artesanales',
    tag: 'Pizza',
    url: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=1200&h=600&fit=crop&q=80',
  },
  {
    name: 'Desayunos & Antojitos',
    tag: 'Mexicana',
    url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1200&h=600&fit=crop&q=80',
  },
  {
    name: 'Cortes & Parrillada',
    tag: 'Asador',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&h=600&fit=crop&q=80',
  },
  {
    name: 'Cafetería & Waffles',
    tag: 'Dulce',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&h=600&fit=crop&q=80',
  },
];

const AVAILABLE_TAGS = [
  'Tacos',
  'Mexicana',
  'Antojitos',
  'Hamburguesas',
  'Pizza',
  'Snacks',
  'Bebidas',
  'Postres',
  'Mariscos',
  'Cafetería',
  'Desayunos',
  'Parrilla',
];

const DAYS_OF_WEEK: { key: string; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

// High-speed client-side image compression using HTML5 Canvas & Blob URL
const compressImage = (
  file: File,
  maxWidth = 1200,
  maxHeight = 600,
  quality = 0.80,
  forceJpeg = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida.'));
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('No se pudo inicializar el procesador gráfico del dispositivo.'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Use JPEG for banners/photos or when forceJpeg is true to produce compact payloads (<150KB)
      const isPngWithTransparency = file.type === 'image/png' && !forceJpeg;

      if (!isPngWithTransparency) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      const exportFormat = isPngWithTransparency ? 'image/png' : 'image/jpeg';
      let dataUrl = canvas.toDataURL(exportFormat, quality);

      // If PNG is over 500KB, convert to JPEG to keep payload lightweight
      if (isPngWithTransparency && dataUrl.length > 600000) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = width;
        fallbackCanvas.height = height;
        const fbCtx = fallbackCanvas.getContext('2d');
        if (fbCtx) {
          fbCtx.fillStyle = '#FFFFFF';
          fbCtx.fillRect(0, 0, width, height);
          fbCtx.drawImage(img, 0, 0, width, height);
          dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.82);
        }
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo procesar la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });
};

export const RestaurantSettingsView: React.FC<RestaurantSettingsViewProps> = ({
  initialRestaurant,
  currentRestaurantId,
  onSave,
  isSaving,
}) => {
  // Local form state
  const [formData, setFormData] = useState<Partial<Restaurant>>({
    name: initialRestaurant.name || '',
    description: initialRestaurant.description || '',
    phone: initialRestaurant.phone || '',
    address: initialRestaurant.address || '',
    logo_url: initialRestaurant.logo_url || '',
    banner_url: initialRestaurant.banner_url || '',
    delivery_fee: initialRestaurant.delivery_fee ?? 2500,
    min_order: initialRestaurant.min_order ?? 8000,
    delivery_time_min: initialRestaurant.delivery_time_min ?? 25,
    delivery_time_max: initialRestaurant.delivery_time_max ?? 40,
    rating: initialRestaurant.rating ?? 4.8,
    category_tags: initialRestaurant.category_tags || ['Tacos', 'Mexicana', 'Antojitos'],
    schedule: initialRestaurant.schedule || {
      monday: '14:00 - 23:00',
      tuesday: '14:00 - 23:00',
      wednesday: '14:00 - 23:00',
      thursday: '14:00 - 23:30',
      friday: '14:00 - 00:00',
      saturday: '14:00 - 00:30',
      sunday: '14:00 - 23:00',
    },
    is_open: initialRestaurant.is_open ?? true,
    is_active: initialRestaurant.is_active ?? true,
    delivery_mode: (initialRestaurant as any).delivery_mode || 'platform_fleet',
    local_driver_name: (initialRestaurant as any).local_driver_name || '',
    local_driver_phone: (initialRestaurant as any).local_driver_phone || '',
  });

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [logoInputMode, setLogoInputMode] = useState<'upload' | 'url'>('upload');
  const [bannerInputMode, setBannerInputMode] = useState<'upload' | 'url'>('upload');
  const [tagInput, setTagInput] = useState('');
  const [hasSavedSuccess, setHasSavedSuccess] = useState(false);

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useApp();
  const isMaster = user?.role === 'master' || (user?.role as any) === 'admin';

  // Mercado Pago Marketplace State (Exclusivo para Master/Admin)
  const [mpStatus, setMpStatus] = useState<{
    is_connected: boolean;
    collector_id?: string;
    nickname?: string;
    connected_at?: string;
  }>({ is_connected: false });
  const [loadingMp, setLoadingMp] = useState(false);
  const [isDisconnectingMp, setIsDisconnectingMp] = useState(false);

  useEffect(() => {
    if (!isMaster) return;
    const fetchMp = async () => {
      try {
        setLoadingMp(true);
        const res = await directApi.getRestaurantMercadoPagoStatus(currentRestaurantId || initialRestaurant.id);
        setMpStatus(res);
      } catch (err) {
        console.warn('No se pudo cargar estado de Mercado Pago:', err);
      } finally {
        setLoadingMp(false);
      }
    };
    fetchMp();
  }, [currentRestaurantId, initialRestaurant.id, isMaster]);

  const handleConnectMp = async () => {
    try {
      setLoadingMp(true);
      const res = await directApi.getRestaurantMercadoPagoAuthUrl(currentRestaurantId || initialRestaurant.id);
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      alert(err.message || 'Error al iniciar vinculación con Mercado Pago');
    } finally {
      setLoadingMp(false);
    }
  };

  const handleDisconnectMp = async () => {
    if (!confirm('¿Seguro que deseas desvincular tu cuenta de cobros de Mercado Pago?')) return;
    try {
      setIsDisconnectingMp(true);
      await directApi.disconnectRestaurantMercadoPago(currentRestaurantId || initialRestaurant.id);
      setMpStatus({ is_connected: false });
    } catch (err: any) {
      alert(err.message || 'Error al desvincular cuenta');
    } finally {
      setIsDisconnectingMp(false);
    }
  };

  // Sync state if initialRestaurant changes
  useEffect(() => {
    if (initialRestaurant && initialRestaurant.name) {
      setFormData((prev) => ({
        ...prev,
        ...initialRestaurant,
      }));
    }
  }, [initialRestaurant]);

  // Handle Logo Upload from device (camera, gallery, files)
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const compressedDataUrl = await compressImage(file, 500, 500, 0.85, false);
      setFormData((prev) => ({ ...prev, logo_url: compressedDataUrl }));
    } catch (err: any) {
      console.error('Error subiendo logo:', err);
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    }
  };

  // Handle Banner Upload from device (camera, gallery, files)
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      // Force JPEG for banner: razor-sharp, lightweight (~90-140KB)
      const compressedDataUrl = await compressImage(file, 1200, 600, 0.80, true);
      setFormData((prev) => ({ ...prev, banner_url: compressedDataUrl }));
    } catch (err: any) {
      console.error('Error subiendo banner:', err);
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  // Add / Remove category tags
  const handleAddTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    const current = formData.category_tags || [];
    if (!current.includes(clean)) {
      setFormData({ ...formData, category_tags: [...current, clean] });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const current = formData.category_tags || [];
    setFormData({
      ...formData,
      category_tags: current.filter((t) => t !== tagToRemove),
    });
  };

  // Helper to parse day schedule whether stored as object or string
  const parseDaySchedule = (val: any): { isOpen: boolean; openTime: string; closeTime: string } => {
    if (!val) {
      return { isOpen: true, openTime: '13:00', closeTime: '23:00' };
    }
    if (typeof val === 'object' && val !== null) {
      return {
        isOpen: val.isOpen !== false,
        openTime: val.openTime || '13:00',
        closeTime: val.closeTime || '23:00',
      };
    }
    if (typeof val === 'string') {
      const trimmed = val.trim().toLowerCase();
      if (trimmed === 'cerrado' || trimmed === 'closed' || trimmed === 'inactivo' || trimmed === '') {
        return { isOpen: false, openTime: '13:00', closeTime: '23:00' };
      }
      const parts = val.split('-');
      if (parts.length === 2) {
        return {
          isOpen: true,
          openTime: parts[0].trim(),
          closeTime: parts[1].trim(),
        };
      }
    }
    return { isOpen: true, openTime: '13:00', closeTime: '23:00' };
  };

  // Toggle open/closed status for a specific day
  const handleToggleDay = (dayKey: string) => {
    const current = parseDaySchedule(formData.schedule?.[dayKey]);
    const nextIsOpen = !current.isOpen;
    const newSchedule = {
      ...(formData.schedule || {}),
      [dayKey]: {
        isOpen: nextIsOpen,
        openTime: current.openTime,
        closeTime: current.closeTime,
        raw: nextIsOpen ? `${current.openTime} - ${current.closeTime}` : 'Cerrado',
      },
    };
    setFormData((prev) => ({ ...prev, schedule: newSchedule }));
  };

  // Update specific day hours
  const handleDayTimeChange = (dayKey: string, field: 'openTime' | 'closeTime', value: string) => {
    const current = parseDaySchedule(formData.schedule?.[dayKey]);
    const updated = {
      ...current,
      [field]: value,
    };
    const newSchedule = {
      ...(formData.schedule || {}),
      [dayKey]: {
        ...updated,
        raw: updated.isOpen ? `${updated.openTime} - ${updated.closeTime}` : 'Cerrado',
      },
    };
    setFormData((prev) => ({ ...prev, schedule: newSchedule }));
  };

  // Apply batch schedule presets
  const handleApplyPresetHours = (hours: string) => {
    const parts = hours.split('-');
    const openTime = parts[0]?.trim() || '13:00';
    const closeTime = parts[1]?.trim() || '23:00';
    const newSched: Record<string, any> = {};
    DAYS_OF_WEEK.forEach((d) => {
      newSched[d.key] = {
        isOpen: true,
        openTime,
        closeTime,
        raw: hours,
      };
    });
    setFormData((prev) => ({ ...prev, schedule: newSched }));
  };

  const handleApplyWeekdayPreset = () => {
    const newSched: Record<string, any> = {};
    DAYS_OF_WEEK.forEach((d) => {
      const isWeekday = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d.key);
      newSched[d.key] = {
        isOpen: isWeekday,
        openTime: '13:00',
        closeTime: '23:00',
        raw: isWeekday ? '13:00 - 23:00' : 'Cerrado',
      };
    });
    setFormData((prev) => ({ ...prev, schedule: newSched }));
  };

  const handleApplyWeekendPreset = () => {
    const newSched: Record<string, any> = {};
    DAYS_OF_WEEK.forEach((d) => {
      const isWeekend = ['friday', 'saturday', 'sunday'].includes(d.key);
      newSched[d.key] = {
        isOpen: isWeekend,
        openTime: '14:00',
        closeTime: '01:00',
        raw: isWeekend ? '14:00 - 01:00' : 'Cerrado',
      };
    });
    setFormData((prev) => ({ ...prev, schedule: newSched }));
  };

  // Instant toggle for closed status
  const [isTogglingClosed, setIsTogglingClosed] = useState(false);
  const handleToggleTemporarilyClosed = async () => {
    const currentClosed = Boolean(formData.is_temporarily_closed ?? (!formData.is_open));
    const targetClosed = !currentClosed;
    
    setFormData((prev) => ({
      ...prev,
      is_temporarily_closed: targetClosed,
      is_open: !targetClosed,
    }));

    try {
      setIsTogglingClosed(true);
      const res = await directApi.toggleRestaurantClosed(targetClosed);
      if (res && res.data) {
        setFormData((prev) => ({ ...prev, ...res.data }));
      }
      if (onSave) {
        await onSave({ is_temporarily_closed: targetClosed, is_open: !targetClosed });
      }
      setHasSavedSuccess(true);
      setTimeout(() => setHasSavedSuccess(false), 3000);
    } catch (err) {
      console.warn('Error al cambiar estado cerrado:', err);
    } finally {
      setIsTogglingClosed(false);
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSavedSuccess(false);
    await onSave(formData);
    setHasSavedSuccess(true);
    setTimeout(() => setHasSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Panel */}
      <div className="bg-gradient-to-r from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/40 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#05268F]/30 text-[#FFD318] border border-[#FFD318]/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight">
              Configuraciones y Credencial del Restaurante
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Sube o cambia el <strong>logo</strong> y el <strong>banner</strong> desde cualquier dispositivo móvil o computadora.
            Los cambios se guardan y actualizan automáticamente la credencial o tarjeta que ven los clientes en su zona.
          </p>
        </div>

        {/* Global Save Button in Header */}
        <div className="flex items-center gap-3">
          {hasSavedSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-2 rounded-xl animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              ¡Guardado y Actualizado!
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-black text-xs flex items-center gap-2 shadow-lg shadow-[#05268F]/30 transition active:scale-95 disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Guardando...' : 'Guardar Configuraciones'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form & Upload Controls (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* SECTION 1: IDENTIDAD VISUAL (LOGO Y BANNER) */}
          <div className="bg-[#080d2c]/90 border border-[#05268F]/35 rounded-3xl p-5 sm:p-6 shadow-lg space-y-6">
            <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-3">
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#FFD318]" />
                  1. Imagen del Restaurante (Logo) y Banner
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Visible en la tarjeta de presentación de la zona y en la cabecera de tu menú.
                </p>
              </div>
            </div>

            {/* A) FOTO / LOGO DEL RESTAURANTE */}
            <div className="bg-[#05091e]/70 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#FFD318]" />
                  Logo o Foto del Restaurante
                </label>
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setLogoInputMode('upload')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      logoInputMode === 'upload' ? 'bg-[#05268F] text-[#FFD318]' : 'text-zinc-400'
                    }`}
                  >
                    Subir archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoInputMode('url')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      logoInputMode === 'url' ? 'bg-[#05268F] text-[#FFD318]' : 'text-zinc-400'
                    }`}
                  >
                    Enlace URL
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Logo Preview Avatar */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#FFD318]/60 bg-zinc-900 shadow-md flex items-center justify-center">
                    {formData.logo_url ? (
                      <img
                        src={formData.logo_url}
                        alt="Logo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-8 h-8 text-zinc-600" />
                    )}
                  </div>
                  {formData.logo_url && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, logo_url: '' }))}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow transition"
                      title="Quitar logo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Upload or URL Controls */}
                <div className="flex-1 w-full space-y-2">
                  {logoInputMode === 'upload' ? (
                    <div>
                      <input
                        type="file"
                        ref={logoFileInputRef}
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#05268F]/30 hover:bg-[#05268F]/50 border border-[#05268F] text-[#FFD318] text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98"
                      >
                        <Upload className={`w-3.5 h-3.5 ${isUploadingLogo ? 'animate-bounce' : ''}`} />
                        {isUploadingLogo
                          ? 'Optimizando foto...'
                          : 'Subir Logo desde este dispositivo (Cámara o Galería)'}
                      </button>
                      <p className="text-[10px] text-zinc-400 text-center mt-1">
                        Soporta JPG, PNG, WEBP desde celulares, tabletas y computadoras.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="url"
                        value={formData.logo_url || ''}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        placeholder="https://ejemplo.com/logo-restaurante.jpg"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD318]"
                      />
                    </div>
                  )}

                  {/* Fast Presets for Logo */}
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-1">O elige un logo rápido sugerido:</span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {LOGO_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, logo_url: preset.url })}
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 shrink-0 transition ${
                            formData.logo_url === preset.url
                              ? 'bg-[#FFD318] text-[#05268F] border-[#FFD318] font-bold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                          {preset.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* B) BANNER / FOTO DE PORTADA */}
            <div className="bg-[#05091e]/70 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#FFD318]" />
                  Banner / Portada Panorámica
                </label>
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setBannerInputMode('upload')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      bannerInputMode === 'upload' ? 'bg-[#05268F] text-[#FFD318]' : 'text-zinc-400'
                    }`}
                  >
                    Subir archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerInputMode('url')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      bannerInputMode === 'url' ? 'bg-[#05268F] text-[#FFD318]' : 'text-zinc-400'
                    }`}
                  >
                    Enlace URL
                  </button>
                </div>
              </div>

              {/* Banner Visual Preview */}
              <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-[#05268F]/40 bg-zinc-900">
                {formData.banner_url ? (
                  <img
                    src={formData.banner_url}
                    alt="Banner Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-1">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[11px]">Sin imagen de banner</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <span className="absolute bottom-2 right-3 text-[10px] text-zinc-300 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 font-mono">
                  Aspecto 16:9 Panorámico
                </span>
                {formData.banner_url && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, banner_url: '' }))}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow transition"
                    title="Quitar banner"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Controls */}
              {bannerInputMode === 'upload' ? (
                <div>
                  <input
                    type="file"
                    ref={bannerFileInputRef}
                    accept="image/*"
                    onChange={handleBannerFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#05268F]/30 hover:bg-[#05268F]/50 border border-[#05268F] text-[#FFD318] text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isUploadingBanner ? 'animate-bounce' : ''}`} />
                    {isUploadingBanner
                      ? 'Optimizando portada...'
                      : 'Subir Portada desde este dispositivo'}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="url"
                    value={formData.banner_url || ''}
                    onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    placeholder="https://ejemplo.com/banner-portada.jpg"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD318]"
                  />
                </div>
              )}

              {/* Fast Presets for Banner */}
              <div>
                <span className="text-[10px] text-zinc-400 block mb-1">O elige una portada temática de alta resolución:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BANNER_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, banner_url: preset.url })}
                      className={`relative h-12 rounded-xl overflow-hidden border text-left p-1.5 flex flex-col justify-end transition group ${
                        formData.banner_url === preset.url
                          ? 'border-[#FFD318] ring-2 ring-[#FFD318]/50'
                          : 'border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition" />
                      <div className="absolute inset-0 bg-black/40" />
                      <span className="relative text-[10px] font-bold text-white leading-tight drop-shadow">
                        {preset.tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DATOS COMERCIALES Y CONTACTO */}
          <div className="bg-[#080d2c]/90 border border-[#05268F]/35 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#05268F]/25 pb-3">
              <Store className="w-4 h-4 text-[#FFD318]" />
              2. Datos Comerciales del Negocio
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Nombre Comercial del Restaurante *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Taquería El Güero"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Descripción Gastronómica / Especialidades
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Auténticos tacos al pastor, suadero, gringas y salsas de la casa."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1 font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#FFD318]" />
                    Teléfono / WhatsApp de Contacto
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej. 4621122334"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1 font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#FFD318]" />
                    Dirección Física para Clientes y Repartidores
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ej. Av. Morelos #142, Col. Centro"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
                  />
                </div>
              </div>

              {/* Categorías / Etiquetas gastronómicas */}
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#FFD318]" />
                  Etiquetas de Cocina y Filtros (Badges)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {(formData.category_tags || []).map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#05268F]/40 border border-[#FFD318]/40 text-[#FFD318] flex items-center gap-1.5"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Agregar otra etiqueta (ej. Postres)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFD318]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
                  >
                    Agregar
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {AVAILABLE_TAGS.filter((t) => !(formData.category_tags || []).includes(t)).map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddTag(t)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: TARIFAS, TIEMPOS Y HORARIOS */}
          <div className="bg-[#080d2c]/90 border border-[#05268F]/35 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#05268F]/25 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#FFD318]" />
                  3. Tarifas, Tiempos de Entrega y Horarios de Atención
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Gestiona tu disponibilidad en tiempo real, activa o desactiva días de apertura y controla tu estado operativo.
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                {formData.is_temporarily_closed || !formData.is_open ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-950 border border-rose-600 text-rose-300">
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    FUERA DE SERVICIO
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-950 border border-emerald-600 text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    EN SERVICIO
                  </span>
                )}
              </div>
            </div>

            {/* BOTÓN Y TARJETA: CERRADO TEMPORALMENTE */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 ${
                formData.is_temporarily_closed || !formData.is_open
                  ? 'bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-[#1e070e] border-rose-600/80 shadow-lg shadow-rose-950/30'
                  : 'bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-[#071a14] border-emerald-600/70 shadow-lg shadow-emerald-950/20'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {formData.is_temporarily_closed || !formData.is_open ? (
                      <Ban className="w-5 h-5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="text-sm font-black text-white tracking-wide uppercase">
                      {formData.is_temporarily_closed || !formData.is_open
                        ? 'Cerrado Temporalmente (Fuera de Servicio)'
                        : 'Abierto para Recibir Comandas'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
                    {formData.is_temporarily_closed || !formData.is_open ? (
                      <span>
                        <strong className="text-rose-300 font-bold">¡Atención!</strong> Tu restaurante se encuentra actualmente{' '}
                        <strong className="text-rose-200 underline">FUERA DE SERVICIO</strong>. La tarjeta que ven los clientes muestra la leyenda{' '}
                        <span className="bg-rose-900/80 px-2 py-0.5 rounded text-white font-black text-[11px]">FUERA DE SERVICIO</span> y no pueden ingresar órdenes.
                      </span>
                    ) : (
                      <span>
                        Tu restaurante está en línea y recibiendo órdenes con normalidad. Si necesitas pausar pedidos por alta demanda, haz clic en Cerrar Temporalmente.
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTemporarilyClosed}
                  disabled={isTogglingClosed}
                  className={`px-5 py-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shrink-0 shadow-md ${
                    formData.is_temporarily_closed || !formData.is_open
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-pulse'
                  }`}
                >
                  {isTogglingClosed ? (
                    <span>Actualizando...</span>
                  ) : formData.is_temporarily_closed || !formData.is_open ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Abrir Restaurante (Poner en Servicio)</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Cerrado Temporalmente (Fuera de Servicio)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ESTADO DE LICENCIA Y SUSCRIPCIÓN COMERCIAL */}
            <div className="p-4 rounded-2xl bg-[#060b24] border border-[#05268F]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#05268F]/40 border border-[#FFD318]/30 text-[#FFD318]">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-xs">Estado de Licencia Directaurante:</span>
                    {formData.subscription_status === 'active' ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 font-bold border border-emerald-700/60 text-[10px]">
                        Suscripción Activa
                      </span>
                    ) : formData.subscription_status === 'trial' ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 font-bold border border-amber-600/60 text-[10px]">
                        Prueba Gratuita (15 días)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-400 font-bold border border-rose-700/60 text-[10px]">
                        Licencia Expirada / Fuera de Servicio
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {formData.trial_ends_at
                      ? `Pase de prueba válido hasta: ${new Date(formData.trial_ends_at).toLocaleDateString()} (${Math.max(0, Math.ceil((new Date(formData.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} días restantes). Al vencer, deberás contratar una suscripción o pasarás a Fuera de Servicio.`
                      : 'Nuevos restaurantes cuentan con 15 días de prueba inicial gratuita. Después se requiere suscripción configurada por Master.'}
                  </p>
                </div>
              </div>
            </div>

            {/* TARIFAS Y TIEMPOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Tarifa de Envío ($ MXN)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#05268F]/30 text-[#FFD318] border border-[#FFD318]/30 font-bold">
                    Regulada por Master
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-zinc-500 font-bold">$</span>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={((formData.delivery_fee ?? 2500) / 100).toFixed(2)}
                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-7 pr-3 py-2 text-zinc-300 cursor-not-allowed font-semibold"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Las tarifas de envío son coordinadas a nivel ecosistema por el panel Master.
                </span>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Pedido Mínimo ($ MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-zinc-500 font-bold">$</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={((formData.min_order ?? 8000) / 100).toFixed(0)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_order: Math.round(parseFloat(e.target.value || '0') * 100),
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-7 pr-3 py-2 text-white focus:outline-none focus:border-[#FFD318]"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 block mt-1">Importe mínimo para aceptar pedidos.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Tiempo Estimado de Entrega (Minutos)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formData.delivery_time_min ?? 25}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_time_min: parseInt(e.target.value, 10) || 20 })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-center focus:outline-none focus:border-[#FFD318]"
                  />
                  <span className="text-zinc-500 font-bold">a</span>
                  <input
                    type="number"
                    min="10"
                    max="240"
                    value={formData.delivery_time_max ?? 40}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_time_max: parseInt(e.target.value, 10) || 40 })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-center focus:outline-none focus:border-[#FFD318]"
                  />
                  <span className="text-zinc-400 text-xs">min</span>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">
                  Calificación Promedio
                </label>
                <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2">
                  <Star className="w-4 h-4 fill-[#FFD318] text-[#FFD318]" />
                  <span className="text-white font-bold">{formData.rating?.toFixed(1) || '4.8'}</span>
                  <span className="text-zinc-500 text-[11px]">/ 5.0 (Calculado por reseñas de comensales)</span>
                </div>
              </div>
            </div>

            {/* MODALIDAD DE ENTREGA + REGLAS FINANCIERAS (CONDUCTOR LOCAL VS FLOTA COMPARTIDA) */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#05268F]/40 text-[#FFD318] flex items-center justify-center border border-[#05268F]">
                    <Bike className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block">Modalidad de Entrega & Logística</span>
                    <span className="text-[10px] text-zinc-400">Reglas operativas y financieras según tu plan comercial</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                    formData.delivery_mode === 'local_driver'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                      : 'bg-[#05268F]/30 text-[#FFD318] border-[#FFD318]/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      formData.delivery_mode === 'local_driver' ? 'bg-emerald-400' : 'bg-[#FFD318]'
                    }`}
                  ></span>
                  {formData.delivery_mode === 'local_driver' ? 'Conductor Local Propio' : 'Red de Repartidores Directaurante'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, delivery_mode: 'platform_fleet' })}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    formData.delivery_mode !== 'local_driver'
                      ? 'border-[#FFD318] bg-[#05268F]/20 text-white shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-[#FFD318]" />
                      Red Directaurante (Flota Compartida)
                    </span>
                    {formData.delivery_mode !== 'local_driver' && (
                      <Check className="w-3.5 h-3.5 text-[#FFD318]" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Despacho automático a los repartidores activos de la plataforma más cercanos al local.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, delivery_mode: 'local_driver' })}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    formData.delivery_mode === 'local_driver'
                      ? 'border-emerald-500 bg-emerald-950/30 text-white shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      Plan Conductor Local (Repartidor Propio)
                    </span>
                    {formData.delivery_mode === 'local_driver' && (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Entregas gestionadas directamente por tu personal. Exento de cobro de tarifa de conductor de plataforma.
                  </p>
                </button>
              </div>

              {formData.delivery_mode === 'local_driver' && (
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                  <div className="text-[11px] text-emerald-200/90 flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Regla financiera activa: Tus pedidos de entrega no descuentan tarifa de conductor externo de plataforma ($0 MXN retenido para conductor).
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <label className="text-zinc-400 block mb-1 font-semibold">
                        Nombre del Repartidor Local
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Roberto Martínez (Repartidor del Local)"
                        value={(formData as any).local_driver_name || ''}
                        onChange={(e) => setFormData({ ...formData, local_driver_name: e.target.value } as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1 font-semibold">
                        Teléfono del Repartidor Local
                      </label>
                      <input
                        type="tel"
                        placeholder="Ej. 4625550101"
                        value={(formData as any).local_driver_phone || ''}
                        onChange={(e) => setFormData({ ...formData, local_driver_phone: e.target.value } as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* HORARIOS POR DÍA DE LA SEMANA (ACTIVAR / DESACTIVAR DÍAS) */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#FFD318]" />
                    Días de Apertura y Horarios de Atención
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Activa o desactiva los días que abres. En los días desactivados, tu restaurante aparecerá como Fuera de Servicio.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPresetHours('14:00 - 23:00')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 hover:border-zinc-700"
                  >
                    Abrir Todos (14:00 - 23:00)
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyWeekdayPreset}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 hover:border-zinc-700"
                  >
                    Lunes a Viernes
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyWeekendPreset}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 hover:border-zinc-700"
                  >
                    Fines de Semana
                  </button>
                </div>
              </div>

              {/* Grid de días con switch y selectores de horas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {DAYS_OF_WEEK.map((d) => {
                  const daySched = parseDaySchedule(formData.schedule?.[d.key]);
                  return (
                    <div
                      key={d.key}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        daySched.isOpen
                          ? 'bg-zinc-950/80 border-zinc-800/80'
                          : 'bg-rose-950/20 border-rose-900/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleDay(d.key)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              daySched.isOpen ? 'bg-emerald-500' : 'bg-zinc-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                daySched.isOpen ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="font-bold text-white text-xs">{d.label}</span>
                        </div>

                        <div>
                          {daySched.isOpen ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Abierto
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                              Cerrado este día
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Horarios si está abierto */}
                      {daySched.isOpen ? (
                        <div className="mt-3 pt-2.5 border-t border-zinc-900 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400">Horario de servicio:</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={daySched.openTime}
                              onChange={(e) => handleDayTimeChange(d.key, 'openTime', e.target.value)}
                              placeholder="13:00"
                              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white text-center w-16 focus:outline-none focus:border-[#FFD318]"
                            />
                            <span className="text-zinc-500 font-bold">a</span>
                            <input
                              type="text"
                              value={daySched.closeTime}
                              onChange={(e) => handleDayTimeChange(d.key, 'closeTime', e.target.value)}
                              placeholder="23:00"
                              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white text-center w-16 focus:outline-none focus:border-[#FFD318]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-rose-300/80 italic">
                          Fuera de servicio durante toda la jornada.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Mercado Pago Marketplace Integration (Solo visible para rol Master/Admin) */}
          {isMaster && (
            <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/30 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#05268F]/25 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#05268F] text-[#FFD318]">
                    <CreditCard className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-white tracking-wide uppercase">
                      4. Cobros Online con Mercado Pago Marketplace
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Vincula tu cuenta oficial de Mercado Pago para recibir ventas online directo a tu saldo.
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                    mpStatus.is_connected
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/80'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {mpStatus.is_connected ? 'Cuenta Vinculada' : 'No Conectado'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3 text-xs">
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  Directaurante opera bajo el modelo <strong className="text-white">Mercado Pago Marketplace México</strong>.
                  Cuando un cliente paga con tarjeta, transferencia SPEI o en tiendas OXXO, el dinero se deposita en tu cuenta de Mercado Pago
                  y se descuenta de forma automática y transparente la comisión acordada del Core.
                </p>

                {mpStatus.is_connected ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">ID de Vendedor en Mercado Pago:</span>
                        <span className="font-mono text-xs font-bold text-white">{mpStatus.collector_id}</span>
                      </div>
                      {mpStatus.connected_at && (
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Fecha de enlace:</span>
                          <span className="text-[11px] text-zinc-300">{new Date(mpStatus.connected_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleDisconnectMp}
                        disabled={isDisconnectingMp}
                        className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        {isDisconnectingMp ? 'Desvinculando...' : 'Desvincular Cuenta'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-zinc-400">
                      Pulsa el botón para autorizar de forma segura en la página oficial de Mercado Pago mediante OAuth.
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectMp}
                      disabled={loadingMp}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/40 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#05268F]/30 transition shrink-0 disabled:opacity-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {loadingMp ? 'Cargando enlace...' : 'Vincular con Mercado Pago'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Save Action */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#0a0f30] to-[#04051a] border border-[#05268F]/40 rounded-3xl">
            <span className="text-xs text-zinc-400">
              Todos los cambios se persisten en base de datos y se actualizan al instante en el catálogo de clientes.
            </span>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] border border-[#FFD318]/50 font-black text-xs flex items-center gap-2 shadow-lg shadow-[#05268F]/30 transition active:scale-95 disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              {isSaving ? 'Guardando...' : 'Guardar y Publicar Credencial'}
            </button>
          </div>
        </form>

        {/* Right Column: LIVE CREDENTIAL / CUSTOMER CARD PREVIEW (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          <div className="bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border-2 border-[#FFD318]/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#05268F]/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#05268F] text-[#FFD318] border border-[#FFD318]/30">
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-white tracking-wide uppercase">
                    Credencial en el Catálogo de Clientes
                  </h3>
                  <span className="text-[10px] text-[#FFD318] flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Vista previa exacta en tiempo real
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug">
              Así es exactamente como los clientes de la zona ven tu restaurante al abrir la app de Directaurante:
            </p>

            {/* LIVE CARD ACCURATE SIMULATION */}
            <div className="group relative bg-gradient-to-b from-[#0a0f30] via-[#070728] to-[#04051a] border border-[#05268F]/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              {/* Banner Area */}
              <div className="relative h-44 w-full overflow-hidden bg-[#070728]">
                {formData.banner_url ? (
                  <img
                    src={formData.banner_url}
                    alt={formData.name || 'Restaurante'}
                    className="w-full h-full object-cover transition-transform duration-500 opacity-95"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070728] via-transparent to-black/30" />

                {/* Rating Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#070728]/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-[#FFD318] border border-[#05268F]/40 shadow-sm">
                  <Star className="w-3.5 h-3.5 fill-[#FFD318] text-[#FFD318]" />
                  <span>{(formData.rating ?? 4.8).toFixed(1)}</span>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1 shadow-md ${
                      formData.is_open
                        ? 'bg-emerald-950/85 text-emerald-400 border-emerald-700/80'
                        : 'bg-zinc-900/90 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        formData.is_open ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                      }`}
                    />
                    {formData.is_open ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>

                {/* Logo Badge (Avatar) */}
                <div className="absolute -bottom-3 left-4 w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#05268F]/70 shadow-xl bg-[#070728]">
                  {formData.logo_url ? (
                    <img
                      src={formData.logo_url}
                      alt={formData.name || 'Logo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-[#FFD318]">
                      <Store className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </div>

              {/* Card Content Details */}
              <div className="p-4 pt-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-[#080d2c] via-[#070728] to-[#04051a] border-t border-[#05268F]/20">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-zinc-100 tracking-tight truncate">
                      {formData.name || 'Nombre de tu Restaurante'}
                    </h3>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-0.5 shrink-0">
                      <MapPin className="w-3 h-3 text-[#FFD318]" />
                      1.8 km
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {formData.description || 'Aquí aparecerá la descripción gastronómica de tu cocina para todos los clientes.'}
                  </p>

                  {/* Categories Pills */}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {(formData.category_tags || ['Tacos', 'Mexicana']).slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold text-zinc-300 bg-[#05268F]/25 border border-[#05268F]/40 px-2 py-0.5 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer Bar */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-[#FFD318]" />
                    <span className="font-medium">
                      {formData.delivery_time_min ?? 25}-{formData.delivery_time_max ?? 40} min
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-emerald-400 font-bold block">
                      ${((formData.delivery_fee ?? 2500) / 100).toFixed(2)} MXN envío
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      Mínimo ${((formData.min_order ?? 8000) / 100).toFixed(0)} MXN
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reassurance Message */}
            <div className="p-3 rounded-2xl bg-[#05268F]/20 border border-[#05268F]/40 text-[11px] text-zinc-300 space-y-1">
              <span className="font-bold text-[#FFD318] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Garantía de Persistencia
              </span>
              <p className="text-[10px] text-zinc-400">
                Al hacer clic en Guardar, las fotos y configuración se sincronizan inmediatamente con el servidor, la base de datos y la memoria local del dispositivo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
