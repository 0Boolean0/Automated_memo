# SmartStock — Smart Inventory & POS System

A full-stack, local-first inventory and point-of-sale system built for small businesses. Tracks products, serial numbers, sales, warranties, returns, and generates PDF invoices — all running on your local machine or LAN.

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.10+ | Runtime |
| **FastAPI** | 0.115 | REST API framework |
| **SQLAlchemy** | 2.0 | ORM (database layer) |
| **Alembic** | 1.13 | Database migrations |
| **SQLite** | — | Database (single file, no server needed) |
| **Pydantic** | 2.9 | Data validation & schemas |
| **python-jose** | 3.3 | JWT authentication |
| **passlib / bcrypt** | — | Password hashing |
| **fpdf2** | 2.7 | PDF invoice generation |
| **Jinja2** | 3.1 | HTML templates |
| **python-dateutil** | 2.9 | Date arithmetic (warranty expiry) |
| **Uvicorn** | 0.30 | ASGI server |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18 | UI framework |
| **TypeScript** | 5.6 | Type-safe JavaScript |
| **Vite** | 5.4 | Build tool & dev server |
| **Tailwind CSS** | 3.4 | Utility-first styling |
| **Recharts** | 2.13 | Charts (dashboard & reports) |
| **React Router** | 6 | Client-side routing |
| **Axios** | 1.7 | HTTP client |
| **Zustand** | 5 | Auth state management |
| **React Hook Form** | 7 | Form handling |
| **Zod** | 3.23 | Form validation schemas |
| **@zxing/browser** | 0.1 | Camera barcode scanner |
| **react-hot-toast** | 2.4 | Notifications |
| **lucide-react** | 0.447 | Icons |

---

## Project Structure

```
GC_Memo/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # All API route handlers
│   │   ├── models/             # SQLAlchemy database models
│   │   ├── schemas/            # Pydantic input/output schemas
│   │   ├── services/           # Business logic
│   │   ├── auth/               # JWT auth & permissions
│   │   ├── core/               # Config, database connection
│   │   ├── templates/          # Jinja2 invoice HTML template
│   │   └── utils/              # Database seeder
│   ├── migrations/             # Alembic migration files
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/              # One file per page/route
│   │   ├── components/         # Reusable UI components
│   │   ├── services/           # API service functions
│   │   ├── layouts/            # App shell (sidebar, top bar)
│   │   └── utils/              # Formatters (currency, date)
│   ├── package.json
│   └── vite.config.ts
├── data/                       # SQLite database (auto-created)
├── backups/                    # Database backups
└── pdfs/                       # Generated invoice PDFs
```

---

## How to Run

