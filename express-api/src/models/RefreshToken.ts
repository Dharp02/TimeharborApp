import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';
import User from './User';

// RefreshToken attributes interface
export interface RefreshTokenAttributes {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at?: Date;
  revoked: boolean;
}

// Optional attributes for creation
interface RefreshTokenCreationAttributes extends Optional<RefreshTokenAttributes, 'id' | 'created_at' | 'revoked'> {}

// RefreshToken model class
class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  public id!: string;
  public user_id!: string;
  public token!: string;
  public expires_at!: Date;
  public readonly created_at!: Date;
  public revoked!: boolean;

  // Instance method to check if token is expired
  public isExpired(): boolean {
    return this.expires_at < new Date();
  }

  // Instance method to revoke token
  public async revoke(): Promise<void> {
    this.revoked = true;
    await this.save();
  }
}

// Initialize RefreshToken model
RefreshToken.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: false
  }
);

// Define associations
RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
  as: 'refreshTokens'
});

export default RefreshToken;
