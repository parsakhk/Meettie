import prisma from '../_lib/prisma.js';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const cookies = parse(req.headers.cookie || '');
  const token = cookies.auth_token;

  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev');
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ 
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('API Error in me.js:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message, stack: error.stack });
  }
}
