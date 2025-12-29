'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Use raw SQL to force the column to be nullable
    await queryInterface.sequelize.query('ALTER TABLE "work_logs" ALTER COLUMN "ticketId" DROP NOT NULL;');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to NOT NULL
    await queryInterface.sequelize.query('ALTER TABLE "work_logs" ALTER COLUMN "ticketId" SET NOT NULL;');
  }
};
