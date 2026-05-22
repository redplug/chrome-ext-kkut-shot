# Repository Guidelines

## Project Structure & Module Organization

This repository is currently an empty Chrome extension workspace. Keep browser extension boundaries explicit:

- `manifest.json`: extension manifest and permissions.
- `src/background/`: service worker or background scripts.
- `src/content/`: content scripts injected into web pages.
- `src/popup/`: popup UI source.
- `src/options/`: options or settings UI, if needed.
- `assets/`: icons, images, and static extension assets.
- `tests/`: unit, integration, or browser automation tests.

Avoid mixing extension entry points in one large file. Shared utilities should live under `src/shared/`.

## Build, Test, and Development Commands

No package manager files are present yet. Once scaffolded, document the real commands here and keep them current. Recommended command names:

- `npm install`: install dependencies.
- `npm run dev`: run the extension build in watch mode.
- `npm run build`: create the production extension bundle.
- `npm test`: run the test suite.
- `npm run lint`: run static checks and formatting validation.

If the extension is plain JavaScript without a build step, document the manual loading flow instead: open `chrome://extensions`, enable Developer mode, and load this directory unpacked.

## Coding Style & Naming Conventions

Prefer TypeScript unless the project deliberately stays build-free. Use 2-space indentation for JavaScript, TypeScript, JSON, CSS, and HTML. Name modules by responsibility, such as `capture-page.ts`, `message-router.ts`, or `popup-app.ts`.

Use camelCase for variables and functions, PascalCase for UI components, and UPPER_SNAKE_CASE for constants. Keep Chrome API access isolated behind small helper functions where practical.

## Testing Guidelines

Place tests in `tests/` or next to source files as `*.test.ts` / `*.test.js`. Cover message passing, permission-sensitive behavior, and DOM interaction in content scripts. For UI flows, prefer browser automation tests that load the unpacked extension and verify real Chrome behavior.

## Commit & Pull Request Guidelines

This directory is not yet a Git repository, so no local commit history is available. Use concise, imperative messages such as `Add popup capture controls` or Conventional Commits such as `feat: add screenshot capture`.

Pull requests should include a short summary, testing performed, screenshots or screen recordings for UI changes, and notes for any new extension permissions.

## Security & Configuration Tips

Request the narrowest Chrome permissions possible. Do not commit secrets, private API keys, or generated extension packages. Treat content scripts as untrusted-page-adjacent code: validate messages, avoid injecting unsanitized HTML, and keep host permissions specific.
