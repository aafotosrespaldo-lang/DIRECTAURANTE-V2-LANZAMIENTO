export interface RealtimeEventPayload {
  type: string;
  data: any;
  order_id?: string;
  folio?: string;
  restaurant_id?: string;
  driver_id?: string;
  customer_id?: string;
  timestamp: string;
}

export type RealtimeEventHandler = (event: RealtimeEventPayload) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private listeners: Set<RealtimeEventHandler> = new Set();
  private reconnectTimeout: any = null;
  private reconnectDelay = 2000;
  private token: string | null = null;
  private isConnected = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.token && !this.isConnected) {
          this.reconnectDelay = 1000;
          this.connect(this.token);
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.token && !this.isConnected) {
          this.reconnectDelay = 1000;
          this.connect(this.token);
        }
      });
    }
  }

  public connect(token?: string) {
    this.token = token || null;

    if (this.eventSource) {
      this.disconnect();
    }

    try {
      let baseUrl = '';
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
        baseUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
      } else if (
        typeof window !== 'undefined' &&
        window.location.hostname.endsWith('directaurante.com') &&
        !window.location.hostname.startsWith('api.')
      ) {
        baseUrl = `${window.location.protocol}//api.directaurante.com`;
      }

      const url = token
        ? `${baseUrl}/api/realtime/stream?token=${encodeURIComponent(token)}`
        : `${baseUrl}/api/realtime/stream?token=guest`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectDelay = 2000;
      };

      // General messages
      this.eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.notify(payload);
        } catch {
          // ignore keepalive or plain text
        }
      };

      // Named event listeners
      const eventTypes = [
        'ORDER_CREATED',
        'ORDER_ACCEPTED',
        'ORDER_REJECTED',
        'ORDER_PREPARING',
        'ORDER_READY',
        'DRIVER_OFFER_CREATED',
        'DRIVER_ASSIGNED',
        'DRIVER_LOCATION_UPDATED',
        'ORDER_ON_THE_WAY',
        'ORDER_DELIVERED',
        'ORDER_CANCELLED',
        'MESSAGE_CREATED',
        'MESSAGE_READ',
        'MESSAGE_UPDATED',
        'MESSAGE_CLOSED',
        'ORDER_EVIDENCE_ADDED',
        'PROFILE_UPDATED',
        'RESTAURANT_STATUS_CHANGED',
        'RESTAURANT_UPDATED',
        'INVENTORY_UPDATED',
        'CONVERSATION_UPDATED',
        'INCIDENT_CREATED',
        'INCIDENT_UPDATED',
        'ENTITLEMENT_UPDATED',
        'PAYMENT_UPDATED',
      ];

      for (const evt of eventTypes) {
        this.eventSource.addEventListener(evt, (e: any) => {
          try {
            const payload = JSON.parse(e.data);
            this.playNotificationSound(payload?.type || evt);
            this.notify(payload);
          } catch {
            // ignore
          }
        });
      }

      this.eventSource.onerror = () => {
        this.isConnected = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Schedule reconnection with exponential backoff
        if (!this.reconnectTimeout && this.token) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
            if (this.token) {
              this.connect(this.token);
            }
          }, this.reconnectDelay);
        }
      };
    } catch {
      // non-fatal
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  public subscribe(handler: RealtimeEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private notify(event: any) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // safety
      }
    }
  }

  // Synthesizes an audible alert with Web Audio API without requiring external audio assets
  public playNotificationSound(eventType?: string) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();

      if (eventType === 'ORDER_CREATED' || eventType === 'DRIVER_OFFER_CREATED') {
        // High-priority 2-tone kitchen/driver bell: Ding-Dong!
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain1.gain.setValueAtTime(0.2, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5
        gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.2);
        osc2.stop(ctx.currentTime + 0.6);
      } else {
        // Standard soft chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio autoplay policy might block if no user interaction yet
    }
  }
}

export const realtimeClient = new RealtimeClient();
