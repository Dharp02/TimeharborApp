const GITHUB_REGEX = /github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/;

/**
 * If `text` is a GitHub issue or PR URL, fetch its title.
 * Returns { title, url } on success, or null if not a GitHub URL / fetch fails.
 */
export async function resolveGitHubUrl(
  text: string
): Promise<{ title: string; url: string } | null> {
  const trimmed = text.trim();
  const match = trimmed.match(GITHUB_REGEX);
  if (!match) return null;

  const [, owner, repo, type, number] = match;
  const endpoint = type === 'pull' ? 'pulls' : 'issues';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/${endpoint}/${number}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, url: trimmed };
  } catch {
    return null;
  }
}
