/**
 * Mischief
 * @module browser-scripts
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Entry point for the browser-scripts module. Functions in this module are meant to be executed by Playwright during capture.
 */
import { autoPlayMedia } from "./autoPlayMedia.js";
import { autoScroll } from "./autoScroll.js";
import { listAllStylesheets } from "./listAllStylesheets.js";
import { listMediaSources } from "./listMediaSources.js";
import { listResponsiveImages } from "./listResponsiveImages.js";

export {
  autoPlayMedia,
  autoScroll,
  listAllStylesheets,
  listMediaSources,
  listResponsiveImages
};