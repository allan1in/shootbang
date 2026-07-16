Run `pnpm check` first — if any step fails, fix the issues before proceeding.

Then do the following:

1. Run `git status` and `git diff` to see all changes (staged and unstaged).
2. Run `git log --oneline -5` to understand the commit style.
3. Stage relevant files with `git add` (exclude secrets, .env, credentials).
4. Generate a concise commit message in the same style as recent commits, summarizing the changes.
5. Commit with the generated message.
6. Push to the remote: run `git push`. If the branch has no upstream, use `git push -u origin HEAD`.

Report the commit hash and push result when done.
