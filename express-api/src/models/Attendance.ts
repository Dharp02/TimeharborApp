import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import User from './User';

interface AttendanceAttributes {
  id: string;
  userId: string;
  clockIn: Date;
  clockOut?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AttendanceCreationAttributes extends Optional<AttendanceAttributes, 'id' | 'clockOut' | 'createdAt' | 'updatedAt'> {}

class Attendance extends Model<AttendanceAttributes, AttendanceCreationAttributes> implements AttendanceAttributes {
  public id!: string;
  public userId!: string;
  public clockIn!: Date;
  public clockOut?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Attendance.init(
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
    clockIn: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    clockOut: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'attendance',
  }
);

export default Attendance;
