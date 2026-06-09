# CHANGELOG

## [1.0.0] - 2026-06-09

### Initial Release

This is the initial release of the MAQCrop Demo platform, an Enterprise Risk Management Dashboard for mortgage quality control, counterparty risk oversight, and loan acquisition workflows.

---

### CLUSTER-1: Loan Operations & Quality Workflow

#### Loan Intake & Validation
- Upload loan files (CSV/JSON) with simulated file processing and progress indication
- Validate loan records against schema rules (required fields, format validation, range checks)
- Validate cross-field dependency rules (product type × LTV, jumbo limits, USDA income limits, cash-out LTV)
- Validate seller references against existing counterparty records
- View all submitted loans with filtering by status, product type, channel, and free-text search
- Expandable loan detail rows with full field visibility including PII-masked fields
- Paginated loan list with configurable page sizes (25, 50, 100)

#### Eligibility Rules Engine
- Create, edit, and archive eligibility rules with hard-stop and weighted-score types
- Configure rule conditions with field, operator, value, and message templates
- Scope rules by product type, channel, and specific seller IDs
- Set effective dates and optional expiration dates for rules
- Version history tracking with full snapshot diffs between versions
- Execute rules engine against loans to produce pass/fail/exception decisions
- Decision card visualization showing rule-by-rule breakdown with pass/fail indicators
- Weighted score calculation with configurable thresholds (80% pass threshold)
- Manual override request workflow with reason codes and justification
- Role-based override permissions (risk-analyst, admin, compliance-officer)

#### Exception Queue
- View all loans in FAIL or EXCEPTION status
- Route exceptions to QC review, manual review, permanent rejection, or override request
- Detailed failure reason display with rule evaluation results
- Audit trail logging for all routing actions

#### QC Workflow
- Sampling configurations with four methodologies: random, risk-based, targeted, threshold
- Configurable sample rates, product type filters, channel filters, and loan amount ranges
- Risk-based sampling with weighted criteria (field, operator, value, weight)
- Threshold-based sampling with multiple threshold rules
- Run sampling against loan pool and view selected loan IDs
- QC case creation from sampling runs with auto-generated checklists
- QC work queue sorted by priority and due date with SLA breach indicators
- Checklist review interface with pass/fail/NA responses per item
- Defect logging directly from failed checklist items with taxonomy code selection
- Evidence attachment simulation for checklist items
- Review completion with overall result (pass/fail/conditional_pass)
- Case escalation workflow
- Reviewer assignment

#### Defect Management
- Full defect lifecycle: create, update, close, dispute
- Taxonomy-based defect classification with category/subcategory/defect type hierarchy
- Severity levels: critical, major, minor, observation
- Root cause classification (Seller Error, Process Gap, System Issue, etc.)
- Source of defect tracking (pre_closing, post_closing, servicing)
- Evidence attachment support
- Auto-generation of remedy cases for critical and major severity defects
- Defect list with filtering by severity, status, root cause, date range, and search
- Expandable defect detail rows

#### Defect Taxonomy Manager
- Manage defect taxonomy categories, subcategories, and defect types
- Add, edit, and delete categories with nested subcategory and defect type management
- Default severity assignment per defect type
- Taxonomy version tracking
- Paginated flat list of all defect types with full taxonomy codes

#### Remedy Cases
- Auto-generated remedy cases from eligibility failures and QC defects
- Status-driven workflow: open → assigned → in_progress → pending_counterparty → resolved → closed
- Escalation workflow with level tracking and priority escalation
- SLA tracking with due dates, breach detection, and aging bucket classification
- Financial impact recording (estimated and actual)
- Case history timeline with all status transitions and actions
- Linked defect tracking
- Remedy case list with filtering by status, priority, remedy type, source type, and SLA status
- Expandable case detail rows with history and linked defects

#### Repurchase Cases
- Full repurchase demand lifecycle: draft → demand_issued → counterparty_review → negotiation → accepted/disputed/alternative_accepted → closed
- Counterparty response recording (accept, dispute, counter)
- Alternative proposal negotiation (indemnification, price_adjustment, partial_repurchase, other)
- Final outcome recording with settlement amounts
- Financial exposure tracking and calculation
- Aging bucket classification for open cases
- Evidence attachment support
- Linked defect tracking
- Repurchase case list with filtering by status, counterparty, and aging bucket
- Expandable case detail rows

#### Audit Log
- Immutable audit trail recording all system activity
- Event types covering all modules: loan, rule, QC, defect, remedy, repurchase, persona, PII, export, config
- Filterable by date range, persona, event type, entity type, and free-text search
- Expandable entry details with full JSON payload
- Export to JSON format
- Paginated audit log viewer

---

### CLUSTER-2: Risk & Executive Oversight

#### Counterparty Risk Dashboard
- Risk score calculation engine with weighted factors: defect rate (0.35), remedy aging (0.25), exposure (0.25), breach count (0.15)
- Risk tier classification: critical (76-100), high (51-75), moderate (26-50), low (0-25)
- Ranked counterparty table with sortable columns
- Filtering by risk tier, watchlist status, and search
- Recalculate risk tiers on demand
- Export counterparty risk data

