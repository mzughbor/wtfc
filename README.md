# FalconCodes / WallTech creative clone

Static front-end workspace for a FalconCodes-style marketing home page. The page keeps the original layout, typography, and scroll-driven intro copy, and replaces the former case-study column with an embedded WallTech Three.js scroll experience.

## What is in the repo

- `home.html` — main home page markup, inline scripts, and HTMX hooks from the FalconCodes export
- `static/` — shared CSS, JavaScript, logos, and the WallTech 3D partial
- `better-call-sall-liefle-main/` — local Vite + Three.js prototype used as the source for the embedded story (listed in `.gitignore`)

## Project layout

```text
creative-clone/
├── home.html
├── static/
│   ├── assets/logo/
│   ├── css/
│   │   ├── header-styles.css
│   │   ├── newbb.shared.mzug.min.css
│   │   ├── apendx.css
│   │   ├── responsive-images.css
│   │   └── walltech-3d.css
│   ├── js/
│   │   ├── jquery-3.5.1.min.js
│   │   └── walltech-3d.js
│   └── partials/
│       └── walltech-3d-block.html
└── better-call-sall-liefle-main/
    ├── story.html
    ├── main.js
    └── package.json
```

## Preview the home page

Serve the repository root over HTTP so `/static/...` paths and the WallTech ES module resolve correctly. Opening `home.html` with `file://` is not supported for the 3D block.

```bash
cd /home/mahmoud/falcon/creative-clone
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/home.html`.

## WallTech 3D block

The case column (`f-cases-clw w-dyn-list`) renders `#walltech-3d-story`: a sticky viewport, six Falcon service chapters, and scroll-linked camera movement through the scene stack.

| Piece | Path |
| --- | --- |
| Markup | `home.html`, `static/partials/walltech-3d-block.html` |
| Styles | `static/css/walltech-3d.css` |
| Runtime | `static/js/walltech-3d.js` |

On desktop, the sticky viewport uses `top: 0` and `height: 100vh`. On viewports up to 768px wide, it uses `top: 58px` and `height: 94vh` so the canvas clears the mobile header.

The left intro column still reads segment copy from `#intro-scroll-data` and switches text as each `.walltech-chapter` crosses the scroll threshold.

`walltech-3d.js` loads Three.js from jsDelivr (`three@0.160.0`). A network connection is required for the 3D scene unless you vendor that module locally and update the import.

## Standalone 3D prototype

The prototype under `better-call-sall-liefle-main/` is the full-page scroll story experiment that the embedded block was adapted from.

```bash
cd /home/mahmoud/falcon/creative-clone/better-call-sall-liefle-main
npm install
npm run dev
```

Use `story.html` for the standalone experience and `home.html` for the Falcon-branded embed.

## Notes

- Markup still references HTMX refresh URLs and CSRF tokens from the original Django-backed site. In this static snapshot those requests only work when the matching backend is running.
- Hero, services, and contact case blocks were removed from the case column in favor of the WallTech experience. Footer contact details below the case column remain in `home.html`.
- Shared styles and scripts under `static/` are served as static assets; there is no application build step for the home page itself.

## Deploy on Vercel

The repo is a static site: `home.html` at the root, assets under `static/`, and no build step. `vercel.json` rewrites `/` to `/home.html` so the site loads at the project URL without renaming the main file.

### Dashboard

1. Import the Git repository in [Vercel](https://vercel.com/new).
2. Set **Framework Preset** to **Other**.
3. Leave **Root Directory** as `.`.
4. Leave **Build Command** and **Output Directory** empty.
5. Deploy.

### CLI

```bash
cd /home/mahmoud/falcon/creative-clone
npx vercel
```

Use `npx vercel --prod` for production.

### After deploy

- Open the deployment URL at `/` or `/home.html`.
- Confirm `/static/css/walltech-3d.css` and `/static/js/walltech-3d.js` return `200`.
- HTMX refresh URLs under `/en/htmx/...` still need the original Django backend; they are not part of this static deploy.
- WallTech still loads Three.js from jsDelivr, so the browser needs outbound HTTPS access to that CDN.
