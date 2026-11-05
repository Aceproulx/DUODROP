# DUODROP

DUODROP is a music streaming and discovery platform built for Malawi and beyond. Fans can discover and stream music, while artists can publish tracks, connect with listeners, and track their performance and earnings.

## Features

- Discover new releases, trending tracks, artists, playlists, and music charts
- Search for songs, artists, and genres
- Stream music with playback controls, queue, lyrics, and sharing
- Create an account with email/password or Google sign-in
- Like songs, follow artists, and manage a personal library
- Upload tracks and cover artwork, with free and monetized upload options
- Artist analytics, earnings, and profile tools
- Admin panel for managing platform content

## Tech stack

- Frontend: HTML, CSS, and JavaScript
- Backend: Node.js and Express
- Authentication and data: Firebase
- Media uploads: Cloudinary
- Payments: PayChangu integration
- Deployment configuration: Vercel

## Run locally

### Requirements

- Node.js and npm
- Firebase project credentials
- Cloudinary credentials for media uploads
- PayChangu credentials if you want to test payment features

### Setup

1. Clone the repository and enter the project directory.
2. Install the server dependencies:

   ```bash
   npm run install-deps
   ```

3. Configure the environment variables in `server/.env`. Keep this file private and never commit credentials. The server reads Firebase configuration from environment variables and uses the configured integrations for storage and payments.
4. Configure Firebase Realtime Database rules. See [`server/SETUP.md`](server/SETUP.md) for the setup guide and admin-account instructions.
5. Start the application:

   ```bash
   npm run dev
   ```

   The development server runs at [http://localhost:3000](http://localhost:3000). To run without automatic restarts, use `npm start`.

The Express server serves both the frontend and API. The API health check is available at `/api/health`.

## Project structure

```text
.
├── css/                 # Application styles
├── images/              # Artwork and other static assets
├── js/                  # Frontend application modules
├── lib/                 # Shared libraries
├── server/              # Express API, routes, and setup guide
├── index.html           # Application entry point
├── package.json         # Root development scripts
└── vercel.json          # Vercel deployment configuration
```

## Deployment

The repository includes a `vercel.json` configuration for deploying the static frontend and Express API to Vercel. Set the required environment variables in the deployment environment before publishing.

## Contributing

Issues and pull requests are welcome. For changes involving credentials or deployment configuration, do not include secrets in commits.

## License

This project is licensed under the MIT License.
