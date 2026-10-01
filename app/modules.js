// Application composition is the only frontend place that imports modules.
import content from '../modules/content/index.js';
import calendar from '../modules/calendar/index.js?v=20261001-2';

export default [content, calendar];
