import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import prisma from './db.ts';
import { env } from './env.ts';

// Local strategy: email + password
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, { ...user, userId: user.id });
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: 'No email found in Google profile' });
        }

        // Find by googleId first, then by email
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

        if (!user) {
          // Check if a user with this email exists (signed up manually)
          user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            // Link Google account to existing user
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                avatar: profile.photos?.[0]?.value ?? user.avatar,
              },
            });
          } else {
            // Create new user from Google profile
            user = await prisma.user.create({
              data: {
                name: profile.displayName,
                email,
                googleId: profile.id,
                avatar: profile.photos?.[0]?.value,
                role: 'customer',
              },
            });
          }
        }

        return done(null, { ...user, userId: user.id });
      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;
