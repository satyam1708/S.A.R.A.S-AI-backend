import * as BookmarkService from './bookmarks.service.js';

export const addBookmark = async (req, res) => {
  try {
    const bookmark = await BookmarkService.create(req.user.id, req.body);
    res.status(201).json({ message: 'Bookmark added' });
  } catch (error) {
    console.error('Bookmark add error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

export const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await BookmarkService.getByUserId(req.user.id);
    res.json(bookmarks);
  } catch (error) {
    console.error('Bookmark fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteBookmark = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'Bookmark URL required' });

    await BookmarkService.deleteByUserAndUrl(req.user.id, url);
    res.json({ message: 'Bookmark deleted' });
  } catch (error) {
    console.error('Bookmark delete error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};
export const getPublicBookmarks = async (req, res) => {
  try {
    const bookmarks = await BookmarkService.getPublicBookmarks();
    res.json(bookmarks);
  } catch (error) {
    console.error('Public bookmarks fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};