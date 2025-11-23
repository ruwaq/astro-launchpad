import handler from './api/index.js';

const mockReq = {
  method: 'GET',
  url: '/health',
  headers: { 'content-type': 'application/json' }
};

const mockRes = {
  statusCode: 200,
  headers: {},
  headersSent: false,
  setHeader(key, value) {
    this.headers[key] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log('Response:', JSON.stringify(data, null, 2));
    return this;
  },
  end() {
    console.log('Response ended');
  }
};

console.log('Testing handler...');
handler(mockReq, mockRes).catch(err => {
  console.error('Handler test failed:', err);
  process.exit(1);
});
