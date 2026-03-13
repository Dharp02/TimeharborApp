'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [results] = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.ticket_pulse_attachments');"
    );
    if (results[0].to_regclass) return; // idempotent

    await queryInterface.createTable('ticket_pulse_attachments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      ticketId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tickets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      requestedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      draftId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'uploaded', 'failed', 'expired'),
        allowNull: false,
        defaultValue: 'pending',
      },
      watchUrl: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      thumbnailUrl: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      title: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      uploadedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('ticket_pulse_attachments', ['ticketId'],
      { name: 'pulse_attachments_ticket_id' });
    await queryInterface.addIndex('ticket_pulse_attachments', ['teamId'],
      { name: 'pulse_attachments_team_id' });
    await queryInterface.addIndex('ticket_pulse_attachments', ['status', 'expiresAt'],
      { name: 'pulse_attachments_status_expires' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ticket_pulse_attachments');
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_ticket_pulse_attachments_status;"
    );
  },
};
