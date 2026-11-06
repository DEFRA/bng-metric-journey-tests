// A CDP Uploader that never finishes scanning, for the resilience tests.
//
// Every request is passed to the real uploader, so starting an upload works as
// normal, except a status check, which always answers "pending". A test points
// the backend's uploader proxy here to reach the frontend's "file check timed
// out" message with the uploader otherwise healthy.

import http from 'node:http'

const PORT = 8080
const UPLOADER = new URL(process.env.UPLOADER_URL ?? 'http://cdp-uploader:7337')
const STATUS_PATH = /^\/status\/[^/]+$/

http
  .createServer((req, res) => {
    if (req.method === 'GET' && STATUS_PATH.test(req.url)) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ uploadStatus: 'pending', numberOfRejectedFiles: 0 }))
      return
    }

    const upstream = http.request(
      {
        host: UPLOADER.hostname,
        port: UPLOADER.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: UPLOADER.host }
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers)
        upstreamRes.pipe(res)
      }
    )
    upstream.on('error', () => {
      res.writeHead(502)
      res.end()
    })
    req.pipe(upstream)
  })
  .listen(PORT)
