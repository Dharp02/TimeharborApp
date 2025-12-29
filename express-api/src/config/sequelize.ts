import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';

// Try to load .env from current dir, or parent dir if not found
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const env = process.env.NODE_ENV || 'development';
const config = require('./database.js')[env];

export const sequelize = new Sequelize(config.url, {
  dialect: config.dialect,
  logging: config.logging,
  pool: config.pool,
  dialectOptions: config.dialectOptions
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync models in development (not recommended for production)
    if (env === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database models synchronized.');
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

export default sequelize;
