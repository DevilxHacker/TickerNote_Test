import express from "express";
const router = express.Router();
import { body } from "express-validator"; 

import { 
  registerUser, 
  loginUser, 
  sendRegistrationOtp, 
  verifyOtpAndRegister, 
  sendForgotPasswordOtp, 
  resetPasswordWithOtp,
  googleAuth,         
} from "../controllers/userController.js";

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Invalid Email"),
    body("fullName.firstName")
      .isLength({ min: 3 })
      .withMessage("First Name must be at least 3 characters long"),
    body("fullName.lastName")
      .optional()
      .isLength({ min: 3 })
      .withMessage("Last Name must be at least 3 characters long"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  registerUser
);

router.post(
  "/login", 
  [
     body("email").isEmail().withMessage("Invalid Email"),
     body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  loginUser
);


router.post("/register/send-otp", sendRegistrationOtp);
router.post("/register/verify-otp", verifyOtpAndRegister);


router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", resetPasswordWithOtp);

router.post("/google-auth", googleAuth);

export default router; 



