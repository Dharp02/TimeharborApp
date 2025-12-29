import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import User from './User';
import Team from './Team';

interface MemberAttributes {
  id: string;
  userId: string;
  teamId: string;
  role: 'Leader' | 'Member';
  joinedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MemberCreationAttributes extends Optional<MemberAttributes, 'id' | 'joinedAt' | 'createdAt' | 'updatedAt'> {}

class Member extends Model<MemberAttributes, MemberCreationAttributes> implements MemberAttributes {
  public id!: string;
  public userId!: string;
  public teamId!: string;
  public role!: 'Leader' | 'Member';
  public readonly joinedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Member.init(
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
      allowNull: false,
      references: {
        model: Team,
        key: 'id',
      },
    },
    role: {
      type: DataTypes.ENUM('Leader', 'Member'),
      defaultValue: 'Member',
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'members',
    indexes: [
      {
        unique: true,
        fields: ['userId', 'teamId'],
      },
    ],
  }
);

export default Member;
