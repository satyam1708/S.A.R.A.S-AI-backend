import * as AuthService from './auth.service.js';
import logger from '../../lib/logger.js';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // Input is already validated by Zod middleware
    
    const user = await AuthService.register(name, email, password);
    
    logger.info(`New user registered: ${email}`);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    logger.error(`Register Failed: ${error.message}`);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await AuthService.login(email, password);
    
    logger.info(`User logged in: ${email}`);
    res.json({ token, user });
  } catch (error) {
    logger.warn(`Login Failed for ${req.body.email}: ${error.message}`);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await AuthService.getProfileById(req.user.id);
    res.json(user);
  } catch (error) {
    logger.error(`Profile Error [User:${req.user.id}]: ${error.message}`);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const selectCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    const updatedUser = await AuthService.updateUserCourse(userId, courseId);
    
    logger.info(`User ${userId} selected course ${courseId}`);
    
    res.json({
      message: "Course goal updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        selectedCourse: updatedUser.selectedCourse
      }
    });
  } catch (error) {
    logger.error(`Select Course Error [User:${req.user.id}]: ${error.message}`);
    res.status(500).json({ error: "Failed to update course selection" });
  }
};