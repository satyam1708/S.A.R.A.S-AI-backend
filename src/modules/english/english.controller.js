// src/modules/english/english.controller.js
import * as EnglishService from './english.service.js';
import logger from '../../lib/logger.js';

/**
 * Get Dose for Today (Auto-generates if missing)
 */
export const getTodayDose = async (req, res) => {
  try {
    const dose = await EnglishService.getDailyDose(new Date());
    res.json(dose);
  } catch (error) {
    logger.error(`Get Today Dose Error: ${error.message}`);
    res.status(500).json({ message: "Failed to load daily dose." });
  }
};

/**
 * Get Dose by specific Date (YYYY-MM-DD)
 */
export const getDoseByDate = async (req, res) => {
  try {
    const { date } = req.query; // Validated by middleware
    const dose = await EnglishService.getDailyDose(date);
    
    if (!dose) {
      return res.status(404).json({ message: "No content found for this date." });
    }
    res.json(dose);
  } catch (error) {
    logger.error(`Get Dose By Date Error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const history = await EnglishService.getHistory();
    res.json(history);
  } catch (error) {
    logger.error(`Get History Error: ${error.message}`);
    res.status(500).json({ message: "Failed to fetch history." });
  }
};

export const getDoseById = async (req, res) => {
  try {
    const dose = await EnglishService.getDoseById(req.params.id);
    if (!dose) return res.status(404).json({ message: "Dose not found" });
    res.json(dose);
  } catch (error) {
    logger.error(`Get Dose By ID Error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};