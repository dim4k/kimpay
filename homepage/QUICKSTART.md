# Kimpay Homepage - Static Landing Page

**Live**: [kimpay.io](https://kimpay.io)  
**App**: [app.kimpay.io](https://app.kimpay.io)

Simple, fast, SEO-optimized static homepage for Kimpay.

## Quick Start

```bash
# Serve locally
python3 -m http.server 8000
# or
npx serve .
```

Open http://localhost:8000

## Architecture

```
kimpay.io       → This static homepage (SEO, marketing)
app.kimpay.io   → SvelteKit PWA app (full CSR, offline-first)
```

## Files

- `index.html` - Main landing page (~15KB)
- `favicon.svg` - Site icon
- `apple-touch-icon.png` - iOS home screen icon
- `og-image.png` - Social media preview
- `robots.txt` - SEO crawling rules
- `sitemap.xml` - Site structure

## Deploy

### Vercel

```bash
vercel --prod
```

### Netlify

Drag and drop the `homepage/` folder to Netlify.

### Cloudflare Pages

Connect your Git repo and set build directory to `homepage`.

## DNS Setup

```
kimpay.io       → Static host (this homepage)
app.kimpay.io   → Your SvelteKit deployment
```

## Performance

- ✅ 100/100 Lighthouse score target
- ✅ ~15KB HTML + CSS
- ✅ No JavaScript required
- ✅ Dark mode support
- ✅ Fully responsive

---

Made with ❤️ for Kimpay
