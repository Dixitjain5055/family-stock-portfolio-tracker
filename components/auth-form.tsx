"use client";
import { useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Mail, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "magic";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
      setMessage(error ? { text: error.message, error: true } : { text: "Secure sign-in link sent. Check your email." });
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters.", error: true });
      setLoading(false);
      return;
    }
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
      if (error) setMessage({ text: error.message, error: true });
      else if (data.session) location.assign("/dashboard");
      else setMessage({ text: "Account created. Check your email if confirmation is enabled." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, error: true });
      else location.assign("/dashboard");
    }
    setLoading(false);
  }

  const choices: Array<{ value: Mode; label: string }> = [{ value: "signin", label: "Sign in" }, { value: "signup", label: "Create account" }, { value: "magic", label: "Email link" }];
  return <div className="mt-8"><div className="grid grid-cols-3 rounded-xl bg-[var(--surface-2)] p-1" role="tablist" aria-label="Sign-in method">{choices.map((choice) => <button key={choice.value} type="button" role="tab" aria-selected={mode === choice.value} onClick={() => { setMode(choice.value); setMessage(null); }} className={cn("min-h-10 rounded-lg px-2 text-xs font-bold transition", mode === choice.value ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]")}>{choice.label}</button>)}</div><form onSubmit={submit} className="mt-6 space-y-4"><div><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>{mode !== "magic" && <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>}<Button variant="primary" className="w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : mode === "signin" ? <KeyRound size={18} /> : mode === "signup" ? <UserPlus size={18} /> : <Mail size={18} />}{mode === "signin" ? "Sign in securely" : mode === "signup" ? "Create family account" : "Send secure link"}<ArrowRight size={18} /></Button>{message && <p role="status" className={cn("rounded-xl p-3 text-sm", message.error ? "bg-red-50 text-red-800" : "bg-[var(--accent-wash)] text-[var(--accent-strong)]")}>{message.text}</p>}</form></div>;
}
