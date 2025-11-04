import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';

const DEFAULT_HOST = '127.0.0.1';

class FakeSocket extends Duplex {
  constructor() {
    super();
    this.remoteAddress = DEFAULT_HOST;
    this.remotePort = 0;
    this.localAddress = DEFAULT_HOST;
    this.localPort = 0;
    this.encrypted = false;
    this.buffer = [];
  }

  _read() {}

  _write(chunk, encoding, callback) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    this.buffer.push(buf);
    callback();
  }

  setTimeout() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  address() {
    return { address: DEFAULT_HOST, family: 'IPv4', port: 0 };
  }

  cork() {}

  uncork() {}

  destroy(error) {
    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
    super.destroy(error);
  }
}

const lowerCaseHeaders = (headers = {}) => {
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
};

const prepareBody = (body, headers) => {
  if (body === undefined || body === null) {
    return null;
  }

  if (Buffer.isBuffer(body)) {
    headers['content-length'] = body.length;
    return body;
  }

  if (typeof body === 'string') {
    headers['content-length'] = Buffer.byteLength(body);
    headers['content-type'] = headers['content-type'] || 'text/plain; charset=utf-8';
    return Buffer.from(body);
  }

  const json = JSON.stringify(body);
  headers['content-length'] = Buffer.byteLength(json);
  headers['content-type'] = headers['content-type'] || 'application/json; charset=utf-8';
  return Buffer.from(json);
};

export const sendRequest = (app, { method, path, headers, body } = {}) =>
  new Promise((resolve, reject) => {
    const lowerHeaders = lowerCaseHeaders(headers);
    if (!lowerHeaders.host) {
      lowerHeaders.host = `${DEFAULT_HOST}`;
    }

    const bodyBuffer = prepareBody(body, lowerHeaders);
    const socket = new FakeSocket();
    const req = new IncomingMessage(socket);
    req.method = method.toUpperCase();
    req.url = path;
    req.originalUrl = path;
    req.headers = lowerHeaders;
    req.connection = req.socket = socket;
    req.httpVersion = '1.1';

    if (bodyBuffer) {
      req.push(bodyBuffer);
    }
    req.push(null);

    const res = new ServerResponse(req);
    res.assignSocket(socket);

    const cleanup = () => {
      res.detachSocket(socket);
    };

    req.res = res;
    res.req = req;
    res.locals = Object.create(null);

    const resolveResponse = () => {
      try {
        const raw = Buffer.concat(socket.buffer);
        let bodyBufferResult = raw;
        let headersObj = {};
        let text = '';

        if (raw.length) {
          const rawStr = raw.toString();
          const separatorIndex = rawStr.indexOf('\r\n\r\n');
          if (separatorIndex !== -1) {
            const headerPart = rawStr.slice(0, separatorIndex);
            const headerLines = headerPart.split('\r\n');
            headerLines.shift(); // remove status line
            headersObj = headerLines.reduce((acc, line) => {
              const idx = line.indexOf(':');
              if (idx === -1) return acc;
              const key = line.slice(0, idx).trim().toLowerCase();
              const value = line.slice(idx + 1).trim();
              acc[key] = value;
              return acc;
            }, {});
            bodyBufferResult = raw.slice(separatorIndex + 4);
          }
        }

        text = bodyBufferResult.toString();
        let parsedBody = text;
        const contentType = headersObj['content-type'] || '';
        if (contentType.includes('application/json') && text) {
          try {
            parsedBody = JSON.parse(text);
          } catch {
            parsedBody = text;
          }
        }

        resolve({
          status: res.statusCode,
          headers: headersObj,
          body: parsedBody,
          text,
        });
      } catch (error) {
        reject(error);
      }
    };

    res.on('finish', () => {
      cleanup();
      resolveResponse();
    });

    res.on('error', (error) => {
      cleanup();
      reject(error);
    });

    req.on('error', (error) => {
      cleanup();
      reject(error);
    });

    try {
      app(req, res, (err) => {
        cleanup();
        if (err) {
          reject(err);
        } else if (!res.writableEnded) {
          res.statusCode = res.statusCode || 404;
          res.end();
        }
      });
    } catch (err) {
      reject(err);
    }
  });

export const createClient = (app) => ({
  request: (method, path, options = {}) =>
    sendRequest(app, { method, path, ...options }),
  get: (path, options) => sendRequest(app, { method: 'GET', path, ...options }),
  post: (path, options) => sendRequest(app, { method: 'POST', path, ...options }),
  put: (path, options) => sendRequest(app, { method: 'PUT', path, ...options }),
  patch: (path, options) => sendRequest(app, { method: 'PATCH', path, ...options }),
  delete: (path, options) => sendRequest(app, { method: 'DELETE', path, ...options }),
});
