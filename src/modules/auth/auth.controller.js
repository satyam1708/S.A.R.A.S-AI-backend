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