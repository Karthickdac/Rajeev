import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import type { Language } from "@/lib/i18n";

interface Msg { role: "user" | "assistant"; content: string }

const WELCOME: Record<Language, string> = {
  ta: "வணக்கம்! தொகுதி தொடர்பான கேள்விகளுக்கு நான் உதவ முடியும். எதை அறிய விரும்புகிறீர்கள்?",
  en: "Hello! Ask me anything about the constituency, the MLA's work, or how to file a grievance.",
};

const PROMPTS: Record<Language, string[]> = {
  ta: ["புகாரை எப்படி பதிய வேண்டும்?", "அவசர தொடர்புகள் என்ன?", "வரும் நிகழ்வுகள்", "வாக்குறுதிகள் என்ன ஆயின?"],
  en: ["How do I file a grievance?", "Emergency contacts?", "Upcoming events?", "Promises status?"],
};

export function ChatWidget({ lang = "ta" }: { lang?: Language }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/status").then((r) => r.json()).then((d) => setEnabled(!!d.enabled)).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ role: "assistant", content: WELCOME[lang] }]);
  }, [open, lang, msgs.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, sending]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setErr(null);
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setSending(true);
    try {
      const recent = next.filter((m) => m !== next[0]).slice(-8); // skip welcome
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, history: recent.slice(0, -1), lang }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || "Chat unavailable"); return; }
      setMsgs((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  if (enabled === false || enabled === null) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-20 md:bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 md:bottom-6 right-2 md:right-6 z-50 w-[calc(100vw-1rem)] sm:w-96 max-h-[80vh] bg-white rounded-xl shadow-2xl border flex flex-col overflow-hidden">
          <div className="bg-primary text-white p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{lang === "ta" ? "உதவி இணையான்" : "Office Assistant"}</div>
              <div className="text-[10px] opacity-80">{lang === "ta" ? "AI வழங்கும் பதில்கள்" : "AI-powered, in beta"}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="opacity-80 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-white rounded-br-sm" : "bg-white border rounded-bl-sm"
                }`}>{m.content}</div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> {lang === "ta" ? "யோசிக்கிறேன்…" : "Thinking…"}
                </div>
              </div>
            )}
            {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
            {msgs.length <= 1 && !sending && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {PROMPTS[lang].map((p) => (
                  <button key={p} onClick={() => send(p)}
                    className="text-xs px-2.5 py-1 rounded-full bg-white border hover:bg-primary/5 hover:border-primary/40">
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-2 flex gap-2">
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder={lang === "ta" ? "கேள்வியை இங்கே எழுதுங்கள்…" : "Ask anything…"}
              className="flex-1 border rounded-full px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
