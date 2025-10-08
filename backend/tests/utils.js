import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../src/app.js';
import User from '../src/models/User.js';

export const createUser = async ({
  username,
  email,
  password,
  role = 'user',
  isActive = true
}) => {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({
    username,
    email: email.toLowerCase(),
    passwordHash,
    passwordChangedAt: new Date(),
    role,
    isActive
  });
};

export const loginUser = async ({ usernameOrEmail, password }) => {
  const response = await request(app).post('/api/auth/login').send({ usernameOrEmail, password });
  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}: ${response.body?.message}`);
  }
  return response.body;
};

const uniqueValue = () => Math.random().toString(36).slice(2, 10);

export const authenticateAsAdmin = async () => {
  const adminUsername = `admin_${uniqueValue()}`;
  const adminPassword = 'SuperSecret123!';
  const adminEmail = `${adminUsername}@example.com`;

  await createUser({
    username: adminUsername,
    email: adminEmail,
    password: adminPassword,
    role: 'admin'
  });

  return loginUser({ usernameOrEmail: adminUsername, password: adminPassword });
};

export const authenticateAsUser = async () => {
  const username = `user_${uniqueValue()}`;
  const password = 'StrongPass123!';
  const email = `${username}@example.com`;

  await createUser({ username, email, password });

  return loginUser({ usernameOrEmail: username, password });
};

export const authHeader = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });
