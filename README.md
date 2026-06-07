# Milk App — Home Management Suite

A personal home-management web app. It started as a simple milk & newspaper purchase
tracker and has grown into a broader suite for running a household: purchases & billing,
health & medicine tracking, vehicle management, home finances, and a family journal.

## Features

- **Purchases & billing** — daily catalog purchases, advance payments, bill generation,
  payment links (UPI/PhonePe), and purchase/spend trends
- **LPG** — cylinder bookings and usage tracking
- **Health & medicine** — patients, vitals, consulting notes, medicine purchases and a
  daily medicine-giving diary
- **Vehicles** — fuel logs, service & maintenance history, trips, and document tracking
  across a small fleet
- **Home management** — appliances, recurring spends, lending/IOU tracking, electricity,
  education, and household services
- **Family journal** — shared diary, family notes, and a todo list

See [frontend/src/components/tabs/](frontend/src/components/tabs/) for the full set of
feature modules.

## Tech stack & architecture

**Backend** — Django 4.2 with Django REST Framework
([backend/milk_management/](backend/milk_management/),
[backend/purchase/](backend/purchase/)), exposing token-authenticated REST endpoints
consumed by the frontend.

**Frontend** — React 19 with React Router, Tailwind CSS, axios, `@dnd-kit` for
drag-and-drop, and `jspdf`/`html2canvas` for PDF bill generation
([frontend/src/](frontend/src/)).

**Database** — SQLite for local development; PostgreSQL in production via
`dj_database_url` / the `DATABASE_URL` environment variable.

## Deployment

The app is hosted on PythonAnywhere.

- [backend/Procfile](backend/Procfile) runs the Django app with `gunicorn`
- [backend/build.sh](backend/build.sh) installs dependencies, collects static files, and
  runs migrations
- `frontend/build/` is intentionally committed so PythonAnywhere can serve the production
  React build directly alongside the Django backend (via `whitenoise`)

### Environment variables

The backend reads its configuration from the environment
([backend/milk_management/settings.py](backend/milk_management/settings.py)):

| Variable         | Purpose                                                            |
|------------------|--------------------------------------------------------------------|
| `SECRET_KEY`     | Django secret key (required when `DEBUG=False`)                    |
| `DEBUG`          | `True`/`False` — enables/disables debug mode                       |
| `ALLOWED_HOSTS`  | Comma-separated list of allowed hostnames                          |
| `DATABASE_URL`   | Postgres connection string (falls back to local SQLite if unset)   |

CORS is configured for the deployed frontend origin in production.
