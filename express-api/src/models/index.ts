import sequelize from '../config/sequelize';
import User from './User';
import RefreshToken from './RefreshToken';
import Team from './Team';

// Export all models
export {
  User,
  RefreshToken,
  Team
};

// Export sequelize instance
export default sequelize;
