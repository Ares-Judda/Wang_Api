const { response } = require('express');
const { pool, poolConnect, sql } = require('../../business/models/database');
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const { get } = require('http');
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^[a-zA-Z0-9!@#$%^&*]{6,}$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '¡Error! El formato del correo electrónico es inválido' });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: '¡Error! La contraseña debe tener al menos 6 caracteres y solo contener letras, números o símbolos !@#$%^&*' });
  }

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

const validateChangePasswordInput = (email, newPassword, confirmPassword) => {
  if (!email || !newPassword || !confirmPassword) {
    return { valid: false, error: '¡Error! ¡Hay campos vacíos! Complételos para continuar' };
  }

  const passwordRegex = /^[a-zA-Z0-9!@#$%^&*]{6,}$/;
  if (!passwordRegex.test(newPassword)) {
    return { valid: false, error: '¡Error! ¡Hay caracteres erróneos! Cámbielos para continuar' };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'Las contraseñas no coinciden' };
  }

  return { valid: true };
};

const changePassword = async (req, res = response) => {
  const { email, newPassword, confirmPassword } = req.body;

  const validation = validateChangePasswordInput(email, newPassword, confirmPassword);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.VarChar(100), email);
    const result = await request.query('SELECT AccountID FROM Accounts WHERE Email = @Email');
    const account = result.recordset[0];

    if (!account) {
      return res.status(404).json({ error: 'Correo no encontrado en la base de datos' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateRequest = pool.request();
    updateRequest.input('AccountID', sql.UniqueIdentifier, account.AccountID);
    updateRequest.input('Password', sql.NVarChar(255), hashedPassword);
    await updateRequest.query(`
      UPDATE Accounts SET Password = @Password WHERE AccountID = @AccountID
    `);

    return res.status(200).json({ message: '¡Se ha actualizado la contraseña del Usuario correctamente!' });

  } catch (error) {
    console.error('Error en changePassword:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAllUsers = async (req, res = response) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT 
        u.UserID, u.FullName, u.Phone, u.Address, u.ProfileImageUrl,
        a.Email, a.Role
      FROM Users u
      INNER JOIN Accounts a ON u.AccountID = a.AccountID
    `);

    return res.status(200).json({ users: result.recordset });

  } catch (error) {
    console.error('Error en getAllUsers:', error);
    return res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
};


const getUserProfile = async (req, res = response) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ error: 'Se requiere el correo electrónico' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '¡Error! El formato del correo electrónico es inválido' });
  }

  try {
    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.VarChar(100), email);

    const result = await request.query(`
      SELECT 
        u.UserID, u.FullName, u.Phone, u.Address, u.ProfileImageUrl,
        a.Email, a.Role
      FROM Users u
      INNER JOIN Accounts a ON u.AccountID = a.AccountID
      WHERE a.Email = @Email
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ user: result.recordset[0] });

  } catch (error) {
    console.error('Error en getUserProfile:', error);
    return res.status(500).json({ error: 'Error al obtener perfil del usuario' });
  }
};

module.exports = {
  registerUser,
  changePassword,
  getAllUsers,
  getUserProfile,
};