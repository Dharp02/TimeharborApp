import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/sequelize';

export class ActivityLog extends Model {
  public id!: string;
  public activityId!: string;
  public teamId!: string;
  public userId!: string;
  public type!: string;
  public title!: string;
  public subtitle?: string;
  public description?: string;
  public status?: string;
  public startTime!: Date;
  public endTime?: Date;
  public duration?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ActivityLog.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // Allow null for legacy data or system events
    references: {
      model: 'users',
      key: 'id'
    }
  },
  activityId: {
    type: DataTypes.STRING, // Should match frontend generated ID
    allowNull: false,
    unique: true
  },
  teamId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subtitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  duration: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'ActivityLog',
  tableName: 'activity_logs',
  indexes: [
    {
      name: 'idx_activity_logs_team_uuid',
      fields: ['teamId'],
    },
    {
      name: 'idx_activity_logs_start_time_v2',
      fields: ['startTime'],
    },
  ],
});
