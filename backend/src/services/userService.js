
import User from "../schema/userSchema.js";
import bcrypt from 'bcrypt';

export const createUser = async ({ firstName, lastName, email, password, verified }) => {
  if (!firstName || !email || !password) {
    throw new Error("All fields are required");
  }
const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    fullName: { firstName, lastName },
    email,
    password, 
    verified,
  });

  await user.save();
  return user;
};
