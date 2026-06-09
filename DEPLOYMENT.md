# MAQCrop Demo — Deployment Guide

## Overview

MAQCrop Demo is a static single-page application (SPA) built with Vite + React. It is deployed to **Vercel** for hosting. This guide covers the complete deployment workflow, environment configuration, and operational procedures.

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Vercel CLI** (optional, for CLI-based deployments): `npm i -g vercel`
- **Vercel account** with access to the project
- **Git** repository connected to Vercel for automatic deployments

---

## Environment Variables

The application uses a single environment variable for configuring the mock data reference date.

### Required Variables

| Variable | Description | Default | Required |
|---|---|---|---|
| `VITE_REFERENCE_DATE` | Reference date for all mock data calculations (format: `YYYY-MM-DD`) | Current date | No |

### Setting Environment Variables

#### Vercel Dashboard

1. Navigate to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Go to **Settings** → **Environment Variables**
3. Add the variable:
   - **Key:** `VITE_REFERENCE_DATE`
   - **Value:** `2026-06-09`
   - **Environments:** Production, Preview, Development
4. Click **Save**

#### Vercel CLI

```bash
vercel env add VITE_REFERENCE_DATE production
# Enter value: 2026-06-09

vercel env add VITE_REFERENCE_DATE preview
# Enter value: 2026-06-09

vercel env add VITE_REFERENCE_DATE development
# Enter value: 2026-06-09
```

#### Local Development

Copy `.env.example` to `.env` and set the value:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_REFERENCE_DATE=2026-06-09
```

**Important:** The `.env` file is gitignored and should never be committed. The `.env.example` file serves as documentation for required variables.

---

## Build Configuration

### Build Command

```bash
npm run build
```

This executes `vite build` which:
- Compiles React JSX to optimized JavaScript
- Bundles all assets with code splitting
- Outputs to the `dist/` directory
- Generates sourcemaps for debugging
- Targets ES2020 for broad browser compatibility

### Output Directory

```
dist/
├── index.html          # Entry point
├── assets/
│   ├── index-[hash].js # Main bundle
│   ├── index-[hash].css # Styles
│   └── ...             # Other chunks
└── favicon.svg
```

### Build Size

The production build is optimized with:
- Tree shaking (unused code elimination)
- Code splitting (lazy-loaded routes)
- Minification (Terser for JS, cssnano for CSS)
- Asset hashing for cache busting

---

## Vercel Configuration

The project includes a `vercel.json` file at the root with SPA rewrite rules:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### Rewrite Rules Explained

- All requests that do **not** start with `/api/` are rewritten to `/index.html`
- This enables client-side routing — React Router handles all navigation
- The `/api/` exclusion allows future API routes if needed
- Static assets (JS, CSS, images) are served directly without rewriting

### Framework Detection

Vercel automatically detects Vite projects and applies the following defaults:
- **Build Command:** `vite build` (from `npm run build`)
- **Output Directory:** `dist`
- **Install Command:** `npm install`

No additional framework preset configuration is needed.

---

## Deployment Methods

### Method 1: Git-Connected Automatic Deployments (Recommended)

1. **Connect Repository**
   - In Vercel Dashboard, click **Add New** → **Project**
   - Import your Git repository (GitHub, GitLab, or Bitbucket)
   - Vercel will automatically detect the Vite framework

2. **Configure Project**
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)

3. **Set Environment Variables**
   - Add `VITE_REFERENCE_DATE` as described above

4. **Deploy**
   - Click **Deploy**
   - Vercel will build and deploy the project
   - A production URL will be assigned (e.g., `maqcrop-demo.vercel.app`)

5. **Automatic Deployments**
   - Every push to the main branch triggers a production deployment
   - Every pull request triggers a preview deployment
   - Deployment status is reported in the Git provider's UI

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Method 3: Manual Deploy via Dashboard

1. Build the project locally:
   ```bash
   npm run build
   ```
2. In Vercel Dashboard, go to **Deployments** → **Create Deployment**
3. Upload the `dist/` directory
4. Click **Deploy**

---

## Custom Domain Setup

### Adding a Custom Domain

1. In Vercel Dashboard, go to **Settings** → **Domains**
2. Enter your custom domain (e.g., `maqcrop.example.com`)
3. Click **Add**

### DNS Configuration

Vercel provides two DNS configuration options:

#### Option A: Recommended (CNAME)

Add a CNAME record pointing to `cname.vercel-dns.com`:

```
maqcrop.example.com.  CNAME  cname.vercel-dns.com.
```

#### Option B: A Record

Add an A record pointing to Vercel's edge network IP:

```
maqcrop.example.com.  A  76.76.21.21
```

### SSL/TLS

Vercel automatically provisions and renews SSL certificates via Let's Encrypt. No additional configuration is required.

### Domain Verification

1. After adding the domain, Vercel will provide verification instructions
2. Add the required TXT record to your DNS configuration
3. Wait for DNS propagation (typically 5-30 minutes)
4. Vercel will automatically verify and activate the domain

---

## Preview Deployments

### How Preview Deployments Work

Every pull request automatically receives a unique preview URL:
- Format: `maqcrop-demo-git-[branch]-[username].vercel.app`
- Each preview deployment is isolated with its own environment
- Preview deployments use the **Preview** environment variables

### Preview Deployment Features

- **Unique URL** for each PR
- **Automatic commenting** on PRs with the preview URL
- **Environment isolation** — preview deployments do not affect production
- **Automatic cleanup** — preview deployments are removed when the PR is closed or merged

### Manual Preview Deployment

```bash
# Deploy current branch to preview
vercel

