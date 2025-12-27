import { Model, DataTypes, Optional } from 'sequelize';
import bcrypt from 'bcrypt';
import sequelize from '../config/sequelize';

// User attributes interface
export interface UserAttributes {
  id: string;
  email: string;
  password: string;
  full_name?: string;
  email_verified: boolean;
  status: 'online' | 'offline';
  reset_token?: string;
  reset_token_expiry?: Date;
  created_at?: Date;
  updated_at?: Date;
}

// Optional attributes for creation
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'email_verified' | 'created_at' | 'updated_at'> {}

// User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public password!: string;
  public full_name?: string;
  public email_verified!: boolean;
  public status!: 'online' | 'offline';
  public reset_token?: string;
  public reset_token_expiry?: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Instance method to validate password
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Instance method to generate reset token
  public async generateResetToken(): Promise<string> {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.reset_token = token;
    this.reset_token_expiry = new Date(Date.now() + 3600000); // 1 hour
    await this.save();
    return token;
  }

  // Override toJSON to exclude sensitive data
  public toJSON(): Partial<UserAttributes> {
    const values = { ...this.get() } as any;
    delete values.password;
    delete values.reset_token;
    delete values.reset_token_expiry;
    return values;
  }
}

// Initialize User model
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: 'Must be a valid email address'
        }
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: {
          args: [8, 255],
          msg: 'Password must be at least 8 characters long'
        }
      }
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
          status: {
      type: DataTypes.ENUM('online', 'offline'),
      defaultValue: 'offline',
      allowNull: false,
    },    },
    reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      // Hash password before creating user
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      // Hash password before updating if it changed
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  }
);

export default User;
