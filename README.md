<div align="center">
  <img src="app/static/logo.png" alt="Logo Kimpay" width="120" height="120">

  <h1>Kimpay</h1>

  <p>
    <strong>A modern, containerized expense-sharing web application.</strong>
    <br />
    <a href="https://kimpay.io"><strong>🌐 https://kimpay.io</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="SvelteKit" />
    <img src="https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/PocketBase-B8DBE4?style=for-the-badge&logo=pocketbase&logoColor=black" alt="PocketBase" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#tech-stack">Tech Stack</a>
  </p>
</div>

<br />

**Kimpay** is a modern, containerized expense-sharing web application (similar to Tricount/Splitwise) designed to be simple, fast, and delightful to use.

![Kimpay Screenshot](app/static/marketing_final.png)

## <a id="features"></a>✨ Features

-   **No Login Required**: Start immediately—no account creation needed
-   **Cross-Platform**: Optimized for both mobile and desktop browsers
-   **Quick Setup**: Create a group in seconds with an emoji and a name
-   **Easy Sharing**: Invite friends with a link, a QR code or the group code
-   **Read-Only Link**: Share a summary (expenses, balances, payments to make) with people who must not edit the group
-   **Expense Management**: Add expenses specifying who paid and for whom, then search and filter them by person, type or category
-   **Flexible Splits**: Split equally, by shares, by exact amounts or by percentage
-   **Money Received**: Record refunds or returned deposits, shared back between the group
-   **Smart Balance**: Intelligent algorithm to minimize reimbursements ("Who owes whom"), with no cent lost to rounding
-   **Pay in One Tap**: PayPal.me and Revolut.me links on the payments you owe
-   **Real-Time**: Updates align instantly across devices
-   **Multilingual**: Available in English 🇬🇧, French 🇫🇷, German 🇩🇪, Spanish 🇪🇸 and Portuguese 🇵🇹
-   **Multi-Currency**: Support for 9 currencies (EUR, USD, GBP, JPY, AUD, CAD, CHF, CNH, VND); each expense keeps the exchange rate of its date
-   **Export**: CSV and Markdown, with balances and suggested payments
-   **Dark Mode**: Elegant interface supporting both light and dark themes
-   **Delightful UX**: Smooth animations, emojis, and polished design
-   **PWA Ready**: Install as a Progressive Web App on any device, usable offline
-   **AI Receipt Scanner**: Scan receipts with Gemini AI to auto-fill expense details, amount, date, and category, and suggest who it was for

## <a id="tech-stack"></a>🛠️ Tech Stack

-   **Runtime**: **Node.js 24 (LTS)**
-   **Frontend**: [SvelteKit 3](https://svelte.dev/docs/kit) (static SPA/PWA, Svelte 5) + [Tailwind CSS 4](https://tailwindcss.com/)
-   **Backend**: [PocketBase](https://pocketbase.io/) (Real-time SQLite database + Auth)
-   **Language**: TypeScript 6 (Strict Mode)
-   **Infrastructure**: Docker Compose (Production & CI environments)

## <a id="quick-start"></a>🚀 Quick Start

The entire project is containerized. You only need **Docker** installed.

### 1. Start the application (Production Mode)

```bash
make start
```

This builds and runs the application in production mode.

-   **Frontend**: [http://localhost:3000](http://localhost:3000)
-   **PocketBase Admin**: [http://localhost:8090/\_/](http://localhost:8090/_/)

### 2. Stop the application

```bash
make stop
```

## 🔧 Development Workflow

We provide a set of `make` commands to streamline development and ensure consistency across environments.

### 🏃‍♂️ Running in Development Mode

To start the app with hot-reloading (HMR):

```bash
make start-dev
```

### 🛡️ Code Quality & Testing

We use an **isolated CI container** to ensure linting and type-checking run in a consistent Node 24 environment, regardless of your local setup.

| Command                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `make check`              | Run Svelte check (Type Safety)                                       |
| `make lint`               | Run ESLint (Code Style)                                              |
| `make lint-fix`           | Auto-fix ESLint issues                                               |
| `make test-unit`          | Run Vitest unit tests                                                |
| `make test-e2e`           | Run Playwright E2E + visual tests (Chromium & WebKit, isolated PB)   |
| `make test-e2e ARGS=...`  | Same, with extra Playwright args (e.g. `ARGS="tests/e2e/sync.spec.ts"`) |
| `make test-visual-update` | Regenerate the visual baselines after an intended UI change          |

Visual baselines (`app/tests/e2e/visual.spec.ts-snapshots/`) are rendered in the Playwright Docker image, so they are only compared when the tests run in Docker. After an intended UI change, run `make test-visual-update`, review the updated PNGs and commit them.

### 🌍 Environment Variables

Configuration is handled via `docker-compose.yml`.

-   `PUBLIC_POCKETBASE_URL`: PocketBase API URL (default: `http://localhost:8090`)
-   `GEMINI_API_KEY` (PocketBase): Gemini API key used by the receipt scanner (optional, the scanner is disabled without it)
-   `APP_ORIGINS` (PocketBase): comma-separated app origins allowed in emailed links, the first one being the default (default: `https://app.kimpay.io`)
-   `ORIGIN`: Application origin URL (default: `http://localhost:3000`)

## 📝 License

This project is open source and available under the MIT License.

---

_Made with ❤️ to simplify your group expenses._
