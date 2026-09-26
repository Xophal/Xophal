// Shared SQL helpers: escaping, deterministic UUIDs, JSONB literals.
const crypto = require('crypto');
function q(s) { return String(s == null ? '' : s).replace(/'/g, "''"); }
function uuid(seed) {
  const h = crypto.createHash('sha1').update(String(seed)).digest('hex');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
}
function jbDollar(obj) { return '$json$' + JSON.stringify(obj) + '$json$'; }
module.exports = { q, uuid, jbDollar };
