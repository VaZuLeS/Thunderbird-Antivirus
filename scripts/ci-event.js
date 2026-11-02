// Fail open to *running checks*, never to accepting untested artifacts.
async function shouldRunChecks({ eventName, ref, defaultBranch, repository, owner, listOpenPulls }) {
    if (eventName !== 'push' || !ref.startsWith('refs/heads/') || ref === 'refs/heads/' + defaultBranch) return true;
    try {
        const branch = ref.slice('refs/heads/'.length);
        const pulls = await listOpenPulls({ owner, repo: repository, state: 'open', head: owner + ':' + branch, per_page: 100 });
        if (!Array.isArray(pulls)) return true;
        return !pulls.some(pr => pr.state === 'open' && pr.head?.ref === branch && pr.head?.repo?.full_name === owner + '/' + repository);
    } catch (error) { return true; }
}
module.exports = { shouldRunChecks };
