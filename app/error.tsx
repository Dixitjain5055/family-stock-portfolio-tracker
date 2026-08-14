"use client";
import { Button } from "@/components/ui/button";
export default function GlobalError({error,reset}:{error:Error;reset:()=>void}){return <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6"><div className="max-w-md rounded-2xl border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-3 text-sm text-[var(--muted)]">{error.message||"The dashboard could not be loaded."}</p><Button className="mt-6" onClick={reset}>Try again</Button></div></main>}

