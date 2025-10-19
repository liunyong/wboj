process.env.NODE_ENV = 'test';
process.env.JUDGE0_MAX_CONCURRENCY = process.env.JUDGE0_MAX_CONCURRENCY || '4';
process.env.JUDGE0_MAX_RETRIES = process.env.JUDGE0_MAX_RETRIES || '1';
process.env.MONGOMS_IP = '127.0.0.1';
process.env.MONGOMS_BIND_IP = '127.0.0.1';
process.env.MONGOMS_DISABLE_DEFAULT_PORT = 'true';
process.env.MONGOMS_DISABLE_PORT_CHECK = 'true';

import net from 'node:net';

const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function patchedListen(...args) {
  if (args.length > 0) {
    const [arg0, arg1, arg2] = args;
    if (typeof arg0 === 'number') {
      // listen(port[, host][, backlog][, callback])
      const port = arg0;
      if (typeof arg1 === 'function' || arg1 === undefined) {
        const cb = typeof arg1 === 'function' ? arg1 : typeof arg2 === 'function' ? arg2 : undefined;
        return originalListen.call(this, port, '127.0.0.1', cb);
      }
      if (typeof arg1 === 'number') {
        const backlog = arg1;
        const cb = typeof arg2 === 'function' ? arg2 : undefined;
        return originalListen.call(this, port, '127.0.0.1', backlog, cb);
      }
    } else if (typeof arg0 === 'object' && arg0 !== null) {
      const options = { ...arg0 };
      if (!options.host) {
        options.host = '127.0.0.1';
      }
      return originalListen.call(this, options, arg1, arg2);
    }
  }

  return originalListen.apply(this, args);
};
