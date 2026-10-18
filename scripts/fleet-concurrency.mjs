/**
 * V7.277: promote-stable.yml and demo-catchup.yml must share ONE concurrency
 * group that queues (cancel-in-progress false). See fleet-concurrency.test.mjs
 * for why, and for GitHub's one-pending-run-per-group rule.
 *
 * Takes the two parsed workflow documents and returns readable findings; an
 * empty list means they agree.
 */

/** GitHub accepts `concurrency: <group>` or `{ group, cancel-in-progress }`. */
function readConcurrency(doc) {
  const c = doc?.concurrency;
  if (typeof c === "string") return { group: c, cancel: false };
  if (c && typeof c === "object" && typeof c.group === "string") {
    return { group: c.group, cancel: c["cancel-in-progress"] === true };
  }
  return null;
}

export function fleetBuildConcurrencyIssues(promoteDoc, catchupDoc) {
  const issues = [];
  const promote = readConcurrency(promoteDoc);
  const catchup = readConcurrency(catchupDoc);
  if (!promote || !catchup) {
    issues.push("both fleet-build workflows must declare a concurrency group");
    return issues;
  }
  if (promote.group !== catchup.group) {
    issues.push(`promote-stable.yml group "${promote.group}" and demo-catchup.yml group "${catchup.group}" differ`);
  }
  if (promote.cancel || catchup.cancel) {
    issues.push("cancel-in-progress must be false: a cancelled fleet build stops mid fan-out");
  }
  return issues;
}
