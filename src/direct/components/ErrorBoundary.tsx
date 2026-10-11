import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4 bg-zinc-50 font-sans">
          <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-base font-black text-zinc-900">
                {this.props.fallbackTitle || 'Ocurrió un inconveniente al cargar esta sección'}
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                La vista encontró un error inesperado al renderizar. Puedes reintentar o volver al inicio sin perder tu sesión.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="text-[11px] text-zinc-600 font-mono bg-zinc-100 p-3 rounded-xl border border-zinc-200 text-left overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              <button
                type="button"
                onClick={this.reset}
                className="px-4 py-2 rounded-xl bg-[#05268F] text-[#FFD318] text-xs font-bold hover:bg-[#0732b3] transition shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('direct_last_active_view', 'explore');
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold hover:bg-zinc-200 transition flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Volver al Inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
