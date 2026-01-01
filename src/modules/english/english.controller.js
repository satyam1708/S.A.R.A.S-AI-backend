// src/modules/english/english.controller.js
import * as EnglishService from './english.service.js';
import logger from '../../lib/logger.js'; // Enterprise Logger

/**
 * Gets the dose for "Today" (Server Time normalized to start of day)
 */
export const getTodayDose = async (req, res) => {
  try {
    const dose = await EnglishService.getDailyDose(new Date());
    res.json(dose);
  } catch (error) {
    logger.error(`Get Today's Dose Failed: ${error.message}`);
    res.status(500).json({ message: "Failed to fetch English dose." });
  }
};

/**
 * Gets a specific dose by Date string (YYYY-MM-DD)
 */
export const getDoseByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required (YYYY-MM-DD)" });

    const dose = await EnglishService.getDailyDose(new Date(date));
    res.json(dose);
  } catch (error) {
    logger.error(`Get Dose By Date Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Gets list of past doses (History)
 */
export const getHistory = async (req, res) => {
  try {
    const history = await EnglishService.getHistory();
    res.json(history);
  } catch (error) {
    logger.error(`Get English History Failed: ${error.message}`);
    res.status(500).json({ message: "Failed to fetch history." });
  }
};

/**
 * Gets a specific dose by ID
 */
export const getDoseById = async (req, res) => {
  try {
    const dose = await EnglishService.getDoseById(req.params.id);
    if (!dose) return res.status(404).json({ message: "Dose not found" });
    res.json(dose);
  } catch (error) {
    logger.error(`Get Dose By ID Failed: ${error.message}`);
    res.status(500).json({ message: "Failed to fetch dose." });
  }
};