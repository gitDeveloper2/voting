import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase } from './mongodb';
import { compare } from 'bcryptjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔐 Auth attempt:', { email: credentials?.email, hasPassword: !!credentials?.password });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          throw new Error('Email and password are required');
        }

        try {
          const { db } = await connectToDatabase();
          console.log('✅ Database connected');
          
          const user = await db.collection('user').findOne({ 
            email: credentials.email 
          });
          console.log('👤 User lookup:', { 
            found: !!user, 
            email: credentials.email,
            searchQuery: { email: credentials.email },
            userResult: user ? { id: user._id, email: user.email, role: user.role } : null
          });
          
          // Also try to see what users exist in the collection
          const allUsers = await db.collection('user').find({}).limit(5).toArray();
          console.log('📋 Available users in collection:', allUsers.map(u => ({ email: u.email, role: u.role })));

          // First check: User must exist in database
          if (!user) {
            console.log('❌ User not found in database');
            throw new Error('User not found');
          }

          // Second check: Password must match ADMIN_PASSWORD from env
          const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
          console.log('🔑 Password check:', { hasEnvPassword: !!ADMIN_PASSWORD, inputPassword: credentials.password });
          
          if (!ADMIN_PASSWORD) {
            console.log('❌ ADMIN_PASSWORD not set in environment');
            throw new Error('Admin password not configured');
          }
          
          if (credentials.password !== ADMIN_PASSWORD) {
            console.log('❌ Password mismatch');
            throw new Error('Invalid password');
          }

          console.log('✅ Authentication successful');
          
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role || 'user',
          };
        } catch (error) {
          console.log('💥 Auth error:', error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

export async function auth() {
  return await getServerSession(authOptions);
}
