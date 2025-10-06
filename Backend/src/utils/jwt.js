const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');


const generateAccessToken = ({ userId, organizationId, permissions }) => {
  return jwt.sign(
    { userId, organizationId, permissions },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};


const generateRefreshToken = async (userId) => {
  const token = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );


  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); 

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt
    }
  });

  return token;
};


const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) {
      return null;
    }

    return refreshToken.user;
  } catch (error) {
    return null;
  }
};


const revokeRefreshToken = async (token) => {
  try {
    await prisma.refreshToken.delete({
      where: { token }
    });
    return true;
  } catch (error) {
    return false;
  }
};


const revokeAllRefreshTokens = async (userId) => {
  try {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
    return true;
  } catch (error) {
    return false;
  }
};


const cleanupExpiredTokens = async () => {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  cleanupExpiredTokens
};
