module.exports = {
  apps: [
    {
      name: "timeharbor-frontend",
      cwd: "/Users/mieloaner/mieprojects/TimeharborApp.worktrees/ui-ractor/timeharbourapp",
      script: "npx",
      args: "next dev -H 0.0.0.0 --experimental-https --experimental-https-cert ./10.0.0.8+2.pem --experimental-https-key ./10.0.0.8+2-key.pem",
      node_args: "--max-old-space-size=8192",
      env: {
        NODE_ENV: "development",
        PORT: 8080,
        NODE_OPTIONS: "--max-old-space-size=8192"
      }
    },
    {
      name: "timeharbor-backend",
      cwd: "/Users/mieloaner/mieprojects/TimeharborApp.worktrees/ui-ractor/timeharbor-timehuddle-backend/apps/api",
      script: "npx",
      args: "tsx src/server.ts",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        NODE_OPTIONS: "--max-old-space-size=4096"
      }
    }
  ]
};
