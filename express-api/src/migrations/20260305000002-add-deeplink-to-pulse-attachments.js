'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket_pulse_attachments', 'deeplink', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('ticket_pulse_attachments', 'qrData', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ticket_pulse_attachments', 'deeplink');
    await queryInterface.removeColumn('ticket_pulse_attachments', 'qrData');
  },
};
