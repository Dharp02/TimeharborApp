'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "tickets" ALTER COLUMN "teamId" DROP NOT NULL;`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE FROM "tickets" WHERE "teamId" IS NULL;`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "tickets" ALTER COLUMN "teamId" SET NOT NULL;`
    );
  },
};
