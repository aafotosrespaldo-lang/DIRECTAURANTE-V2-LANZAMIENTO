import React, { useEffect, useState, useRef } from 'react';
import { OrderMessage } from '../types.ts';
import { MessageSquare, Send, User, Store, Bike } from 'lucide-react';

interface DriverChatViewProps {
  orderId: string | null;
  orderFolio?: string;
  messages: OrderMessage[];
  onSendMessage: (orderId: string, text: string) => Promise<void>;
  currentDriverId: string;
  onRefreshMessages: () => Promise<void>;
}

export const DriverChatView: React.FC<DriverChatViewProps> = ({
  orderId,
  orderFolio,
  messages,
  onSendMessage,
  currentDriverId,
  onRefreshMessages,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickReplies = [
    'Voy en camino',
    'He llegado al restaurante',
    'Estoy afuera del domicilio',
    'Hay tráfico en la zona',
    'El restaurante está preparando el pedido',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !orderId) return;

    try {
      setIsSending(true);
      await onSendMessage(orderId, text);
      setInputText('');
    } finally {
      setIsSending(false);
    }
  };

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto min-h-[50vh] text-[#667085] bg-white">
        <MessageSquare className="w-12 h-12 text-[#667085] mb-3 opacity-40" />
        <h3 className="font-black text-[#101828]">Sin pedido activo</h3>
        <p className="text-xs text-[#667085] mt-1">
          El chat contextual se activa automáticamente cuando tienes un pedido asignado en curso.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-145px)] max-w-md mx-auto p-4 pb-20 select-none bg-white text-[#101828]">
      {/* Top Chat Header */}
      <div className="bg-[#F4F6F8] border border-[#E5E7EB] p-3.5 rounded-2xl flex items-center justify-between mb-3 shadow-xs">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#05268F]" />
          <span className="text-xs font-black text-[#101828]">Chat del Pedido {orderFolio || `#${orderId.slice(-6)}`}</span>
        </div>
        <button
          onClick={onRefreshMessages}
          className="text-[10px] text-[#05268F] font-bold hover:bg-[#EAF0FF] px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white transition"
        >
          Actualizar
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-xs text-[#667085]">
            No hay mensajes aún. Escribe al cliente o al restaurante.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentDriverId || msg.sender_role === 'driver';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1 text-[10px] text-[#667085] mb-0.5">
                  {msg.sender_role === 'restaurant' ? (
                    <Store className="w-3 h-3 text-[#05268F]" />
                  ) : msg.sender_role === 'driver' ? (
                    <Bike className="w-3 h-3 text-[#05268F]" />
                  ) : (
                    <User className="w-3 h-3 text-[#05268F]" />
                  )}
                  <span className="font-semibold">{msg.sender_name}</span>
                </div>

                <div
                  className={`p-3 rounded-2xl max-w-[80%] text-xs leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-[#05268F] text-white rounded-tr-none'
                      : 'bg-[#F4F6F8] text-[#101828] rounded-tl-none border border-[#E5E7EB]'
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-[9px] text-[#667085] mt-0.5 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {quickReplies.map((qr, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(qr)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#F4F6F8] border border-[#E5E7EB] text-[11px] text-[#101828] hover:border-[#05268F] shrink-0 active:scale-95 transition"
          >
            {qr}
          </button>
        ))}
      </div>

      {/* Input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 mt-1"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Escribe un mensaje al cliente/restaurante..."
          className="flex-1 px-3 py-2.5 rounded-xl bg-[#F4F6F8] border border-[#E5E7EB] text-xs text-[#101828] placeholder-[#667085] focus:outline-none focus:border-[#05268F]"
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="p-2.5 rounded-xl bg-[#05268F] hover:bg-[#0732b3] text-[#FFD318] disabled:opacity-40 transition shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
