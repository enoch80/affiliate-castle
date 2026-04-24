import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const authOptions: NextAuthOptions = {
  // Force non-secure cookies when running over plain HTTP (avoids __Secure- prefix issue in production)
  ...(process.env.NEXTAUTH_URL?.startsWith('http://') && {
    cookies: {
      sessionToken: {
        name: 'next-auth.session-token',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: false },
      },
      callbackUrl: {
        name: 'next-auth.callback-url',
        options: { sameSite: 'lax' as const, path: '/', secure: false },
      },
      csrfToken: {
        name: 'next-auth.csrf-token',
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: false },
      },
    },
  }),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        // Single-owner app: validate against env vars
        const adminEmail = process.env.ADMIN_EMAIL
        const adminHash = process.env.ADMIN_PASSWORD_HASH

        if (!adminEmail || !adminHash) {
          console.error('ADMIN_EMAIL or ADMIN_PASSWORD_HASH not configured')
          return null
        }

        if (email !== adminEmail) return null

        const valid = await bcrypt.compare(password, adminHash)
        if (!valid) return null

        return { id: '1', email, name: 'Admin' }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
