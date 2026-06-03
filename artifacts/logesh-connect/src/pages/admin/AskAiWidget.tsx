import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { adminApi } from "./api";

interface Message { role: "user" | "ai"; text: string }

export default function AskAiWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await adminApi.askAi({ question: q, context: "general" });
      setMessages(m => [...m, { role: "ai", text: r.answer }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 bg-white border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-primary text-white">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="w-4 h-4" /> AI Assistant
            </div>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-72 min-h-[120px] bg-muted/10">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Ask anything about the constituency, grievances, or daily schedules.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-white border rounded-bl-none text-foreground"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-xl rounded-bl-none px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-1.5 p-2 border-t bg-white">
            <input
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything…"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={busy || !input.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <Button
        onClick={() => setOpen(v => !v)}
        className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white p-0"
        title="AI Assistant"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </Button>
    </div>
  );
}