# Deploy specific branch to preview
vercel --scope [team-slug] --environment preview
```

---

## Production Deployment Workflow

### Standard Workflow

1. **Develop** on a feature branch
2. **Create PR** — triggers preview deployment
3. **Review** preview deployment
4. **Merge to main** — triggers production deployment
5. **Verify** production deployment

### Deployment Pipeline

```
Feature Branch → PR Created → Preview Deploy → Review → Merge to Main → Production Deploy
```

### Rollback Procedure

#### Via Vercel Dashboard

1. Go to **Deployments** in the Vercel Dashboard
2. Find the last known-good deployment
3. Click the **...** menu → **Promote to Production**
4. Confirm the promotion

#### Via Vercel CLI

```bash
# List recent deployments
vercel list

# Rollback to a specific deployment
vercel rollback [deployment-url-or-id]
```

#### Instant Rollback

Vercel supports instant rollbacks — the previous deployment remains available and can be promoted instantly without rebuilding.

---

## Environment-Specific Configuration

### Production Environment

- **URL:** `https://maqcrop-demo.vercel.app` (or custom domain)
- **Branch:** `main`
- **Environment Variables:** Production values
- **Auto-deploy:** On push to `main`

### Preview Environment

- **URL:** `https://maqcrop-demo-git-[branch]-[user].vercel.app`
- **Branch:** Any non-main branch with an open PR
- **Environment Variables:** Preview values
- **Auto-deploy:** On PR creation and new commits

### Development Environment

- **URL:** `http://localhost:3000`
- **Command:** `npm run dev`
- **Environment Variables:** From `.env` file
- **Hot Reload:** Enabled

---

## Monitoring & Logs

### Vercel Analytics

Vercel provides built-in analytics for:
- **Web Vitals** (LCP, FID, CLS)
- **Traffic** (requests, bandwidth)
- **Audience** (visitors, page views)

Enable analytics in **Settings** → **Analytics**.

### Deployment Logs

View build and runtime logs in the Vercel Dashboard:
- **Build Logs:** Available during and after build
- **Runtime Logs:** Available in the **Logs** tab
- **Function Logs:** For serverless functions (if added later)

### Monitoring with Vercel CLI

```bash
# View deployment logs
vercel logs [deployment-url]

# View production logs
vercel logs --production
```

---

## Performance Optimization

### Vercel Edge Network

