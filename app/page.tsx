import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const features = [
    { Icon: Users, title: "Shared, not blurred", copy: "See one family position, then expand to exact member and lot ownership." },
    { Icon: BarChart3, title: "Weighted correctly", copy: "Every average uses remaining quantity and adjusted acquisition cost." },
    { Icon: ShieldCheck, title: "Server-side data access", copy: "Database and market-data credentials stay on the server and never enter the browser bundle." },
  ];
  return <main className="min-h-screen overflow-hidden bg-[var(--canvas)]"><div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
    <nav className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2 font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-white">K</span>Kinfolio</Link><Link className={buttonVariants({variant:"outline"})} href="/dashboard">Open tracker</Link></nav>
    <section className="grid min-h-[82vh] items-center gap-14 py-16 lg:grid-cols-[1.1fr_.9fr]">
      <div><p className="mb-5 inline-flex rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--accent-strong)]">One clear view for the whole family</p><h1 className="font-display max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-.04em] text-[var(--ink)] sm:text-7xl">Invest together.<br/><span className="text-[var(--accent)]">Understand every lot.</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">Track shared holdings without losing individual ownership, purchase history, or realized returns. Built for patient family wealth—not trading noise.</p><div className="mt-9 flex flex-wrap gap-3"><Link className={cn(buttonVariants({variant:"primary"}),"px-6")} href="/dashboard">View your portfolio <ArrowRight size={18}/></Link><Link className={buttonVariants({variant:"outline"})} href="#principles">See how it works</Link></div></div>
      <div className="relative"><div className="absolute -inset-12 rounded-full bg-[var(--accent-wash)] blur-3xl"/><div className="relative rotate-1 rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_40px_100px_rgba(23,72,67,.16)] backdrop-blur"><div className="flex items-center justify-between border-b border-[var(--border)] pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Family portfolio</p><p className="mt-1 text-3xl font-bold">₹42.8L</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">+12.4%</span></div><div className="my-5 h-36 rounded-2xl bg-[linear-gradient(180deg,rgba(27,133,119,.15),transparent),linear-gradient(135deg,transparent_35%,rgba(27,133,119,.45)_36%,transparent_37%,transparent_51%,rgba(27,133,119,.7)_52%,transparent_53%)]"/><div className="grid grid-cols-3 gap-3">{[["R","Ravi","48%"],["A","Anita","31%"],["M","Maya","21%"]].map(([letter,name,value])=><div key={name} className="rounded-xl bg-[var(--surface-2)] p-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-bold">{letter}</span><p className="mt-3 text-xs text-[var(--muted)]">{name}</p><p className="font-bold">{value}</p></div>)}</div></div></div>
    </section>
    <section id="principles" className="grid gap-4 pb-20 md:grid-cols-3">{features.map(({Icon,title,copy})=><div key={title} className="rounded-2xl border border-[var(--border)] bg-white p-6"><Icon className="text-[var(--accent)]"/><h2 className="mt-5 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p></div>)}</section>
  </div></main>;
}
