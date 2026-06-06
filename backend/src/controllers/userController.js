import { sendEmail } from "../utilities/sendEmail.js";
import User from '../schema/userSchema.js'; 
import { createUser } from '../services/userService.js'; 
import { validationResult } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res, next) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, given_name, family_name, sub } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      // Auto register by google
      user = new User({
        fullName: { firstName: given_name, lastName: family_name || '' },
        email,
        password: sub + process.env.JWT_SECRET_KEY, 
        verified: true,
      });
      await user.save();
    }

    const jwtToken = user.generateJwtToken();
    res.status(200).json({ token: jwtToken, user });
  } catch (err) {
    next(err);
  }
};

export const registerUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, email, password } = req.body;
    const { firstName, lastName } = fullName; 

const alreadyUser = await User.findOne({ email })
if(!alreadyUser){

  const user = await createUser({ 
  firstName, 
  lastName, 
  email: email.toLowerCase(),  
  password,
   verified: true,
});
  return res.status(201).json({ message: "User registered successfully", user });
  const token = user.generateJwtToken();
  res.status(201).json({ token, user });
} else{
  res.status(409).json({message:'Email Already Exists'});
}
    
  
  } catch (err) {
    next(err);
  }
};




export const loginUser = async (req, res, next) => {
  try {

    console.log("Login attempt:", req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

  
const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    console.log("User found:", user ? "yes" : "no");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

  
    const token = user.generateJwtToken();

    user.password = undefined;

    res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    next(error); 
  }
};





export const sendRegistrationOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    let user = await User.findOne({ email });

    if (user && user.verified)
      return res.status(400).json({ message: "Email already registered" });


    if (!user) {
      user = new User({
        email,
        fullName: { firstName: "temp" }, 
        password: "temp123456", 
      });
    }

    const otp = user.generateOTP();
    await user.save();

    await sendEmail(
      email,
      "Your OTP Code",
      `Your OTP for verification is ${otp}. It will expire in 10 minutes.`
    );

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const verifyOtpAndRegister = async (req, res) => {
  try {
    const { email, otp, firstName, lastName, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = user.verifyOTP(otp);
    if (!isValid) return res.status(400).json({ message: "Invalid or expired OTP" });


    user.fullName = { firstName, lastName };
    user.password = password;
    user.verified = true;
    await user.save();

    const token = user.generateJwtToken();
    res.status(200).json({ message: "Registration successful", token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = user.generateOTP();
    await user.save();

    await sendEmail(
      email,
      "Reset Password OTP",
      `Your OTP for password reset is ${otp}. It will expire in 10 minutes.`
    );

    res.status(200).json({ message: "OTP sent successfully for password reset" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = user.verifyOTP(otp);
    if (!isValid) return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
