# UMaT Timetable Maker

Made by Callistus Aidoo.

A small web app that cuts a student's personal class timetable out of the general UMaT teaching timetable for the Essikado and Tarkwa campuses and saves it as a PDF. It installs like an app and works offline after the first visit.

## What's in this folder

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `parser.js` | Reads the timetable Excel files for both campus layouts (one sheet per day; merged cells give the class length) |
| `timetables/campuses.json` | The list of campuses shown in the app. Edit it to add one |
| `timetables/essikado.json`, `timetables/tarkwa.json` | The published timetables for each campus |
| `sw.js` | Service worker. Saves the app on the phone so it works offline |
| `manifest.webmanifest`, `icons/` | Lets students install it to their home screen |
| `privacy.html`, `terms.html` | Privacy and terms pages |
| `vendor/` | PDF and Excel libraries, bundled so nothing loads from the internet |

## The best way to host it: GitHub + GitHub Pages

GitHub holds the files and GitHub Pages serves them as a website, free, over https. Every change, whether a new timetable, a new campus or a design tweak, is saved on GitHub, goes live by itself in about a minute, and can be undone from the history. You never re-upload the whole site.

**One-time setup (about 15 minutes)**

1. **Create the repository.** Sign in at github.com, click **+** then **New repository**. Name it `umat-timetable`, choose **Public**, click **Create repository**.
2. **Upload the app.** On the new repository page click **uploading an existing file**. Open the `umat-timetable` folder, select **everything inside it** (not the folder itself), drag it in, and click **Commit changes**.
3. **Turn on Pages.** Go to **Settings, then Pages**. Set Source to **Deploy from a branch**, Branch **main**, folder **/ (root)**, and click **Save**. A minute later the page shows your link: `https://<your-username>.github.io/umat-timetable/`.
4. **Create a publishing token** so the app can save timetables for you: profile picture, **Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token**. Name it `timetable publishing`, choose **Only select repositories** and pick `umat-timetable`, set **Contents** to **Read and write**, then generate and copy it (it starts with `github_pat_`). Keep it private.
5. **Connect the app.** Open your link with `?admin` at the end. Under **Publishing settings**, enter `your-username/umat-timetable` and paste the token. This is saved on that phone or laptop only.

**How to change things afterwards**

| You want to | Do this | Live in |
|---|---|---|
| Publish a new or final timetable | Open `your-link/?admin`, pick the campus, upload the Excel file, set title and date, tap **Publish for everyone** twice | a few minutes |
| Mark a timetable as draft or final | Put the word "draft" in the title when publishing for a Draft badge; leave it out for Official | a few minutes |
| Add a campus | On GitHub open `timetables/campuses.json`, click the pencil, add a line like `{ "id": "accra", "name": "Accra" }`, commit. Then publish its timetable from the admin page | about a minute |
| Change wording, colours or layout | Open the file on GitHub (for example `index.html` or `styles.css`), click the pencil, edit, **Commit changes**. For bigger edits press `.` on the repository page to open a full editor in your browser | about a minute |
| Undo a mistake | Open the file on GitHub, click **History**, pick the earlier version, and restore it (or use **Revert** on the commit) | about a minute |

Students' phones pick up code changes the next time they open the app online, and timetable changes as soon as they open it. Nothing needs a version number changed.

**Optional: your own web address.** If you buy a domain (for example from a Ghanaian or international registrar), add it under **Settings, then Pages, then Custom domain** and follow GitHub's DNS instructions. The publish button keeps working unchanged.

**Limits worth knowing.** As far as I know GitHub Pages is free for public repositories and has soft limits of roughly 1 GB of site size and 100 GB of traffic a month, far more than this app needs (it is about 0.7 MB). Check GitHub's current Pages documentation if that ever matters. Because the repository is public, anyone can see the code and timetables, which are public information anyway. Your token is never stored in the repository.

**Alternatives.** Netlify or Cloudflare Pages can serve the same GitHub repository instead of GitHub Pages: create a site there, choose **Import from Git**, pick `umat-timetable`, leave the build settings empty, and deploy. The publish button still works because it writes to GitHub and they redeploy on every change. "Download the file instead" in the admin view lets you place a timetable file by hand if you ever need to.

## For students

- The first time they open the link, students pick their campus (Essikado or Tarkwa). They can switch any time at the top of the app.
- Open the link once while online. After that it works with no data.
- On Android/Chrome, tap **Install the app** (or the browser menu → *Add to Home screen*). On iPhone, use Safari → Share → *Add to Home Screen*.
- **Add to calendar:** pick a reminder (15 min, 30 min or 1 hour), set the date lectures end, then tap **Add classes to my calendar**. Open the downloaded file and tap **Add All**. Every class repeats weekly until that date, with an alert before it.
  - iPhone: opens straight into the Calendar app.
  - Android: open the file from the download notification or Files. Samsung Calendar opens it directly. Google Calendar on a phone may not open it; in that case open calendar.google.com on a computer, go to Settings, then Import & export, and import the file.
  - If the timetable changes, delete the old events before adding the new file, or you'll get both.
- **Share** sends the PDF or the calendar file through WhatsApp, Telegram, email and so on. It appears on phones that support sharing files.
- **Upload a newer timetable** loads an Excel file on that phone only. **Use the official timetable** switches back.
- The layout adapts to the screen: one column on phones, and on tablets in landscape and computers the choices sit in a sidebar with the week alongside.
- **Appearance:** the app starts in Light mode. To change it, tap the sun icon at the top right (it cycles Light, Dark, Auto), or scroll to **Appearance** at the bottom and pick one. Auto follows the phone's own light or dark setting. The choice is remembered.

## Changing the app's code

Edit any file on GitHub and commit. The offline worker (`sw.js`) shows the saved copy instantly and fetches your new version in the background, so phones get the change on their next open. There is no version number to bump.

## Testing on your computer

Service workers need a web server, so double-clicking `index.html` won't load the timetable. From this folder run:

```
python -m http.server 8000
```

then open http://localhost:8000.

## Privacy and legal

- The app sets **no cookies**, has **no analytics, ads or accounts**, and sends nothing to you or anyone else. Choices and uploads are saved in the browser on the student's own phone.
- Because nothing optional is stored, there's nothing to ask consent for, so the app shows a one-time **information notice** instead of a cookie banner, with a link to the privacy page.
- `privacy.html` explains what is saved and has a **Delete everything** button. `terms.html` says the app is an independent project, not an official UMaT service, and that students should confirm times with their department.
- **If you ever add analytics, ads or sign-ins**, you'll need a real consent prompt before any of it runs, and you should update `privacy.html` first.
- Your hosting provider may keep its own server logs. That's covered in general terms on the privacy page; check your host's policy.
- If you want students to be able to reach you, add a contact email to the end of `privacy.html`.
