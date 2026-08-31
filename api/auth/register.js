import prisma from '../_lib/prisma.js';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { firstName, lastName, username, email, password } = req.body;
  if (!firstName || !lastName || !username || !email || !password) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomUUID();

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        username,
        email,
        passwordHash,
        verificationToken
      }
    });

    // Send verification email
    const verifyUrl = `${process.env.VITE_APP_URL || 'http://localhost:5173'}/verify?token=${verificationToken}`;
    
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Meettie <onboarding@resend.dev>',
        to: email,
        subject: 'Verify your Meettie email',
        html: `<p>Hi ${firstName},</p><p>Click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
      });
    } else {
      console.log('No RESEND_API_KEY found. Verification URL:', verifyUrl);
    }

    return res.status(200).json({ message: 'User created. Please verify your email.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
