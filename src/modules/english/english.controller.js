import * as EnglishService from './english.service.js';

export const getTodayDose = async (req, res) => {
  try {
    const dose = await EnglishService.getDailyDose(new Date());
    res.json(dose);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const history = await EnglishService.getHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDoseById = async (req, res) => {
  try {
    const dose = await EnglishService.getDoseById(req.params.id);
    res.json(dose);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};