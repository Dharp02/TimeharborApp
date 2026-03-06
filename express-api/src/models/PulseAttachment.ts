import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/sequelize';

export type PulseAttachmentStatus = 'pending' | 'uploaded' | 'failed' | 'expired';

interface PulseAttachmentAttributes {
  id: string;
  ticketId: string;
  teamId: string;
  requestedBy?: string;
  draftId: string;       // TimeHarbor-generated UUID; stable key across both systems
  status: PulseAttachmentStatus;
  watchUrl?: string;     // filled by webhook / fallback poll after upload
  thumbnailUrl?: string; // filled by webhook / fallback poll after upload
  title?: string;        // filled by webhook / fallback poll after upload
  expiresAt?: Date;      // TTL — cron marks 'expired' when pending row passes this
  uploadedAt?: Date;     // timestamp set when Pulse Vault confirms the upload
  createdAt?: Date;
  updatedAt?: Date;
}

interface PulseAttachmentCreationAttributes
  extends Optional<
    PulseAttachmentAttributes,
    'id' | 'requestedBy' | 'watchUrl' | 'thumbnailUrl' | 'title' | 'expiresAt' | 'uploadedAt' | 'createdAt' | 'updatedAt'
  > {}

class PulseAttachment
  extends Model<PulseAttachmentAttributes, PulseAttachmentCreationAttributes>
  implements PulseAttachmentAttributes
{
  public id!: string;
  public ticketId!: string;
  public teamId!: string;
  public requestedBy?: string;
  public draftId!: string;
  public status!: PulseAttachmentStatus;
  public watchUrl?: string;
  public thumbnailUrl?: string;
  public title?: string;
  public expiresAt?: Date;
  public uploadedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PulseAttachment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tickets', key: 'id' },
    },
    teamId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
    },
    requestedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    draftId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'uploaded', 'failed', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    watchUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'ticket_pulse_attachments',
    modelName: 'PulseAttachment',
  }
);

export default PulseAttachment;
