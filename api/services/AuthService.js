const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

class AuthService {
  constructor(jwtSecret) {
    this.jwtSecret = jwtSecret;
  }

  async loginUser(email, password) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error("User not found");
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        throw new Error("Invalid credentials");
      }

      const token = jwt.sign({ id: user.id }, this.jwtSecret, {
        expiresIn: "1h",
      });
      return token;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

module.exports = AuthService;
