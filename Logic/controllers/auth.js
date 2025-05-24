const { response } = require('express');
const { pool, poolConnect, sql } = require('../../business/models/database');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const generateTokens = (payload) => ({
  accessToken: jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  }),
  refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  }),
});

const login = async (req, res = response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    await poolConnect;
    const request = pool.request();
    request.input('Email', sql.VarChar(100), email);
    const query = "SELECT * FROM Accounts WHERE Email = @Email AND IsActive = 1";
    const result = await request.query(query);
    const user = result.recordset[0];
    if (!user) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
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

  if (!refreshToken) {
    return res.status(401).json({ error: 'Token de refresco requerido' });
  }

  try {
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token inválido' });
      }

      const newTokens = generateTokens({ id: user.id, role: user.role });
      return res.json(newTokens);
    });
  } catch (error) {
    console.error('Error en refreshToken:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  refreshToken,
};
