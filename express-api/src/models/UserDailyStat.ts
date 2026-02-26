import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';

interface UserDailyStatAttributes {
  id: string;
  userId: string;
  teamId: string | null;
  date: string; // DATEONLY 'YYYY-MM-DD'
  totalMs: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserDailyStatCreationAttributes
  extends Optional<UserDailyStatAttributes, 'id' | 'teamId' | 'createdAt' | 'updatedAt'> {}

class UserDailyStat
  extends Model<UserDailyStatAttributes, UserDailyStatCreationAttributes>
  implements UserDailyStatAttributes
{
  public id!: string;
  public userId!: string;
  public teamId!: string | null;
  public date!: string;
  public totalMs!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserDailyStat.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    totalMs: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'user_daily_stats',
    indexes: [
      // Non-unique because teamId can be NULL (PG treats NULL != NULL in unique indexes)
      // Uniqueness is enforced at the application layer via findOrCreate.
      {
        fields: ['userId', 'teamId', 'date'],
        name: 'user_daily_stats_lookup_idx',
      },
      {
        fields: ['userId', 'date'],
        name: 'user_daily_stats_user_date_idx',
      },
    ],
  }
);

export default UserDailyStat;
