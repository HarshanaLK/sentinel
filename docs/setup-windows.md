# Windows / VS Code setup (without Docker)

1. Install Node.js 22+, PostgreSQL, Python 3.10–3.13, and VS Code.
2. Create `sentinel` PostgreSQL user/database as shown in the root README.
3. Copy the three `.env.example` files.
4. Run `npm install` at the repository root.
5. Run `powershell -ExecutionPolicy Bypass -File .\scripts\setup-ml.ps1`.
6. Run `.\scripts\db-migrate.ps1`, then `npm run seed -w @sentinel/api`.
7. Use **Terminal → Run Task** in VS Code and start API, Worker, ML, and Web.
8. Open `http://localhost:3000` and sign in with the seeded account.

If TensorFlow installation is large, that is expected: the Windows wheel is several hundred MB. The anomaly service falls back to robust MAD scoring if you have not trained a model yet, but TensorFlow still needs to be installed because the service imports the training/model code.