All deployments are served from Vercel's global edge network:
- **80+ edge locations** worldwide
- **Automatic SSL/TLS** termination
- **HTTP/2 and HTTP/3** support
- **Brotli compression** for text assets

### Caching Strategy

Vercel automatically applies optimal caching headers:
- **Static assets** (JS, CSS, images): 1 year cache with content-hash invalidation
- **HTML:** Short cache (revalidated on each deployment)
- **Immutable assets:** Fingerprinted filenames enable aggressive caching

### Build Optimizations

The Vite build is configured for production:
- **Code splitting:** Routes are lazy-loaded
- **Tree shaking:** Unused code is eliminated
- **Minification:** JS and CSS are minified
- **Source maps:** Generated for debugging (not served to users)

---

## Troubleshooting

### Common Issues

#### Build Fails with "VITE_REFERENCE_DATE is not defined"

**Cause:** Environment variable not set in Vercel.

**Solution:**
1. Go to **Settings** → **Environment Variables**
2. Add `VITE_REFERENCE_DATE` with a valid date
3. Redeploy

#### 404 on Page Refresh (Client-Side Routing)

**Cause:** SPA rewrite rules not applied.

**Solution:**
1. Verify `vercel.json` exists at the project root
2. Verify the rewrite rule is correct:
   ```json
   {
     "rewrites": [
       { "source": "/((?!api/).*)", "destination": "/index.html" }
     ]
   }
   ```
3. Redeploy

#### Stale Content After Deployment

**Cause:** Browser caching old assets.

**Solution:**
- Vite uses content hashing — new deployments have new filenames
- Hard refresh (Ctrl+Shift+R) to clear browser cache
- Vercel automatically invalidates edge cache on new deployments

#### Custom Domain Not Working

**Cause:** DNS not propagated or misconfigured.

**Solution:**
1. Verify DNS records are correct (CNAME or A record)
2. Wait for DNS propagation (up to 48 hours, typically 5-30 minutes)
3. Check domain verification status in Vercel Dashboard
4. Use `dig` or `nslookup` to verify DNS resolution

---

## Security Considerations

### HTTPS

- All Vercel deployments are served over HTTPS by default
- Automatic SSL certificate provisioning and renewal
- HTTP requests are automatically redirected to HTTPS

### Environment Variables

- Environment variables are encrypted at rest
- Never expose sensitive values in client-side code
- `VITE_*` prefixed variables are embedded at build time — do not store secrets in them

### Headers

Vercel applies security headers by default:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

Additional headers can be configured in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
        }
      ]
    }
  ]
}
```

---

## Continuous Integration

### GitHub Integration

Vercel integrates with GitHub to provide:
- **Status checks** on pull requests
- **Preview deployment URLs** as PR comments
- **Automatic deployments** on merge to main

### Required Checks

Configure branch protection rules in GitHub to require:
- Vercel deployment status check
- Successful build

---

## Quick Reference

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `vercel` | Deploy to preview |
| `vercel --prod` | Deploy to production |
| `vercel list` | List recent deployments |
| `vercel rollback [url]` | Rollback to previous deployment |
| `vercel logs [url]` | View deployment logs |
| `vercel env ls` | List environment variables |

### URLs

| Environment | URL |
|---|---|
| Production | `https://maqcrop-demo.vercel.app` |
| Preview | `https://maqcrop-demo-git-[branch]-[user].vercel.app` |
| Local | `http://localhost:3000` |

### Files

| File | Purpose |
|---|---|
| `vercel.json` | Vercel configuration (rewrites, headers) |
| `.env.example` | Environment variable documentation |
| `.env` | Local environment variables (gitignored) |
| `vite.config.js` | Vite build configuration |
| `dist/` | Production build output |

---

## Support

For deployment issues:
1. Check the [Vercel Documentation](https://vercel.com/docs)
2. Review build logs in the Vercel Dashboard
3. Verify environment variables are set correctly
4. Check `vercel.json` for correct SPA rewrite rules