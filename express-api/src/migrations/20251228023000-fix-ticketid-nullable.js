'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Explicitly alter the column to allow NULL
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
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to NOT NULL (this might fail if there are nulls, but it's the correct down migration)
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
