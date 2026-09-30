'use strict';

module.exports = {
hooks: {
readPackage(pkg) {
if (pkg.name === 'query-string' && pkg.version === '7.1.3') {
delete pkg.dependencies?.['decode-uri-component'];
}

return pkg;
},
},
};