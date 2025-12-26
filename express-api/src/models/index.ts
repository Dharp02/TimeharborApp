import sequelize from '../config/sequelize';
import User from './User';
import RefreshToken from './RefreshToken';

// Export all models
export {
  User,
  RefreshToken
};

// Export sequelize instance
export default sequelize;
