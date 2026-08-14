"use client";
import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addFamilyMember } from "@/app/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { BrokerOptions } from "@/components/holdings/broker-options";

export function MemberDialog({ disabled = false }: { disabled?: boolean }) {
  const [open,setOpen]=useState(false); const [pending,start]=useTransition();
  function submit(form:FormData){start(async()=>{const result=await addFamilyMember({name:form.get("name"),defaultBroker:form.get("broker")}); if(result.ok){toast.success(result.message);setOpen(false)}else toast.error(result.error)})}
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" disabled={disabled}><UserPlus size={17}/> <span className="hidden sm:inline">Add family member</span><span className="sm:hidden">Member</span></Button></DialogTrigger><DialogContent><DialogTitle>Add family member</DialogTitle><DialogDescription>Create a separate ownership profile. Data remains private to your account.</DialogDescription><form action={submit} className="mt-6 space-y-5"><div><Label htmlFor="member-name">Name</Label><Input id="member-name" name="name" required maxLength={80} autoFocus placeholder="e.g. Ravi"/></div><div><Label htmlFor="member-broker">Default broker</Label><Input id="member-broker" name="broker" list="member-broker-options" maxLength={100} placeholder="Choose or type a broker"/><BrokerOptions id="member-broker-options" /></div><Button variant="primary" className="w-full" disabled={pending}>{pending?"Adding…":"Add member"}</Button></form></DialogContent></Dialog>;
}
