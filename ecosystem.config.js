module.exports = {
  apps: [
    {
      name: "timeharbor-frontend",
      cwd: "/home/dharapoonam/TimeharborApp/timeharbourapp",
      script: "node_modules/.bin/serve",
      args: "out -p 3000",
      env: {
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production"
      }
    },
    {
      name: "timeharbor-backend",
      cwd: "/home/dharapoonam/TimeharborApp/express-api",
      script: "dist/index.js",
      env: {
        PORT: 3001,
        NODE_ENV: "production"
      }
    },
    {
      name: "timeharbor-proxy",
      cwd: "/home/dharapoonam/TimeharborApp/timeharbor-proxy",
      script: "index.js",
      env: {
        PORT: 80
      }
    }
  ]
};
