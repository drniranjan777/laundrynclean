# NClean

Laundry platform with doorstep pickup and delivery: a customer app, a delivery partner app, a backend API and an admin panel.

Each part lives on its own branch:

| Branch | What | Folder |
|---|---|---|
| [`user-app`](../../tree/user-app) | Customer app (Flutter, Android + iOS), id `com.tallygen.customer` | `laundry-user-app/` |
| [`driver-app`](../../tree/driver-app) | Delivery partner app (Flutter), id `com.tallygen.partner` | `laundry-driver-app/` |
| [`api-admin`](../../tree/api-admin) | Backend API (Node/Express + PostgreSQL) and admin panel (React + Vite) | `laundry-backend/`, `laundry-admin/` |

Production API: `https://tallygen.com/nclean/api/v1`. Support: support@tallygen.com.
