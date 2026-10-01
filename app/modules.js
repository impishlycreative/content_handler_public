// Application composition is the only frontend place that imports modules.
import content from '../modules/content/index.js';
import calendar from '../modules/calendar/index.js';

export default [content, calendar];
