import sequelize from '../config/sequelize';
import User from './User';
import RefreshToken from './RefreshToken';
import Team from './Team';
import Member from './Member';

// Define associations
User.hasMany(Member, { foreignKey: 'userId', as: 'memberships' });
Member.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Team.hasMany(Member, { foreignKey: 'teamId', as: 'members' });
Member.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

User.belongsToMany(Team, { through: Member, foreignKey: 'userId', as: 'teams' });
Team.belongsToMany(User, { through: Member, foreignKey: 'teamId', as: 'users' });

// Export all models
export {
  User,
  RefreshToken,
  Team,
  Member
};

// Export sequelize instance
export default sequelize;
