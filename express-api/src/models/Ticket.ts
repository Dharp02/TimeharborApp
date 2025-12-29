import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import Team from './Team';
import User from './User';

interface TicketAttributes {
  id: string;
  title: string;
  description?: string;
  status: 'Open' | 'In Progress' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  link?: string;
  teamId: string;
  createdBy: string;
  assignedTo?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TicketCreationAttributes extends Optional<TicketAttributes, 'id' | 'description' | 'status' | 'priority' | 'link' | 'assignedTo' | 'createdAt' | 'updatedAt'> {}

class Ticket extends Model<TicketAttributes, TicketCreationAttributes> implements TicketAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public status!: 'Open' | 'In Progress' | 'Closed';
  public priority!: 'Low' | 'Medium' | 'High';
  public link?: string;
  public teamId!: string;
  public createdBy!: string;
  public assignedTo?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Ticket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Open', 'In Progress', 'Closed'),
      defaultValue: 'Open',
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('Low', 'Medium', 'High'),
      defaultValue: 'Medium',
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    teamId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Team,
        key: 'id',
      },
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    assignedTo: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'tickets',
  }
);

export default Ticket;
