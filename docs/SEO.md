# SEO Improvements

Create an Open Graph image for social media sharing:

1. **Create `static/og-image.png`**
   - Dimensions: 1200x630px (recommended for Open Graph)
   - Include:
     - Kimpay logo
     - Tagline: "Simple Expense Sharing for Groups"
     - Clean, branded background (indigo gradient)
     - High contrast text for readability

2. **Create `static/robots.txt`**
   ```
   User-agent: *
   Allow: /
   Sitemap: https://kimpay.io/sitemap.xml
   ```

3. **Create `static/sitemap.xml`**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://kimpay.io/</loc>
       <lastmod>2025-12-07</lastmod>
       <priority>1.0</priority>
     </url>
   </urlset>
   ```

## Completed
- ✅ Added comprehensive meta tags (title, description, keywords)
- ✅ Added Open Graph tags for Facebook/LinkedIn
- ✅ Added Twitter Card tags
- ✅ Added JSON-LD structured data (WebApplication schema)
- ✅ Added canonical URLs
- ✅ Added PWA meta tags (theme-color, apple-mobile-web-app)
- ✅ Added multi-language support meta tags

## TODO
- Create OG image (1200x630px)
- Create robots.txt
- Create sitemap.xml
