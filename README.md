<div align="center">

<img src="app/static/logo.png" alt="Kimpay" width="96" height="96">

# Kimpay

**Split group expenses, without the hassle.**<br>
No sign-up, no install: create a Kimpay, share the link, everyone adds what they paid.

[**Open the app →**](https://app.kimpay.io) &nbsp;·&nbsp; [kimpay.io](https://kimpay.io)

![SvelteKit](https://img.shields.io/badge/SvelteKit_3-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PocketBase](https://img.shields.io/badge/PocketBase-B8DBE4?style=flat-square&logo=pocketbase&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-7C3AED?style=flat-square)

<br>

<img src="app/static/marketing_final.png" alt="Kimpay: expenses, balance and the expense form" width="100%">

</div>

<br>

## ✨ Why Kimpay

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>⚡ Start in seconds</h3>
      No account needed. Pick an emoji and a name, then invite with a link or a QR code.
    </td>
    <td width="33%" valign="top">
      <h3>⚖️ Fair splits</h3>
      Equally, by shares, by amounts or by percentage. Reimbursements and money received included.
    </td>
    <td width="33%" valign="top">
      <h3>🔄 Fewest payments</h3>
      Who owes whom, to the cent, with PayPal and Revolut links to pay in one tap.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>🧾 Receipt scanner</h3>
      Snap a receipt: Gemini fills in the amount, date, category and who it was for.
    </td>
    <td valign="top">
      <h3>🌍 Travel-ready</h3>
      9 currencies with the rate of each expense's day, in 5 languages 🇬🇧 🇫🇷 🇩🇪 🇪🇸 🇵🇹
    </td>
    <td valign="top">
      <h3>📱 Feels native</h3>
      Installable PWA, works offline, syncs in real time, light and dark themes.
    </td>
  </tr>
</table>

<sub>And also: repeated expenses, notes, change history, read-only sharing link, CSV and Markdown export.</sub>

## 🚀 Quick start

Everything runs in Docker, nothing else to install.

```bash
make start   # build and run in production mode
make stop
```

| Service              | URL                                                    |
| -------------------- | ------------------------------------------------------ |
| App                  | [localhost:3000](http://localhost:3000)                |
| PocketBase dashboard | [localhost:8090/\_/](http://localhost:8090/_/)         |

For hot reload while coding: `make start-dev`.

## 🧱 Stack

|              |                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------- |
| **Frontend** | [SvelteKit 3](https://svelte.dev/docs/kit) + Svelte 5, static SPA / PWA, [Tailwind CSS 4](https://tailwindcss.com/) |
| **Backend**  | [PocketBase 0.40](https://pocketbase.io/): real-time SQLite, auth, JS hooks and cron jobs           |
| **Tooling**  | TypeScript 6 (strict), Node.js 24, Vitest, Playwright, Docker Compose                              |

## 🛠️ Development

<details>
<summary><b>Quality and tests</b></summary>

<br>

Lint and type checks run in an isolated Node 24 container, whatever your local setup.

| Command                   | What it does                                                            |
| ------------------------- | ----------------------------------------------------------------------- |
| `make check`              | Svelte check (types)                                                    |
| `make lint` / `lint-fix`  | ESLint, with or without auto-fix                                        |
| `make test-unit`          | Vitest unit tests                                                       |
| `make test-e2e`           | Playwright e2e and visual tests (Chromium and Mobile Safari, isolated PocketBase) |
| `make test-e2e ARGS=...`  | Same, with Playwright args, e.g. `ARGS="tests/e2e/sync.spec.ts"`        |
| `make test-visual-update` | Regenerate the visual baselines after an intended UI change             |
| `make ci`                 | Lint, check and unit tests in one go                                   |

- Visual baselines (`app/tests/e2e/visual.spec.ts-snapshots/`) are rendered in the Playwright Docker image and only compared there. After a UI change, run `make test-visual-update`, review the PNGs and commit them.
- Tests tagged `@chromium-only` check a server behaviour (hooks, routes, cron jobs) and only run on Chromium.

</details>

<details>
<summary><b>Environment variables</b></summary>

<br>

Set in `docker-compose.yml`.

| Variable                | Where      | Default                 | Purpose                                                                 |
| ----------------------- | ---------- | ----------------------- | ----------------------------------------------------------------------- |
| `PUBLIC_POCKETBASE_URL` | app        | `http://localhost:8090` | PocketBase API URL                                                      |
| `ORIGIN`                | app        | `http://localhost:3000` | App origin                                                              |
| `GEMINI_API_KEY`        | PocketBase | –                       | Enables the receipt scanner                                             |
| `APP_ORIGINS`           | PocketBase | `https://app.kimpay.io` | Comma-separated origins allowed in emailed links, the first is the default |
| `RATE_LIMIT_MULTIPLIER` | PocketBase | `1`                     | Scales every rate limit (raised by the e2e stack, whose browsers share one IP) |

</details>

<details>
<summary><b>Deploying behind a reverse proxy</b></summary>

<br>

Rate limits count per client IP, which PocketBase reads from the right-most `X-Forwarded-For` value (migration `1740000005_trusted_proxy`, editable in Dashboard › Settings › Application). PocketBase must therefore only be reachable through the proxy: with port 8090 open to the internet, anyone could forge that header and dodge the limits.

</details>

<br>

<div align="center">
<sub>MIT License · Made with ❤️ to simplify your group expenses</sub>
</div>
