# DUODROP Server — Setup Guide

## 1. Update Firebase Database Rules

Go to [Firebase Console](https://console.firebase.google.com) → **DUODROP project** → **Realtime Database** → **Rules** tab.

Replace the existing rules with:

```json
{
  "rules": {
    "songs": {
      ".read": true,
      ".write": "auth != null"
    },
    "artists": {
      ".read": true,
      ".write": "auth != null"
    },
    "comments": {
      ".read": true,
      ".write": "auth != null"
    },
    "users": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "likes": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "follows": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "earnings": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "fanEarnings": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

> **Why?** The public song/artist/comment reads need to work without a logged-in user.
> The write operations still require authentication.

## 2. Install Dependencies & Run

```bash
cd server
npm install
npm start
```

The app will be live at: **http://localhost:3000**

For development with auto-restart:
```bash
npm run dev
```

## 3. Create an Admin Account

1. Open http://localhost:3000
2. Click **Sign Up** and create an account with any email
3. Go to your [Firebase Console](https://console.firebase.google.com) → Realtime Database
4. Find your user under `/users/<uid>/`
5. Change the `role` field from `"fan"` or `"artist"` to `"admin"`
6. Refresh the page — the **Admin Panel** link will appear in the sidebar

## 4. Cloudinary Configuration

Your Cloudinary account is pre-configured:
- **Cloud Name**: dpb2zxeuo
- Music uploads go to: `duodrop/audio/`
- Artwork uploads go to: `duodrop/artwork/`
- Avatars go to: `duodrop/avatars/`

## 5. Song Approval Workflow

Songs submitted through the Upload page start with status `"pending"`.
Admin users can approve or reject them from the **Admin Panel** page.

Once approved, songs appear publicly in Discover, Trending, etc.

## Environment Variables (.env)

All credentials are stored in `server/.env`. Never commit this file to Git.
Add `.env` to your `.gitignore`.
