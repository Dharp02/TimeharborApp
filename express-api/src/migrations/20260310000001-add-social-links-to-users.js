'use strict';

const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');

    if (!tableDescription.github) {
      await queryInterface.addColumn('users', 'github', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
    if (!tableDescription.linkedin) {
      await queryInterface.addColumn('users', 'linkedin', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'github');
    await queryInterface.removeColumn('users', 'linkedin');
  }
};
