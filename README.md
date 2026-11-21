# Harry — the jungle site

A layered, pixel-art 3D jungle home page for GitHub Pages, with a console for editing it.

## What's in here

| File / folder | What it is |
|---|---|
| `index.html` | The home page: the jungle, the title, the menu and social links. Every page opens inside it |
| `about/`, `projects/`, `gallery/`, `contact/` | Your pages. Each is a folder with an `index.html`, so it lives at harryh.xyz/about and so on |
| `flappy/` | Jungle Flappy, the game, at harryh.xyz/flappy |
| `trolley/` | Trolley Trials, the jungle-market trolley game, at harryh.xyz/trolley |
| `trivia/` | Tree-Frog Trivia, the daily trivia climb, at harryh.xyz/trivia. `trivia/data/` holds the question bank and the built days (encoded, see below) |
| `cookies/` | The cookie policy, at harryh.xyz/cookies |
| `404.html` | The "Lost in the jungle" page, at harryh.xyz/404. GitHub Pages shows it for any address that doesn't exist; it switches the address to /404 and suggests the page you probably meant. Keep it at the top of the repository |
| `console.html` | The console for editing the site (harryh.xyz/console.html) |
| `site.json` | The content: title, tagline, pages and socials. The console edits this for you |
| `letterboxd.json`, `letterboxd/` | Harry's most recent Letterboxd review and its poster, refreshed automatically (see below) |
| `.github/` | The automatic jobs: one refreshes the Letterboxd review, one builds Tree-Frog Trivia days |
| `jungle-kit.js` | The shared engine: animals, pixel painter, 6 fps clock, cookie banner, icons |
| `page.css` | Styling used when a page is opened on its own |
| `fonts/` | Self-hosted fonts (Climate Crisis, Pixelify Sans, Barlow, Cormorant Garamond), so nothing loads from Google |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | The "H" icon |
| `icons/` | Icons you upload through the console end up here |
| `robots.txt` | Tells search engines what to read: everything except the console and the old `pages` folder, and where the sitemap is |
| `sitemap.xml` | The list of pages for search engines: home and the three games. Add a line if you make a new game |
| `share/` | The 1200×630 preview pictures shown when a game is shared or turns up in search (`home.jpg`, `trivia.jpg`, `flappy.jpg`, `trolley.jpg`) |

## Tree-Frog Trivia

A daily trivia climb from the forest floor to the canopy at harryh.xyz/trivia. Everyone gets the same game each day (London time). The style changes through the week:

| Day | Style |
|---|---|
| Mon, Thu | **Canopy Chase**: 3 “Name a…” prompts (rarer answers give a bigger head start), then 7 questions against an emerald tree boa that gets the same ones right for everyone. Safe climb (3 options, +1 rung) or risky leap (typed, +2). Escape the canopy, then push the boa back with 30 seconds of quick connections. |
| Tue, Fri | **Vine Ladder**: 12 rungs, safe ledges at 3 and 9, three lifelines (Shake the branch 50:50, Ask the troop, Swap the vine), walk away any time. |
| Wed, Sat | **Tangled Wall**: 16 vines, 4 hidden groups with red herrings, 3 lives once two groups are found, 2½ minutes, then name each connection. |
| Sun | **Summit**: a mini wall, a 5-rung ladder and a quick chase, added together. |

- **Timer.** Every question has 20 seconds on a pixel vine: a leafcutter ant snips one leaf per second and carries it off. The wall (2½ minutes) and the final pushback (30 seconds) have their own vines.
- **Typed answers are forgiving.** Small typos are corrected, alternative names count (“Swaziland” → Eswatini, “Henry the Eighth” → Henry VIII), and the game says what it counted. Real things that don't fit (“Australia” for a landlocked country) are recognised and refused.
- **Rarity** in the “Name a…” prompts is worked out ahead of time from how often each answer's English Wikipedia page was viewed over the last 12 months. 0 means the most obvious answer and 100 the deepest cut. Until the Action first runs, it uses hand estimates.
- **Nothing repeats within 730 days.** Every question, finale clue, wall and prompt is retired for two years once used.
- **Sharing.** **Share result** sends an emoji track of the climb; **Challenge a friend** sends a link with your score inside it. Players can go back over the last 7 days. With cookies accepted, results and a streak are kept on the device, and a day can't be replayed for a better score (there's an unsaved practice run instead).
- **Preview** with `?day=2026-11-24` (last 7 days only), `?time=night&weather=rain`.

