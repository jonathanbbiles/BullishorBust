# Bullish or Bust Frontend

This folder contains a minimal [Expo](https://expo.dev/) project that displays trading data from the Bullish or Bust backend.

## Running
1. Install dependencies with `npm install` or `yarn install` inside this folder.
2. Start the development server with `npx expo start`.
3. Open the project in Expo Go on your mobile device.

Axios is loaded through a small wrapper in `../axios.js`. Make sure this file
exists and you have run `npm install` before starting Expo.

The main application logic is defined in `App.js`. It fetches data from the backend and displays entry-ready and watchlist assets.
