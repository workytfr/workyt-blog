"use client";

import { useEffect } from "react";
import { EMBED_PROVIDERS, parseEmbed } from "@/lib/embeds";

/**
 * Contenus Spotify, Dailymotion, Instagram, TikTok d'un article : une carte
 * « Afficher le contenu », et le lecteur officiel seulement au clic. Ces
 * plateformes déposent des cookies : rien n'est chargé sans l'accord du
 * lecteur (public jeune, CNIL). Sans JavaScript, la carte reste un lien.
 */
export default function EmbedLoader() {
    useEffect(() => {
        const cards = [...document.querySelectorAll<HTMLElement>(".post-content .wk-embed[data-embed]")];
        for (const card of cards) {
            if (card.dataset.ready) continue;
            // L'adresse du lecteur est recalculée ici (jamais lue telle quelle dans le HTML)
            const embed = parseEmbed(card.dataset.src || "");
            if (!embed || embed.provider !== card.dataset.embed) continue;
            card.dataset.ready = "1";
            const { label } = EMBED_PROVIDERS[embed.provider];

            card.replaceChildren();
            const box = document.createElement("div");
            box.className = "wk-embed-card";
            const name = document.createElement("strong");
            name.textContent = label;
            const note = document.createElement("p");
            note.textContent = `Ce contenu est hébergé par ${label}, qui peut déposer des cookies. Il ne se charge que si tu le demandes.`;
            const actions = document.createElement("div");
            actions.className = "wk-embed-actions";
            const show = document.createElement("button");
            show.type = "button";
            show.textContent = "Afficher le contenu";
            const open = document.createElement("a");
            open.href = embed.url;
            open.target = "_blank";
            open.rel = "noopener noreferrer";
            open.textContent = `Ouvrir sur ${label}`;
            actions.append(show, open);
            box.append(name, note, actions);
            card.append(box);

            show.addEventListener("click", () => {
                const frame = document.createElement("iframe");
                frame.src = embed.embedUrl;
                frame.title = `Contenu ${label}`;
                frame.loading = "lazy";
                frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
                frame.setAttribute("allowfullscreen", "");
                if (embed.ratio) frame.style.aspectRatio = "16 / 9";
                else frame.style.height = `${embed.height}px`;
                if (embed.maxWidth) frame.style.maxWidth = `${embed.maxWidth}px`;
                card.classList.add("is-loaded");
                card.replaceChildren(frame);
            });
        }
    }, []);
    return null;
}