### Where the questions live

`trivia/data/bank.tft` is the question bank and `trivia/data/days/` has one file per built day. They're encoded so answers can't be read at a glance or found by search engines; the console shows them readably. `trivia/data/index.json` lists the built days and what has been used. `trivia/tft-core.js` is the shared engine (matching, rarity, building days).

### The Trivia desk (console)

Console → **Open the trivia desk**:
- **Calendar** of every built day, past and future. Open any day to read and edit every question, answer, accepted alternative, rarity score, boa answer, finale clue and wall group. Each day gets automatic checks (duplicate options, missing answers, phrases that date) and you can add a flag note.
- **Swap** any question, prompt or wall for an unused one from the bank, and retire the old one if it was wrong.
- **Play-test** opens the day as you've edited it in a new tab, without saving anything.
- **Build more days** and **Refresh rarity** do in the browser what the Action does.
- **Download top-up pack** gives a readable text file with every question and when it was used, what's running low, and a ready-made request. Paste it into a chat with Claude, then paste the reply into **Import questions**. Anything already in the bank is skipped.
- **Save** commits everything to GitHub.

### The weekly Action

`.github/workflows/trivia.yml` runs every Monday (or Actions → **Tree-Frog Trivia** → **Run workflow**). It:
1. scores rarity from Wikipedia page views for future days still on hand estimates, and adds alternative names from Wikidata where a prompt has a query;
2. builds days so there are always about 5 weeks ready, as far as the bank allows.

If the bank runs low it leaves a warning on the run. The first 12 weeks (to 11 February 2027) are already built. **Run the Action once after uploading** so the first weeks get Wikipedia rarity.

## Updating your GitHub repository

1. In your repository, **delete the old `pages` folder**. The pages now live in their own folders.
2. **Keep the `CNAME` file.** It's what links the site to harryh.xyz.
3. Upload everything from this folder to the top of the repository (drag in all the files and folders, including the hidden `.github` folder), then commit.
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
- **Where links show.** In the console, each page can show in the main menu or hang as a wooden sign on a branch in the jungle (up to 5). Flappy, Trolley Trials and Tree-Frog Trivia hang in the jungle by default.
- **Jungle Flappy.** High scores stay on the visitor's device. **Share** sends "My Jungle Flappy high score is…" with a link to harryh.xyz/flappy, and **Save image** downloads a score card.
- **Trolley Trials.** A new store every day (London time): the aisles, items, prices, budget and hazards come from the date, so everyone gets the same one. **Copy receipt** shares a text receipt; **Challenge a friend** shares a link with your route packed inside it, and their game races your ghost trolley on that day's store. Preview another day with `?day=2026-12-25`.
- **Latest Letterboxd review.** Every three hours a GitHub Action (`.github/workflows/letterboxd.yml`) reads letterboxd.com/harryhayw/rss, saves the newest review to `letterboxd.json` and copies its poster into `letterboxd/`, so visitors never load anything from Letterboxd. It shows on the Gallery page as a card with the poster, stars and the start of the review (**Read the rest** opens the whole thing; reviews marked as spoilers stay hidden until tapped). To show it on another page, add an **HTML** block in the page editor containing `<div data-letterboxd></div>`. To refresh it straight away: repository → **Actions → Latest Letterboxd review → Run workflow**.
- **Search engines.** Each game has its own title, description, preview picture and structured data (schema.org) in its `<head>`, so search results and shared links look right. After uploading, add harryh.xyz to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit `https://harryh.xyz/sitemap.xml`.
- **Phones.** Double-tapping no longer zooms the page in the games or the jungle (pinch-to-zoom still works). It's `touch-action: manipulation` in each page's CSS plus `JungleKit.noDoubleTapZoom()`. Text boxes are 16px or bigger so iPhones don't zoom when you type.
- **Animation speed.** The frame rate is `const FPS = 6` in `jungle-kit.js`.
