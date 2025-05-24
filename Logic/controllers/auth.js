const { response } = require('express');
const { pool, poolConnect, sql } = require('../../business/models/database');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
require("dotenv").config();

const generateTokens = (payload) => ({
  accessToken: jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  }),
  refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  }),
});

const emailExists = async (email) => {
  await poolConnect;
  const request = pool.request();
  request.input('Email', sql.VarChar(100), email);
  const result = await request.query('SELECT 1 FROM Accounts WHERE Email = @Email');
  return result.recordset.length > 0;
};


const usernameExists = async (userName) => {
  await poolConnect;
  const request = pool.request();
  request.input('UserName', sql.VarChar(100), userName);
  const result = await request.query('SELECT 1 FROM Users WHERE FullName = @UserName');
  return result.recordset.length > 0;
};

const createAccount = async (transaction, accountId, email, hashedPassword, role) => {
  const request = new sql.Request(transaction);
  request.input('AccountID', sql.UniqueIdentifier, accountId);
  request.input('Email', sql.NVarChar(100), email);
  request.input('Password', sql.NVarChar(255), hashedPassword);
  request.input('Role', sql.NVarChar(20), role || 'user');
  await request.query(`
    INSERT INTO Accounts (AccountID, Email, Password, Role)
    VALUES (@AccountID, @Email, @Password, @Role)
  `);
};

const createUser = async (transaction, userId, accountId, fullName, phone, address, profileImageUrl) => {
  const request = new sql.Request(transaction);
  request.input('UserID', sql.UniqueIdentifier, userId);
  request.input('AccountID', sql.UniqueIdentifier, accountId);
  request.input('FullName', sql.NVarChar(100), fullName);
  request.input('Phone', sql.NVarChar(20), phone || null);
  request.input('Address', sql.NVarChar(255), address || null);
  request.input('ProfileImageUrl', sql.NVarChar(255), profileImageUrl || null);
  await request.query(`
    INSERT INTO Users (UserID, AccountID, FullName, Phone, Address, ProfileImageUrl)
    VALUES (@UserID, @AccountID, @FullName, @Phone, @Address, @ProfileImageUrl)
  `);
};

const getUserByEmail = async (email) => {
  await poolConnect;
  const request = pool.request();
  request.input('Email', sql.VarChar(100), email);
  const query = "SELECT * FROM Accounts WHERE Email = @Email AND IsActive = 1";
  const result = await request.query(query);
  return result.recordset[0];
};


const verifyAndRefreshToken = (refreshToken, callback) => {
  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, callback);
};

const login = async (req, res = response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) return res.status(400).json({ error: 'Credenciales inválidas' });

    const payload = { id: user.AccountID, role: user.Role };
    const tokens = generateTokens(payload);
    return res.json(tokens);

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const refreshToken = (req, res = response) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ error: 'Token de refresco requerido' });

  try {
    verifyAndRefreshToken(refreshToken, (err, user) => {
      if (err) return res.status(403).json({ error: 'Token inválido' });

      const newTokens = generateTokens({ id: user.id, role: user.role });
      return res.json(newTokens);
    });
  } catch (error) {
    console.error('Error en refreshToken:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const registerUser = async (req, res = response) => {
  const { email, password, role, name, lastname, userName, phone, address } = req.body;
  const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!email || !password || !name || !lastname || !userName)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    if (await emailExists(email))
      return res.status(400).json({ error: 'El correo ya está registrado' });

    if (await usernameExists(userName))
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const accountId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    await createAccount(transaction, accountId, email, hashedPassword, role);
    await createUser(transaction, userId, accountId, `${name} ${lastname}`, phone, address, profileImageUrl);

    await transaction.commit();

    return res.status(201).json({ message: 'Usuario registrado exitosamente' });

  } catch (error) {
    console.error('Error en registerUser:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  refreshToken,
  registerUser,
};
