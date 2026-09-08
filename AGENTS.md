# Project conventions

## Project goals

This is a T3 Stack project-management application. Keep the core workflows simple and easy to find. Prefer focused changes over broad rewrites, and avoid adding complexity when a smaller implementation meets the same need.

## UI components

- Build UI with shadcn/ui first. Before creating a component, check whether shadcn/ui already provides it and whether it is already installed.
- Install missing shadcn/ui components with the documented `pnpm dlx shadcn` command.
- Do not edit files in `src/components/ui` unless there is no practical alternative. Those files are generated shadcn/ui primitives and other code depends on their standard APIs. Document any unavoidable edits in the affected file.
- Keep `src/components/ui` for shadcn/ui components. Put shared custom components in `src/app/_components`. Put route-specific components in that route's `_components` directory.
- Use component APIs such as `variant`, `size`, and `render` before adding custom classes.
- Use Tailwind classes mainly for layout and true one-off styling. If the same group of styles appears repeatedly, add or update a reusable component instead.
- Use the shared `Typography` component for headings and body text instead of repeating typography classes on each page.

## Code changes

- Keep changes within the user's requested scope.
- Prefer a straightforward implementation that avoids technical debt. Fewer lines are not automatically better if they make the code harder to maintain.
- Do not create database migrations until the feature's schema work is complete. A partial migration creates noise when more schema changes are still expected.

## Running and testing

- Do not start a development server unless the user explicitly asks. Assume the user already has one running.
- Do not run a production build while a development server is running because both write to `.next`.
- Use the scripts in `package.json` instead of invoking their underlying tools directly when a matching script exists.

## Maintaining this file

If a rule here is misleading or causes the wrong implementation choice, tell the user what happened so the rule can be corrected.
