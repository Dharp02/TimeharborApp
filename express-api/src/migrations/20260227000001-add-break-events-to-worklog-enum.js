'use strict';

/** Adds BREAK_START and BREAK_END to the work_logs."type" ENUM in PostgreSQL. */
module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL requires separate ALTER TYPE statements for each new enum value.
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_work_logs_type" ADD VALUE IF NOT EXISTS 'BREAK_START';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_work_logs_type" ADD VALUE IF NOT EXISTS 'BREAK_END';`
    );
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL does not support removing enum values natively.
    // Reversing this migration would require recreating the type, which is risky.
    // Leave as a no-op — the extra values won't break anything if unused.
  },
};
