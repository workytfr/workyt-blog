import type { PostCardView } from "./content";
import { SITE, absoluteUrl } from "./site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** Flux RSS 2.0, à la même adresse et avec les mêmes champs que WordPress */
export function rssFeed(opts: { title: string; path: string; description: string; posts: (PostCardView & { contentHtml?: string })[] }): string {
    const items = opts.posts
        .map((p) => {
            const url = absoluteUrl(`/${p.slug}/`);
            return `
    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      ${p.authors.map((a) => `<dc:creator>${cdata(a.name)}</dc:creator>`).join("")}
      ${p.categories.map((c) => `<category>${cdata(c.name)}</category>`).join("")}
      <description>${cdata(p.excerpt)}</description>${p.contentHtml ? `\n      <content:encoded>${cdata(p.contentHtml)}</content:encoded>` : ""}${
          p.featuredImage ? `\n      <enclosure url="${esc(p.featuredImage.url)}" type="image/jpeg" length="0" />` : ""
      }
    </item>`;
        })
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <atom:link href="${absoluteUrl(opts.path)}" rel="self" type="application/rss+xml" />
    <link>${SITE.url}/</link>
    <description>${esc(opts.description)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${new Date(opts.posts[0]?.publishedAt || Date.now()).toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;
}

export function xmlResponse(body: string, contentType = "application/xml; charset=utf-8", status = 200): Response {
    return new Response(body, { status, headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
