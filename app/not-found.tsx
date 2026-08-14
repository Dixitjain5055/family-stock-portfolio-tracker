import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound(){return <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6 text-center"><div><p className="font-display text-8xl text-[var(--accent)]">404</p><h1 className="mt-3 text-2xl font-bold">This page wandered off.</h1><p className="mt-2 text-sm text-[var(--muted)]">Your portfolio is still right where you left it.</p><Link href="/dashboard" className={`${buttonVariants({variant:"primary"})} mt-6`}>Return to dashboard</Link></div></main>}

