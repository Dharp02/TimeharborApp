'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop existing table
    await queryInterface.dropTable('work_logs');

    // Create new table
    await queryInterface.createTable('work_logs', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('CLOCK_IN', 'CLOCK_OUT', 'START_TICKET', 'STOP_TICKET'),
        allowNull: false
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      ticketId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'tickets',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      ticketTitle: {
        type: Sequelize.STRING,
        allowNull: true
      },
      comment: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('work_logs');
  }
};
