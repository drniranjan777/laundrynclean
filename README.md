# NClean – Backend API and admin panel

- [`laundry-backend/`](laundry-backend/): Node/Express API with PostgreSQL (Sequelize). Routes are under `/api/v1`; uploaded files are served from `/uploads`.
- [`laundry-admin/`](laundry-admin/): React + Vite + Tailwind admin panel (orders, POS, catalogue, stores, delivery boys, settings).

## Run locally
Backend (needs PostgreSQL):
```
cd laundry-backend
cp .env.example .env      # then fill in the database and secrets
npm install
npm run migrate
npm run seed
npm start                 # http://localhost:5002
```
Admin panel:
```
cd laundry-admin
npm install
npx vite                  # http://localhost:5173, forwards /api and /uploads to the backend on :5002
```

The mobile apps are on the `user-app` and `driver-app` branches.
