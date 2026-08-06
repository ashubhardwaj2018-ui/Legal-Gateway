import { useState } from "react";
import { X, MessageCircle, Send } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/** Strip formatting and ensure the number has a country code for wa.me URLs */
function toWaNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `91${d}`; // bare Indian 10-digit → prepend ISD code
  return d;
}

const QUICK_MESSAGES = [
  "I need help with Company Registration",
  "I want to file a Trademark",
  "I need GST / Tax compliance help",
  "I need legal consultation",
  "I have a property / personal matter",
];

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const settings = useSiteSettings();

  // Prefer the dedicated website WhatsApp number; fall back to primary phone
  const waNumber = toWaNumber(settings.website_whatsapp || settings.phone_primary || "");
  const businessName = settings.site_name || "Legal Filing India";

  const send = (msg: string) => {
    if (!waNumber) return; // no number configured yet
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[998] bg-black/10 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat card */}
      <div
        className={`fixed bottom-24 right-5 z-[999] w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 origin-bottom-right ${
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="bg-[#25D366] px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">{businessName}</div>
            <div className="text-white/80 text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-pulse" />
              Typically replies in minutes
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="bg-[#f0fdf4] rounded-xl p-3 mb-4 text-sm text-gray-700 border border-[#25D366]/20">
            👋 Hi there! How can we help you today? Choose a topic or type your message below.
          </div>

          <div className="space-y-2 mb-4">
            {QUICK_MESSAGES.map(msg => (
              <button
                key={msg}
                onClick={() => send(msg)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 hover:border-[#25D366] hover:bg-[#f0fdf4] transition-all"
              >
                {msg}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === "Enter" && custom.trim() && send(custom.trim())}
              placeholder="Type a message…"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/30"
            />
            <button
              onClick={() => custom.trim() && send(custom.trim())}
              disabled={!custom.trim()}
              className="bg-[#25D366] text-white p-2.5 rounded-xl hover:bg-[#1fb855] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating button */}
      <div className="fixed bottom-5 right-5 z-[999] flex flex-col items-end gap-2">
        {!open && (
          <div className="bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-gray-100 animate-bounce-slow whitespace-nowrap">
            💬 Chat with us on WhatsApp
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Chat on WhatsApp"
          className="relative w-14 h-14 bg-[#25D366] hover:bg-[#1fb855] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-110 active:scale-95"
        >
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
          <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20 animation-delay-150" />

          {open ? (
            <X size={22} />
          ) : (
            <svg viewBox="0 0 24 24" fill="white" width="26" height="26">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
