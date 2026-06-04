// PM2 Ecosystem Config — Ungaludan Sarath
//
// Single-process deployment: the Node API server (artifacts/api-server) also
// serves the built frontend (artifacts/logesh-connect/dist/public), so ONE
// process serves both the website and the /api routes on PORT (5500).
//
// Usage (from the repo root on the VPS):
//   bash deploy.sh            # builds everything + (re)starts via PM2
//   -- or manually --
//   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
//
// Secrets are read from the environment (loaded by deploy.sh from a gitignored
// .env file) — NOTHING sensitive is hard-coded here, so this file is safe to
// commit. Copy .env.example to .env on the server and fill in real values.

const REPO_DIR =
  "/home/ungaludansarath/htdocs/ungaludansarath.tamilagavetrikalagam.com";

module.exports = {
  apps: [
    {
      name: "ungaludan-sarath",
      // Run from the api-server package dir so ./uploads and
      // ../../attached_assets resolve the same way they do in development.
      cwd: `${REPO_DIR}/artifacts/api-server`,
      script: "./dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "5500",
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        // Optional — only needed if you wire up social OAuth one-click connect.
        OAUTH_REDIRECT_BASE_URL:
          process.env.OAUTH_REDIRECT_BASE_URL ||
          "https://ungaludansarath.tamilagavetrikalagam.com",
        FB_APP_ID: process.env.FB_APP_ID,
        FB_APP_SECRET: process.env.FB_APP_SECRET,
        TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      out_file: `${REPO_DIR}/logs/api-out.log`,
      error_file: `${REPO_DIR}/logs/api-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
