import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';

export interface NotificationAttributes {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data: any;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationCreationAttributes
  extends Optional<NotificationAttributes, 'id' | 'type' | 'data' | 'readAt' | 'createdAt' | 'updatedAt'> {}

class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  public id!: string;
  public userId!: string;
  public title!: string;
  public body!: string;
  public type!: string;
  public data!: any;
  public readAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: 'info',
    },
    data: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    modelName: 'notification',
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
  }
);

export default Notification;
