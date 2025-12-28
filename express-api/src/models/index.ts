import sequelize from '../config/sequelize';
import User from './User';
import RefreshToken from './RefreshToken';
import Team from './Team';
import Member from './Member';
import Ticket from './Ticket';

// Define associations
User.hasMany(Member, { foreignKey: 'userId', as: 'memberships' });
Member.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Team.hasMany(Member, { foreignKey: 'teamId', as: 'members' });
Member.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

User.belongsToMany(Team, { through: Member, foreignKey: 'userId', as: 'teams' });
Team.belongsToMany(User, { through: Member, foreignKey: 'teamId', as: 'users' });

Team.hasMany(Ticket, { foreignKey: 'teamId', as: 'tickets' });
Ticket.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

User.hasMany(Ticket, { foreignKey: 'createdBy', as: 'createdTickets' });
Ticket.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Ticket, { foreignKey: 'assignedTo', as: 'assignedTickets' });
Ticket.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

// Export all models
export {
  User,
  RefreshToken,
  Team,
  Member,
  Ticket
};

// Export sequelize instance
export default sequelize;
