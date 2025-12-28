'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add ticketTitle column
    await queryInterface.addColumn('work_logs', 'ticketTitle', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 2. Remove attendanceId column
    // Note: If there's a foreign key constraint, it should be removed first.
    // Sequelize usually names it work_logs_attendanceId_fkey
    try {
      await queryInterface.removeConstraint('work_logs', 'work_logs_attendanceId_fkey');
    } catch (error) {
      console.warn('Could not remove constraint work_logs_attendanceId_fkey:', error.message);
    }
    await queryInterface.removeColumn('work_logs', 'attendanceId');

    // 3. Change ticketId to be nullable and SET NULL on delete
    try {
      await queryInterface.removeConstraint('work_logs', 'work_logs_ticketId_fkey');
    } catch (error) {
      console.warn('Could not remove constraint work_logs_ticketId_fkey:', error.message);
    }

    await queryInterface.changeColumn('work_logs', 'ticketId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'tickets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 4. Drop attendance table
    await queryInterface.dropTable('attendance');
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Recreate attendance table
    await queryInterface.createTable('attendance', {
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
      clockIn: {
        type: Sequelize.DATE,
        allowNull: false
      },
      clockOut: {
        type: Sequelize.DATE,
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

    // 2. Revert work_logs changes
    await queryInterface.addColumn('work_logs', 'attendanceId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'attendance',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.removeColumn('work_logs', 'ticketTitle');

    // Revert ticketId to NOT NULL and CASCADE
    // Note: This might fail if there are now null ticketIds in the table.
    // We would technically need to delete those rows or assign a dummy ticket.
    // For now, we'll just try to revert the schema definition.
    try {
        await queryInterface.removeConstraint('work_logs', 'work_logs_ticketId_fkey');
    } catch (e) {}

    await queryInterface.changeColumn('work_logs', 'ticketId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'tickets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