#### Counterparty Scorecard
- Detailed scorecard view per counterparty with key metrics
- Risk tier breakdown with contributing factors and normalized scores
- 6-month performance trend charts (defects, remedies)
- Peer comparison charts against peer group averages
- Defect analysis with severity and root cause breakdowns (pie charts)
- Recent activity feed from audit log
- Add to watchlist from scorecard view

#### Alert Configuration
- Create, edit, delete, and toggle alert rules
- Configurable metrics: defect rate, critical defect rate, remedy response time, repurchase exposure, SLA breach count, pass rate, open remedy cases, open repurchase cases
- Configurable operators: gt, gte, lt, lte, eq, neq
- Severity levels: info, warning, high, critical
- Counterparty scope: all or specific counterparties
- Alert rule list with filtering by severity, metric, and enabled status
- Toggle enable/disable with audit logging

#### Alert Monitoring
- Automated alert evaluation on configurable polling interval (default 30s)
- Threshold evaluation against counterparty metrics
- Notification generation for new breaches
- Active alert tracking with acknowledgment and resolution
- Manual force-evaluate capability

#### Watchlist Management
- Add counterparties to watchlist with reason and recommendation
- Watchlist statuses: active, monitoring, cleared
- Monitoring notes with author and timestamp tracking
- Action plan association and status tracking
- Remove from watchlist with reason logging
- Watchlist entry list with filtering by status and search
- Expandable entry details with monitoring notes and action plans

#### Executive Dashboard
- Portfolio-level KPIs: total loans, defect rate, pass/fail ratio, active watchlist, total exposure
- Portfolio quality heatmap by risk tier
- Top counterparties table ranked by defect rate
- Repurchase case aging chart (bar chart by aging bucket)
- Defect trend chart (6-month line chart)
- Drill-down navigation from KPIs to detail views
- Export executive dashboard data

#### Reports & Analytics
- Defect trend report with monthly counts and severity/root cause breakdowns
- Concentration report by product type, channel, and counterparty
- Aging & SLA report with repurchase case aging and remedy SLA status
- Date range and counterparty filtering across all reports
- Export report data

---

### Platform Features

#### Persona-Based Access Control
- Five personas: Risk Analyst, Compliance Officer, Fraud Investigator, Administrator, Executive
- Role-based route access with AccessDenied component
- Persona switching from sidebar with persistent state
- Default dashboard per persona
- Permission matrix for granular action control

#### PII Masking
- Automatic masking of 22 PII field types (SSN, email, phone, address, account numbers, etc.)
- Role-based reveal permissions (critical sensitivity: admin/fraud-investigator only)
- Auto re-masking after 10-second timeout
- Manual re-mask capability
- PII sensitivity indicators (critical, high, medium, low)
- Audit logging for all PII reveal actions

#### Notifications
- In-app notification system with toast messages
- Notification types: info, success, warning, error
- Notification dropdown in header with unread count badge
- Mark as read and dismiss functionality
- Auto-generated notifications from alert breaches, workflow transitions, and system events

#### Export Functionality
- CSV export with RFC 4180 compliant formatting and BOM for Excel compatibility
- JSON export with pretty-printing
- TSV export for spreadsheet compatibility
- Multi-format export (CSV + JSON + TSV simultaneously)
- Timestamped filenames
- Audit logging for all export actions
- Export buttons on all data tables and reports

#### Mock Data Seeding
- Deterministic pseudo-random data generation using seeded RNG (mulberry32)
- 50 loans across 5 product types and 4 channels
- 12 counterparties with performance metrics
- 20 eligibility rules (18 active, 1 archived) with version history
- 10 checklist templates (9 active, 1 archived)
- 100 QC cases with checklists and findings
- 60 defects with taxonomy classification
- 25 repurchase cases across all statuses
- 500+ audit log entries spanning 6 months
- Data version tracking with automatic re-seeding on schema changes
- Reset data capability

#### UI/UX
- Enterprise design system with consistent card, button, input, and table components
- Responsive sidebar navigation with collapse/expand
- Breadcrumb trail navigation
- Pagination with configurable page sizes
- Expandable table rows for detail views
- Modal dialogs for forms and confirmations
- Loading states, empty states, and error states
- Toast notifications
- Keyboard accessible (focus management, Escape to close modals)
- Tailwind CSS utility-first styling
- Recharts for data visualization (line, bar, pie charts)

#### Technical Foundation
- Vite 5 build tool with React plugin
- React 18 with hooks and context API
- React Router DOM 6 for client-side routing
- 11 React context providers for state management
- localStorage persistence for all data
- Event bus for cross-module communication
- Comprehensive input validation
- Unit tests with Vitest and Testing Library
- ESLint + Prettier for code quality
- Environment variable configuration (VITE_REFERENCE_DATE)

---

### Known Limitations

- This is a demonstration platform with mock data only
- No real authentication or authorization backend
- No persistent database — all data stored in localStorage
- No real file upload processing — simulated uploads
- No real API integration
- Single-user experience (no multi-user concurrency)
- No real email or notification delivery