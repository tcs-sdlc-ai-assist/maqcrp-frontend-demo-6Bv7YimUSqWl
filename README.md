# MAQCrop Demo

Enterprise Risk Management Dashboard — a demonstration platform for mortgage quality control, counterparty risk oversight, and loan acquisition workflows.

## Tech Stack

- **Build Tool:** Vite 5
- **Framework:** React 18 (JSX only, no TypeScript)
- **Styling:** Tailwind CSS 3
- **Charts:** Recharts 2
- **Routing:** React Router DOM 6
- **Date Handling:** date-fns 3
- **Testing:** Vitest + Testing Library

## Folder Structure

```
maqcrop-demo/
├── public/
├── src/
│   ├── app/                  # App-level providers and router
│   ├── components/
│   │   ├── acquisition/      # Loan intake, rules, decision cards
│   │   ├── oversight/        # Risk tiers, scorecards, alerts, watchlist
│   │   ├── qc/               # QC checklist, defect classification
│   │   ├── remedy/           # Remedy workflow, SLA indicators, exposure
│   │   └── shared/           # Layout, pagination, PII masking, breadcrumbs
│   ├── config.js             # Personas, risk tiers, PII fields, constants
│   ├── contexts/             # React context providers (11 domain contexts)
│   ├── data/seeds/           # Deterministic mock data generators
│   ├── hooks/                # Custom React hooks
│   ├── pages/                # Page-level components
│   ├── routes/               # Route definitions (operations + oversight)
│   ├── services/             # Business logic services
│   └── utils/                # Formatters, validators, PII masking, logger
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
├── vite.config.js
└── vitest.config.js
```

## Setup Instructions

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000`. Hot module replacement is enabled.

### Build

```bash
npm run build
```

Outputs to `dist/`. Preview with:

```bash
npm run preview
```

### Testing

```bash
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
```

### Linting & Formatting

```bash
npm run lint          # ESLint check
npm run format        # Prettier format
```

## Personas

The demo supports five role-based personas, each with distinct dashboards and permissions:

| Persona | Description | Default Dashboard |
|---|---|---|
| **Risk Analyst** | Monitors risk metrics, investigates alerts, manages risk cases | `/dashboard` |
| **Compliance Officer** | Ensures regulatory compliance, reviews audit trails | `/compliance` |
| **Fraud Investigator** | Investigates suspicious transactions, analyzes fraud patterns | `/investigations` |
| **Administrator** | Full system access, user management, configuration | `/admin` |
| **Executive** | High-level portfolio overview, KPIs, strategic insights | `/executive` |

Select a persona on the login screen to access persona-specific workflows. No real authentication is performed.

## Key Features

- **Loan Intake & Validation:** Upload loan files (CSV/JSON), validate against schema and dependency rules, run eligibility rules engine
- **Eligibility Rules Engine:** Hard-stop and weighted-score rules with version history, effective dates, and seller scoping
- **QC Workflow:** Sampling configurations (random, risk-based, targeted, threshold), checklist review, defect classification with taxonomy
- **Defect Management:** Full defect lifecycle with severity, root cause, evidence attachments, and taxonomy management
- **Remedy Cases:** Status-driven workflow with SLA tracking, escalation, financial impact recording
- **Repurchase Cases:** Demand issuance, counterparty response, alternative negotiation, case closure
- **Counterparty Risk:** Risk score calculation, tier classification, peer comparison, trend analysis
- **Watchlist & Alerts:** Configurable alert rules, threshold monitoring, watchlist management with action plans
- **Executive Dashboard:** Portfolio-level KPIs, concentration analysis, aging reports, defect trends
- **Audit Log:** Immutable record of all system activity with filtering and export
- **PII Masking:** Automatic masking of sensitive fields with role-based reveal and auto re-masking
- **Export:** CSV and JSON export for all data tables and reports

## Demo Disclaimer

This is a **demonstration platform** only. All data is mock data generated deterministically from seed factories. No real authentication, authorization, or backend services are implemented. Data is stored in `localStorage` and can be reset at any time.

The reference date for all mock data is configurable via the `VITE_REFERENCE_DATE` environment variable (default: `2026-06-09`).

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
VITE_REFERENCE_DATE=2026-06-09
```

## License

Private. All rights reserved.