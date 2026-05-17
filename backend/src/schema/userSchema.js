
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      firstName: { type: String, required: true, minlength: 3 },
      lastName: { type: String },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      minlength: 5,
      lowercase: true,
    },
    phone: { type: String },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    otp: {
      code: String,
      expiresAt: Date,
    },
    verified: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: "File" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.generateJwtToken = function () {
  return jwt.sign({ userId: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
  });
};

userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  return otp;
};

userSchema.methods.verifyOTP = function (code) {
  if (!this.otp?.code) return false;
  const valid = this.otp.code === code && this.otp.expiresAt > new Date();
  if (valid) this.otp = undefined;
  return valid;
};

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateResetPasswordToken = function () {
  const token = jwt.sign(
    { userId: this._id },
    process.env.JWT_RESET_SECRET_KEY,
    { expiresIn: "15m" }
  );
  this.resetPasswordToken = token;
  this.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  return token;
};

const User = mongoose.model("User", userSchema);
export default User;