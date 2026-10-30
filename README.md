# DashboardKit CRM

CRM & Business Management Frontend Application built with React 18, Vite, Tailwind CSS, and Highcharts.

---

## Overview

**DashboardKit CRM** delivers an enterprise dashboard interface featuring real-time financial tracking, team sales forecasting, customer management, lead scheduling, role-based access control, and comprehensive reporting.

---

## Technology Stack

- **Core Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.1
- **Routing**: React Router v6
- **Styling**: Tailwind CSS + application component styles; no Bootstrap runtime or stylesheet dependency
- **Charts & Data Visualization**: Highcharts 13.1.1 + ApexCharts
- **Icons**: Lucide React + Feather Icons
- **HTTP Client**: Axios with centralized error handling & auth interceptors
- **Notifications**: Sonner

---

## Project Structure

```text
src/
|-- App.jsx              # Root application shell
|-- main.jsx             # Browser entry point
|-- auth/                # Route guards, session handling, and auth pages
|-- assets/              # Images and other bundled static assets
|-- components/          # Shared and reusable UI only
|   |-- common/          # Tables, buttons, inputs, pagination, and modals
|   |-- loaders/         # Loading indicators
|   `-- ui/              # Low-level UI primitives
|-- config/              # Application constants and configuration
|-- hooks/               # Reusable React hooks
|-- layouts/             # Admin and guest page shells
|-- lib/                 # Small framework-independent helpers
|-- pages/               # All routed screens, grouped by business module
|   |-- dashboard/
|   |-- customer/
|   |-- leads/
|   |-- order/
|   |-- performance/
|   |-- profile/
|   |-- reports/
|   |-- settings/
|   `-- tickets/
|-- providers/           # React context providers
|-- routing/             # Central React Router configuration
|-- services/            # API clients and domain services
|-- store/               # Shared application state actions
|-- styles/              # Global and shared stylesheets
`-- utils/               # Reusable application utilities
```

### Where to add files

- Add a routed screen to `src/pages/<feature>/`.
- Keep components used by only one page in that page's `components/` or `table/` folder.
- Add genuinely reusable UI to `src/components/common/` or `src/components/ui/`.
- Add API calls to `src/services/`, reusable hooks to `src/hooks/`, and pure helpers to `src/lib/` or `src/utils/`.
- Register routes in `src/routing/MainRoutes.jsx`.
- Use `@/` for imports from `src`, for example `@/services/userService`.

This layout follows the same high-level conventions as the AmethystCRM reference project: pages, auth, providers, routing, layouts, shared components, services, and utilities each have one clear home.

---

## Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm or yarn

### Installation
```bash
npm install
```

### Environment Configuration
Create or configure `.env`:
```ini
VITE_APP_VERSION = v1.0.0
VITE_APP_API_URL = https://demoapi.enstasol.com/api
VITE_APP_BASE_NAME = /DashboardKit
```

### Development Server
```bash
npm run dev
```

Vite starts on port **3000**. If it is occupied, it automatically tries **3001**,
**3002**, and so on. Run `npm run dev` in another terminal to start another local
instance, and open the exact URL Vite prints (including the configured base path).

To choose a starting port explicitly:

```bash
npm run dev -- --port 3001
npm run dev -- --port 3002
```

The app already uses the Vite entry point `index.html` → `src/main.jsx`. Tailwind
is processed through PostCSS in `vite.config.mjs` and configured in
`tailwind.config.js`. Shared React controls live in `src/components/ui`; the
`Bootstrap.jsx` filename preserves existing imports, but contains local components
and does not import Bootstrap.

### Local HTTPS for card autofill

The browser disables saved-card autofill on an insecure HTTP page. Serve the
frontend over trusted HTTPS to use it; changing the API URL to HTTPS alone does
not secure the frontend. See [Vite HTTPS options](https://v5.vite.dev/config/server-options).

On Windows with Git for Windows (OpenSSL) installed:

```bash
npm run setup:https
npm run dev:https
```

`setup:https` creates a localhost server certificate in the ignored `.certs/`
directory and trusts that certificate for your current Windows user. It does not
install a certificate authority. Approve the Windows certificate confirmation
for **CRM local development**. Restart the browser if it was already open,
then open the HTTPS URL printed by Vite, normally **https://localhost:3000/DashboardKit/**.
If that port is occupied, Vite chooses the next available port. HTTP and HTTPS
instances can run together on different ports. Use `npm run dev:https` for HTTPS;
`npm run dev` continues to use HTTP. Set `DEV_HTTPS=true` in `.env.local` to make
HTTPS the default after trusting the certificate.

For a phone or another device, include the development computer's LAN IP:
`npm run setup:https -- 192.168.1.20` (replace the example IP). Import only
`.certs/localhost.pem` into that device's trusted certificate store, then visit
`https://192.168.1.20:3000/DashboardKit/`. Keep the private key on the development
computer. If its LAN IP changes, regenerate the certificate with the new IP and
trust the replacement certificate on each device.

On other operating systems, run `node scripts/setup-local-https.mjs` and trust the
generated certificate using the OS/browser certificate settings. To use your
own trusted certificate, set `DEV_HTTPS_CERT` and `DEV_HTTPS_KEY` to their file paths
in `.env.local`; these server settings are not exposed to the browser bundle.
Production hosting must terminate HTTPS with a certificate trusted by clients;
the Vite development certificate is only for local development.

### Production Build
```bash
npm run build
```

---

## Features

- **Executive Dashboard**: Daily sales metrics, RPL analytics, and location breakdown with interactive Highcharts.
- **Customer & Lead Management**: Advanced filtering, search, pagination, and customer detail modals.
- **Sales Targets & Performance**: Individual and manager-level targets with forecasting curves.
- **Role-Based Access Control**: Granular module permissions with instant reactive updates.
- **Responsive Layout**: Fluid desktop, tablet, and mobile experience with collapsable sidebar navigation.

---

## License

This project is licensed under the MIT License.
