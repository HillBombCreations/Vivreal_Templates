import Link from "next/link";
import type { Metadata } from "next";

/**
 * App Router `not-found` boundary.
 *
 * This file previously rendered `next/head` — a **Pages Router** API. In the
 * App Router a Server Component importing `next/head` is invalid; metadata
 * belongs in an exported `metadata` object below. The old import was dead
 * markup: `next/head`'s tags never reach `<head>` in the App Router, so this
 * boundary was silently shipping no title/description at all.
 *
 * Note this fix does NOT restore the 404 status code on its own
 * (docs/bugs/templates-soft-404-and-301-status/research.md, Step A: both
 * asserts fail identically with this fix applied in isolation). The actual
 * status-code loss is caused by the sibling `loading.tsx` files implicitly
 * wrapping `page.tsx` in a `<Suspense>` boundary, which flushes a 200 shell
 * before the async page component's `notFound()`/`permanentRedirect()` throw
 * ever runs — see the same bug's `research.md` for the full mechanism. That
 * is fixed separately by deleting the three `loading.tsx` files (Change 1b).
 *
 * Keep this component trivial and side-effect free: it is the last boundary
 * before a request gives up, so anything that can throw here costs a status
 * code fleet-wide.
 */
export const metadata: Metadata = {
  title: "404 Not Found",
  description:
    "Sorry, the page you are looking for does not exist. Return to our homepage to explore our features and solutions.",
};

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <Link href="/" className="text-blue-700 hover:text-blue-700 underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
