# Repository Guidelines

## Project Structure & Module Organization
This is a multi-tool web application built with a **React (Vite)** frontend and a **Node.js/Express** backend.

- **Frontend (`/`)**: 
  - `src/pages/`: Individual tool implementations (calculators, converters, PDF tools).
  - `src/components/`: UI components, including `shared/` tools for common functionality (upload, headers, placeholders).
  - `src/data/`: Centralized catalog of tools (`toolCatalog.jsx`) and content pages (`contentPages.js`).
  - `src/context/`: Global state management for themes and user favorites.
  - `scripts/`: Build-time scripts like `generate-seo-assets.mjs` for sitemap and robots.txt generation.
- **Backend (`/server`)**: 
  - Express server handling complex file operations (e.g., PDF processing) using the `@ilovepdf/ilovepdf-nodejs` library.

## Build, Test, and Development Commands

### Frontend (Root Directory)
- **Start development server**: `npm run dev`
- **Build for production**: `npm run build` (Automatically runs `generate-seo-assets.mjs` pre and post build)
- **Preview production build**: `npm run preview`
- **Lint code**: `npm run lint`

### Backend (`/server` Directory)
- **Start production server**: `npm start`
- **Start development server (nodemon)**: `npm run dev`

## Coding Style & Naming Conventions
- **Framework**: React functional components with Hooks.
- **State**: Context API for global state (`ThemeContext`, `FavoritesContext`).
- **File Naming**: 
  - `PascalCase.jsx` for pages and components (e.g., `AgeCalculator.jsx`, `Layout.jsx`).
  - `camelCase.js` for utilities and hooks (e.g., `imageTools.js`, `useTheme.js`).
- **Styling**: Component-specific CSS files or shared styles in `src/components/shared/SharedStyles.css`.
- **Linting**: ESLint is enforced via `npm run lint`.

## Commit & Pull Request Guidelines
Follow the conventional commits pattern identified in the history:
- `feat:` for new tools or features.
- `fix:` for bug fixes.
- `style:` for UI/UX improvements and layout fixes.
- `refactor:` for code improvements without functional changes.
