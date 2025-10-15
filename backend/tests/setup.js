process.env.NODE_ENV = 'test';
process.env.JUDGE0_MAX_CONCURRENCY = process.env.JUDGE0_MAX_CONCURRENCY || '4';
process.env.JUDGE0_MAX_RETRIES = process.env.JUDGE0_MAX_RETRIES || '1';
process.env.MONGOMS_IP = '127.0.0.1';
process.env.MONGOMS_BIND_IP = '127.0.0.1';
process.env.MONGOMS_DISABLE_DEFAULT_PORT = 'true';
process.env.MONGOMS_DISABLE_PORT_CHECK = 'true';
