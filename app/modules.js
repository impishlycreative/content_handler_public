// Application composition is the only frontend place that imports modules.
import content from '../modules/content/index.js?v=20261003-3';
import calendar from '../modules/calendar/guest-speaker.js?v=20261104-fenced-json';
import users from '../modules/users/index.js?v=20261003-8';
import newsletter from '../modules/newsletter/index.js?v=20261107-import-timeout';

export default [content, calendar, users, newsletter];
