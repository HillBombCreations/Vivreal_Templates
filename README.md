This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Release channels

Every customer site's Amplify app builds from a single shared branch — there are
no per-site branches. Two channels matter:

- **`main`** — integration. Merge day-to-day template work here. Merging to
  `main` does **not** touch any live site.
- **`stable`** — the release channel. Every customer site's Amplify app is bound
  to `stable`; a push to `stable` rebuilds all of them.
- **`beta`** — reserved for a future opt-in channel (volunteer sites). Not wired
  up yet.

**Promotion (`main` → `stable`) is a manual, fast-forward-only step.** Run the
**Promote main to stable** workflow (`.github/workflows/promote-stable.yml`) from
the Actions tab (`workflow_dispatch`). It refuses to run unless `stable` is a
strict ancestor of `main` (i.e. a real fast-forward), and reports the old → new
`stable` SHA in the run summary. There is no automatic promotion on merge — that
is deliberate, so shipping to every site is always an explicit decision.

**Per-site emergency hold.** To pin one site while promoting the rest, disable
that Amplify app's branch auto-build, then start builds explicitly with
`start-job` only when you want that site to pick up `stable`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
