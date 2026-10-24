# Setting up SimpleGit

You only do this once. It takes about 10 minutes.

If you know someone who is comfortable with computers, you can ask them to do
this part for you. After setup, everything happens in SimpleGit's simple screens.

**What you need:**

- A Windows computer or a Mac
- An internet connection
- A GitHub account. It is free. You can make one at <https://github.com/signup>.

---

## Step 1: Install Node.js

SimpleGit needs a free program called Node.js.

1. Go to <https://nodejs.org>.
2. Press the big button that says **LTS** (it means "the steady version").
3. Open the file you downloaded.
4. Keep pressing **Next** or **Continue** until it says it is finished.

You only need to do this once.

---

## Step 2: Get SimpleGit

1. Download the SimpleGit folder to your computer.
   If it came from GitHub, press the green **Code** button, then **Download ZIP**.
2. Open the ZIP file you downloaded.
3. Move the **simplegit** folder somewhere easy to find, such as your **Documents** folder.

---

## Step 3: Start SimpleGit

**On Windows:**

1. Open the **simplegit** folder.
2. Double-click **Start SimpleGit (Windows)**.
3. If Windows says "Windows protected your PC", press **More info**, then **Run anyway**.

**On a Mac:**

1. Open the **simplegit** folder.
2. Hold the **Control** key and click **Start SimpleGit (Mac)**. Then choose **Open**.
3. If your Mac asks whether you are sure, press **Open** again.

A window full of text appears. **Leave it open** while you use SimpleGit.
The first time, it takes about a minute to get ready.

Then your web browser opens SimpleGit by itself.
If it does not, open your web browser and go to **http://localhost:3000**.

---

## Step 4: Connect SimpleGit to GitHub

You do this once. SimpleGit shows each step on the screen.

1. Make sure you are signed in to GitHub in your web browser.
2. In SimpleGit, press **Next**, then **Connect to GitHub**.
3. GitHub shows a page called **Create GitHub App**. Everything is already filled in.
   Scroll to the bottom and press the green **Create GitHub App** button.
4. GitHub brings you back to SimpleGit.

This creates a private connection that only lets SimpleGit do what you ask:
look at files, save changes, invite helpers and publish websites.

---

## Step 5: Choose which projects SimpleGit may use

1. Press **Choose My Projects on GitHub**.
2. Choose **All repositories**. ("Repository" is GitHub's word for "project".)
   This means new projects work straight away too.
3. Press the green **Install** button.

---

## Step 6: Sign in

1. Press **Sign in with GitHub**.
2. If GitHub asks, press **Authorize**.

You will see SimpleGit's seven big buttons. You are ready.

---

## Every time after that

1. Double-click **Start SimpleGit**, the same way as in Step 3.
2. Use SimpleGit in your web browser.
3. When you are finished, close the window full of text. That stops SimpleGit.

---

## If something goes wrong

**"SimpleGit needs a free program called Node.js."**
Do Step 1, then try again.

**The browser says "This site can't be reached".**
SimpleGit is not running. Do Step 3 again, and keep the text window open.

**"Something else is already using port 3000".**
SimpleGit is probably already running. Go to **http://localhost:3000** in your browser.

**I cannot see some of my projects.**
In SimpleGit, press **Help**, then **Choose My Projects on GitHub**, and choose **All repositories**.

**I want to start setup again from the beginning.**
Delete the file called **.env** inside the simplegit folder, then start SimpleGit again.
(This file may be hidden. On a Mac, press Command, Shift and the full stop key (.) together in the folder to show hidden files.)

---

## For helpers: running SimpleGit on a server

SimpleGit can also run on a server so that it works from a phone, anywhere.
This is optional and needs some technical knowledge.

1. Copy the `simplegit` folder to the server and run `npm install --omit=dev`.
2. Set these settings (environment variables):
   - `BASE_URL`: the public **https** address, for example `https://simplegit.example.org`.
     HTTPS is required for secure sign-in cookies.
   - `PORT`: the port to listen on (default `3000`).
   - `ALLOW_REMOTE_SETUP=1`: **only** while you do Step 4 from your browser.
     Remove it straight after setup, so nobody else can set up your copy first.
3. Start it with `npm start` (or a process manager).
4. Do Steps 4–6 from your browser.
5. If **other people** will sign in with their own GitHub accounts, make the
   GitHub App public: GitHub → Settings → Developer settings → GitHub Apps →
   your SimpleGit app → Advanced → Make public. Each person then installs it
   on their own account (Step 5).

You can also create the GitHub App by hand instead of Step 4:

- Callback URL: `<BASE_URL>/auth/callback`
- Webhook: off
- Repository permissions: Contents (read and write), Metadata (read),
  Administration (read and write), Pages (read and write),
  Workflows (read and write), Actions (read)
- Then set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_APP_SLUG`.
  SimpleGit does not need the app's private key, so don't keep it.

All settings are listed in `.env.example`.
