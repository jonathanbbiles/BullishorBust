# Bullish or Bust

This repository contains a minimal cryptocurrency trading demo with a React Native frontend and a simple Express backend.

## Folders

- **frontend/** – Expo project containing the React Native app.
- **backend/** – Express server used for manual trading actions.

## Running the Backend

```bash
cd backend
npm install
npm start
```

The server listens on the port specified in `backend/env` (default `3000`). It exposes a `/buy` endpoint used by the app.

## Running the Frontend

```bash
cd frontend
npm install
npm start
```

The app was created with Expo so you can open it in Expo Go or run it on an emulator.
