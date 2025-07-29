import express from 'express'
import {
    userCredits,
    registerUser,
    loginUser,
    paymentStripe,
    verifyStripe
} from '../controllers/userController.js'
import authUser from '../middlewares/auth.js'

const userRouter = express.Router()

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/credits', authUser, userCredits)
userRouter.post('/pay-stripe', authUser, paymentStripe)
userRouter.post('/verify-stripe', authUser, verifyStripe)

export default userRouter