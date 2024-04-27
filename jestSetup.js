require("blob-polyfill");
require("whatwg-fetch");
const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
window.MessageChannel = require("worker_threads").MessageChannel;
