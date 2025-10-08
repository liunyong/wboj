import { createRequire } from 'module';

let AdmZipModule;

try {
  const require = createRequire(import.meta.url);
  const imported = require('adm-zip');
  AdmZipModule = imported?.default ?? imported;
} catch (error) {
  class StubZip {
    constructor() {
      throw new Error('ZIP support is not available in this environment');
    }
  }
  StubZip.getEntries = () => [];
  AdmZipModule = StubZip;
}

export default AdmZipModule;
