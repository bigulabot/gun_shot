# Finlay's Game

A browser game starter built with Phaser and Vite. The current scene is a tiny tap demo so we can verify the setup before choosing the game design.

## Run locally

Open a terminal in this folder and run:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Stop the server with Ctrl+C.

## Build and check the production version

```powershell
npm run build
npm run preview
```

The production site is built into `dist/`.

## Project files

- `src/main.js` starts Phaser and controls the game size.
- `src/scenes/StarterScene.js` contains the temporary tap demo. New game scenes can go in this folder.
- `src/style.css` controls the page around the game canvas.
- `public/assets/` is ready for art, audio, and other static game files.
- `.github/workflows/deploy.yml` builds and deploys the game from the `main` branch.

## Publish on GitHub Pages later

Create an empty GitHub repository, then run these commands from this folder, replacing the example URL with your repository URL:

```powershell
git add .
git commit -m "Initial Phaser setup"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The **Deploy game to GitHub Pages** workflow runs when you push to `main`. You can also run it manually from the Actions tab.

Vite uses relative asset paths so the game can be hosted under a GitHub Pages repository URL without changing the repo name in the config. When loading future assets from JavaScript, use imports or prefix public asset URLs with `import.meta.env.BASE_URL`.
