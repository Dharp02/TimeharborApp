'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.github_url) {
      await queryInterface.addColumn('users', 'github_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table.linkedin_url) {
      await queryInterface.addColumn('users', 'linkedin_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table.redmine_url) {
      await queryInterface.addColumn('users', 'redmine_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'github_url');
    await queryInterface.removeColumn('users', 'linkedin_url');
    await queryInterface.removeColumn('users', 'redmine_url');
  },
};
