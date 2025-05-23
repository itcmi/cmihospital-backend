const { sequelize } = require("../src/config/database");

// Setup test database
beforeAll(async () => {
  await sequelize.sync({ force: true });
});

// Cleanup after tests
afterAll(async () => {
  await sequelize.close();
});

// Reset database before each test
beforeEach(async () => {
  // Clear all tables
  const models = Object.values(sequelize.models);
  for (const model of models) {
    await model.destroy({ where: {}, force: true });
  }
});
