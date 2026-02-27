'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.changeColumn('tickets', 'link', {
       type: Sequelize.TEXT,
       allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.changeColumn('tickets', 'link', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  }
};
