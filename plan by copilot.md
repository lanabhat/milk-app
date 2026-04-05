## Plan: Milk and Paper Purchase Management App

Build a simple web application for managing daily milk and newspaper purchases, tracking advance payments, calculating bills, and facilitating payments via UPI/PhonePe. The app will use React for the frontend, Django REST Framework for the backend, SQLite for the database, and be hosted on PythonAnywhere for free access via web URL. Authentication via email/password with super admin privileges.

**IMPLEMENTATION IN PROGRESS**
- ✅ Backend: Django 4.2 with DRF, SQLite at e:\Development\Milk\database\db.sqlite3
- ✅ Frontend: React with Router, running on port 3000 (was port 3000, may be on different port)
- ✅ Models: Item, Purchase, Advance, SpecialRequest with full CRUD via DRF ViewSets
- ✅ API Endpoints: /api/items, /api/purchases, /api/advances, /api/special-requests, /api/bills
- ✅ Superuser: lanabhat@gmail.com (password: 'password')
- ✅ Dashboard: Shows available items, purchase form, purchase history, balance tracking
- Django server: http://localhost:8000 (running)
- React server: http://localhost:3000 or next available port (running)

**Steps**
1. Set up project structure: Create directories for frontend (React with Tailwind), backend (Flask), and database (SQLite). Initialize React project and Flask app.
2. Implement authentication: Set up email/password login using Flask-Security or similar, with lanabhat@gmail.com as super admin. Allow manual user management via DB.
3. Define catalog: Create models for items (Nandini 1L packets, 500ml packets, Kannada newspaper, English newspaper) with prices.
4. Build daily purchase entry: Create React form to log daily quantities for each item, store in DB with dates.
5. Implement calculations: Track advance amount, calculate daily totals, remaining balance, and forecast based on 2L milk + newspapers (~1048 Rs).
6. Add payment integration: Attempt UPI/PhonePe API integration (e.g., via Razorpay if feasible); fallback to redirect to PhonePe app with vendor's UPI ID and bill details.
7. Generate and share bills: Create bill summary with purchases, totals, advance balance; generate shareable link or message for WhatsApp sharing.
8. Handle special requests: Add form for extra packets, generate WhatsApp message to vendor 1-2 days in advance.
9. Deploy to PythonAnywhere: Set up hosting, configure domain, ensure email/password access for user and wife.
10. Test and verify: Run unit tests for backend, manual UI tests, validate calculations and payments.

**Relevant files**
- `frontend/src/` — React components for login, catalog, daily entry, bills
- `backend/app.py` — Flask routes for API endpoints
- `backend/models.py` — SQLAlchemy models for users, items, purchases
- `database/milk_app.db` — SQLite database file

**Verification**
1. Unit tests for backend calculations (advance balance, totals) using pytest.
2. Manual testing: Add sample purchases, verify bill generation, test auth for multiple users.
3. Integration test: Simulate payment redirect and WhatsApp sharing.
4. Deploy and access via web URL, ensure permissions for lanabhat@gmail.com and wife's email.

**Decisions**
- Tech stack: React (frontend), Flask (backend), SQLite (DB), PythonAnywhere (hosting) based on familiarity and free options.
- Authentication: Custom email/password with super admin role.
- Payments: Prefer API integration; fallback to PhonePe redirect.
- WhatsApp: Shareable link with summary table.
- Scope: Core features (catalog, daily logging, billing, payments, sharing); exclude advanced analytics or multi-vendor support.
- Database: SQLite for simplicity; can migrate to Google Sheets or NoSQL if needed later.

**Further Considerations**
1. UPI integration feasibility: Research PhonePe API availability for web apps; if not, confirm redirect approach.