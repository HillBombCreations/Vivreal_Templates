/**
 * V7.52. `/favicon.ico` answered 404 on every site: the icon is generated at
 * the convention route `/icon` (src/app/icon.tsx, from the site's colour and
 * logo), and every page links that, but browsers, feed readers and crawlers
 * still ask for `/favicon.ico` by default. This sends them there.
 *
 * 307, not a permanent redirect: a browser keeps a 308 for good, and if a
 * site ever serves a real `/favicon.ico` file it must be able to take over.
 *
 * The Location is a PATH, never built from `request.url`: on Amplify compute
 * that URL is localhost, so an absolute redirect built from it would send
 * every browser to http://localhost. No request is read at all, so the route
 * is static and costs one prerendered response, not a render per hit.
 */
export function GET(): Response {
  return new Response(null, { status: 307, headers: { Location: '/icon' } });
}
