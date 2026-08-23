import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('site-level JSON-LD resolves its URL through the central canonical resolver', () => {
  const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ resolveSiteOrigin \} from '@\/lib\/og\/ogImage'/);
  assert.match(source, /const url = resolveSiteOrigin\(siteData\) \|\| undefined/);
  assert.doesNotMatch(source, /`https:\/\/\$\{domain\}`/);
});
