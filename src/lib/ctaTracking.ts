// Red-proof stub for marketing-measurement T2: final signatures, fail-open
// behaviour, so the tests fail on their assertions. Replaced in the next commit.

export type CtaDestination = 'register' | 'login';
export type CtaIntent = 'signup' | 'login';
export type CtaLocation = 'header' | 'footer' | 'body';

export function classifyCta(_href: string, _pageOrigin: string): CtaDestination | null {
  return 'register';
}

export function ctaIntent(_destination: CtaDestination, _text: string): CtaIntent {
  return 'signup';
}

export function ctaLocation(_el: Element): CtaLocation {
  return 'body';
}

export function installCtaClickTracking(_vivrealOwnSite: boolean, win?: Window): () => void {
  const handler = () => {};
  win?.document.addEventListener('click', handler, true);
  return () => {};
}
