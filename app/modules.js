// Application composition is the only frontend place that imports modules.
import content from '../modules/content/index.js?v=20261003-3';
import calendar from '../modules/calendar/browser.js?v=20261006-1';
import users from '../modules/users/index.js?v=20261003-8';
import newsletter from '../modules/newsletter/index.js?v=20261003-5';

export default [content, calendar, users, newsletter];
