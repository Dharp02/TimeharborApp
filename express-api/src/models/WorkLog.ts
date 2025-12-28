import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import User from './User';
import Team from './Team';
import Ticket from './Ticket';

export type TimeEventType = 'CLOCK_IN' | 'CLOCK_OUT' | 'START_TICKET' | 'STOP_TICKET';

interface WorkLogAttributes {
  id: string;
  userId: string;
  type: TimeEventType;
  timestamp: Date;
  ticketId: string | null;
  teamId?: string | null;
  ticketTitle?: string | null;
  comment?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WorkLogCreationAttributes extends Optional<WorkLogAttributes, 'id' | 'ticketId' | 'teamId' | 'ticketTitle' | 'comment' | 'createdAt' | 'updatedAt'> {}

class WorkLog extends Model<WorkLogAttributes, WorkLogCreationAttributes> implements WorkLogAttributes {
  public id!: string;
  public userId!: string;
  public type!: TimeEventType;
  public timestamp!: Date;
  public ticketId!: string | null;
  public teamId?: string | null;
  public ticketTitle?: string | null;
  public comment?: string | null;
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
    teamId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Team,
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('CLOCK_IN', 'CLOCK_OUT', 'START_TICKET', 'STOP_TICKET'),
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Ticket,
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },
    ticketTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    comment: {
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
