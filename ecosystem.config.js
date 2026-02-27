module.exports = {
  apps: [
    {
      name: "timeharbor-frontend",
      cwd: "/Users/mieloaner/mieprojects/TimeharborApp/timeharbourapp",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        NODE_OPTIONS: "--max-old-space-size=8192"
      }
    },
    {
      name: "timeharbor-backend",
      cwd: "/Users/mieloaner/mieprojects/TimeharborApp/express-api",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        NODE_OPTIONS: "--max-old-space-size=4096"
      }
    },
    {
      name: "timeharbor-proxy",
      cwd: "/Users/mieloaner/mieprojects/TimeharborApp/timeharbor-proxy",
      script: "index.js",
      env: {
        PORT: 8080
      }
    }
  ]
};
