self.options = {
  "domain": "5gvci.com",
  "zoneId": 10966165
};
self.lary = "";

try {
  importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');
} catch (e) {
  // Remote ad script failed — continue silently
}
