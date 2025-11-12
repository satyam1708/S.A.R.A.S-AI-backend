// A simple helper function to format dates into "X time ago"
// We'll use this in the frontend, but it's good practice
// to have utils in one place. Let's add it to the backend
// utils, even though we'll copy it to the frontend.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 12 * MONTH;

export const timeAgo = (date) => {
  const ts = new Date(date).getTime();
  const now = new Date().getTime();
  const diff = now - ts;

  if (diff < MINUTE) {
    return 'just now';
  }
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diff < MONTH) {
    const days = Math.floor(diff / DAY);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (diff < YEAR) {
    const months = Math.floor(diff / MONTH);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diff / YEAR);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};