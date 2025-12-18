# Kimpay Homepage - Static SEO Landing

This is the static homepage for `kimpay.io`, optimized for SEO and marketing.

## Architecture

- **kimpay.io** → This static homepage (SEO, marketing)
- **app.kimpay.io** → SvelteKit PWA (full CSR, offline-first)

## Features

✅ **SEO Optimized**
- Complete meta tags (Open Graph, Twitter Cards)
- Schema.org structured data
- Semantic HTML5
- Optimized performance

✅ **Fast & Lightweight**
- Single HTML file with inline CSS
- No JavaScript required for content
- Minimal dependencies
- ~15KB gzipped

✅ **Responsive**
- Mobile-first design
- Dark mode support (respects system preference)
- Touch-friendly

## Assets

✅ All assets copied from main app:
- `favicon.svg` - 2.8 KB
- `apple-touch-icon.png` - 9.0 KB
- `og-image.png` - 7.1 MB

## Deployment

### Option 1: Static Hosting (Recommended)

Deploy to any static host:
- **Vercel**: `vercel --prod`
- **Netlify**: Drag & drop to Netlify
- **Cloudflare Pages**: Connect Git repo
- **GitHub Pages**: Push to `gh-pages` branch
- **S3 + CloudFront**: Upload to S3 bucket

### Option 2: Nginx

```nginx
server {
    listen 80;
    server_name kimpay.io www.kimpay.io;
    
    root /var/www/kimpay-homepage;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Customization

### Update Content

Edit `index.html`:
- Meta tags (lines 8-34)
- Hero section (lines 295-306)
- Features (lines 308-345)
- How it works steps (lines 347-371)

### Update Styling

All CSS is inline in the `<style>` tag (lines 46-278):
- CSS variables for theming (lines 48-71)
- Component styles
- Responsive breakpoints (lines 257-272)

### Add Analytics

Add before `</body>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```



## DNS Configuration

Point your domain to the static host:

```
kimpay.io           A     <your-static-host-ip>
www.kimpay.io       CNAME kimpay.io
app.kimpay.io       CNAME <your-sveltekit-host>
```

## Performance Checklist

- [ ] Enable HTTPS (Let's Encrypt / Cloudflare)
- [ ] Enable gzip/brotli compression
- [ ] Set cache headers for static assets
- [ ] Add OG image (1200x630)
- [ ] Test on PageSpeed Insights
- [ ] Verify mobile responsiveness
- [ ] Check dark mode appearance

## SEO Checklist

- [ ] Submit sitemap to Google Search Console
- [ ] Verify Open Graph tags with Facebook debugger
- [ ] Test Twitter Card with Twitter validator
- [ ] Add robots.txt
- [ ] Monitor Core Web Vitals

## License

Same as main Kimpay project.
