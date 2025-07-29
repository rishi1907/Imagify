import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import razorpay from 'razorpay';
import transactionModel from "../models/transactionModel.js";

// REGISTER USER
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.json({ success: false, message: 'Missing credentials' });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await userModel.create({
      name,
      email,
      password: hashedPassword
      // creditBalance defaults to 5 via schema
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);

    res.status(201).json({
      success: true,
      token,
      user: {
        name: newUser.name,
        creditBalance: newUser.creditBalance
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// LOGIN USER
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: 'User does not exist' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({
      success: true,
      token,
      user: {
        name: user.name,
        creditBalance: user.creditBalance
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// GET USER CREDITS
const userCredits = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      credits: user.creditBalance,
      user: {
        name: user.name
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// RAZORPAY INSTANCE
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// INITIATE PAYMENT
const paymentRazorpay = async (req, res) => {
  try {
    const { userId, planId } = req.body;
    if (!userId || !planId) {
      return res.json({ success: false, message: 'Details missing' });
    }

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.json({ success: false, message: 'User not found' });
    }

    let credits, plan, amount;
    switch (planId) {
      case 'Basic':
        credits = 100;
        plan = 'Basic';
        amount = 10;
        break;
      case 'Advanced':
        credits = 500;
        plan = 'Advanced';
        amount = 50;
        break;
      case 'Business':
        credits = 5000;
        plan = 'Business';
        amount = 250;
        break;
      default:
        return res.json({ success: false, message: 'Invalid plan' });
    }

    const transactionData = await transactionModel.create({
      userId,
      plan,
      credits,
      amount,
      date: Date.now()
    });

    const options = {
      amount: amount * 100,
      currency: process.env.CURRENCY,
      receipt: transactionData._id.toString()
    };

    razorpayInstance.orders.create(options, (error, order) => {
      if (error) {
        console.log(error);
        return res.json({ success: false, message: 'Payment error' });
      }
      res.json({ success: true, order });
    });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// VERIFY PAYMENT
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

    if (orderInfo.status === 'paid') {
      const transactionData = await transactionModel.findById(orderInfo.receipt);
      if (!transactionData || transactionData.payment) {
        return res.json({ success: false, message: 'Payment already processed' });
      }

      const userData = await userModel.findById(transactionData.userId);
      const updatedCredits = userData.creditBalance + transactionData.credits;

      await userModel.findByIdAndUpdate(userData._id, { creditBalance: updatedCredits });
      await transactionModel.findByIdAndUpdate(transactionData._id, { payment: true });

      res.json({ success: true, message: 'Credits added successfully' });
    } else {
      res.json({ success: false, message: 'Payment failed' });
    }
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  registerUser,
  loginUser,
  userCredits,
  paymentRazorpay,
  verifyRazorpay
};
