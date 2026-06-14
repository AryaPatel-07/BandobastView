## Dummy credentials (local demo only)

### Web / Portal (`client/`)

- **URL**: `http://localhost:5173/`
- **Login endpoint**: `POST /api/auth/officer` (served by `server/` on `http://127.0.0.1:3001`)
- **Dummy users**:
  - **officer / officer**
  - **admin / admin123**
  - **control / control123**

### App (`app/`)

- **URL**: `http://localhost:5175/`
- **Dummy users (Buckle / PIN)**:
  - **1001 / 1111**
  - **1002 / 2222**
  - **1003 / 3333**
  - **2001 / 1234**

## Notes

- These are **not secure** and are meant only for local testing/demo.
- If you want real authentication, we can replace this with **Firebase Authentication** (email/password, phone OTP, etc.).
