'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('work_logs');
    if (!tableDefinition.teamId) {
      await queryInterface.addColumn('work_logs', 'teamId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'teams',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('work_logs', 'teamId');
  }
};
