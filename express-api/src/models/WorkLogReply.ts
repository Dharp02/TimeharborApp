import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import User from './User';
import WorkLog from './WorkLog';

interface WorkLogReplyAttributes {
  id: string;
  workLogId: string;
  userId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WorkLogReplyCreationAttributes extends Optional<WorkLogReplyAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class WorkLogReply extends Model<WorkLogReplyAttributes, WorkLogReplyCreationAttributes> implements WorkLogReplyAttributes {
  public id!: string;
  public workLogId!: string;
  public userId!: string;
  public content!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly user?: User;
  public readonly workLog?: WorkLog;
}

WorkLogReply.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    workLogId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'work_logs',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'work_log_replies',
  }
);

export default WorkLogReply;
