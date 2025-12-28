import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import User from './User';
import Ticket from './Ticket';
import Attendance from './Attendance';

interface WorkLogAttributes {
  id: string;
  userId: string;
  ticketId: string;
  attendanceId?: string;
  startTime: Date;
  endTime?: Date;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WorkLogCreationAttributes extends Optional<WorkLogAttributes, 'id' | 'attendanceId' | 'endTime' | 'description' | 'createdAt' | 'updatedAt'> {}

class WorkLog extends Model<WorkLogAttributes, WorkLogCreationAttributes> implements WorkLogAttributes {
  public id!: string;
  public userId!: string;
  public ticketId!: string;
  public attendanceId?: string;
  public startTime!: Date;
  public endTime?: Date;
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WorkLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Ticket,
        key: 'id',
      },
    },
    attendanceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Attendance,
        key: 'id',
      },
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'work_logs',
  }
);

export default WorkLog;
