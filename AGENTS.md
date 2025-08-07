# AGENTS Instructions

Welcome to the SkinView3D project. These guidelines help contributors build the best web application for rendering and interacting with Minecraft skins while squashing bugs and implementing new features.

## Core Principles
- **Clarity and maintainability:** write code that is easy to understand and adapt.
- **Feature-first mindset:** every feature must improve the experience or developer ergonomics.
- **Bug accountability:** always reproduce a bug before fixing it and prevent regressions afterwards.

## Workflow
1. Search the codebase with `rg` instead of `grep -R`.
2. Keep changes focused and incremental.
3. Format code with `npm run format` when source files are touched.
4. Run `npm test` and ensure it passes before committing.
5. Provide or update examples and documentation for features or fixes.
6. Use clear commit messages that describe what and why.

## Bug Fixing
- Reproduce the issue and add a regression test or example demonstrating the problem.
- Confirm the fix by running the test suite and verifying the example works in the browser.
- Reference related issue numbers in commit messages when possible.

## Feature Implementation
- Start from an open issue or a well-defined proposal.
- Keep API changes minimal and backward compatible whenever feasible.
- Update documentation, examples, and type definitions in sync with the implementation.
- Include tests or demos that illustrate the new capability.

## Testing and Quality
- `npm test` runs linting; keep the code style consistent.
- For significant changes, ensure `npm run build` succeeds to validate the production build.
- Review warnings from TypeScript, ESLint, or build tools and resolve them.

## Collaboration
- Communicate design decisions and trade-offs in pull request descriptions.
- Respond to review feedback promptly and respectfully.

Following these practices will keep the project healthy, extensible, and bug-free. Happy hacking!

## Development Insights
- Keyframes must map rotations to the correct bone path. A past bug stored all rotations under a generic `rotation` key, which broke uploaded animations.
- The animation editor exposes elbow and knee joints; do not remove these options.
- When improvements or bug fixes are made, document the lessons learned here so they aren't repeated.
- CCDIKSolver integration relies on existing body part groups as bones. Ensure IK targets are included in the bone selector and keyframes capture all bones in a chain.
- The timeline viewer displays keyframes per bone row. Avoid reverting to a single-row timeline.
