# Jahan Bastan

Jahan Bastan is a Persian travel booking and agency management platform. Travelers can search tours and hotels, save passenger details, and submit bookings. Agency staff maintain catalogs, import pricing from Excel, and manage bookings and agency credit.

## Explore the code

| Area | Implementation |
| --- | --- |
| Traveler and staff interfaces | [Next.js pages](frontend/src/app/) and [React components](frontend/src/components/) for right-to-left booking and administration workflows |
| Booking and pricing | [FastAPI services](backend/app/services/) for checkout, multi-currency pricing, spreadsheet imports, and Persian PDF generation |
| Data model | [SQLAlchemy models](backend/app/models/) and [Alembic migrations](backend/migrations/) for PostgreSQL |
| Configuration | [Application settings](backend/app/core/config.py) define the environment variables used by the API and optional integrations |

## Public source edition

This repository contains an independently versioned snapshot of the application source. The production installation also uses private operational configuration, media, and document templates. Supply your own assets and provider settings when adapting the code. The dependency manifests are in [backend/pyproject.toml](backend/pyproject.toml) and [frontend/package.json](frontend/package.json).
