# Meettie

Meettie is a minimal and premium scheduling application, built with React and powered by Vercel Postgres.

## Current State

- Built the initial home page step-by-step with a minimal, UX-friendly premium design.
- Implemented a responsive Navbar with a theme switcher (light/dark mode) and a login button, including hover effects.
- Added a Hero section featuring a welcome message and a CSS-based, theme-adaptive calendar graphic with transparent background style.
- Created Authentication pages (`/login` and `/register`) with theme-adaptive SVG line-art visuals.
- Designed form layouts for login and registration with custom styling for light and dark modes.
- Set up client-side routing using `react-router-dom`.
- The project is ready to connect with a Postgres Database.
- `.env` template is set up (and hidden from Git via `.gitignore`).

## Running the project locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Next Steps

- Design the database schema for users and events.
- Set up an ORM (like Prisma or Drizzle) to interact with the Postgres database.
- Hook up the frontend Authentication forms with a real backend/auth provider.
- Build the user dashboard UI components.
