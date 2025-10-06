const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();


passport.serializeUser((user, done) => {
  done(null, user.id);
});


passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});


if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await prisma.user.findUnique({
        where: { googleId: profile.id }
      });

      if (user) {
        return done(null, user);
      }

      user = await prisma.user.findUnique({
        where: { email: profile.emails[0].value }
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.id,
            avatar: profile.photos[0]?.value || user.avatar,
            emailVerified: true,
            emailVerifiedAt: new Date()
          }
        });
        return done(null, user);
      }

      user = await prisma.user.create({
        data: {
          email: profile.emails[0].value,
          googleId: profile.id,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          avatar: profile.photos[0]?.value,
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
}


if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {

      let user = await prisma.user.findUnique({
        where: { githubId: profile.id }
      });

      if (user) {
        return done(null, user);
      }


      const email = profile.emails?.[0]?.value;
      if (email) {
        user = await prisma.user.findUnique({
          where: { email }
        });

        if (user) {

          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              githubId: profile.id,
              avatar: profile.photos[0]?.value || user.avatar,
              emailVerified: true,
              emailVerifiedAt: new Date()
            }
          });
          return done(null, user);
        }
      }


      user = await prisma.user.create({
        data: {
          email: email || `${profile.username}@github.local`,
          githubId: profile.id,
          firstName: profile.displayName?.split(' ')[0] || profile.username,
          lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
          avatar: profile.photos[0]?.value,
          emailVerified: !!email,
          emailVerifiedAt: email ? new Date() : null
        }
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
}


passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (user && user.isActive) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));

module.exports = passport;
