# Thundy AV – Email & Link Security (React Web Application)

**Thundy AV** is an email attachment and link security analyzer rewritten as a modern React application. It inspects messages for malicious attachments, typosquatting lookalikes, urgency signals, and suspicious links—all locally on your machine with transparent heuristics and zero telemetry.

---

## Key Features

- **Local-First Security Engine**:
  - Transparent threat scoring (0–100) based on SPF/DKIM/DMARC headers, domain typosquatting (Levenshtein distance vs. known brands), multilingual urgency signal keywords (English, German, French, Spanish, Italian, Polish), Reply-To discrepancies, first-contact BEC checks, and custom allow/block lists.
  - Safe, local HTML disarming that removes active scripts, forms, frames, and dangerous URIs (`javascript:`, `data:`, `vbscript:`).

- **Time-of-Click Link Protection**:
  - Intercepts and tests link navigation against local threat heuristics and reputation policies.
  - Clear user decision workflow ("Open Link" vs "Cancel & Block").

- **Link Decision Log (Audit)**:
  - Local audit trail of all link inspections, threat scores, provider verdicts, and user decisions.
  - Multi-attribute filtering (search, outcome, minimum score, date ranges).
  - JSON and CSV export capabilities, plus local retention management.

- **Enterprise Profiles & Verification Drafts**:
  - Pre-configure enterprise integration profiles across Hosting, SSO, Device Management, SIEM, and Ticket Systems.
  - Generates verified profile drafts and requirements checklists.

- **Settings & Guided Setup Wizard**:
  - Theme customization (System, Light, Dark mode; Ocean, Violet, Forest, Amber accents; Comfortable / Compact density).
  - Privacy tier controls (`strict`, `balanced`, `max`) and external analysis opt-in.
  - 6 bundled languages: English, German, French, Spanish, Italian, and Polish.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Icons**: Lucide React
- **Design Tokens**: Thundy AV Design System (CSS variables with dark/light mode and accent variations)

---

## Running the Application

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

---

## License

GNU General Public License v3 (`GPL-3.0-only`). See [LICENSE](LICENSE).
