'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('activity_logs');
    if (!tableDescription.link) {
      await queryInterface.addColumn('activity_logs', 'link', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('activity_logs', 'link');
  }
};
