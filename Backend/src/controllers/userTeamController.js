const { prisma } = require('../config/database');

exports.createUserTeam = async (req, res, next) => {
  try {
    const data = req.body;
    const userTeam = await prisma.userTeam.create({ data });
    res.status(201).json({ message: 'User team created successfully', userTeam });
  } catch (error) {
    next(error);
  }
};

exports.getUserTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userTeam = await prisma.userTeam.findUnique({ where: { id } });
    if (!userTeam) return res.status(404).json({ error: 'User team not found' });
    res.json({ userTeam });
  } catch (error) {
    next(error);
  }
};

exports.getUserTeams = async (req, res, next) => {
  try {
    const userTeams = await prisma.userTeam.findMany();
    res.json({ userTeams });
  } catch (error) {
    next(error);
  }
};

exports.updateUserTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userTeam = await prisma.userTeam.update({ where: { id }, data });
    res.json({ message: 'User team updated successfully', userTeam });
  } catch (error) {
    next(error);
  }
};

exports.deleteUserTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.userTeam.delete({ where: { id } });
    res.json({ message: 'User team deleted successfully' });
  } catch (error) {
    next(error);
  }
}; 