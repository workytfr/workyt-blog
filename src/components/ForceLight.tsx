"use client";

import { useEffect } from "react";
import { applyTheme, preferredTheme } from "@/lib/theme";

/** Dashboard et éditeur : toujours en clair (le thème du lecteur revient en quittant) */
export default function ForceLight() {
    useEffect(() => {
        applyTheme("light");
        return () => applyTheme(preferredTheme());
    }, []);
    return null;
}
