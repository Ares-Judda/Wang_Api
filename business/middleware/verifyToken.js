const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyTokenAndRefresh = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const refreshToken = req.headers['x-refresh-token']; 
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      if (!refreshToken) {
        return res.status(401).json({ error: 'Token expirado y no hay refresh token' });
      }
      try {
        const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccessToken = jwt.sign({ id: decodedRefresh.id, role: decodedRefresh.role }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN,
        });
        const newRefreshToken = jwt.sign({ id: decodedRefresh.id, role: decodedRefresh.role }, process.env.JWT_REFRESH_SECRET, {
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
        });
        res.setHeader('x-access-token', newAccessToken);
        res.setHeader('x-refresh-token', newRefreshToken);

        req.user = { id: decodedRefresh.id, role: decodedRefresh.role };
        return next();
      } catch (refreshErr) {
        return res.status(401).json({ error: 'Refresh token inválido o expirado' });
      }
    } else {
      return res.status(401).json({ error: 'Token inválido' });
    }
  }
};

module.exports = verifyTokenAndRefresh;
