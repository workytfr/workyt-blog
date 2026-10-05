"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";

export default function MarkAllRead() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => {
                setBusy(true);
                await fetch("/api/notifications/", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                router.refresh();
                setBusy(false);
            }}
            className="btn-ghost px-4 py-2 text-sm"
        >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Tout marquer comme lu
        </button>
    );
}
