module.exports = {
  apps: [
    {
      name: 'timeharbor-frontend',
      cwd: '/home/pdharamkar/TimeharborApp/timeharbourapp',
      script: 'node_modules/.bin/next',
      args: 'start -p 80 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=8192',
      },
    },
    {
      name: 'timeharbor-backend',
      cwd: '/home/pdharamkar/TimeharborApp/timeharbor-timehuddle-backend/apps/api',
      script: 'node',
      args: 'dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
    {
      name: 'timeharbor-proxy',
      cwd: '/home/pdharamkar/TimeharborApp/timeharbor-proxy',
      script: 'index.js',
      env: {
        PORT: 80,
      },
    },
  ],
};
