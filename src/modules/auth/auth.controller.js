// Handles (req, res) logic
import * as AuthService from './auth.service.js';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    const user = await AuthService.register(name, email, password);
    res.status(201).json({ message: 'User registered', user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const { token, user } = await AuthService.login(email, password);
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await AuthService.getProfileById(req.user.id);
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const selectCourse = async (req, res) => {
  try {
    const userId = req.user.id; // Coming from auth middleware
    const { courseId } = req.body;

    if (!courseId) return res.status(400).json({ error: "Course ID is required" });

    const updatedUser = await authService.updateUserCourse(userId, courseId);
    
    res.json({
      message: "Course goal updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        selectedCourse: updatedUser.selectedCourse
      }
    });
  } catch (error) {
    console.error("Select Course Error:", error);
    res.status(500).json({ error: "Failed to update course selection" });
  }
};