const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema/schema");
const mongoose = require("mongoose");
const passport = require("passport");
const passportJWT = require("passport-jwt");
const jwtSecret = "secret-key";
const jwtExtractor = passportJWT.ExtractJwt;
const User = require("./models/user");

const app = express();

const jwtOptions = {
  jwtFromRequest: jwtExtractor.fromAuthHeaderAsBearerToken(),
  secretOrKey: jwtSecret,
};

passport.use(
  new passportJWT.Strategy(jwtOptions, async (jwtPayload, done) => {
    try {
      const user = await User.findById(jwtPayload.id);

      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (error) {
      console.log(error.message);
      return done(error, false);
    }
  })
);
const authenticateUser = passport.authenticate("jwt", { session: false });

app.use(passport.initialize());
app.use(
  "/graph",
  graphqlHTTP(() => ({
    schema,
    graphiql: true,
  }))
);

app.use(
  "/graphql",
  authenticateUser,
  graphqlHTTP((req) => ({
    schema,
    graphiql: true,
    context: { user: req.user },
  }))
);

const uri = "mongodb://127.0.0.1:27017/graphqltesting";

mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("connected to mongodb");
    app.listen(5000, () => {
      console.log("server started on port 5000");
    });
  })
  .catch((err) => {
    console.log(err);
  });
