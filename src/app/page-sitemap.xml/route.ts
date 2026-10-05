/**
 * GET /page-sitemap.xml — 410 « supprimé définitivement » : les pages
 * WordPress (à propos, contact…) ne sont pas reprises, elles redirigent vers
 * workyt.fr. Le 410 fait oublier ce sitemap à Google plus vite qu'un 404.
 */
export function GET() {
    return new Response("Ce plan de site n'existe plus.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