### Prerequisites
- **Python 3.10 or higher** — [python.org](https://python.org)
- **Node.js 18 or higher** — [nodejs.org](https://nodejs.org)

### 1. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Start the backend

Open a terminal in the `backend/` folder:

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On first run the server automatically:
- Creates all database tables
- Seeds default roles (ADMIN, MANAGER, STAFF, SELLER, VIEWER)
- Creates a default admin user

### 4. Start the frontend (dev mode)

Open a **second** terminal in the `frontend/` folder:

```bash
npm run dev
```

### 5. Open the app

| URL | What it opens |
|-----|--------------|
| `http://localhost:5173` | React app (dev mode, hot reload) |
| `http://localhost:8000/docs` | FastAPI Swagger — all API endpoints |
| `http://192.168.x.x:5173` | Same app from phone on same WiFi |

### Default login

Check `backend/app/utils/seeder.py` for the seeded admin credentials. By default:
- **Username:** `admin`
- **Password:** `admin123` *(change this immediately in Settings)*

---

## All Features (13 Phases)

| Phase | Feature | Key screens |
|-------|---------|-------------|
| 1 | Project setup | — |
| 2 | Auth & Users | Login, Users, Roles & Permissions |
| 3 | Products | Products, Variants, Categories, Brands |
| 4 | Purchasing | Suppliers, Purchase Orders, Receive Stock |
| 5 | Inventory | Inventory Dashboard, Adjustments, Low-Stock Alerts |
| 6 | Barcode Scanner | /scan — camera barcode lookup |
| 7 | Customers | Customer list, Retail/Wholesale, Loyalty Points |
| 8 | POS / Sales | New Sale wizard, Sales list, Sale detail |
| 9 | Invoices | PDF invoice per sale — download or print |
| 10 | Warranty | Warranty status per serial, file & manage claims |
| 11 | Returns | File returns (GOOD/DAMAGED), refund tracking |
| 12 | Reports | Revenue charts, top products, inventory value |
| 13 | Backup | Create/download/restore database backups |

---

## How to Add Products

### Step 1 — Create Categories and Brands (optional but recommended)

1. Go to **Categories & Brands** in the sidebar
2. Click **New Category** → enter name (e.g. "Keyboards") → Save
3. Click **New Brand** → enter name (e.g. "AJAZZ") → Save

### Step 2 — Create a Product

1. Go to **Products** → click **New Product**
2. Fill in:
   - **Product Name** — e.g. "AJAZZ AK820"
   - **Category** and **Brand** (from step 1)
   - **Serialized?** — check this if each unit has its own serial number (recommended for electronics). Leave unchecked for bulk/accessory items.
3. Add at least one **Variant** (e.g. "Wireless / Blue Switch"):
   - SKU (optional but useful for scanning)
   - Barcode (optional)
   - Cost price (what you paid)
   - Selling price (what you charge)
   - Warranty months (0 = no warranty)
   - Reorder level (alert threshold)
4. Click **Create Product**

### Step 3 — Receive Stock

Products start with 0 stock. Add stock through a purchase:

1. Go to **Purchases** → **Receive Stock**
2. **Step 1:** Select supplier (or leave blank for walk-in), enter date and amount paid
3. **Step 2:** Click **Add Item**, select your product and variant, enter quantity and unit cost
4. **Step 3 (serialized products only):** Enter each serial number individually
5. **Step 4:** Review and confirm — stock is updated immediately

After confirming, `current_stock` increases by the received quantity and all serial numbers are registered as `IN_STOCK`.

---

## How to Make a Sale (POS)

1. Go to **POS / New Sale** or click the **POS** link in the sidebar
2. **Step 1 — Customer:** Select a customer (optional for walk-in), set the date, enter amount paid, discount, and loyalty points to redeem
3. **Step 2 — Products:** Select product → variant → quantity. Price is pre-filled from the variant's selling price (editable). Repeat for multiple items
4. **Step 3 — Serials (serialized items only):** Enter the serial number of each unit being sold. Must already exist in the system as `IN_STOCK`
5. **Step 4 — Confirm:** Review totals (subtotal → discount → loyalty → net payable → paid → due), then click **Confirm Sale**

On confirmation:
- Each serial transitions from `IN_STOCK` → `SOLD`
- Non-serialized stock is decremented
- Customer loyalty points are updated (earned + deducted)
- A sale record is created with a unique number (SO-YYYY-XXXXX)

---

## How to Generate, Download, and Print an Invoice (PDF)

### From the Sale Detail page

1. Go to **Sales** → click any sale row to open the detail page
2. In the top-right corner you will see two buttons:
   - **Print** — generates the PDF and opens it in a new browser tab, then triggers the browser's print dialog automatically
   - **Invoice PDF** — generates the PDF and downloads it to your computer as `invoice_SO-XXXX.pdf`

### From the Invoices page

1. Go to **Invoices** in the sidebar
2. Find the sale you want and click the **PDF** button in the last column
3. The PDF downloads automatically

### What the invoice contains

- Business name, address, phone, email, and tax number (set in **Settings → Business Profile**)
- Bill To: customer name, phone, email, address (or "Walk-in Customer" if no customer was linked)
- Items table with product name, variant, SKU, quantity, unit price, per-line discount, and line total
- Serial numbers listed under each serialized item
- Payment summary: subtotal → discount → loyalty redemption → net payable → amount paid → balance due
- Loyalty points earned notice
- Notes (if any were added to the sale)
- Page number footer

### Customising the invoice

Edit `backend/app/templates/invoice.html` — it is a standard HTML file with CSS. Change colours, layout, add your logo, or modify any section. The invoice uses the business details stored in the database (editable in Settings).

### Business profile for the invoice header

1. Go to **Settings** (sidebar bottom)
2. Update: Business Name, Address, Phone, Email, Website, Tax/VAT Number
3. Save — all future invoices will use the updated details

---

## Scanning Products with a Phone Camera

1. Ensure your phone and PC are on the **same WiFi network**
2. Find your PC's local IP: run `ipconfig` in a terminal, look for `IPv4 Address` (e.g. `192.168.1.105`)
3. On your phone's browser, open `http://192.168.1.105:5173/scan`
4. Allow camera permission when prompted
5. Point the camera at any barcode — the app looks up the matching variant and shows:
   - Product name, variant, SKU
   - Current stock and reorder level
   - Selling price
   - Low-stock warning if below reorder level

If the camera is blocked (browsers block camera on plain `http://` from non-localhost), use a tunnel:
```bash
npm install -g localtunnel
lt --port 5173
# Opens a public HTTPS URL — open that on your phone
```

---

## Backup & Restore

### Create a backup

1. Go to **Backup** in the sidebar
2. Click **Create Backup Now**
3. A timestamped `.db` file is created in `backups/` (e.g. `inventory_backup_20260918_143000.db`)
4. Click **Download** next to it to save it to your computer

### Restore from a backup

1. Go to **Backup** → click **Restore from File…**
2. Select a `.db` backup file from your computer
3. Read the warning — **this replaces all live data**
4. Type `RESTORE` in the confirmation box and click **Restore Now**
5. The server must be restarted after a restore to reconnect to the database

> **Best practice:** Always create a backup before restoring, doing bulk edits, or updating the software.

---

## Permissions & Roles

The system has 5 built-in roles:

| Role | What they can do |
|------|-----------------|
| **ADMIN** | Everything |
| **MANAGER** | Everything except user/role management |
| **SELLER** | Create sales, manage customers, scan products |
| **STAFF** | Receive stock, view inventory and products |
| **VIEWER** | Read-only access to most data |

Manage users and roles at **Users** → **Roles** in the sidebar (ADMIN only).

---

## API Documentation

With the backend running, open [http://localhost:8000/docs](http://localhost:8000/docs) for the full interactive Swagger UI. All endpoints are documented with request/response schemas and can be tested directly in the browser.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` on startup | Run `pip install -r requirements.txt` inside `backend/` |
| Port 8000 already in use | `--port 8001` in the uvicorn command, update `VITE_API_URL` in `frontend/.env.local` |
| Camera not working on phone | Use HTTPS — run `lt --port 5173` (localtunnel) or serve over LAN with a self-signed cert |
| PDF download fails | Check that `fpdf2` is installed: `pip install fpdf2` |
| Database locked error | Only one uvicorn process should run at a time |
| Frontend can't reach backend | Check the Vite proxy in `frontend/vite.config.ts` — `/api` should proxy to `http://localhost:8000` |
