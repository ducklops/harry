# Harry — the jungle site

A layered, pixel-art 3D jungle home page for GitHub Pages, with a console for editing it.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The home page: the jungle, the title, your page menu and social links |
| `console.html` | The console. Log in with a GitHub token to edit pages, social links and icons |
| `site.json` | The content (title, tagline, pages, socials). The console edits this for you |
| `jungle-kit.js` | Shared engine: animals, pixel painter, 6 fps animation clock, icons |
| `page.css` | Styling for the pages in `/pages` |
| `pages/` | Starter pages. The console creates new ones when you add a page |
| `icons/` | Icons you upload through the console end up here |

## Put it online (GitHub Pages)

1. Create a repository, e.g. `yourname.github.io` (or any name).
2. Upload **all** these files and folders to the repository root, keeping the folder structure.
3. In the repository go to **Settings → Pages**. Under **Build and deployment**, set **Source: Deploy from a branch** and **Branch: main / (root)**, then **Save**.
4. After a minute the site is live at `https://yourname.github.io/` (or `https://yourname.github.io/repo-name/`).

## Using the console

Go to `https://yourname.github.io/console.html`.

You need a **fine-grained personal access token**:

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access:** *Only select repositories* → pick your site's repository
3. **Permissions → Repository permissions → Contents: Read and write**
4. Copy the token and paste it into the console. Owner and repository are filled in automatically on `*.github.io`.

In the console you can:

- change the title and tagline
- add, rename, reorder and remove pages (optionally creating or deleting a starter page file)
- add, edit, reorder and remove social links
- pick any of the pixel animals as an icon, or upload your own image (PNG/JPG/WebP/GIF/SVG, up to 1 MB)
- **Preview draft** to see unsaved changes, then **Save & publish**. Everything is saved as one commit.

The token is only ever sent to `api.github.com`. It's kept for the browser tab only, unless you tick *Remember token on this device*.

## Live time and weather

- **Time of day** follows London (sun position worked out in the browser): dawn, day, golden hour, dusk and night, each with its own lighting, sky, stars, moon and fireflies.
- **Weather** follows Liverpool via [Open-Meteo](https://open-meteo.com) (free, no key), refreshed every 15 minutes: clear, cloudy, overcast, fog, drizzle, rain, heavy rain, thunderstorms with lightning, and snow.
- Preview any combination by adding to the address, e.g. `index.html?time=night&weather=storm`
  - `time`: `dawn` `day` `golden` `dusk` `night`
  - `weather`: `clear` `cloudy` `overcast` `fog` `drizzle` `rain` `heavy` `storm` `snow`

## Elephants

- Every 60 seconds a small herd walks through the jungle.
- On the hour (London time) an elephant walks in and trumpets the hour (five trumpets at 5 o'clock). The blast knocks an animal out of the trees, and it crawls back about 20 seconds later. Preview with `index.html?chime=now`.
- Sounds (the trumpet, animal calls, rain ambience) play once you switch on sound with the music-note button. Browsers block autoplaying audio until a visitor clicks.

## Small tweaks

- **Animation frame rate:** `const FPS = 6` in `jungle-kit.js`
- **Herd frequency:** `setTimeout(loop, 60000)` in `index.html`
- **Clicking an animal** shows its field-guide name. The text lives in `SPECIES` in `jungle-kit.js`
- **Fonts:** title in *Climate Crisis* (hovering a letter melts it with the font's Year axis), menu in *Pixelify Sans*, captions in *Cormorant Garamond*, all from Google Fonts
