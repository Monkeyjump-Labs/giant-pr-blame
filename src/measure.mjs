// Pure functions: how big a PR is, and whether that is giant.

// `files` is the GitHub "list pull request files" payload: { filename, additions, deletions }.
// Weighted lines count an addition as 1 and a deletion as `deletionWeight`: deleting code is
// good, but not free to review. Ignored files count toward nothing. A counted file belongs
// to the first component whose prefix it starts with, or to `unmatchedComponent` (when set).
// A file matching `componentIgnore` still counts toward lines and files, but does not drag
// a component in.
export function measure(
  files,
  { ignore, componentIgnore, components, deletionWeight, unmatchedComponent },
) {
  const counted = files.filter((f) => !ignore.some((re) => re.test(f.filename)));
  const additions = counted.reduce((n, f) => n + f.additions, 0);
  const deletions = counted.reduce((n, f) => n + f.deletions, 0);

  const touched = new Set();
  for (const f of counted) {
    if (componentIgnore.some((re) => re.test(f.filename))) continue;
    const hit = components.find(([, prefix]) => f.filename.startsWith(prefix));
    const name = hit ? hit[0] : unmatchedComponent;
    if (name) touched.add(name);
  }

  return {
    additions,
    deletions,
    lines: Math.round(additions + deletions * deletionWeight),
    files: counted.length,
    ignoredFiles: files.length - counted.length,
    components: [...touched].sort(),
  };
}

// Giant means `bigRequired` of the "big" thresholds, or any one "absurd" threshold.
// A threshold of 0 is disabled.
export function verdict(m, { big, absurd, bigRequired }) {
  const over = (t) => ({
    lines: t.lines > 0 && m.lines >= t.lines,
    files: t.files > 0 && m.files >= t.files,
    components: t.components > 0 && m.components.length >= t.components,
  });
  const b = over(big);
  const a = over(absurd);
  const bigCount = Object.values(b).filter(Boolean).length;
  const absurdHit = Object.values(a).some(Boolean);
  return {
    giant: (bigRequired > 0 && bigCount >= bigRequired) || absurdHit,
    big: b,
    absurd: a,
    bigCount,
    absurdHit,
  };
}
