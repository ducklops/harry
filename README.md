# Harry — the jungle site

A layered, pixel-art 3D jungle home page for GitHub Pages, with a console for editing it.

## What's in here

| File / folder | What it is |
|---|---|
| `index.html` | The home page: the jungle, the title, the menu and social links. Every page opens inside it |
| `about/`, `projects/`, `gallery/`, `contact/` | Your pages. Each is a folder with an `index.html`, so it lives at harryh.xyz/about and so on |
| `flappy/` | Jungle Flappy, the game, at harryh.xyz/flappy |
| `trolley/` | Trolley Trials, the jungle-market trolley game, at harryh.xyz/trolley |
| `cookies/` | The cookie policy, at harryh.xyz/cookies |
| `404.html` | The "Lost in the jungle" page, at harryh.xyz/404. GitHub Pages shows it for any address that doesn't exist; it switches the address to /404 and suggests the page you probably meant. Keep it at the top of the repository |
| `console.html` | The console for editing the site (harryh.xyz/console.html) |
| `site.json` | The content: title, tagline, pages and socials. The console edits this for you |
| `jungle-kit.js` | The shared engine: animals, pixel painter, 6 fps clock, cookie banner, icons |
| `page.css` | Styling used when a page is opened on its own |
| `fonts/` | Self-hosted fonts (Climate Crisis, Pixelify Sans, Barlow, Cormorant Garamond), so nothing loads from Google |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | The "H" icon |
| `icons/` | Icons you upload through the console end up here |

## Updating your GitHub repository

1. In your repository, **delete the old `pages` folder**. The pages now live in their own folders.
2. **Keep the `CNAME` file.** It's what links the site to harryh.xyz.
3. Upload everything from this folder to the top of the repository (drag in all the files and folders), then commit.
4. After a minute or two, check harryh.xyz.

## Using the console

Go to harryh.xyz/console.html, paste your GitHub key and press **Log on**. Leave **Repository** blank and the console finds your site by itself.

To get a key: GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Under **Repository access**, choose your site's repository. Under **Permissions**, set **Contents: Read and write**.

## Good to know

- **Time and weather.** The jungle follows London's time of day and Liverpool's weather (from Open-Meteo) across every page. Preview other conditions with `?time=night&weather=storm`.
  - `time`: `dawn` `day` `golden` `dusk` `night`
  - `weather`: `clear` `cloudy` `overcast` `fog` `drizzle` `rain` `heavy` `storm` `snow`
- **Elephants.** A herd walks through every 60 seconds. On the hour, an elephant trumpets the time and knocks an animal out of the trees. Preview with `?chime=now`.
- **Sound.** Switch it on with the music-note button. If a visitor has accepted cookies, the site remembers it, and sound resumes on their next click.
- **Cookies.** Visitors choose **Accept** or **Essential only**. Nothing optional is stored on their device unless they accept. Add a contact email to `cookies/index.html` if you'd like one on the policy.
- **Editing a page.** In the console, press **✎ Edit page** next to any page. Type straight onto the page, add headings, text, pictures, galleries, quotes, buttons, embeds (YouTube, Vimeo, Spotify, SoundCloud, TikTok, Google Maps) and dividers from the **Add** bar, drag blocks by ⠿ to move them, and drop pictures from your computer anywhere on the page. Big photos are shrunk automatically and saved in `media/`. Only the inside of the page's content box changes; anything the editor doesn't recognise is kept as an HTML block, exactly as written.
- **Where links show.** In the console, each page can show in the main menu or hang as a wooden sign on a branch in the jungle (up to 5). Flappy and Trolley Trials hang in the jungle by default.
- **Jungle Flappy.** High scores stay on the visitor's device. **Share** sends "My Jungle Flappy high score is…" with a link to harryh.xyz/flappy, and **Save image** downloads a score card.
- **Trolley Trials.** A new store every day (London time): the aisles, items, prices, budget and hazards come from the date, so everyone gets the same one. **Copy receipt** shares a text receipt; **Challenge a friend** shares a link with your route packed inside it, and their game races your ghost trolley on that day's store. Preview another day with `?day=2026-12-25`.
- **Animation speed.** The frame rate is `const FPS = 6` in `jungle-kit.js`.
