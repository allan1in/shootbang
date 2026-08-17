<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Package manager

- This project is pinned to `pnpm@10.28.1` through the `packageManager` field in `package.json`.
- Never run bare `pnpm` in Codex Desktop because it resolves to the bundled pnpm 11 and may try to recreate the pnpm 10 `node_modules` directory.
- On Windows, run package commands through `C:\nvm4w\nodejs\corepack.cmd pnpm`. In environments where Corepack is already on `PATH`, use `corepack pnpm`.
- Do not bypass the version mismatch with `CI=true`, `confirmModulesPurge=false`, or another option that allows a different pnpm major version to recreate `node_modules`.
