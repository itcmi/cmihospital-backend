const request = require("supertest");
const { faker } = require("@faker-js/faker");
const app = require("../../src/app");
const User = require("../../src/models/User.model");

describe("Auth Endpoints", () => {
  describe("POST /api/v1/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.email).toBe(userData.email.toLowerCase());
      expect(response.body.data.tokens).toBeDefined();

      // Verify user was created in database
      const user = await User.findOne({ where: { email: userData.email } });
      expect(user).toBeTruthy();
    });

    it("should return validation error for invalid data", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "invalid-email",
          password: "123", // Too short
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toBeDefined();
    });

    it("should return error if user already exists", async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      // Create user first
      await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(201);

      // Try to create same user again
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe("User already exists");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      // Create test user
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      testUser = { ...userData, id: response.body.data.user.id };
    });

    it("should login user with valid credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.access).toBeDefined();
      expect(response.body.data.tokens.refresh).toBeDefined();
    });

    it("should return error for invalid email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@email.com",
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should return error for invalid password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should return validation error for missing fields", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          // Missing password
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      // Create and login test user
      await request(app).post("/api/v1/auth/register").send(userData);

      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: userData.email,
        password: userData.password,
      });

      testUser = userData;
      refreshToken = loginResponse.body.data.tokens.refresh;
    });

    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.access).toBeDefined();
      expect(response.body.data.tokens.refresh).toBeDefined();
    });

    it("should return error for invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken: "invalid-token",
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid refresh token");
    });

    it("should return validation error for missing refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    let testUser;
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      // Create and login test user
      await request(app).post("/api/v1/auth/register").send(userData);

      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: userData.email,
        password: userData.password,
      });

      testUser = userData;
      accessToken = loginResponse.body.data.tokens.access;
      refreshToken = loginResponse.body.data.tokens.refresh;
    });

    it("should logout user with valid tokens", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.message).toBe("Logged out successfully");

      // Verify tokens are invalidated
      const refreshResponse = await request(app)
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken,
        })
        .expect(401);

      expect(refreshResponse.body.error).toBe("Invalid refresh token");
    });

    it("should return error for missing authorization header", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .send({
          refreshToken,
        })
        .expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should return error for invalid access token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", "Bearer invalid-token")
        .send({
          refreshToken,
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid access token");
    });
  });

  describe("GET /api/v1/auth/profile", () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      // Create and login test user
      const registerResponse = await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: userData.email,
        password: userData.password,
      });

      testUser = { ...userData, id: registerResponse.body.data.user.id };
      accessToken = loginResponse.body.data.tokens.access;
    });

    it("should get user profile with valid access token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.user.firstName).toBe(testUser.firstName);
      expect(response.body.data.user.lastName).toBe(testUser.lastName);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it("should return error for missing authorization header", async () => {
      const response = await request(app)
        .get("/api/v1/auth/profile")
        .expect(401);

      expect(response.body.error).toBe("Access token required");
    });

    it("should return error for invalid access token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBe("Invalid access token");
    });
  });

  describe("PUT /api/v1/auth/profile", () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      const userData = {
        email: faker.internet.email(),
        password: "Test123!@#",
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      // Create and login test user
      const registerResponse = await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: userData.email,
        password: userData.password,
      });

      testUser = { ...userData, id: registerResponse.body.data.user.id };
      accessToken = loginResponse.body.data.tokens.access;
    });

    it("should update user profile with valid data", async () => {
      const updateData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      const response = await request(app)
        .put("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
    });

    it("should return validation error for invalid data", async () => {
      const response = await request(app)
        .put("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          firstName: "", // Empty string
          lastName: "A".repeat(101), // Too long
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("should return error for unauthorized access", async () => {
      const response = await request(app)
        .put("/api/v1/auth/profile")
        .send({
          firstName: faker.person.firstName(),
        })
        .expect(401);

      expect(response.body.error).toBe("Access token required");
    });
  });
});
