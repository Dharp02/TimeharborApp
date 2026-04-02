const GITHUB_REGEX = /github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/;

/**
 * If `text` is a GitHub issue or PR URL, fetch its title from the GitHub API.
 * Returns { title, url, isFallback } on success.
 * When offline / fetch fails, returns a fallback title derived from the URL
 * with isFallback=true so callers can retry later.
 * Returns null if not a GitHub URL.
 */
export async function resolveGitHubUrl(
  text: string
): Promise<{ title: string; url: string; isFallback: boolean } | null> {
  const trimmed = text.trim();
  const match = trimmed.match(GITHUB_REGEX);
  if (!match) return null;

  const [, owner, repo, type, number] = match;
  const endpoint = type === 'pull' ? 'pulls' : 'issues';
  const label = type === 'pull' ? 'PR' : 'Issue';
  const fallback = `${repo} ${label} #${number}`;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/${endpoint}/${number}`
    );
    if (!res.ok) {
      return { title: fallback, url: trimmed, isFallback: true };
    }
    const data = await res.json();
    return { title: data.title, url: trimmed, isFallback: false };
  } catch {
    // Offline or network error — use fallback title from URL parts
    return { title: fallback, url: trimmed, isFallback: true };
  }
}
