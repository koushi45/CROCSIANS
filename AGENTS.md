## Local commands on Windows

Use `.cmd` wrappers for Node package commands in PowerShell:

- `npm run lint`
- `npm run build`
- `npx tsc --noEmit`

Do not use bare `npm` / `npx` in PowerShell because `npm.ps1` / `npx.ps1` may be blocked by execution policy.

## Dev server notes

For quick route checks, prefer a foreground command:

```
npm run lint
npx tsc --noEmit
```

- `npm run dev -- --port 3000`

Some background launch methods for `next dev` may fail with a Next lockfile IO permission error in this environment. If browser verification is needed, first confirm the server responds with:

- `Invoke-WebRequest -Uri http://127.0.0.1:3000/<route> -UseBasicParsing`