
import User from "../schema/userSchema.js";


export const createUser = async ({ firstName, lastName, email, password }) => {
  if (!firstName || !email || !password) {
    throw new Error("All fields are required");
  }

  const user = new User({
    fullName: { firstName, lastName },
    email,
    password, 
    verified,
  });

  await user.save();
  return user;
};
