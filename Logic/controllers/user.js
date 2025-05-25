const { response } = require('express');
const { pool, poolConnect, sql } = require('../../business/models/database');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
require("dotenv").config();


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
  registerUser,
};