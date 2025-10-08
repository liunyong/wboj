import { createRequire } from 'module';

let multerModule;

try {
  const require = createRequire(import.meta.url);
  const imported = require('multer');
  multerModule = imported?.default ?? imported;
} catch (error) {
  const stub = () => ({
    single: () => (req, _res, next) => {
      req.file = null;
      next();
    }
  });
  stub.memoryStorage = () => ({});
  multerModule = stub;
}

export default multerModule;
