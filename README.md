# Digit Scanner — Deriv synthetic index bot

A dashboard that scans Deriv synthetic indices for the Even/Odd and Over/Under
last-digit setups you defined, and can trade them automatically with
martingale sizing, a stop loss, and a target profit.

**Everything runs in your browser.** There is no backend server — your
Deriv API token stays on your device and talks directly to Deriv over a
WebSocket connection. That also means the bot only trades while this page
is open in a browser tab (see "Running it unattended" below).

## 1. Get a Deriv API token

1. Log in at https://app.deriv.com
2. Go to Settings → API token (or visit https://app.deriv.com/account/api-token)
3. Create a token with the **Trade** and **Read** permissions checked.
4. **Start with a demo account token.** Switch your account to "Demo" (top
   right of the Deriv app) before generating the token, so it's tied to
   your fake-money account, not real funds.

## 2. Run it on your own computer first

You'll need [Node.js](https://nodejs.org) installed (version 18 or later).

```bash
npm install
npm run dev
```

Open http://localhost:3000, paste your demo token, hit Connect, then set
your stake/martingale/stop-loss/target-profit numbers and press **Start
bot**. Watch it for a while on demo before ever touching a real token.

## 3. Put the code on GitHub

GitHub is just a place to store your code online with version history.
Vercel will watch this GitHub repository and auto-publish whenever it
changes.

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository** (top right → "New repository"). Name it
   something like `digit-scanner-bot`. Leave it empty (no README/gitignore).
3. On your computer, inside this project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/digit-scanner-bot.git
   git push -u origin main
   ```
   (GitHub will show you this exact block of commands on the empty repo
   page after you create it — you can copy theirs instead.)

## 4. Deploy it with Vercel

1. Create a free account at https://vercel.com — sign up with your GitHub
   account, it's the easiest path.
2. Click **Add New → Project**.
3. Pick the `digit-scanner-bot` repository you just pushed.
4. Vercel auto-detects this is a Next.js app — leave the default build
   settings as-is and click **Deploy**.
5. After a minute you'll get a live URL like
   `digit-scanner-bot.vercel.app`. That's your bot's dashboard, live on
   the internet.
6. From now on: any time you (or I) push a code change to GitHub, Vercel
   rebuilds and republishes automatically within a minute or two. No
   manual upload, ever.

Your Deriv token is typed into the page at runtime and never leaves your
browser — you don't need to add it as a Vercel environment variable, and
it isn't stored anywhere in the code.

## Running it unattended (optional, more advanced)

Because everything runs in the browser, the bot stops if you close the
tab or your computer sleeps. For a bot that needs to run 24/7 without a
browser open, the usual next step is renting a small always-on VPS (e.g.
a $5/month box) and running the app there in a headless browser, or
rewriting the trading loop to run as a background service instead of in
React. That's a bigger project — happy to help with it once you're
comfortable with the demo version above.

## How the scanner decides which market to trade

Instead of only looking at the last 1000 ticks, `lib/digitStats.js`
checks each market's digit distribution across four window sizes (100,
300, 1000, 3000 ticks) and scores it by:
- **Consistency** — how many of those windows agree the same setup
  (Even/Odd/Over/Under) currently qualifies
- **Magnitude** — how far the leading digits clear the 11% threshold

A setup that only shows up in the newest 100 ticks scores low; one that
holds up across all four windows scores high. The bot always trades
whichever qualifying market currently scores highest.

## Important — please read

Deriv generates synthetic index ticks with its own random number
generator, and states that each tick's last digit is independent and
close to uniformly distributed. That means recent digit-frequency
patterns are not a mathematically proven predictor of the next digit —
this bot automates the rules you gave me, it doesn't add a statistical
edge those rules don't already have. Martingale sizing increases what a
losing streak costs, it doesn't change your win probability. Please only
trade money you can afford to lose, and keep testing on demo for a good
while before switching the token to a real account.
