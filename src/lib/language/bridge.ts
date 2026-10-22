import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { GRAMMALECTE_DIR, GRAMMALECTE_OPTIONS, type RawIssue } from "./core";

/**
 * Charge le pont Grammalecte (public/grammalecte-2.3.0/workyt.js) dans une
 * machine virtuelle Node, avec ce que le moteur attend d'un Web Worker :
 * importScripts et XMLHttpRequest (lecture synchrone des fichiers).
 * Séparé de engine.ts (réservé au serveur) pour les tests.
 */

export interface Bridge {
    init(options: Record<string, boolean>): boolean;
    check(text: string): RawIssue[];
    suggest(word: string): string[];
    synonyms(word: string): { label: string; words: string[] }[];
}

export function loadBridge(dir = path.join(process.cwd(), "public", GRAMMALECTE_DIR)): Bridge {
    const read = (f: string) => fs.readFileSync(path.join(dir, f.replace(/^\/+/, "")), "utf8");
    class FileRequest {
        private file = "";
        responseText = "";
        open(_method: string, url: string) {
            this.file = url;
        }
        overrideMimeType() {}
        send() {
            this.responseText = read(this.file);
        }
    }
    const quiet = () => {};
    const ctx: Record<string, unknown> = { console: { log: quiet, info: quiet, warn: quiet, error: quiet, time: quiet, timeEnd: quiet }, XMLHttpRequest: FileRequest };
    ctx.self = ctx;
    ctx.importScripts = (...files: string[]) => files.forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
    vm.createContext(ctx);
    (ctx.importScripts as (f: string) => void)("workyt.js");
    const bridge = ctx.workyt as Bridge;
    bridge.init(GRAMMALECTE_OPTIONS);
    return bridge;
}
