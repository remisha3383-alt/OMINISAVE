# OmniSave Download Button Fix

This project keeps the screenshot-inspired UI and adds a small Node.js backend for **direct, publicly accessible video-file URLs**.

## What works
- Validates the pasted URL.
- Opens social-media post links at the original platform and explains that the site cannot extract those videos.
- Attempts a server-side download for a direct public video URL that returns a `video/*` or `application/octet-stream` response.
- Includes basic protections against localhost/private IP targets, redirect loops, non-video responses, and files over 100 MB.

## What does not work
The button does **not** extract downloadable media from YouTube, Instagram, TikTok, Facebook, X, or Pinterest. These platforms often require official APIs, user authorization, platform-specific permissions, or provide downloads only through their own interfaces. Do not add scraping or access-control bypasses. Use each platform's official download/export feature where available.

## Run locally
1. Install Node.js 18 or newer.
2. Extract the ZIP and open a terminal in this folder.
3. Run `npm start`.
4. Open `http://localhost:3000`.

The `Paste` clipboard button works best on HTTPS or localhost. On iPhone, use a host that supports Node.js for the backend; uploading only these files to static hosting will not run `server.js`.

## Deployment
Deploy to a Node.js host that supports a persistent web service. Configure the start command as `npm start`. Do not deploy an arbitrary-URL proxy publicly without further security work, authentication, rate limiting, abuse controls, and a review of your host's policies. The included safeguards are a starter example, not a guarantee of production security.

## Permission
Only download content you own or have permission to save, and comply with the source site's terms and applicable law.
