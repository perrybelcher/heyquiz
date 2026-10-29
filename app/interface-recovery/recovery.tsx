"use client";
import { useState } from "react";
export default function InterfaceRecovery({accountKey}:{accountKey:string}) {
  const [busy,setBusy]=useState(false), [error,setError]=useState("");
  async function recover() {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/profile/interface",{cache:"no-store"});
      const preference=await response.json();
      if(!response.ok) throw new Error(preference.error || "Could not load your preference. Retry shortly.");
      const saved=await fetch("/api/profile/interface",{method:"PATCH",headers:{"Content-Type":"application/json","X-Pippi-Account":accountKey},body:JSON.stringify({preferredVersion:"v1",revision:preference.revision})});
      const result=await saved.json();
      if(!saved.ok || result.preferredVersion!=="v1") throw new Error(result.error || "Could not confirm the change. Retry shortly.");
      window.location.assign("/");
    } catch(e) {setError(e instanceof Error?e.message:"Could not switch interfaces.");setBusy(false);}
  }
  return <><button className="hq-primary" disabled={busy} onClick={()=>void recover()}>{busy?"Switching…":"Use Classic"}</button>{error&&<p role="alert" className="hq-error mt-4">{error}</p>}</>;
}
