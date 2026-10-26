// Red-proof stub for marketing-measurement T3: final signatures, fail-open
// behaviour, so the tests fail on their assertions. Replaced in the next commit.

export const OWN_SITE_HOSTS: readonly string[] = Object.freeze(['vivreal.io', 'help.vivreal.io']);

export interface BeaconPolicyInput {
  siteId: string;
  vivrealOwnSite: boolean;
  hostname: string;
  referrer: string;
  cookie: string;
}

export function shouldSendBeacon(_input: BeaconPolicyInput): boolean {
  return true;
}
