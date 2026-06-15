# ♻️ Recycling Finder

**[🌍 Access the Live Application (PWA)](https://tar-gezed.github.io/recycling-finder)**

A mobile-first web application (Progressive Web App) to easily find recycling centers and sorting containers near you. Built with **Vue 3** and **Leaflet** mapping, the app utilizes OpenStreetMap data (Overpass API) in real-time.

## ✨ Features (Eco-Modern Overhaul)
- **Native Experience**: The interface behaves like a true mobile application (full-screen, no native browser zooming, touch-friendly controls).
- **Smart Filtering (Client-side)**: Quickly filter collection points by materials (Glass, Paper, Plastic, Clothes, Batteries) using a smooth horizontally scrolling "Chips" bar.
- **Dynamic Markers**: Marker colors adapt to the type of waste (Emerald for glass, Yellow for plastic, Gray for mixed points, etc.).
- **Rich Details (Mobile Bottom-Sheet & Desktop Popup)**: Instantly view the dynamic distance to the collection point, opening hours, operator, and accepted materials.
- **Direct Routing**: One click opens your phone's native Google Maps or Apple Maps app for GPS guidance.
- **Geolocation**: Recenters the map on your position with a single click via a floating button.

---

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
