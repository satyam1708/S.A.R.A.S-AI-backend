// src/modules/bookmarks/bookmarks.controller.js
import * as BookmarkService from "./bookmarks.service.js";
import logger from "../../lib/logger.js"; // Enterprise Logger

export const addBookmark = async (req, res) => {
  try {
    const bookmark = await BookmarkService.create(req.user.id, req.body);
    logger.info(`Bookmark added: ${bookmark.title} [User: ${req.user.id}]`);
    res.status(201).json({ message: "Bookmark added", data: bookmark });
  } catch (error) {
    // 409 Conflict (Already exists) is a common case here
    if (error.statusCode === 409) {
      logger.warn(`Duplicate bookmark attempt: ${req.body.url} [User: ${req.user.id}]`);
      return res.status(409).json({ message: error.message });
    }
    
    logger.error(`Bookmark Add Failed: ${error.message}`);
    res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
  }
};

export const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await BookmarkService.getByUserId(req.user.id);
    res.json(bookmarks);
  } catch (error) {
    logger.error(`Bookmark Fetch Failed: ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteBookmark = async (req, res) => {
  try {
    const { url } = req.body;
    await BookmarkService.deleteByUserAndUrl(req.user.id, url);
    
    logger.info(`Bookmark deleted: ${url} [User: ${req.user.id}]`);
    res.json({ message: "Bookmark deleted" });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    logger.error(`Bookmark Delete Failed: ${error.message}`);
    res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
  }
};

export const getPublicBookmarks = async (req, res) => {
  try {
    const bookmarks = await BookmarkService.getPublicBookmarks();
    res.json(bookmarks);
  } catch (error) {
    logger.error(`Public Bookmarks Fetch Failed: ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};